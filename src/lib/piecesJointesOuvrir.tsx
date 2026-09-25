/**
 * Ouvrir une pièce jointe — et DIRE quand ce n'est pas possible.
 *
 * ⭐ LE DÉFAUT CORRIGÉ ICI (2026-09-25, trouvé en vérifiant le clic à l'écran,
 * qui ne l'avait jamais été). Les cinq appelants faisaient
 * `void ouvrirPieceJointe(uid)` : le booléen rendu était jeté, l'erreur aussi.
 * Or `false` est le cas NORMAL sur un second appareil — les octets ne quittent
 * jamais la machine où le fichier a été joint (`pieces_jointes.rs`). Cliquer
 * le jeton y ne faisait rien, sans un mot : exactement ce qu'un utilisateur
 * prend pour une panne.
 *
 * ⚠️ Tous les chemins d'ouverture passent par ici — clic sur le jeton (Notes et
 * Savoir), entrée « Ouvrir » du menu du bloc, lien vers un fichier dans le
 * panneau des liens (`naviguer.ts`). Un seul endroit décide de ce qu'on dit.
 */

import { ouvrirPieceJointe } from "./repo";
import { afficherToast } from "./toast";
import { t } from "./i18n";
import { IconAlert } from "../components/icons";

// Un échec ne porte pas la coche verte du toast par défaut : elle dirait « réussi ».
const iconeEchec = <IconAlert className="h-5 w-5 shrink-0 text-yellow" />;

export async function ouvrirPieceJointeOuDire(uid: string): Promise<boolean> {
  try {
    if (await ouvrirPieceJointe(uid)) return true;
    afficherToast({
      msg: t("Ce fichier n'est pas sur cet appareil : il reste sur celui où il a été joint."),
      icone: iconeEchec,
    });
  } catch (e) {
    afficherToast({
      msg: t("Le fichier n'a pas pu s'ouvrir : {erreur}", { erreur: String(e) }),
      icone: iconeEchec,
    });
  }
  return false;
}
