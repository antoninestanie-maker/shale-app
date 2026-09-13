// ─────────────────────────────────────────────────────────────────────────────
// Signature d'un profil de licence — ECDSA P-256 / SHA-256, par WebCrypto.
//
// Pourquoi signer, alors que le profil ne fait que RESTREINDRE ? Parce que le
// profil est ce qu'un client a acheté pour ses équipes : sans signature,
// n'importe quel poste pourrait effacer son cache, ou en écrire un autre, et
// retirer les restrictions que l'entreprise a demandées. La synchronisation
// chiffrée n'y change rien — l'utilisateur détient la clé.
//
// Pourquoi ECDSA P-256 et pas Ed25519 : `crypto.subtle` le vérifie sur TOUTES
// les cibles de l'app (WebKit macOS 14, WKWebView iOS, WebView2, Node des
// tests), sans aucune dépendance. Ed25519 n'est arrivé que récemment dans
// WebKit, et une vérification qui échoue sur un moteur ne se voit pas : elle
// dégrade en silence vers le palier nu, chez le seul client qui a payé pour
// autre chose.
//
// ⚠️ Le MESSAGE SIGNÉ n'est pas un JSON re-sérialisé : c'est le texte exact
// stocké, champ par champ, séparé par des sauts de ligne. Re-sérialiser un JSON
// avant de vérifier ferait dépendre la signature de l'ordre des clés et des
// espaces — deux moteurs différents, deux verdicts.
// ─────────────────────────────────────────────────────────────────────────────

/** Une ligne de profil, telle que le serveur la délivre et que la base la garde. */
export interface LigneProfil {
  /** Identifiant du COMPTE Supabase auquel le profil est destiné. */
  uid: string;
  /** Palier pour lequel le profil a été émis (`shale` · `shale_trade`). */
  tier: string;
  profile_version: number;
  /** ISO 8601, texte exact tel que signé. */
  issued_at: string;
  expires_at: string;
  /** Texte JSON exact tel que signé — jamais re-sérialisé. */
  payload: string;
  /** Signature ECDSA brute (r‖s, 64 octets), en base64. */
  signature: string;
}

const DOMAINE = "shale-licence-profil/v1";

/**
 * Les octets signés. Le préfixe de domaine empêche qu'une signature produite
 * pour autre chose, avec la même clé, soit présentée comme un profil.
 */
export function messageSigne(l: Omit<LigneProfil, "signature">): Uint8Array {
  const texte = [
    DOMAINE,
    l.uid,
    l.tier,
    String(l.profile_version),
    l.issued_at,
    l.expires_at,
    l.payload,
  ].join("\n");
  return new TextEncoder().encode(texte);
}

/** Clé publique sous forme JWK — la seule forme que les deux côtés échangent. */
export interface ClePubliqueJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}

const ALGO_CLE = { name: "ECDSA", namedCurve: "P-256" } as const;
const ALGO_SIGNATURE = { name: "ECDSA", hash: "SHA-256" } as const;

function subtle(): SubtleCrypto | null {
  return typeof globalThis.crypto?.subtle === "object" ? globalThis.crypto.subtle : null;
}

export function versBase64(octets: ArrayBuffer | Uint8Array): string {
  const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}

function depuisBase64(b64: string): Uint8Array | null {
  try {
    const s = atob(b64);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  } catch {
    return null;
  }
}

/**
 * La signature est-elle valide pour AU MOINS une des clés acceptées ?
 *
 * Plusieurs clés : c'est ce qui permettra de changer de clé de signature sans
 * invalider d'un coup tous les profils en circulation (on publie la nouvelle,
 * on attend l'expiration des anciens profils, on retire l'ancienne).
 *
 * Ne lève JAMAIS : une clé mal formée, une signature tronquée ou un moteur sans
 * WebCrypto rendent `false`. La dégradation est silencieuse par contrat.
 */
export async function signatureValide(
  ligne: LigneProfil,
  cles: readonly ClePubliqueJwk[],
): Promise<boolean> {
  const s = subtle();
  const sig = depuisBase64(ligne.signature);
  if (!s || !sig || sig.length !== 64 || !cles.length) return false;
  const message = messageSigne(ligne);
  for (const jwk of cles) {
    try {
      const cle = await s.importKey("jwk", jwk as JsonWebKey, ALGO_CLE, false, ["verify"]);
      if (await s.verify(ALGO_SIGNATURE, cle, sig, message)) return true;
    } catch {
      /* clé suivante */
    }
  }
  return false;
}

/**
 * Signe une ligne. Sert au mode démo (clé éphémère) et aux tests ; l'outil
 * d'émission (`tools/licence-profil.mjs`) produit exactement les mêmes octets.
 */
export async function signerLigne(
  ligne: Omit<LigneProfil, "signature">,
  clePrivee: CryptoKey,
): Promise<LigneProfil> {
  const s = subtle();
  if (!s) throw new Error("WebCrypto indisponible");
  const sig = await s.sign(ALGO_SIGNATURE, clePrivee, messageSigne(ligne));
  return { ...ligne, signature: versBase64(sig) };
}

/** Paire de clés neuve, la publique rendue en JWK. */
export async function genererPaire(): Promise<{ privee: CryptoKey; publique: ClePubliqueJwk }> {
  const s = subtle();
  if (!s) throw new Error("WebCrypto indisponible");
  const paire = await s.generateKey(ALGO_CLE, true, ["sign", "verify"]);
  const jwk = await s.exportKey("jwk", paire.publicKey);
  return {
    privee: paire.privateKey,
    publique: { kty: "EC", crv: "P-256", x: jwk.x!, y: jwk.y! },
  };
}
