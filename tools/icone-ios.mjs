#!/usr/bin/env node
/**
 * Génère les trois variantes de l'icône iOS, depuis la géométrie de la marque.
 *
 *   node tools/icone-ios.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'APPELLE PAS `tauri icon`.
 *
 * `npm run tauri icon` écrit dans `src-tauri/icons/ios/`, et RIEN ne recopie
 * ensuite ces fichiers dans `gen/apple/Assets.xcassets/` — mesuré le 2026-09-10 :
 * la commande régénère les 18 PNG de `icons/ios/` sans toucher d'un octet le
 * catalogue d'assets, qui est pourtant le seul endroit qu'iOS lit. On aurait
 * donc « régénéré l'icône » sans rien changer à l'écran d'accueil.
 *
 * Elle écrase AUSSI macOS, Windows et Android au passage. Or la marge
 * transparente qui produit le halo sur iOS est CORRECTE sur macOS, où le système
 * n'applique pas de masque et attend que l'icône dessine sa propre plaque. Les
 * deux plateformes ne veulent pas la même source : les mélanger était l'erreur.
 *
 * Ce script écrit donc directement dans le catalogue, et ne touche à rien
 * d'autre. `src-tauri/icons/` reste la source des icônes de bureau, inchangée.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ CE QUI DIFFÈRE DE L'ANCIENNE SOURCE, ET POURQUOI.
 *
 * `logos/shale-appicon-1024.png` portait une marge TRANSPARENTE de 100 px et des
 * coins arrondis DESSINÉS (rayon 165 px sur une plaque de 824). iOS aplatit
 * l'alpha sur blanc, puis applique son propre masque : la marge devenait un
 * anneau blanc autour d'une plaque plus petite. C'est le halo constaté.
 *
 * Ici : plein cadre, opaque, aucun coin dessiné, aucune marge. iOS arrondit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ LA RASTERISATION PASSE PAR `sips`, ET C'EST VOLONTAIRE.
 *
 * Pas de dépendance npm ajoutée pour dessiner quatre rectangles. ImageIO sait
 * lire le SVG depuis macOS 13 ; vérifié le 2026-09-11, l'anti-crénelage est
 * correct (0 → 94 → 242 → 255 le long d'un congé) et les bords tombent à moins
 * d'un pixel de la géométrie attendue.
 *
 * ⚠️ `sips` rend toujours du RGBA, même sur une image entièrement opaque. Les
 * variantes claire et sombre sont donc ré-encodées SANS canal alpha par
 * `sansAlpha()` — « aucune transparence » est la règle, et une règle qu'on ne
 * vérifie pas n'est pas tenue.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

/** Côté de la source. 1024 est la seule taille que demande le format moderne. */
const TAILLE = 1024;

/**
 * Géométrie de la marque « Strates » — grille 24×24.
 *
 * ⚠️ RECOPIÉE de `src/components/auth/ShaleMark.tsx`, qui la partage lui-même
 * avec `shale-site/vitrine/src/components/Logo.astro`. Les couches courtes
 * s'alignent à GAUCHE ; ne jamais les recentrer.
 * `src/lib/icone-ios.test.ts` échoue si cette copie dérive du composant.
 */
const GRILLE = 24;
const MARGE = 4; // inset des barres dans la grille
const BARRES = [
  { y: 3, w: 16, accent: false },
  { y: 8, w: 10.88, accent: false },
  { y: 13, w: 16, accent: true },
  { y: 18, w: 7.36, accent: false },
];

/**
 * Les trois palettes, toutes prises dans des tokens existants.
 *
 * - claire / sombre : `--color-bg` et `--color-text` de `src/index.css`,
 *   accent = `--accent` du site (`shale-site/vitrine/src/styles/global.css`),
 *   chacun sur SA surface : `oklch(0.72 0.13 225)` = #22b5e1 en sombre,
 *   `oklch(0.528 0.15 235)` = #0075b4 en clair.
 *
 *   ⚠️ Le cyan sombre n'est pas réutilisable sur le fond clair : #22b5e1 sur
 *   #f4f5f7 ne donne que 2,20:1, la barre d'accent s'effacerait. Avec l'accent
 *   clair, 4,58:1. (Sombre : 8,32:1.)
 *
 * - teintée : iOS applique la teinte de l'utilisateur, donc AUCUN fond opaque et
 *   des niveaux de gris. Les deux valeurs conservent exactement le rapport de
 *   clarté de la variante sombre — gris de même luminance que #eef1f6 et que
 *   #22b5e1 — pour que la troisième strate reste lisible comme un accent.
 */
const PALETTES = {
  "AppIcon-1024-any": { fond: "#f4f5f7", barre: "#0b0d12", accent: "#0075b4", opaque: true },
  "AppIcon-1024-dark": { fond: "#07090d", barre: "#eef1f6", accent: "#22b5e1", opaque: true },
  "AppIcon-1024-tinted": { fond: null, barre: "#f1f1f1", accent: "#a7a7a7", opaque: false },
};

function svg({ fond, barre, accent }) {
  const plaque = fond ? `<rect width="${GRILLE}" height="${GRILLE}" fill="${fond}"/>` : "";
  const barres = BARRES.map(
    (b) =>
      `<rect x="${MARGE}" y="${b.y}" width="${b.w}" height="3" rx="1.5" fill="${
        b.accent ? accent : barre
      }"/>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRILLE} ${GRILLE}" ` +
    `width="${TAILLE}" height="${TAILLE}">${plaque}${barres}</svg>`
  );
}

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
  if (profondeur !== 8 || type !== 6) throw new Error(`PNG inattendu (${profondeur} bits, type ${type})`);
  const brut = inflateSync(Buffer.concat(idat));
  const canaux = 4;
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
  return { w, h, px };
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

// ── Exécution ────────────────────────────────────────────────────────────────
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGUE = resolve(
  RACINE,
  "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset",
);

const temporaire = mkdtempSync(join(tmpdir(), "shale-icone-"));
try {
  for (const [nom, palette] of Object.entries(PALETTES)) {
    const source = join(temporaire, `${nom}.svg`);
    const rendu = join(temporaire, `${nom}.png`);
    writeFileSync(source, svg(palette));
    execFileSync("sips", ["-s", "format", "png", "-z", String(TAILLE), String(TAILLE), source, "--out", rendu], {
      stdio: "ignore",
    });
    const image = lirePng(rendu);
    if (image.w !== TAILLE || image.h !== TAILLE)
      throw new Error(`${nom} : ${image.w}×${image.h} au lieu de ${TAILLE}×${TAILLE}`);

    const cible = join(CATALOGUE, `${nom}.png`);
    if (palette.opaque) {
      // Contrôle avant écriture : un pixel translucide ici, et le halo revient.
      for (let i = 3; i < image.px.length; i += 4)
        if (image.px[i] !== 255) throw new Error(`${nom} : pixel non opaque, la source a une marge`);
      ecrirePngRgb(cible, image);
    } else {
      writeFileSync(cible, readFileSync(rendu)); // la teintée GARDE son alpha
    }
    console.log(`  ✓ ${nom}.png`);
  }
} finally {
  rmSync(temporaire, { recursive: true, force: true });
}
console.log(`Trois variantes écrites dans ${CATALOGUE.replace(RACINE + "/", "")}`);
