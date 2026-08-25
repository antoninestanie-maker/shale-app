// Briques de formulaire communes au module Finance.
//
// Le point important est `ChampMontant` : il garde la saisie SOUS FORME DE
// TEXTE tant que l'utilisateur tape, et ne la convertit en centimes qu'au
// moment de valider. Un champ contrôlé qui reformaterait à chaque frappe
// empêcherait d'écrire « 1 2 3 4 , 5 » — la virgule sauterait avant d'avoir été
// suivie d'un chiffre.
import { useEffect, useState, type ReactNode } from "react";

import { formaterCents, parseMontantEnCents } from "../../lib/finance/montants";
import { localeTag, t } from "../../lib/i18n";

/** Centimes → texte éditable, virgule française. `null` donne un champ vide. */
const enTexte = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");

export const inputCls =
  "w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text placeholder:font-body placeholder:text-text-dim focus:border-blue focus:outline-none";
export const labelCls = "mb-1.5 block text-xs font-medium text-text-dim";

export function Champ({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

/** Montant en euros → centimes. `null` = saisie vide ou invalide. */
export function ChampMontant({
  label,
  valeurCents,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  valeurCents: number | null;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [texte, setTexte] = useState(() => enTexte(valeurCents));

  /**
   * Resynchronisation quand la valeur vient D'AILLEURS — le bouton qui propose
   * la valeur du calculateur de position, par exemple.
   *
   * ⚠️ LE PIÈGE, ET IL A MORDU. La version précédente se déclenchait dès que
   * `valeurCents` passait de `null` à un nombre : autrement dit au PREMIER
   * chiffre tapé. Saisir « 9 » réécrivait aussitôt le champ en « 9,00 », le
   * curseur sautait derrière la virgule, et le chiffre suivant produisait
   * « 9,005 ». Le champ devenait inutilisable pour tout montant à plus d'un
   * chiffre.
   *
   * La garde correcte ne regarde pas D'OÙ vient la valeur mais si elle
   * CONTREDIT ce qui est affiché : tant que le texte à l'écran produit déjà la
   * valeur reçue, c'est que l'utilisateur est en train de taper, et on ne
   * touche à rien. `?? 0` parce qu'un champ vide et un zéro saisi désignent le
   * même montant côté parent — sans ça, taper « 0 » effaçait le champ.
   */
  useEffect(() => {
    if ((parseMontantEnCents(texte) ?? 0) === (valeurCents ?? 0)) return;
    setTexte(enTexte(valeurCents));
  }, [valeurCents, texte]);

  return (
    <Champ label={label}>
      <input
        className={inputCls}
        inputMode="decimal"
        autoFocus={autoFocus}
        value={texte}
        placeholder={placeholder ?? "0,00"}
        onChange={(e) => {
          setTexte(e.target.value);
          onChange(parseMontantEnCents(e.target.value));
        }}
      />
    </Champ>
  );
}

/** Montant formaté, coloré par son signe. Zéro reste neutre. */
export function Montant({
  cents,
  devise = "EUR",
  colore = false,
  signe = false,
  sansDecimales = false,
  className = "",
}: {
  cents: number | null;
  devise?: string;
  colore?: boolean;
  signe?: boolean;
  sansDecimales?: boolean;
  className?: string;
}) {
  if (cents === null)
    return <span className={`font-mono text-text-dim ${className}`}>{t("—")}</span>;
  const teinte = !colore || cents === 0 ? "" : cents > 0 ? "text-green" : "text-red";
  return (
    <span className={`font-mono tabular-nums ${teinte} ${className}`}>
      {formaterCents(cents, devise, localeTag(), { sansDecimales, signeExplicite: signe })}
    </span>
  );
}

/** Bouton d'action secondaire, discret — le style récurrent du module. */
export function BoutonDiscret({
  onClick,
  children,
  tip,
  danger = false,
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  tip?: string;
  danger?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      data-tip={tip}
      className={`rounded-[10px] border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-overlay ${
        danger ? "text-red hover:border-red/40" : "text-text-dim hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
