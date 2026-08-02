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
for (const m of enSrc.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) {
  known.add(JSON.parse(`"${m[1]}"`));
}

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

if (missing.size === 0) {
  console.log(`✓ 0 clé manquante (${known.size} entrées dans en.ts)`);
} else {
  console.log(`✗ ${missing.size} clé(s) sans traduction anglaise :\n`);
  for (const [key, files] of missing) {
    console.log(`  ${JSON.stringify(key)}\n      ${[...new Set(files)].join(", ")}`);
  }
  process.exitCode = 1;
}
