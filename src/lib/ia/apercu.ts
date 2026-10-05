// ─────────────────────────────────────────────────────────────────────────────
// « Ce qui sera envoyé » : le payload tel qu'il part, lisible.
//
// C'est le payload EXACT, pas un résumé qui pourrait diverger — à une
// exception près : un fichier joint (base64) est remplacé par sa description,
// ses octets n'ayant rien à montrer. Le prompt, lui, n'est pas montré : il est
// assemblé par le serveur, et il ne contient rien de l'utilisateur de plus que
// ce payload.
// ─────────────────────────────────────────────────────────────────────────────

import { formatNumber, t } from "../i18n";

function estFichier(v: unknown): v is { media_type: string; data: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).media_type === "string" &&
    typeof (v as Record<string, unknown>).data === "string"
  );
}

function remplacer(v: unknown): unknown {
  if (estFichier(v)) {
    const octets = Math.floor((v.data.length * 3) / 4);
    return t("[fichier {type}, {taille} Ko]", {
      type: v.media_type,
      taille: formatNumber(Math.max(1, Math.round(octets / 1024))),
    });
  }
  if (Array.isArray(v)) return v.map(remplacer);
  if (typeof v === "object" && v !== null)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remplacer(x)]));
  return v;
}

export function apercuDe(payload: unknown): string {
  return JSON.stringify(remplacer(payload), null, 2);
}
