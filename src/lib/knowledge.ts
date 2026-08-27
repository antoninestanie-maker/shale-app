// Savoir — helpers purs de la base de connaissances (aucun accès DB, aucun JSX).
// Deux règles guident ce fichier :
//   1. tout ce qui est stocké doit rester LÉGER (les images passent par une
//      recompression avant d'entrer en base : une capture d'écran de 4 Mo
//      devient ~150 ko sans perte visible à l'écran) ;
//   2. la recherche travaille sur du texte brut, jamais sur le HTML.
import { plainText } from "./richtext";
import type { KnowledgeEntry, KnowledgeEntryLite } from "./types";

import { localeTag } from "./i18n";
/**
 * Palette proposée aux nouveaux thèmes — accordée aux tokens du design system.
 *
 * ⚠️ L'ORDRE COMPTE : la teinte d'un thème créé est attribuée d'office, en
 * tournant dans cette liste (cf. `TopicGrid`). Le rouge corail est donc placé
 * EN DERNIER — dans ce design system, rouge et vert sont sémantiques, et un
 * quatrième thème peint en rouge sans que personne l'ait demandé se lirait
 * comme une alerte. Il reste choisissable à la main, ce qui est tout autre
 * chose : là, c'est une intention.
 */
export const TOPIC_COLORS = [
  "#4d8dff", // bleu
  "#14c8a0", // vert jade
  "#f0b341", // ambre
  "#8e8bff", // indigo
  "#41c9e2", // cyan
  "#f08ac0", // rose
  "#8b94a6", // ardoise
  "#ff5666", // rouge corail
];

// — Tags —

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw.split(",")) {
    const tag = t.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export const serializeTags = (tags: string[]): string => tags.join(", ");

// — Texte —

/** Extrait court pour les cartes (coupe sur un mot, jamais au milieu). */
export function excerpt(raw: string, max = 180): string {
  const text = raw.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

/** Domaine d'un lien, pour l'afficher à la place d'une URL interminable. */
export function domainOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

/** Complète une URL saisie sans protocole (« exemple.com » → « https://… »). */
export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  return /^[a-z][\w+.-]*:/i.test(url) ? url : `https://${url}`;
}

// — Liens —

/**
 * Ouvre un lien dans le navigateur système (natif) ou un onglet (démo).
 * Ne JAMAIS laisser la webview suivre un lien : elle quitterait l'application.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

// — Recherche (en mémoire : la liste est déjà chargée) —

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function matchesQuery(entry: KnowledgeEntryLite, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  // `text` = texte brut du corps, matérialisé en base : la recherche n'a
  // jamais besoin de charger le HTML (ni les images qu'il contient).
  const haystack = norm(`${entry.title} ${entry.tags} ${entry.text}`);
  // tous les mots doivent être présents (recherche « ET », comme une palette)
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/**
 * Deux noms de thèmes désignent-ils la même chose ? Casse et accents ignorés,
 * espaces de bordure retirés : « Lectures », « lectures » et « LECTURES » sont
 * un seul et même thème. Sert à refuser un doublon au lieu de le créer.
 */
export function sameTopicName(a: string, b: string): boolean {
  return norm(a.trim()) === norm(b.trim());
}

// — Dates —

/** « 14 juil. » / « 14 juil. 2025 » si l'année diffère. */
export function fmtDay(stamp: string): string {
  const d = new Date(stamp.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return stamp.slice(0, 10);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(localeTag(), {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// — Images —

/** Le WebP n'est pas encodable par tous les moteurs : on teste une fois. */
let webpOk: boolean | null = null;
function supportsWebp(): boolean {
  if (webpOk === null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpOk;
}

function drawScaled(img: ImageBitmap | HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  const ratio = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* repli <img> ci-dessous */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // l'image est déjà décodée : l'URL objet ne sert plus
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export interface EncodedImage {
  /** Pleine résolution (bornée à 1600 px) — stockée, affichée dans le lecteur. */
  media: string;
  /** Aperçu (480 px) — c'est lui que les cartes chargent. */
  thumb: string;
  width: number;
  height: number;
}

/**
 * Recompresse une image importée (fichier, presse-papiers ou glisser-déposer)
 * en deux tailles. Reste en data URL : aucune dépendance au système de
 * fichiers, donc identique en mode démo et en natif, et rien à re-résoudre
 * si la base est déplacée.
 */
export async function encodeImage(blob: Blob): Promise<EncodedImage> {
  const img = await decode(blob);
  const type = supportsWebp() ? "image/webp" : "image/jpeg";
  const full = drawScaled(img, 1600);
  const small = drawScaled(img, 480);
  if ("close" in img) img.close();
  return {
    media: full.toDataURL(type, 0.82),
    thumb: small.toDataURL(type, 0.7),
    width: full.width,
    height: full.height,
  };
}

/** Aperçu d'un croquis : le PNG plein format réduit à 480 px de large. */
export async function thumbFromDataUrl(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return drawScaled(img, 480).toDataURL("image/jpeg", 0.75);
}

/** Un presse-papiers / un drop peut contenir plusieurs fichiers : on ne garde que les images. */
export function imageFilesOf(list: FileList | File[] | null): File[] {
  if (!list) return [];
  return Array.from(list).filter((f) => f.type.startsWith("image/"));
}

// — Fiches historiques (avant l'unification autour de la note) —

/**
 * Reconstruit le corps d'une fiche créée quand image / croquis / lien étaient
 * des natures séparées : le média redevient une figure dans le corps, le lien
 * un vrai lien. Aucune donnée n'est perdue, et un croquis reste modifiable
 * (ses traits repassent dans l'attribut `data-sketch` de l'image).
 */
export function legacyBodyOf(entry: KnowledgeEntry): string {
  if (entry.kind === "note") return entry.body;
  const doc = document.createElement("div");
  doc.innerHTML = entry.body ?? "";

  if (entry.media) {
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = entry.media;
    img.alt = entry.title;
    if (entry.kind === "sketch" && entry.data) img.dataset.sketch = entry.data;
    figure.appendChild(img);
    doc.insertBefore(figure, doc.firstChild);
  }

  if (entry.kind === "link" && entry.url) {
    const p = document.createElement("p");
    const a = document.createElement("a");
    a.href = entry.url;
    a.textContent = entry.url;
    p.appendChild(a);
    doc.appendChild(p);
  }

  return doc.innerHTML;
}

/** Texte brut du corps — réexporté ici pour garder un point d'entrée unique. */
export { plainText };
