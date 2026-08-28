// Audit i18n : toute clé passée à t() doit exister dans en.ts.
// Usage : node i18n-audit.mjs <dossier src>
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const root = process.argv[2] ?? "src";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

const enSrc = readFileSync(join(root, "lib/i18n/en.ts"), "utf8");
const known = new Set();
// Clés du dictionnaire : "…": ou '…': en début de valeur d'objet.
// On note aussi les LIGNES, pour repérer les doublons : en JS le dernier gagne
// en silence, et une clé écrite deux fois signifie qu'une des deux traductions
// ne s'affichera jamais. `tsc` le voit (TS1117), mais il tourne bien plus tard
// et son message ne dit pas QUELLE clé.
const lignesDe = new Map();
enSrc.split("\n").forEach((ligne, i) => {
  const m = ligne.match(/^\s*"((?:[^"\\]|\\.)*)"\s*:/);
  if (!m) return;
  const key = JSON.parse(`"${m[1]}"`);
  known.add(key);
  if (!lignesDe.has(key)) lignesDe.set(key, []);
  lignesDe.get(key).push(i + 1);
});

const doublons = [...lignesDe].filter(([, l]) => l.length > 1);

const missing = new Map();
const noter = (key, file) => {
  if (known.has(key)) return;
  if (!missing.has(key)) missing.set(key, []);
  missing.get(key).push(file);
};

for (const file of walk(root)) {
  if (file.includes("lib/i18n/")) continue;
  const src = readFileSync(file, "utf8");
  // t("…") / t('…') — littéraux seulement (les templates sont hors portée).
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    noter(JSON.parse(`"${m[1]}"`), file);
  }
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    noter(m[1].replace(/\\'/g, "'"), file);
  }
  // ⚠️ `tp(n, "singulier", "pluriel")` porte DEUX clés, et l'en-tête de ce
  // fichier prétendait les couvrir depuis toujours — c'était faux : `\bt\(` ne
  // matche pas `tp(`, où `t` est suivi d'un `p`. Résultat, toutes les clés de
  // pluriel étaient invisibles au contrôle, qui annonçait « 0 manquante » sur
  // une app où « {n} position » n'avait pas de traduction. Trouvé le
  // 2026-08-28, en constatant qu'une clé fraîchement écrite n'était jamais
  // réclamée.
  for (const m of src.matchAll(
    /\btp\(\s*[^,]+?,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/g,
  )) {
    noter(JSON.parse(`"${m[1]}"`), file);
    noter(JSON.parse(`"${m[2]}"`), file);
  }
}

if (doublons.length > 0) {
  console.log(`✗ ${doublons.length} clé(s) EN DOUBLE dans en.ts — la seconde écrase la première :\n`);
  for (const [key, lignes] of doublons) {
    console.log(`  ${JSON.stringify(key)}\n      lignes ${lignes.join(", ")}`);
  }
  console.log("");
  process.exitCode = 1;
}

if (missing.size === 0) {
  console.log(`✓ 0 clé manquante (${known.size} entrées dans en.ts)`);
} else {
  console.log(`✗ ${missing.size} clé(s) sans traduction anglaise :\n`);
  for (const [key, files] of missing) {
    console.log(`  ${JSON.stringify(key)}\n      ${[...new Set(files)].join(", ")}`);
  }
  process.exitCode = 1;
}
