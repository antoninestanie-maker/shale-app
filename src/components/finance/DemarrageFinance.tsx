// Le parcours de démarrage — trois étapes, et rien de plus.
//
// Un module financier vide n'est pas seulement pauvre : il est INUTILISABLE.
// Sans compte, pas de patrimoine ; sans relevé, pas de liquidités ; sans flux,
// pas de burn — et donc pas de runway, c'est-à-dire pas de raison d'ouvrir
// l'onglet. Ce panneau dit exactement ce qui manque et ce que ça débloque,
// puis disparaît de lui-même.
import { IconCheckCircle } from "../icons";
import { t } from "../../lib/i18n";

export interface EtapesDemarrage {
  compte: boolean;
  releve: boolean;
  flux: boolean;
}

/** Trois étapes faites ⇒ le panneau n'a plus lieu d'être. */
export const demarrageTermine = (e: EtapesDemarrage) => e.compte && e.releve && e.flux;

export default function DemarrageFinance({
  etapes,
  onAjouterCompte,
  onRelever,
  onAjouterFlux,
}: {
  etapes: EtapesDemarrage;
  onAjouterCompte: () => void;
  onRelever: () => void;
  onAjouterFlux: () => void;
}) {
  const liste: {
    fait: boolean;
    titre: string;
    quoi: string;
    action?: { label: string; run: () => void };
  }[] = [
    {
      fait: etapes.compte,
      titre: t("Ajoute un compte"),
      quoi: t("Ton compte courant suffit pour commencer. Les autres viendront."),
      action: etapes.compte ? undefined : { label: t("Ajouter un compte"), run: onAjouterCompte },
    },
    {
      fait: etapes.releve,
      titre: t("Relève son solde"),
      quoi: t("Un chiffre approximatif vaut mieux que pas de chiffre. Tu le corrigeras."),
      // L'étape 2 n'avait AUCUN bouton : elle disait quoi faire sans dire où.
      // Il n'apparaît qu'une fois un compte créé — sans compte, il n'y a rien
      // à relever, et un bouton qui ouvrirait un formulaire vide serait pire
      // que pas de bouton.
      action:
        etapes.releve || !etapes.compte
          ? undefined
          : { label: t("Saisir un solde"), run: onRelever },
    },
    {
      fait: etapes.flux,
      titre: t("Déclare un revenu et une charge"),
      quoi: t("Ton loyer et ta principale rentrée : c'est ce qui produit le runway."),
      action: etapes.flux ? undefined : { label: t("Ajouter un flux"), run: onAjouterFlux },
    },
  ];

  const faites = liste.filter((e) => e.fait).length;

  return (
    <section className="card p-6">
      <p className="hud-label">{t("mise en route · {n}/3", { n: faites })}</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-text">
        {t("Trois gestes, et Finance sait combien de mois tu tiens.")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-text-dim">
        {t(
          "Pas de tickets de caisse, pas de connexion bancaire : tu relèves tes soldes une fois par mois et tu déclares ce qui revient. Le reste se calcule.",
        )}
      </p>

      <ol className="mt-5 flex flex-col gap-3">
        {liste.map((e, i) => (
          <li
            key={e.titre}
            /* ⚠️ `flex-wrap` ET un plancher sur le texte, les deux ensemble.
               `flex-wrap` seul ne suffit pas : la colonne de texte est en
               `flex-1 min-w-0`, donc sa largeur de BASE vaut zéro — elle se
               tasse au lieu de forcer le repli. Mesuré sur iPhone 17 : la
               description de l'étape 1 tombait dans 126 px, six lignes de deux
               mots, pendant que « Ajouter un compte » gardait les siens.
               Avec un plancher de 12 rem, la somme dépasse la largeur et c'est
               le BOUTON qui passe à la ligne — ce qu'on veut. */
            className={`flex flex-wrap items-start gap-3 rounded-[var(--radius-field)] border p-3 transition-colors ${
              e.fait ? "border-border bg-overlay/40" : "border-border-strong"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                e.fait ? "text-green" : "bg-overlay-2 text-text-dim"
              }`}
            >
              {e.fait ? <IconCheckCircle className="h-5 w-5" /> : i + 1}
            </span>
            <div className="min-w-[12rem] flex-1">
              <p className={`text-sm ${e.fait ? "text-text-dim line-through" : "text-text"}`}>
                {e.titre}
              </p>
              <p className="mt-0.5 text-xs text-text-dim">{e.quoi}</p>
            </div>
            {e.action && (
              <button
                type="button"
                onClick={e.action.run}
                className="shrink-0 rounded-[10px] bg-blue px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                {e.action.label}
              </button>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs text-text-dim">
        {t(
          "Ces données partent chiffrées de bout en bout vers tes autres appareils, et illisibles pour le serveur. Les cotations de marché, elles, ne sont pas synchronisées : ce sont des données publiques.",
        )}
      </p>
    </section>
  );
}
