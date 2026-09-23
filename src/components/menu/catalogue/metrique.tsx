/**
 * Ce qu'un menu contextuel propose sur une MÉTRIQUE de la Performance.
 *
 * ⚠️ RÈGLE 18 — « Supprimer » appelle `jeter()`, comme la croix de la carte.
 * Le « +1 » n'y est PAS : il ajoute 1 au CHAMP en cours de saisie, pas à la
 * valeur enregistrée — une entrée de menu qui ferait « presque » la même chose
 * divergerait de son bouton sans que rien ne le dise.
 */

import { IconTrash } from "../../icons";
import { IconCopier } from "../icones";
import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";
import { copierTexte } from "../../../lib/menu/pressePapier";
import type { CustomMetric } from "../../../lib/types";

export interface GestesMetrique {
  supprimer: (m: CustomMetric) => Promise<void>;
}

export function entreesMetrique(m: CustomMetric, gestes: GestesMetrique): EntreePossible[] {
  return [
    {
      id: "copier-nom",
      libelle: t("Copier le nom"),
      icone: <IconCopier />,
      executer: async () => {
        await copierTexte(m.name);
      },
    },
    { id: "supprimer", libelle: t("Supprimer"), icone: <IconTrash />, danger: true, executer: () => gestes.supprimer(m) },
  ];
}
