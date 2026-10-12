import { choisirDateDeTache, type GestesTache } from "../menu/catalogue/tache";
import { dateAuFil, formaterComplet } from "../../lib/calendrier/champDate";
import { t } from "../../lib/i18n";
import { ancreSurElement } from "../../lib/selecteurDate";
import type { Task } from "../../lib/types";

/**
 * ⭐ LA DATE D'UNE TÂCHE, SUR SA LIGNE — un bouton qui ouvre le calendrier sur
 * place (2026-10-11).
 *
 * Avant, la date n'était qu'un mot : pour reporter d'un jour il fallait ouvrir
 * la tâche, puis son champ d'échéance, puis enregistrer (crible du labo,
 * constat 7 — cinq utilisateurs sur cinq). Le bouton est visible AU REPOS (ce
 * n'est pas une action de survol) et fait 44 pt de haut au doigt.
 *
 * Le jour choisi passe par `dater`, le geste du menu « Dater » (règle 18).
 */
export default function BoutonDate(props: {
  task: Task;
  aujourdHui: string;
  dater: GestesTache["dater"];
  /** La couleur du mot — le retard se dit sans crier. */
  className?: string;
}) {
  const { task, aujourdHui } = props;
  if (!task.due_date) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const bouton = e.currentTarget;
        choisirDateDeTache(task, props.dater, ancreSurElement(bouton), bouton);
      }}
      aria-haspopup="dialog"
      aria-label={t("Échéance : {date}. Changer", { date: formaterComplet(task.due_date) })}
      data-tip={t("Changer la date")}
      // Au doigt : 44 pt de cible, mais la ligne ne grandit pas d'autant — la
      // marge négative laisse la zone déborder sans écarter le libellé de ses faits.
      // En LARGEUR aussi (2026-10-12) : « hier » mesurait 22 px de large. Le
      // retrait de 12 px de chaque côté est repris en marge négative, donc le
      // mot ne bouge pas ; `justify-center` le garde au milieu de ses 44 pt.
      className={`cible-tactile inline-flex shrink-0 items-center justify-center rounded underline decoration-dotted decoration-1 underline-offset-[3px] transition-colors hover:text-text [@media(pointer:coarse)]:-mx-3 [@media(pointer:coarse)]:-my-2 [@media(pointer:coarse)]:px-3 ${
        props.className ?? ""
      }`}
    >
      {dateAuFil(task.due_date, aujourdHui)}
    </button>
  );
}
