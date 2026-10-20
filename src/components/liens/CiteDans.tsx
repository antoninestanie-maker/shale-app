import { useEffect, useState } from "react";
import { ICONE_DE_KIND, LIBELLE_DE_KIND } from "./libelles";
import { citantsDe, type Citant } from "../../lib/liens";
import { fetchLinksTo, titresDesMentions } from "../../lib/repo";
import { ouvrirObjet } from "../../lib/naviguer";
import type { LinkKind } from "../../lib/types";
import { t } from "../../lib/i18n";

/**
 * « Cité dans » — la ligne qu'une fenêtre de tâche, d'événement ou une fiche du
 * Savoir montre quand une note (ou autre chose) la cite (2026-10-20, audit
 * complet, constat 5 : « un lien posé depuis une note ne se voit que d'un
 * côté »).
 *
 * ⚠️ PAS LE PANNEAU DES NOTES. `PanneauLiens` porte aussi le rattachement à la
 * main et un état vide ; dans une fenêtre de saisie, ce serait une carte de
 * plus pour rien. Ici : rien du tout quand rien ne cite l'objet, et chaque
 * ligne ouvre ce qui cite.
 */
export default function CiteDans({
  kind,
  uid,
  avantOuvrir,
  className = "",
}: {
  kind: LinkKind;
  uid: string | null | undefined;
  /** Appelé avant d'ouvrir un citant — une fenêtre se ferme, par exemple. */
  avantOuvrir?: () => void;
  className?: string;
}) {
  const [citants, setCitants] = useState<Citant[]>([]);

  useEffect(() => {
    let annule = false;
    if (!uid) {
      setCitants([]);
      return;
    }
    void (async () => {
      const aretes = await fetchLinksTo(kind, uid);
      const titres = await titresDesMentions(aretes.map((l) => ({ kind: l.from_kind, uid: l.from_uid })));
      if (!annule) setCitants(citantsDe(aretes, titres, { kind, uid }));
    })().catch(() => {
      /* sans liens lisibles, la fenêtre reste utilisable */
    });
    return () => {
      annule = true;
    };
  }, [kind, uid]);

  if (citants.length === 0) return null;
  return (
    <section className={className} aria-label={t("Cité dans")}>
      <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Cité dans")}</p>
      <ul className="flex flex-col gap-0.5">
        {citants.map((c) => (
          <li key={`${c.kind}:${c.uid}`}>
            <button
              type="button"
              onClick={() => {
                avantOuvrir?.();
                void ouvrirObjet(c.kind, c.uid);
              }}
              data-tip={t("Ouvrir « {label} »", { label: c.titre })}
              className="cible-tactile-ligne flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-text hover:bg-overlay"
            >
              <span className="shrink-0 text-text-dim">{ICONE_DE_KIND[c.kind]}</span>
              <span className="min-w-0 flex-1 truncate">{c.titre}</span>
              <span className="shrink-0 text-[0.65rem] text-text-dim">{t(LIBELLE_DE_KIND[c.kind])}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
