import { useCallback, useState } from "react";
import { deposerPieceJointe, ErreurDepot, isTauri } from "../lib/repo";
import { insererPieceJointe } from "../lib/piecesJointesDom";
import { tailleLisible, TAILLE_MAX } from "../lib/piecesJointes";
import { localeTag, t } from "../lib/i18n";

/**
 * Joindre un fichier à une note — le SEUL chemin, pour les deux éditeurs.
 *
 * ⚠️ POURQUOI UN CROCHET ET PAS DEUX BOUTONS. Notes (`RichNoteEditor`) et Savoir
 * (`NoteComposer`) sont deux éditeurs distincts, et le dépôt enchaîne cinq
 * gestes qui doivent tous réussir dans le bon ordre : choisir, copier les
 * octets, écrire la ligne, insérer le jeton, prévenir l'éditeur qu'il a changé.
 * Recopier cette séquence dans les deux, c'est garantir qu'un des deux oubliera
 * le cinquième — et cet oubli-là est SILENCIEUX d'une façon particulièrement
 * méchante (voir `marquerModifie` plus bas).
 *
 * C'est le même raisonnement que `useLiens`, et il a la même histoire : les deux
 * éditeurs étaient exactement complémentaires, chacun ayant la moitié que
 * l'autre n'avait pas (chantier cartes mentales, 2026-09-07).
 */

export interface DepotOptions {
  /** La zone éditable où insérer le jeton. */
  racine: () => HTMLElement | null;
  /**
   * ⚠️⚠️ À APPELER APRÈS TOUTE MUTATION PROGRAMMATIQUE DU DOM, sans exception.
   *
   * Une insertion faite en JavaScript ne déclenche PAS `onInput` : l'éditeur ne
   * sait donc pas que son contenu a changé. Si la graine rafraîchie arrive
   * ensuite, elle resème le DOM avec le corps d'AVANT — et **la pièce jointe
   * disparaît de l'écran**, alors que le fichier est bien copié sur le disque et
   * sa ligne bien écrite. C'est mot pour mot le piège que `RichNoteEditor`
   * documente pour les cartes mentales, et la famille du § 6.5 de `PIEGES.md`.
   */
  marquerModifie: () => void;
}

export interface EtatDepot {
  /** Un dépôt est en cours — copie d'un gros fichier comprise. */
  enCours: boolean;
  /** Ce qui vient d'échouer, prêt à être affiché. `null` = rien à signaler. */
  erreur: string | null;
}

export function useDepotPieceJointe({ racine, marquerModifie }: DepotOptions) {
  const [etat, setEtat] = useState<EtatDepot>({ enCours: false, erreur: null });

  const effacerErreur = useCallback(() => setEtat((e) => ({ ...e, erreur: null })), []);

  /**
   * Ouvre le sélecteur système, puis dépose ce qui a été choisi.
   *
   * ⚠️ PLUSIEURS FICHIERS D'UN COUP, et chacun est traité INDÉPENDAMMENT : si le
   * troisième dépasse la taille maximale, les deux premiers restent joints. Tout
   * annuler parce qu'un fichier sur cinq est trop gros ferait recommencer un
   * travail qui avait réussi.
   */
  const joindre = useCallback(async (): Promise<void> => {
    const zone = racine();
    if (!zone) return;

    const choisis = await choisirFichiers();
    if (choisis.length === 0) return; // dialogue fermé : ce n'est pas une erreur

    setEtat({ enCours: true, erreur: null });
    const refuses: string[] = [];

    for (const { src, taille } of choisis) {
      try {
        const ligne = await deposerPieceJointe(src, taille);
        if (!ligne) continue;
        insererPieceJointe(
          zone,
          { uid: ligne.uid, nom: ligne.name, taille: ligne.size },
          ligne.mime,
          localeTag(),
        );
        // ⚠️ APRÈS CHAQUE insertion, pas une seule fois à la fin : si le dépôt
        // suivant échoue, ce qui vient d'être inséré doit déjà être acquis.
        marquerModifie();
      } catch (e) {
        refuses.push(
          e instanceof ErreurDepot
            ? e.refus === "trop-gros"
              ? t("{nom} dépasse {max}", {
                  nom: e.nom,
                  max: tailleLisible(TAILLE_MAX, localeTag()),
                })
              : t("{nom} est vide", { nom: e.nom })
            : String(e),
        );
      }
    }

    setEtat({
      enCours: false,
      // ⚠️ Le message NOMME les fichiers refusés. « Certains fichiers n'ont pas
      // pu être joints » obligerait l'utilisateur à comparer sa sélection avec
      // ce qu'il voit dans la note pour deviner lesquels.
      erreur: refuses.length ? refuses.join(" · ") : null,
    });
  }, [racine, marquerModifie]);

  // ⚠️ IL N'Y A PAS DE `rafraichir` ICI, et c'est délibéré. Une première
  // version en portait un — puis `useLiens` a reçu le même besoin pour les
  // mentions et les cartes. Deux chemins de rafraîchissement pour le même
  // corps, c'est la garantie qu'un des deux finira par ne plus dire la même
  // chose que l'autre. Le seul vit dans `useLiens.rafraichir`, avec les deux
  // autres familles de citations.

  return { etat, joindre, effacerErreur };
}

/** Un fichier choisi : son chemin (natif) ou son nom (démo), et sa taille. */
interface Choisi {
  src: string;
  /** Connue seulement en démo — le natif mesure après la copie. */
  taille?: number;
}

/**
 * Ouvre le sélecteur de fichiers — DEUX CHEMINS, une seule signature.
 *
 * ⚠️ POURQUOI LE MODE DÉMO N'EST PAS UN LUXE ICI. Le sélecteur de Tauri
 * n'existe pas dans un navigateur : sans ce second chemin, le bouton
 * « Joindre un fichier » ne ferait rigoureusement RIEN en preview — donc toute
 * cette interface serait invérifiable ailleurs que dans l'app installée, c'est
 * à dire en pilotant la vraie base d'Antonin. C'est le § 6.2 de `PIEGES.md`,
 * et le dépôt l'a déjà payé.
 *
 * ⚠️ En démo, `src` est le NOM du fichier, pas un chemin : il n'y a pas de
 * disque, et `demo.deposerPieceJointe` ne garde que ce nom. La taille, elle,
 * est vraie — c'est ce qui permet de relire le refus « trop gros » à l'écran.
 */
async function choisirFichiers(): Promise<Choisi[]> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const choix = await open({ multiple: true });
    if (!choix) return [];
    const chemins = Array.isArray(choix) ? choix : [choix];
    return chemins.map((c) => ({ src: String(c) }));
  }

  return new Promise<Choisi[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);

    let rendu = false;
    const finir = (v: Choisi[]) => {
      if (rendu) return;
      rendu = true;
      input.remove();
      resolve(v);
    };

    input.addEventListener("change", () => {
      finir(Array.from(input.files ?? []).map((f) => ({ src: f.name, taille: f.size })));
    });
    // ⚠️ Un dialogue FERMÉ sans rien choisir n'émet pas `change` sur tous les
    // navigateurs. Sans ce filet, la promesse ne se résoudrait jamais et
    // l'indicateur « dépôt en cours » resterait allumé pour toujours.
    input.addEventListener("cancel", () => finir([]));

    input.click();
  });
}
