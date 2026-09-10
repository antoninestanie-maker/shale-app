import { t } from "../../lib/i18n";

/**
 * La pastille qui rend un exemple IDENTIFIABLE — règle non négociable du
 * cahier des charges.
 *
 * ⚠️ Un mot, pas une icône. Une icône demanderait d'être apprise, et le seul
 * moment où cette pastille compte est justement celui où l'utilisateur ne
 * connaît encore rien de l'app.
 *
 * ⚠️ Elle DISPARAÎT d'elle-même : la ligne perd son marqueur à la première
 * écriture de l'utilisateur (`repo.ts`, `adopter`). Rien à faire ici.
 */
export default function BadgeExemple({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pill shrink-0 border border-violet/40 bg-violet/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-violet ${className}`}
      title={t("Créé par Shale pour te montrer le produit. Modifie-le, il devient tien.")}
    >
      {t("exemple")}
    </span>
  );
}
