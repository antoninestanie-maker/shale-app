// ─────────────────────────────────────────────────────────────────────────────
// Arithmétique des montants — entière de bout en bout.
//
// POURQUOI CE FICHIER EXISTE. Un `number` JavaScript est un flottant binaire :
// 0,1 + 0,2 vaut 0,30000000000000004, et douze loyers additionnés en euros
// décimaux produisent des centimes fantômes. Tout le module Finance travaille
// donc sur des ENTIERS de centimes, et les quelques opérations qui ne sont pas
// de simples additions passent par ici.
//
// ⚠️ BIGINT N'EST PAS UN LUXE. Valoriser une position multiplie une quantité à
// l'échelle 10⁻⁸ par un prix à l'échelle 10⁻⁸ : un seul bitcoin à 100 000 $
// donne 1e8 × 1e13 = 1e21, très au-delà des 2⁵³ (≈ 9e15) au-delà desquels un
// `number` cesse de compter juste. Le calcul se fait en `bigint`, et ne
// redevient un `number` qu'une fois ramené à des centimes.
// ─────────────────────────────────────────────────────────────────────────────

/** Échelle des quantités et des taux : 10⁻⁸. */
export const E8 = 100_000_000n;

/**
 * Division entière arrondie au plus proche, les moitiés À L'ÉCART DE ZÉRO.
 *
 * C'est la règle de l'arrondi commercial, et surtout elle est SYMÉTRIQUE :
 * −2,5 → −3 comme 2,5 → 3. Un arrondi vers l'infini positif ferait dériver un
 * solde débiteur dans le sens opposé à un solde créditeur, ce qui se voit au
 * bout de quelques mois de projection.
 */
export function divArrondi(numerateur: bigint, denominateur: bigint): bigint {
  if (denominateur === 0n) throw new Error("division par zéro");
  const negatif = numerateur < 0n !== denominateur < 0n;
  const n = numerateur < 0n ? -numerateur : numerateur;
  const d = denominateur < 0n ? -denominateur : denominateur;
  const q = (2n * n + d) / (2n * d);
  return negatif ? -q : q;
}

/**
 * Valeur d'une position, en centimes.
 *
 *   (quantité / 10⁸) × (prix / 10⁸) × 100 centimes = quantité × prix / 10¹⁴
 *
 * Le prix est exprimé dans la devise de la cotation : la conversion vers la
 * devise d'affichage est un second temps (`convertirCents`).
 */
export function valeurPositionCents(quantiteE8: number, prixE8: number): number {
  const brut = BigInt(quantiteE8) * BigInt(prixE8);
  return Number(divArrondi(brut, 10n ** 14n));
}

/** Conversion de devise : le taux est à l'échelle 10⁻⁸. */
export function convertirCents(cents: number, tauxE8: number): number {
  return Number(divArrondi(BigInt(cents) * BigInt(tauxE8), E8));
}

/**
 * Applique un ratio décimal à un montant en centimes.
 *
 * ⚠️ C'est le SEUL endroit du module où un flottant entre, et il n'y entre pas
 * par négligence : les résultats du journal de trading sont stockés en `REAL`
 * depuis la migration 006 (`trades.result_r`), et réécrire cette table
 * dépasserait de loin le périmètre de Finance. On arrondit donc une fois, tout
 * de suite, et le reste de la chaîne reste entier.
 */
export function multiplierParRatio(cents: number, ratio: number): number {
  return Math.round(cents * ratio);
}

// ── Saisie et affichage ──────────────────────────────────────────────────────

/**
 * Lit un montant saisi à la main et le rend en centimes.
 *
 * Tolérant par construction — c'est un champ de formulaire, pas un protocole :
 * espaces (y compris insécables), symboles de devise, virgule ou point comme
 * séparateur décimal, et séparateur de milliers de l'un ou l'autre style.
 * Quand les deux séparateurs sont présents, le DERNIER est le décimal : c'est
 * vrai de « 1.234,56 » comme de « 1,234.56 ».
 *
 * Renvoie `null` si la saisie n'est pas un nombre — jamais `0`, qui serait une
 * réponse plausible et fausse.
 */
export function parseMontantEnCents(saisie: string): number | null {
  let brut = saisie.replace(/[\s  ]/g, "").replace(/[€$£¥]/g, "");
  if (!brut) return null;

  const dernierPoint = brut.lastIndexOf(".");
  const derniereVirgule = brut.lastIndexOf(",");
  if (dernierPoint !== -1 && derniereVirgule !== -1) {
    const millier = dernierPoint < derniereVirgule ? "." : ",";
    brut = brut.split(millier).join("");
  }
  brut = brut.replace(",", ".");

  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(brut);
  if (!m) return null;
  const [, signe, entier, decimales = ""] = m;
  if (!entier && !decimales) return null;

  // Passage en centimes SANS flottant : on décale la virgule sur la chaîne, puis
  // on arrondit en `bigint`. « 12,999 » vaut donc bien 13,00 € et non 12,99 €.
  const chiffres = BigInt(`${entier || "0"}${decimales}`);
  const cents = divArrondi(chiffres * 100n, 10n ** BigInt(decimales.length));
  const n = Number(cents);
  if (!Number.isSafeInteger(n)) return null;
  return signe === "-" ? -n : n;
}

/**
 * Lit une quantité de titres saisie à la main, à l'échelle 10⁻⁸.
 *
 * Même tolérance que pour les montants, mais SIX décimales de plus : passer par
 * `parseMontantEnCents` arrondirait 0,00000001 BTC à zéro, ce qui est
 * précisément la quantité que la crypto rend légitime.
 */
export function parseQuantiteE8(saisie: string): number | null {
  const brut = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (!brut) return null;
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(brut);
  if (!m) return null;
  const [, signe, entier, decimales = ""] = m;
  if (!entier && !decimales) return null;
  const chiffres = BigInt(`${entier || "0"}${decimales}`);
  const q = divArrondi(chiffres * E8, 10n ** BigInt(decimales.length));
  const n = Number(q);
  if (!Number.isSafeInteger(n)) return null;
  return signe === "-" ? -n : n;
}

/** Montant en centimes → chaîne affichable, dans la locale courante. */
export function formaterCents(
  cents: number,
  devise = "EUR",
  locale = "fr-FR",
  opts: { sansDecimales?: boolean; signeExplicite?: boolean } = {},
): string {
  const valeur = cents / 100;
  const texte = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: devise,
    minimumFractionDigits: opts.sansDecimales ? 0 : 2,
    maximumFractionDigits: opts.sansDecimales ? 0 : 2,
  }).format(valeur);
  return opts.signeExplicite && cents > 0 ? `+${texte}` : texte;
}

/** Quantité à l'échelle 10⁻⁸ → chaîne affichable, zéros de fin retirés. */
export function formaterQuantite(quantiteE8: number, locale = "fr-FR"): string {
  const negatif = quantiteE8 < 0;
  const abs = BigInt(Math.abs(quantiteE8));
  const entier = abs / E8;
  const reste = (abs % E8).toString().padStart(8, "0").replace(/0+$/, "");
  const tete = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(entier);
  const virgule = locale.startsWith("fr") ? "," : ".";
  return `${negatif ? "-" : ""}${tete}${reste ? virgule + reste : ""}`;
}
