// ─────────────────────────────────────────────────────────────────────────────
// Audit i18n, deuxième moitié : les chaînes AFFICHÉES qui ne passent pas par
// `t()`.
//
// `i18n-check.mjs` répond à « toute clé passée à t() a-t-elle sa traduction ? ».
// Il ne peut PAS voir une phrase française écrite en dur dans le JSX : elle
// s'affiche telle quelle dans l'app anglaise, et le contrôle reste vert. C'est
// ce défaut-là qui a laissé « court terme », « 1 tâche » et sept bandeaux de
// Market-Brain en français jusqu'au 2026-08-28.
//
// Cet outil prend le problème par l'autre bout : il PARSE les fichiers (AST
// TypeScript, pas des expressions régulières — le JSX est trop retors pour ça)
// et relève tout texte qui atteint l'écran sans traverser `t()` / `tp()` /
// `pick()`.
//
// Usage : node tools/i18n-durs.mjs [dossier src] [--json]
// Sortie : liste classée par certitude, code 1 s'il reste des cas « sûrs ».
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import ts from "typescript";

const root = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "src";
const asJson = process.argv.includes("--json");

// ── Ce qu'on ne regarde pas ──────────────────────────────────────────────────
// Les tests ne s'affichent pas ; `lib/i18n/` EST le dictionnaire.
const IGNORE = (p) =>
  p.includes("/lib/i18n/") ||
  /\.test\.[tj]sx?$/.test(p) ||
  /\.testutil\.[tj]sx?$/.test(p) ||
  /\.d\.ts$/.test(p);

// ── Attributs qui atteignent réellement l'œil ou le lecteur d'écran ──────────
// Liste BLANCHE, pas noire : `className`, `id`, `viewBox`… sont innombrables,
// et un attribut oublié dans une liste noire devient un faux positif permanent.
const ATTRS_VISIBLES = new Set([
  "placeholder",
  "title",
  "alt",
  "label",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "data-tip",
  "data-tip-sub",
  "data-tip-kbd",
  // Props de composants MAISON qui rendent du texte : `ToggleRow`, `NumberField`,
  // `Field`, `ResizablePanel`… Sans elles, `<ToggleRow title="Mode fast-track"
  // desc="Envoi en arrière-plan…" />` passait entièrement sous le radar.
  "desc",
  "description",
  "hint",
  "sub",
  "subtitle",
  "tip",
  "legend",
  "empty",
  "cta",
]);

// ── Propriétés d'objet qui sentent le libellé ────────────────────────────────
// Ces tables (`SCOPE_LABEL`, `ACTIONS`, `WIDGET_LABELS`…) gardent VOLONTAIREMENT
// le français comme clé, traduit à l'affichage (cf. piège n°1 de CLAUDE.md).
// On les sort donc à part : la question n'est pas « est-ce du français ? » mais
// « le point d'affichage appelle-t-il `t()` ? » — et ça se vérifie à la main.
const PROPS_LIBELLE = new Set([
  "label",
  "labelFr",
  "title",
  "titre",
  "text",
  "texte",
  "desc",
  "description",
  "placeholder",
  "tip",
  "sub",
  "hint",
  "message",
  "libelle",
  "nom",
  "short",
  "medium",
  "long",
  // Trouvés à l'écran, pas par le scanner : un « jours » en dur survivait dans
  // les réglages de notification sous la propriété `suffix`. Une liste blanche
  // ne vaut que par ce qu'on y met — d'où cet élargissement.
  "suffix",
  "prefix",
  "unit",
  "unite",
  "body",
  "corps",
  // ⚠️ PAS `value` ni `name` : trop génériques. Les ajouter ramenait du bruit
  // jusque dans `sync/crypto.ts`, où aucune chaîne ne s'affiche jamais.
]);

// ── Est-ce du FRANÇAIS ? ─────────────────────────────────────────────────────
// Un littéral anglais en dur (« Flash », « No-trade ») n'est pas un défaut : la
// clé de traduction EST la phrase française, donc l'anglais s'affiche pareil des
// deux côtés. Le défaut, c'est le français qui survit en mode anglais.
const ACCENTS = /[éèêëàâäîïôöûüùçœæ]/i;
// Mots-outils : bien plus discriminants que les accents seuls (« court terme »,
// « 1 task » et « Session » n'ont aucun accent).
const MOTS_FR =
  /\b(le|la|les|un|une|des|du|de|au|aux|et|ou|est|sont|dans|pour|par|sur|avec|sans|pas|ne|plus|tes|ton|ta|tu|toi|ce|cette|ces|qui|que|quoi|quand|puis|encore|deja|aucun|aucune|toute|toutes|tous|chaque|entre|vers|sera|seront|reste|restent|commence|ajoute|verifie|choisis|clique|appuie|terme|jour|jours|heure|heures|semaine|mois|annee|tache|taches|objectif|objectifs|note|notes|theme|themes|compte|comptes|reglage|reglages|fermer|ouvrir|creer|modifier|supprimer|enregistrer|annuler)\b/i;
// Élisions : « l'analyse », « d'un », « n'est » — signature française nette.
const ELISION = /\b[ldnjmtscqu]['’](?=[aeiouyhéèêà])/i;

const sansAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function frTier(txt) {
  const nu = sansAccents(txt);
  if (ACCENTS.test(txt) || ELISION.test(txt) || MOTS_FR.test(nu)) return "sur";
  return "verifier";
}

// ── Bruit technique évident ──────────────────────────────────────────────────
// ⚠️ Volontairement ÉTROIT. Une première version écartait tout mot capitalisé
// isolé comme « identifiant » : elle ratait donc « Gagnante », « Perdante »,
// « Terminé » — des libellés de BOUTON. Un outil d'audit qui sous-compte est
// pire qu'aucun outil, puisqu'il produit un « c'est propre » faux.
const TECHNIQUE =
  /^(?:[a-z][a-z0-9]*(?:[_-][a-z0-9]+)+|[a-z]+[A-Z][a-zA-Z0-9]*|[\d\s.,:;/%+×·—–-]+|https?:\/\/\S+|var\(--[\w-]+\)|[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+)$/u;

function estCandidat(txt, origine) {
  const t = txt.trim();
  if (t.length < 3) return false;
  // Au moins un mot de 3 lettres — écarte « — », « · », « 0 % », « ⌘K ».
  if (!/[a-zA-Zà-ÿ]{3}/.test(t)) return false;
  // Le texte JSX brut EST rendu par définition : aucun filtre technique.
  if (origine === "jsx") return true;
  // Ailleurs, un jeton manifestement technique (kebab, camelCase, URL, token
  // CSS, marque de saisie type « AIza… ») ne mérite pas de traduction.
  if (!/\s/.test(t) && TECHNIQUE.test(t)) return false;
  return true;
}

// ── Parcours ─────────────────────────────────────────────────────────────────
function walkDir(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if ([".ts", ".tsx"].includes(extname(p)) && !IGNORE(p)) out.push(p);
  }
  return out;
}

/** Le nœud est-il un argument de t() / tp() / pick() ? */
function sousTraduction(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const f = p.expression;
      const nom = ts.isIdentifier(f) ? f.text : ts.isPropertyAccessExpression(f) ? f.name.text : "";
      if (nom === "t" || nom === "tp" || nom === "pick") {
        // Seulement si le nœud est DANS les arguments (pas dans la callee).
        if (p.arguments.some((a) => a === node || estAncetre(a, node))) return true;
      }
    }
  }
  return false;
}

function estAncetre(a, node) {
  for (let p = node; p; p = p.parent) if (p === a) return true;
  return false;
}

const trouvailles = [];

for (const file of walkDir(root)) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = relative(process.cwd(), file);

  const ajouter = (node, texte, origine) => {
    if (!estCandidat(texte, origine)) return;
    if (sousTraduction(node)) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    trouvailles.push({
      file: rel,
      line: line + 1,
      origine,
      tier: origine === "table" ? "table" : frTier(texte),
      texte: texte.trim().replace(/\s+/g, " ").slice(0, 110),
    });
  };

  const visit = (node) => {
    // (A) texte JSX brut : <p>Aucun objectif…</p>
    if (ts.isJsxText(node)) {
      const t = node.text.trim();
      if (t) ajouter(node, t, "jsx");
    }

    // (B) littéral posé sur un attribut visible : placeholder="…", data-tip="…"
    if (ts.isJsxAttribute(node) && node.initializer) {
      const nom = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sf);
      if (ATTRS_VISIBLES.has(nom)) {
        const ini = node.initializer;
        if (ts.isStringLiteral(ini)) ajouter(ini, ini.text, `attr:${nom}`);
        else if (ts.isJsxExpression(ini) && ini.expression) {
          for (const lit of litterauxDe(ini.expression)) ajouter(lit.node, lit.texte, `attr:${nom}`);
        }
      }
    }

    // (C) littéral rendu par une accolade : {manuel ? "manuelle" : t(…)}
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      for (const lit of litterauxDe(node.expression)) ajouter(lit.node, lit.texte, "jsx");
    }

    // (D) table de libellés : { short: "court terme" }
    if (ts.isPropertyAssignment(node)) {
      const nom = ts.isIdentifier(node.name)
        ? node.name.text
        : ts.isStringLiteral(node.name)
          ? node.name.text
          : "";
      if (PROPS_LIBELLE.has(nom) && ts.isStringLiteral(node.initializer)) {
        ajouter(node.initializer, node.initializer.text, "table");
      }
    }

    // (E) tableau de chaînes passé à .map() : ["date", "paire", "sens", …]
    // ⚠️ Angle mort trouvé À L'ÉCRAN, pas par l'outil : les en-têtes du tableau
    // d'historique de la vue Position vivaient dans un tableau littéral mappé
    // en `<th>`. Aucune des quatre règles précédentes ne regarde cette forme —
    // ce n'est ni du texte JSX, ni un attribut, ni une propriété d'objet.
    // On vise `.map(` précisément : un tableau de chaînes rendu en boucle est
    // presque toujours une liste de libellés, alors qu'un tableau de chaînes
    // quelconque est le plus souvent de la configuration.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "map"
    ) {
      let cible = node.expression.expression;
      while (ts.isParenthesizedExpression(cible) || ts.isAsExpression(cible)) {
        cible = cible.expression;
      }
      if (ts.isArrayLiteralExpression(cible)) {
        for (const el of cible.elements) {
          // Classé « table » et non « jsx » : le rappel de `.map()` peut très
          // bien appeler `t(h)` — savoir s'il le fait demande de suivre la
          // donnée, ce qu'un parseur ne fait pas. La bonne réponse de l'outil
          // est donc « va vérifier le point d'affichage », pas « c'est faux ».
          if (ts.isStringLiteral(el)) ajouter(el, el.text, "table");
          // ["calc", "Calculateur"] — paires [id, libellé] : le libellé est en 2ᵉ
          else if (ts.isArrayLiteralExpression(el) && el.elements.length >= 2) {
            const dernier = el.elements[el.elements.length - 1];
            if (ts.isStringLiteral(dernier)) ajouter(dernier, dernier.text, "table");
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
}

/** Littéraux de chaîne atteignables depuis une expression rendue. */
function litterauxDe(expr, out = []) {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    out.push({ node: expr, texte: expr.text });
  } else if (ts.isTemplateExpression(expr)) {
    const morceaux = [expr.head, ...expr.templateSpans.map((s) => s.literal)];
    const texte = morceaux.map((m) => m.text).join(" … ");
    if (texte.trim()) out.push({ node: expr, texte });
    for (const s of expr.templateSpans) litterauxDe(s.expression, out);
  } else if (ts.isConditionalExpression(expr)) {
    litterauxDe(expr.whenTrue, out);
    litterauxDe(expr.whenFalse, out);
  } else if (ts.isBinaryExpression(expr)) {
    // ⚠️ L'opérateur décide de ce qui est RENDU. `{statut === "active" && …}`
    // n'affiche jamais « active » : c'est une comparaison. Descendre des deux
    // côtés sans regarder l'opérateur rapportait ces identifiants comme du
    // texte à traduire — trois faux positifs dans `SyncSettings` à eux seuls.
    const op = expr.operatorToken.kind;
    const K = ts.SyntaxKind;
    if (op === K.AmpersandAmpersandToken) {
      litterauxDe(expr.right, out); // seul le côté droit s'affiche
    } else if (
      op === K.BarBarToken ||
      op === K.QuestionQuestionToken ||
      op === K.PlusToken
    ) {
      litterauxDe(expr.left, out);
      litterauxDe(expr.right, out);
    }
    // comparaisons (===, !==, <, in, instanceof…) : rien ne s'affiche
  } else if (ts.isParenthesizedExpression(expr)) {
    litterauxDe(expr.expression, out);
  }
  return out;
}

// ── Rapport ──────────────────────────────────────────────────────────────────
if (asJson) {
  console.log(JSON.stringify(trouvailles, null, 2));
  process.exitCode = trouvailles.some((t) => t.tier === "sur") ? 1 : 0;
} else {
  const par = (tier) => trouvailles.filter((t) => t.tier === tier);
  const bloc = (titre, list) => {
    if (!list.length) return;
    console.log(`\n${titre} — ${list.length}\n`);
    let dernier = "";
    for (const t of list) {
      if (t.file !== dernier) {
        console.log(`  ${t.file}`);
        dernier = t.file;
      }
      console.log(`    ${String(t.line).padStart(4)}  [${t.origine}] ${JSON.stringify(t.texte)}`);
    }
  };
  bloc("✗ FRANÇAIS EN DUR (accents, élisions ou mots-outils)", par("sur"));
  bloc("? À VÉRIFIER (texte affiché, langue ambiguë)", par("verifier"));
  bloc("· TABLES DE LIBELLÉS (français volontaire ? vérifier le t() à l'affichage)", par("table"));

  const s = par("sur").length;
  console.log(
    `\n${s === 0 ? "✓" : "✗"} ${s} chaîne(s) sûrement française(s), ` +
      `${par("verifier").length} à vérifier, ${par("table").length} entrée(s) de table.`,
  );
  process.exitCode = s > 0 ? 1 : 0;
}
