// ─────────────────────────────────────────────────────────────────────────────
// Vérifie sur le VRAI projet Supabase ce que les tests ne peuvent pas atteindre.
//
// Les 17 tests de `supabase.test.ts` exécutent `sync.sql` pour de bon, mais sous
// PGlite : Postgres, oui — Supabase, non. Trois choses restent donc invérifiées
// là-bas, et ce sont exactement celles qui peuvent corrompre des données en
// silence :
//
//   1. LE RENDU POSTGREST DU `bytea`. Attendu : hexadécimal préfixé
//      (`"\\x48656c…"`). Du base64 serait accepté sans erreur, stocké comme du
//      TEXTE, et illisible à la relecture — la corruption se découvrirait des
//      semaines plus tard, sur l'autre appareil, sans aucun moyen de savoir ce
//      qui avait été écrit. C'est le contrôle n°1, et le seul irrattrapable.
//   2. LES POLITIQUES DU BUCKET Storage, simulées dans `supabase.testutil.ts`.
//   3. Que le schéma soit RÉELLEMENT joué sur ce projet-ci.
//
// ⚠️ AUCUN SECRET N'EST ÉCRIT NI LU DANS LE DÉPÔT. Tout vient de
// l'environnement, le temps d'une commande :
//
//   SHALE_SUPABASE_URL="https://xxxx.supabase.co" \
//   SHALE_SUPABASE_ANON_KEY="eyJ…" \
//   SHALE_TEST_EMAIL="toi@exemple.fr" \
//   SHALE_TEST_PASSWORD='…' \
//   node tools/verifier-sync-supabase.mjs
//
// Le compte de test doit être un VRAI compte du projet : le script se connecte
// par GoTrue et n'agit qu'avec le jeton de cet utilisateur, jamais avec une clé
// `service_role`. C'est délibéré — c'est le chemin que prendra l'app, donc le
// seul dont la réussite prouve quelque chose. Un `service_role` contourne RLS
// et validerait un schéma qui refuserait tous les vrais clients.
//
// Le script ÉCRIT dans `sync_rows` (des lignes de contrôle, préfixées
// `verif-`), puis les efface. Il ne touche jamais à `sync_keys`.
// ─────────────────────────────────────────────────────────────────────────────

const URL_BASE = process.env.SHALE_SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.SHALE_SUPABASE_ANON_KEY;
const EMAIL = process.env.SHALE_TEST_EMAIL;
const MOT_DE_PASSE = process.env.SHALE_TEST_PASSWORD;

if (!URL_BASE || !ANON || !EMAIL || !MOT_DE_PASSE) {
  console.error(
    "Variables manquantes. Attendu : SHALE_SUPABASE_URL, SHALE_SUPABASE_ANON_KEY,\n" +
      "SHALE_TEST_EMAIL, SHALE_TEST_PASSWORD.\n\n" +
      "Ne les écris pas dans un fichier du dépôt : passe-les sur la ligne de commande.",
  );
  process.exit(2);
}

let echecs = 0;
let avertissements = 0;

function ok(quoi, detail = "") {
  console.log(`  ✓ ${quoi}${detail ? ` — ${detail}` : ""}`);
}
function ko(quoi, detail) {
  echecs++;
  console.log(`  ✗ ${quoi}\n      ${detail}`);
}
function attention(quoi, detail) {
  avertissements++;
  console.log(`  ! ${quoi}\n      ${detail}`);
}
function titre(s) {
  console.log(`\n${s}`);
}

// ─── Connexion ───────────────────────────────────────────────────────────────

async function connexion() {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ email: EMAIL, password: MOT_DE_PASSE }),
  });
  if (!res.ok) {
    console.error(`Connexion refusée (${res.status}) : ${await res.text()}`);
    process.exit(2);
  }
  const s = await res.json();
  return { jeton: s.access_token, userId: s.user.id };
}

const { jeton, userId } = await connexion();
const entetes = {
  "Content-Type": "application/json",
  apikey: ANON,
  Authorization: `Bearer ${jeton}`,
};

console.log(`Projet   : ${URL_BASE}`);
console.log(`Compte   : ${EMAIL} (${userId})`);

// ─── 1. Le schéma est-il joué ? ──────────────────────────────────────────────

titre("1. Schéma");

for (const table of ["sync_rows", "sync_keys"]) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&limit=1`, { headers: entetes });
  if (res.ok) ok(`table ${table} présente et lisible`);
  else if (res.status === 404)
    ko(`table ${table} ABSENTE`, "`sync.sql` n'a pas été joué sur ce projet (Studio → SQL Editor).");
  else ko(`table ${table} inaccessible (${res.status})`, await res.text());
}

if (echecs > 0) {
  console.log("\nLe schéma n'est pas en place : les contrôles suivants n'ont pas de sens.");
  process.exit(1);
}

// ─── 2. Le rendu du `bytea` — LE contrôle qui compte ─────────────────────────

titre("2. Format des octets (bytea ↔ PostgREST)");

// Choisi pour piéger les erreurs d'encodage les plus vicieuses :
// 0x00 (fin de chaîne en C), 0x0f (perte du zéro de tête), 0xff (bit de poids
// fort, cassé par un aller-retour UTF-8), 0x5c (`\`, le préfixe lui-même).
const OCTETS = new Uint8Array([0x00, 0x0f, 0x48, 0xff, 0x5c, 0x78, 0x41]);
const HEX = "\\x" + [...OCTETS].map((o) => o.toString(16).padStart(2, "0")).join("");

const TAG_TABLE = "verif-table";
const TAG_LIGNE = `verif-ligne-${Date.now()}`;

async function ecrireLigne(corps) {
  return fetch(`${URL_BASE}/rest/v1/sync_rows`, {
    method: "POST",
    headers: { ...entetes, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([corps]),
  });
}

const base = {
  user_id: userId,
  table_tag: TAG_TABLE,
  row_tag: TAG_LIGNE,
  device_id: "verificateur",
  deleted: false,
};

const ecriture = await ecrireLigne({
  ...base,
  client_ts: new Date(Date.now() - 60_000).toISOString().replace("Z", "Z"),
  payload: HEX,
});

if (!ecriture.ok) {
  ko(`écriture refusée (${ecriture.status})`, await ecriture.text());
} else {
  ok("écriture acceptée");

  const res = await fetch(
    `${URL_BASE}/rest/v1/sync_rows?select=payload,server_seq,client_ts&table_tag=eq.${TAG_TABLE}&row_tag=eq.${TAG_LIGNE}`,
    { headers: entetes },
  );
  const [ligne] = await res.json();

  if (!ligne) {
    ko("relecture vide", "la ligne écrite n'est pas relisible — politique SELECT ?");
  } else if (ligne.payload === HEX) {
    ok("bytea rendu en hexadécimal préfixé", `aller-retour exact sur ${OCTETS.length} octets`);
  } else if (/^[A-Za-z0-9+/]+=*$/.test(ligne.payload ?? "")) {
    // Ce cas est le motif d'existence de ce script.
    ko(
      "bytea rendu en BASE64",
      "`transport.ts` encode et décode en hexadécimal : il lirait n'importe quoi.\n" +
        "      Vérifier le réglage `db-pre-request` / la version de PostgREST du projet.",
    );
  } else {
    ko("bytea rendu dans une forme inattendue", `reçu : ${JSON.stringify(ligne.payload)?.slice(0, 120)}`);
  }

  if (ligne?.server_seq > 0) ok("server_seq posé par le serveur", `= ${ligne.server_seq}`);
  else ko("server_seq non posé", "le trigger `sync_rows_lww_trg` n'est pas actif.");
}

// ─── 3. Le last-write-wins serveur ───────────────────────────────────────────

titre("3. Last-write-wins appliqué par le serveur");

const tsAncien = new Date(Date.now() - 3_600_000).toISOString();
const perimee = await ecrireLigne({ ...base, client_ts: tsAncien, payload: "\\xdeadbeef" });

if (!perimee.ok) {
  ko(`renvoi refusé (${perimee.status})`, await perimee.text());
} else {
  const res = await fetch(
    `${URL_BASE}/rest/v1/sync_rows?select=payload,client_ts&table_tag=eq.${TAG_TABLE}&row_tag=eq.${TAG_LIGNE}`,
    { headers: entetes },
  );
  const [ligne] = await res.json();
  if (ligne?.client_ts === tsAncien) {
    ko(
      "une écriture PÉRIMÉE a écrasé la récente",
      "le trigger LWW ne mord pas : deux appareils qui poussent en même temps\n" +
        "      perdront les données les plus fraîches, en silence.",
    );
  } else {
    ok("une écriture périmée est ignorée", "le renvoi d'un lot est donc idempotent");
  }
}

// ─── 4. Cloisonnement : écrire au nom d'un autre ─────────────────────────────

titre("4. Cloisonnement (RLS)");

const AUTRE = "00000000-0000-4000-8000-000000000000";
const usurpation = await ecrireLigne({
  ...base,
  user_id: AUTRE,
  row_tag: `${TAG_LIGNE}-usurpe`,
  client_ts: new Date().toISOString(),
  payload: HEX,
});

if (usurpation.ok) {
  ko(
    "une ligne a pu être écrite AU NOM d'un autre compte",
    "la politique INSERT de `sync_rows` ne compare pas `auth.uid()` à `user_id`.",
  );
} else {
  ok(`écrire au nom d'un autre est refusé`, `${usurpation.status}`);
}

const anonyme = await fetch(`${URL_BASE}/rest/v1/sync_rows?select=*&limit=1`, {
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
});
const corpsAnonyme = anonyme.ok ? await anonyme.json() : null;
if (Array.isArray(corpsAnonyme) && corpsAnonyme.length > 0) {
  ko("des lignes sont lisibles SANS session", "la politique SELECT laisse passer `anon`.");
} else {
  ok("rien n'est lisible sans session");
}

// ─── 5. Le bucket privé ──────────────────────────────────────────────────────

titre("5. Bucket sync-blobs");

const CHEMIN = `${userId}/verif/${Date.now()}.bin`;

const depot = await fetch(`${URL_BASE}/storage/v1/object/sync-blobs/${CHEMIN}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${jeton}`, "Content-Type": "application/octet-stream" },
  body: OCTETS,
});

if (!depot.ok) {
  const detail = await depot.text();
  if (depot.status === 404) ko("bucket sync-blobs absent", "`sync.sql` crée le bucket : rejouer le fichier.");
  else ko(`dépôt refusé (${depot.status})`, `${detail}\n      politique INSERT de storage.objects ?`);
} else {
  ok("dépôt dans son propre dossier accepté");

  const relecture = await fetch(`${URL_BASE}/storage/v1/object/sync-blobs/${CHEMIN}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jeton}` },
  });
  if (!relecture.ok) {
    ko(`relecture refusée (${relecture.status})`, "politique SELECT de storage.objects ?");
  } else {
    const relus = new Uint8Array(await relecture.arrayBuffer());
    const identiques = relus.length === OCTETS.length && relus.every((o, i) => o === OCTETS[i]);
    if (identiques) ok("relecture octet pour octet");
    else ko("le contenu relu diffère", `${relus.length} octets au lieu de ${OCTETS.length}`);
  }

  // ⚠️ LE contrôle du bucket : privé ne veut pas dire « pas d'URL publique »,
  // ça veut dire que l'URL publique ne SERT RIEN.
  const publique = await fetch(`${URL_BASE}/storage/v1/object/public/sync-blobs/${CHEMIN}`);
  if (publique.ok) {
    ko(
      "le bucket est PUBLIC",
      "n'importe qui peut télécharger les blobs. Ils sont chiffrés, mais rien\n" +
        "      ne justifie de les exposer — mettre le bucket en privé dans Studio.",
    );
  } else {
    ok("l'accès public est refusé", `${publique.status}`);
  }

  // Écrire hors de son dossier doit échouer.
  const horsDossier = await fetch(`${URL_BASE}/storage/v1/object/sync-blobs/${AUTRE}/intrus.bin`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jeton}`, "Content-Type": "application/octet-stream" },
    body: OCTETS,
  });
  if (horsDossier.ok) {
    ko(
      "un dépôt HORS de son dossier a été accepté",
      "la politique ne contraint pas `(storage.foldername(name))[1]`.",
    );
    await fetch(`${URL_BASE}/storage/v1/object/sync-blobs/${AUTRE}/intrus.bin`, {
      method: "DELETE",
      headers: { apikey: ANON, Authorization: `Bearer ${jeton}` },
    });
  } else {
    ok("déposer hors de son dossier est refusé", `${horsDossier.status}`);
  }

  const menage = await fetch(`${URL_BASE}/storage/v1/object/sync-blobs/${CHEMIN}`, {
    method: "DELETE",
    headers: { apikey: ANON, Authorization: `Bearer ${jeton}` },
  });
  if (!menage.ok) attention("objet de contrôle non effacé", `${CHEMIN} (${menage.status})`);
}

// ─── 6. La fonction de purge ─────────────────────────────────────────────────

titre("6. Entretien");

const purge = await fetch(`${URL_BASE}/rest/v1/rpc/sync_purge_tombstones`, {
  method: "POST",
  headers: entetes,
  body: "{}",
});
// Elle doit être INACCESSIBLE aux clients : `revoke all … from authenticated`.
if (purge.ok) {
  attention(
    "sync_purge_tombstones est appelable par un client",
    "`sync.sql` la révoque pour `authenticated` — le `revoke` n'a pas pris.",
  );
} else {
  ok("sync_purge_tombstones hors de portée des clients", `${purge.status}`);
}

// ─── Ménage ──────────────────────────────────────────────────────────────────

const efface = await fetch(
  `${URL_BASE}/rest/v1/sync_rows?table_tag=eq.${TAG_TABLE}&user_id=eq.${userId}`,
  { method: "DELETE", headers: entetes },
);
if (!efface.ok) attention("lignes de contrôle non effacées", `table_tag = ${TAG_TABLE}`);

// ─── Verdict ─────────────────────────────────────────────────────────────────

console.log("");
if (echecs > 0) {
  console.log(`${echecs} contrôle(s) en échec — NE PAS livrer la synchronisation en l'état.`);
  process.exit(1);
}
console.log(
  avertissements > 0
    ? `Tout est conforme, avec ${avertissements} point(s) d'attention ci-dessus.`
    : "Tout est conforme.",
);
