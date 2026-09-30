// ─────────────────────────────────────────────────────────────────────────────
// Préparer un fichier pour l'extraction (#5), AVANT tout envoi.
//
// · PDF : 10 Mo et 20 pages au plus — comptées ici par `pdf-lib` (déjà une
//   dépendance de l'app), pour refuser sans rien envoyer ; le serveur recompte.
// · Image : PNG, JPEG, WebP passent ; HEIC/HEIF (les photos d'iPhone) sont
//   décodées par la WebView (WebKit sait les lire) et réencodées en JPEG. Toute
//   image plus grande que 2 000 px de côté est réduite : moins d'octets, moins
//   de jetons, et un reçu reste lisible. Au-delà de 5 Mo après ça : refusée.
// ─────────────────────────────────────────────────────────────────────────────

import { PDFDocument } from "pdf-lib";

export type TypeFichierIa = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

export type FichierPrepare =
  | { ok: true; media_type: TypeFichierIa; data: string; nom: string; octets: number; pages: number | null }
  | { ok: false; raison: "type" | "taille" | "pages" | "illisible" };

export const PDF_MAX_OCTETS = 10 * 1024 * 1024;
export const PDF_MAX_PAGES = 20;
export const IMAGE_MAX_OCTETS = 5 * 1024 * 1024;
const COTE_MAX = 2000;

export const ACCEPTE = ".pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif";

function base64De(octets: Uint8Array): string {
  let bin = "";
  const pas = 0x8000;
  for (let i = 0; i < octets.length; i += pas) bin += String.fromCharCode(...octets.subarray(i, i + pas));
  return btoa(bin);
}

/** Le type d'un fichier, par son type MIME ou, à défaut, son extension. */
export function typeDe(f: { name: string; type: string }): "pdf" | "image" | "heic" | null {
  const nom = f.name.toLowerCase();
  if (f.type === "application/pdf" || nom.endsWith(".pdf")) return "pdf";
  if (f.type === "image/heic" || f.type === "image/heif" || /\.hei[cf]$/.test(nom)) return "heic";
  if (["image/png", "image/jpeg", "image/webp"].includes(f.type) || /\.(png|jpe?g|webp)$/.test(nom)) return "image";
  return null;
}

async function reencoder(f: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, COTE_MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * k));
    canvas.height = Math.max(1, Math.round(bmp.height * k));
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.85));
  } catch {
    return null;
  }
}

export async function preparerFichier(f: File): Promise<FichierPrepare> {
  const genre = typeDe(f);
  if (!genre) return { ok: false, raison: "type" };

  if (genre === "pdf") {
    if (f.size > PDF_MAX_OCTETS) return { ok: false, raison: "taille" };
    const octets = new Uint8Array(await f.arrayBuffer());
    let pages: number;
    try {
      pages = (await PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
    } catch {
      return { ok: false, raison: "illisible" };
    }
    if (pages > PDF_MAX_PAGES) return { ok: false, raison: "pages" };
    return { ok: true, media_type: "application/pdf", data: base64De(octets), nom: f.name, octets: f.size, pages };
  }

  // Image : on réencode si c'est du HEIC ou si elle est trop grande à l'œil.
  let blob: Blob = f;
  let type: TypeFichierIa = (f.type as TypeFichierIa) || "image/jpeg";
  if (genre === "heic" || f.size > 1.5 * 1024 * 1024) {
    const jpeg = await reencoder(f);
    if (!jpeg) return { ok: false, raison: genre === "heic" ? "illisible" : "taille" };
    blob = jpeg;
    type = "image/jpeg";
  }
  if (blob.size > IMAGE_MAX_OCTETS) return { ok: false, raison: "taille" };
  const octets = new Uint8Array(await blob.arrayBuffer());
  return { ok: true, media_type: type, data: base64De(octets), nom: f.name, octets: blob.size, pages: null };
}
