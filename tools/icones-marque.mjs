#!/usr/bin/env node
/**
 * Rend toutes les icônes de Shale depuis les SVG de la marque.
 *
 *   node tools/icones-marque.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ LA SOURCE : `src-tauri/icons/marque/*.svg`, copies EXACTES de
 * `~/Desktop/Shale-projet/marque/` (marque décidée par Antonin le 2026-10-19 :
 * un S de deux traits blancs penchés, une lueur, sur une plaque cramoisie).
 * Ces SVG font foi ; ce script ne redessine rien, il rasterise.
 * `src/lib/icone-ios.test.ts` vérifie que `ShaleMark.tsx` dessine les mêmes
 * traits que ces fichiers.
 *
 * ⭐ LE RENDU PASSE PAR CHROME SANS FENÊTRE, et plus par `sips`.
 * La lueur est un flou gaussien (`feGaussianBlur`) ; ImageIO ne le rend pas
 * fidèlement. Chrome si — c'est le moteur qui a servi à choisir le logo.
 * ⚠️ `--disable-features=MacAppCodeSignClone` est OBLIGATOIRE (consigne
 * globale : sans lui, chaque lancement laisse une copie de 1,4 Go sur le disque).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI EST ÉCRIT, ET POURQUOI CHAQUE SOURCE :
 *
 * - iOS, catalogue `AppIcon.appiconset` — plein cadre, opaque, sans coin ni
 *   marge (iOS pose son propre masque ; une marge redonnerait le halo blanc du
 *   2026-09-10, MOBILE.md § 21). Claire = sombre, à l'octet près : décision
 *   d'Antonin (fond rouge, traits blancs dans les deux apparences). Teintée :
 *   la variante grise, iOS applique la teinte.
 * - iOS, écran de lancement — `LaunchIcon` (la plaque SANS lueur, coins
 *   arrondis, fond transparent : c'est la première image de l'animation
 *   d'entrée) et `LaunchHalo` (le halo rouge du fond, rendu depuis le MÊME
 *   dégradé CSS que l'app : `HALO` ci-dessous et `.lancement-halo` dans
 *   `src/index.css` doivent rester identiques).
 * - Bureau (macOS, Windows) — `src-tauri/icons/source-bureau-1024.png`, la
 *   plaque arrondie dans la grille macOS (824 px dans 1024, marge transparente :
 *   macOS ne masque pas, il attend que l'icône dessine sa plaque). On lance
 *   ensuite `npm run tauri icon` dessus.
 * - Barre des menus — `src-tauri/icons/tray-gabarit.png`, le S noir seul :
 *   macOS l'affiche en image « gabarit » (noir ou blanc selon la barre).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARQUE = resolve(RACINE, "src-tauri/icons/marque");
const APPLE = resolve(RACINE, "src-tauri/gen/apple/Assets.xcassets");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Le halo rouge du fond de lancement. ⚠️ Recopié dans `src/index.css` (`.lancement-halo`). */
export const HALO = "radial-gradient(closest-side, rgb(220 38 38 / 0.16), rgb(220 38 38 / 0.05) 55%, rgb(220 38 38 / 0) 100%)";
/** Côté du halo, en points (iOS) et en px CSS (app). ⚠️ Recopié dans `src/index.css`. */
export const COTE_HALO = 560;
/** Côté de l'icône de lancement. ⚠️ Recopié dans `src/index.css` (`--lancement-icone`). */
export const COTE_LANCEMENT = 96;

// ── PNG : décodage minimal, puis ré-encodage sans canal alpha ────────────────
// Uniquement ce dont ce script a besoin : 8 bits, RGBA, non entrelacé — ce que
// rend toujours `sips`. Tout le reste est refusé bruyamment plutôt que deviné.

function lirePng(chemin) {
  const d = readFileSync(chemin);
  if (d.readUInt32BE(0) !== 0x89504e47) throw new Error("pas un PNG");
  let i = 8;
  let idat = [];
  let w, h, profondeur, type;
  while (i < d.length) {
    const n = d.readUInt32BE(i);
    const nom = d.toString("ascii", i + 4, i + 8);
    const corps = d.subarray(i + 8, i + 8 + n);
    if (nom === "IHDR") {
      w = corps.readUInt32BE(0);
      h = corps.readUInt32BE(4);
      profondeur = corps[8];
      type = corps[9];
      if (corps[12] !== 0) throw new Error("PNG entrelacé non géré");
    } else if (nom === "IDAT") idat.push(corps);
    i += 12 + n;
  }
  if (profondeur !== 8 || (type !== 6 && type !== 2)) throw new Error(`PNG inattendu (${profondeur} bits, type ${type})`);
  const brut = inflateSync(Buffer.concat(idat));
  const canaux = type === 6 ? 4 : 3;
  const pas = w * canaux;
  const px = Buffer.alloc(h * pas);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filtre = brut[p++];
    const ligne = brut.subarray(p, p + pas);
    p += pas;
    const sortie = px.subarray(y * pas, (y + 1) * pas);
    const prec = y > 0 ? px.subarray((y - 1) * pas, y * pas) : null;
    for (let x = 0; x < pas; x++) {
      const a = x >= canaux ? sortie[x - canaux] : 0;
      const b = prec ? prec[x] : 0;
      const c = prec && x >= canaux ? prec[x - canaux] : 0;
      let v = ligne[x];
      if (filtre === 1) v += a;
      else if (filtre === 2) v += b;
      else if (filtre === 3) v += (a + b) >> 1;
      else if (filtre === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filtre !== 0) throw new Error(`filtre PNG ${filtre} inconnu`);
      sortie[x] = v & 255;
    }
  }
  if (canaux === 4) return { w, h, px };
  const rgba = Buffer.alloc(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    px.copy(rgba, k * 4, k * 3, k * 3 + 3);
    rgba[k * 4 + 3] = 255;
  }
  return { w, h, px: rgba };
}

function ecrirePngRgb(chemin, { w, h, px }) {
  const pas = w * 3;
  const brut = Buffer.alloc(h * (pas + 1));
  for (let y = 0; y < h; y++) {
    brut[y * (pas + 1)] = 0; // filtre « aucun » : la compression suffit ici
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * (pas + 1) + 1 + x * 3;
      brut[d] = px[s];
      brut[d + 1] = px[s + 1];
      brut[d + 2] = px[s + 2];
    }
  }
  const morceau = (nom, corps) => {
    const t = Buffer.alloc(8 + corps.length + 4);
    t.writeUInt32BE(corps.length, 0);
    t.write(nom, 4, "ascii");
    corps.copy(t, 8);
    t.writeUInt32BE(crc32(t.subarray(4, 8 + corps.length)), 8 + corps.length);
    return t;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolor, SANS alpha — tout l'objet de cette fonction
  writeFileSync(
    chemin,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      morceau("IHDR", ihdr),
      morceau("IDAT", deflateSync(brut, { level: 9 })),
      morceau("IEND", Buffer.alloc(0)),
    ]),
  );
}

const TABLE_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (const o of buf) c = TABLE_CRC[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}


// ── Rendu ────────────────────────────────────────────────────────────────────

const svg = (nom) => readFileSync(join(MARQUE, nom), "utf-8");

/** La plaque SANS lueur : on retire les deux traits floutés, rien d'autre. */
function sansLueur(source) {
  const s = source.replace(/<path [^>]*filter="url\(#lueur\)"\/>/g, "");
  if (s.includes('filter="url(#lueur)"')) throw new Error("lueur non retirée");
  return s;
}

let temporaire;
function rendre(nom, html, largeur, hauteur) {
  const page = join(temporaire, `${nom}.html`);
  const sortie = join(temporaire, `${nom}.png`);
  writeFileSync(
    page,
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body>${html}</body></html>`,
  );
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-features=MacAppCodeSignClone",
      `--user-data-dir=${join(temporaire, "profil")}`,
      "--hide-scrollbars",
      "--default-background-color=00000000",
      "--force-device-scale-factor=1",
      `--window-size=${largeur},${hauteur}`,
      `--screenshot=${sortie}`,
      `file://${page}`,
    ],
    { stdio: "ignore" },
  );
  const image = lirePng(sortie);
  if (image.w !== largeur || image.h !== hauteur)
    throw new Error(`${nom} : ${image.w}×${image.h} au lieu de ${largeur}×${hauteur}`);
  return { image, sortie };
}

/** Un SVG posé en image, à la taille voulue, avec une marge éventuelle. */
const imageSvg = (source, cote, marge = 0) =>
  `<div style="padding:${marge}px"><img style="display:block" width="${cote}" height="${cote}" src="data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}"></div>`;

function opaque(nom, image, cible) {
  // Un pixel translucide ici, et le halo blanc d'iOS revient.
  for (let i = 3; i < image.px.length; i += 4)
    if (image.px[i] !== 255) throw new Error(`${nom} : pixel non opaque`);
  ecrirePngRgb(cible, image);
}

temporaire = mkdtempSync(join(tmpdir(), "shale-icones-"));
try {
  // iOS — les trois apparences. Claire et sombre : le MÊME fichier.
  const pleine = rendre("ios-any", imageSvg(svg("icone-shale-plein-cadre.svg"), 1024), 1024, 1024);
  opaque("AppIcon-1024-any", pleine.image, join(APPLE, "AppIcon.appiconset/AppIcon-1024-any.png"));
  opaque("AppIcon-1024-dark", pleine.image, join(APPLE, "AppIcon.appiconset/AppIcon-1024-dark.png"));
  const teintee = rendre("ios-tinted", imageSvg(svg("icone-teintee-plein-cadre.svg"), 1024), 1024, 1024);
  opaque("AppIcon-1024-tinted", teintee.image, join(APPLE, "AppIcon.appiconset/AppIcon-1024-tinted.png"));
  console.log("  ✓ AppIcon (any = dark, tinted)");

  // iOS — l'écran de lancement, en @1x, @2x, @3x.
  mkdirSync(join(APPLE, "LaunchIcon.imageset"), { recursive: true });
  mkdirSync(join(APPLE, "LaunchHalo.imageset"), { recursive: true });
  const plaque = sansLueur(svg("icone-shale.svg"));
  for (const f of [1, 2, 3]) {
    const c = COTE_LANCEMENT * f;
    const r = rendre(`launch-icon-${f}`, imageSvg(plaque, c), c, c);
    writeFileSync(join(APPLE, `LaunchIcon.imageset/LaunchIcon@${f}x.png`), readFileSync(r.sortie));
    const h = COTE_HALO * f;
    const halo = rendre(`launch-halo-${f}`, `<div style="width:${h}px;height:${h}px;background:${HALO}"></div>`, h, h);
    writeFileSync(join(APPLE, `LaunchHalo.imageset/LaunchHalo@${f}x.png`), readFileSync(halo.sortie));
  }
  console.log("  ✓ LaunchIcon, LaunchHalo (@1x @2x @3x)");

  // Bureau — la plaque arrondie dans la grille macOS (824 dans 1024).
  const bureau = rendre("bureau", imageSvg(svg("icone-shale.svg"), 824, 100), 1024, 1024);
  writeFileSync(resolve(RACINE, "src-tauri/icons/source-bureau-1024.png"), readFileSync(bureau.sortie));
  console.log("  ✓ source-bureau-1024.png (à passer à `npm run tauri icon`)");

  // Barre des menus — le S noir, image gabarit (36 px = 18 pt @2x).
  const tray = rendre("tray", imageSvg(svg("marque-gabarit.svg"), 36), 36, 36);
  writeFileSync(resolve(RACINE, "src-tauri/icons/tray-gabarit.png"), readFileSync(tray.sortie));
  console.log("  ✓ tray-gabarit.png");
} finally {
  rmSync(temporaire, { recursive: true, force: true });
}
