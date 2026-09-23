/**
 * Ce qu'un menu contextuel propose sur une NOTE.
 *
 * ⭐ UN CATALOGUE PAR SURFACE, ET IL NE CONNAÎT QUE DES DONNÉES. Il ne rend
 * rien, il n'ouvre rien : il décrit. C'est ce qui permet au même tableau de
 * nourrir le clic droit et le bouton « ⋯ » sans être écrit deux fois.
 *
 * ⚠️ CHAQUE ENTRÉE APPELLE LA FONCTION DU GESTE ÉQUIVALENT (règle 18) — jamais
 * une réimplémentation. « Ouvrir » appelle ce que fait le clic sur la ligne ;
 * « Renommer » va poser le curseur DANS le champ du titre, celui-là même que
 * l'utilisateur cliquerait. Une entrée qui referait le travail de son jumeau
 * divergerait de lui au premier correctif, et rien ne le dirait.
 *
 * ⚠️ `t()` est appelé ICI, à la construction, et JAMAIS dans une constante de
 * module : une table de libellés évaluée à l'import se fige dans la langue de
 * démarrage (`PASSATION.md` § 14.2).
 */

import { IconNote, IconPencil, IconTrash } from "../../icons";
import { IconCopier, IconDupliquer } from "../icones";
import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";
import { copierTexte } from "../../../lib/menu/pressePapier";
import { plainText } from "../../../lib/richtext";
import type { Note } from "../../../lib/types";

export interface GestesNote {
  /** Exactement ce que fait le clic sur la ligne. */
  ouvrir: (note: Note) => void;
  /** Sélectionne la note ET pose le curseur dans le champ du titre. */
  renommer: (note: Note) => void;
  dupliquer: (note: Note) => Promise<void>;
  /** La MÊME fonction que le bouton « supprimer » de l'éditeur : vers la corbeille. */
  supprimer: (note: Note) => Promise<void>;
}

export function entreesNote(note: Note, gestes: GestesNote): EntreePossible[] {
  return [
    {
      id: "ouvrir",
      libelle: t("Ouvrir"),
      icone: <IconNote />,
      executer: () => gestes.ouvrir(note),
    },
    {
      id: "renommer",
      libelle: t("Renommer"),
      icone: <IconPencil />,
      // ⚠️ Le raccourci n'est affiché que parce qu'il EXISTE VRAIMENT sur la
      // ligne (voir `NotesView`). Un raccourci affiché et non branché est un
      // mensonge que rien ne rattrape.
      raccourci: "F2",
      executer: () => gestes.renommer(note),
    },
    {
      id: "dupliquer",
      libelle: t("Dupliquer"),
      icone: <IconDupliquer />,
      executer: () => gestes.dupliquer(note),
    },
    {
      id: "copier",
      libelle: t("Copier"),
      icone: <IconCopier />,
      sousMenu: [
        {
          id: "copier-titre",
          libelle: t("Le titre"),
          icone: <IconCopier />,
          executer: async () => {
            await copierTexte(note.title);
          },
        },
        {
          id: "copier-texte",
          libelle: t("Le texte"),
          icone: <IconCopier />,
          // Le corps d'une note est du HTML : le copier tel quel collerait du
          // balisage. `plainText` est déjà ce qu'emploie le moteur de recherche.
          executer: async () => {
            await copierTexte(plainText(note.body ?? ""));
          },
          desactive: plainText(note.body ?? "").trim()
            ? undefined
            : { raison: t("Cette note est vide.") },
        },
      ],
    },
    {
      id: "supprimer",
      libelle: t("Supprimer"),
      icone: <IconTrash />,
      // Descend en dernier, sous un filet, en rouge — imposé par `ordonner()`,
      // pas par l'ordre d'écriture ici.
      danger: true,
      executer: () => gestes.supprimer(note),
    },
  ];
}
