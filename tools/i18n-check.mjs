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
for (const file of walk(root)) {
  if (file.includes("lib/i18n/")) continue;
  const src = readFileSync(file, "utf8");
  // t("…") / t('…') / tp("…") — littéraux seulement (les templates sont hors portée).
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    const key = JSON.parse(`"${m[1]}"`);
    if (!known.has(key)) {
      if (!missing.has(key)) missing.set(key, []);
      missing.get(key).push(file);
    }
  }
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    const key = m[1].replace(/\\'/g, "'");
    if (!known.has(key)) {
      if (!missing.has(key)) missing.set(key, []);
      missing.get(key).push(file);
    }
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
