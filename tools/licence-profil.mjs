#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Émettre un profil de licence — l'outil de l'administration, pas de l'app.
//
//   node tools/licence-profil.mjs cles <dossier>
//       Tire une paire ECDSA P-256. Écrit `cle-privee.jwk` (droits 600) et
//       `cle-publique.jwk` dans <dossier>, et affiche la clé publique à coller
//       dans `src/lib/licence/cles.ts`. Refuse d'écraser une clé existante.
//
//   node tools/licence-profil.mjs emettre \
//       --cle <cle-privee.jwk> --compte <uuid Supabase> --palier shale|shale_trade \
//       --version <entier> --expire <AAAA-MM-JJ> --payload <fichier.json> [--json]
//       Signe le profil et affiche le SQL à coller dans Supabase Studio →
//       SQL Editor (ou la ligne signée en JSON avec --json).
//
// Aucune dépendance : WebCrypto de Node 22. ⚠️ Le MESSAGE SIGNÉ doit rester
// identique octet pour octet à `messageSigne()` de `src/lib/licence/
// signature.ts` — `src/lib/licence/outil.test.ts` exécute cet outil et vérifie
// sa signature avec le code de l'app. Toucher l'un sans l'autre fait échouer ce
// test, et c'est son rôle.
//
// ⚠️ La clé privée ne va JAMAIS dans un dépôt git. Qui la détient peut émettre
// un profil pour n'importe quel compte.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;
const DOMAINE = "shale-licence-profil/v1";
const PALIERS = new Set(["shale", "shale_trade"]);

function messageSigne(l) {
  return new TextEncoder().encode(
    [DOMAINE, l.uid, l.tier, String(l.profile_version), l.issued_at, l.expires_at, l.payload].join(
      "\n",
    ),
  );
}

function arguments_(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const cle = argv[i].slice(2);
      const suivant = argv[i + 1];
      if (suivant === undefined || suivant.startsWith("--")) out[cle] = true;
      else {
        out[cle] = suivant;
        i++;
      }
    }
  }
  return out;
}

function echec(msg) {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
}

/** Échappement SQL par dollar-quoting : le payload peut contenir des apostrophes. */
function litteral(texte) {
  let tag = "p";
  while (texte.includes(`$${tag}$`)) tag += "p";
  return `$${tag}$${texte}$${tag}$`;
}

async function cles(dossier) {
  if (!dossier) echec("dossier manquant : node tools/licence-profil.mjs cles <dossier>");
  const prive = join(dossier, "cle-privee.jwk");
  if (existsSync(prive)) echec(`${prive} existe déjà — une clé ne s'écrase pas.`);
  mkdirSync(dossier, { recursive: true });
  const paire = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwkPrive = await subtle.exportKey("jwk", paire.privateKey);
  const jwkPublic = await subtle.exportKey("jwk", paire.publicKey);
  writeFileSync(prive, JSON.stringify(jwkPrive, null, 2) + "\n", { mode: 0o600 });
  chmodSync(prive, 0o600);
  const publique = { kty: "EC", crv: "P-256", x: jwkPublic.x, y: jwkPublic.y };
  writeFileSync(join(dossier, "cle-publique.jwk"), JSON.stringify(publique, null, 2) + "\n");
  process.stdout.write(JSON.stringify(publique) + "\n");
}

async function emettre(a) {
  for (const requis of ["cle", "compte", "palier", "version", "expire", "payload"])
    if (typeof a[requis] !== "string") echec(`--${requis} manquant`);
  if (!/^[0-9a-f-]{36}$/i.test(a.compte) && !a["compte-libre"]) echec("--compte : UUID attendu");
  if (!PALIERS.has(a.palier)) echec("--palier : shale ou shale_trade");
  const version = Number(a.version);
  if (!Number.isInteger(version) || version < 1) echec("--version : entier ≥ 1");
  const expire = new Date(a.expire.length === 10 ? `${a.expire}T23:59:59Z` : a.expire);
  if (Number.isNaN(expire.getTime())) echec("--expire : date invalide");

  const payload = readFileSync(a.payload, "utf-8").trim();
  try {
    const o = JSON.parse(payload);
    if (typeof o !== "object" || o === null || Array.isArray(o)) throw new Error();
  } catch {
    echec("--payload : le fichier n'est pas un objet JSON");
  }

  const jwk = JSON.parse(readFileSync(a.cle, "utf-8"));
  const cle = await subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
  const ligne = {
    uid: a.compte,
    tier: a.palier,
    profile_version: version,
    issued_at: typeof a.emis === "string" ? a.emis : new Date().toISOString(),
    expires_at: expire.toISOString(),
    payload,
  };
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cle, messageSigne(ligne));
  ligne.signature = Buffer.from(sig).toString("base64");

  if (a.json) {
    process.stdout.write(JSON.stringify(ligne) + "\n");
    return;
  }
  process.stdout.write(
    [
      `-- Profil de licence v${version} pour ${a.compte}, valable jusqu'au ${ligne.expires_at}`,
      "insert into public.license_profiles",
      "  (user_id, tier, profile_version, issued_at, expires_at, payload, signature)",
      "values (",
      `  '${ligne.uid}', '${ligne.tier}', ${version},`,
      `  '${ligne.issued_at}', '${ligne.expires_at}',`,
      `  ${litteral(payload)},`,
      `  '${ligne.signature}'`,
      ")",
      "on conflict (user_id) do update set",
      "  tier = excluded.tier, profile_version = excluded.profile_version,",
      "  issued_at = excluded.issued_at, expires_at = excluded.expires_at,",
      "  payload = excluded.payload, signature = excluded.signature, updated_at = now();",
      "",
    ].join("\n"),
  );
}

const [commande, ...reste] = process.argv.slice(2);
if (commande === "cles") await cles(reste[0]);
else if (commande === "emettre") await emettre(arguments_(reste));
else echec("commande : cles <dossier> | emettre --cle … --compte … --palier … --version … --expire … --payload …");
