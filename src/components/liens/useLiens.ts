import { useCallback, useEffect, useState } from "react";
import { rafraichirReferences, refsDesCartes } from "../../lib/carte";
import { rafraichirBlocs } from "../../lib/carteDom";
import { extraireMentions, rafraichirMentions } from "../../lib/mentions";
import { extrairePiecesJointes } from "../../lib/piecesJointes";
import { rafraichirPiecesJointes } from "../../lib/piecesJointesDom";
import { localeTag } from "../../lib/i18n";
import { fetchPiecesJointes, synchroniserMentions, titresDesMentions, uidDe } from "../../lib/repo";
import type { LinkKind } from "../../lib/types";

/**
 * Ce qu'il faut à un écran pour porter des liaisons : l'identité globale de
 * l'objet édité, de quoi rafraîchir ce qui cite, et de quoi enregistrer ses
 * arêtes.
 *
 * ⚠️ POURQUOI UN CROCHET ET PAS TROIS APPELS À LA MAIN. Trois écrans portent
 * des liaisons (Notes, Savoir, Objets). Recopier la séquence dans chacun, c'est
 * garantir qu'un des trois oubliera `synchroniserMentions` — et l'oubli est
 * silencieux : le texte affiche le jeton, mais aucun backlink n'apparaît en
 * face. Personne ne cherche un défaut qui ne se voit que de l'autre côté.
 *
 * ⭐ TROIS FAMILLES DE CITATIONS, UN SEUL CALCUL — la garantie du chantier
 * « cartes mentales » (2026-09-07), étendue aux pièces jointes le 2026-09-23.
 * Un texte peut citer un objet de trois façons :
 *   • un jeton `@` — `<span data-mention>` (`mentions.ts`) ;
 *   • un nœud de carte mentale — le JSON de `data-mindmap` (`carte.ts`) ;
 *   • une pièce jointe — `<span data-fichier>` (`piecesJointes.ts`).
 * Les trois produisent la MÊME arête `object_links`, avec la MÊME origine
 * `'mention'`.
 *
 * ⚠️ Sur l'origine, une correction DATÉE plutôt qu'effacée : jusqu'au
 * 2026-09-23, ce commentaire justifiait le `'mention'` unique par le `CHECK`
 * de la migration 020, « qui n'en accepte pas d'autre ». La migration 028 a
 * retiré ce `CHECK` (il faisait échouer le cycle de synchronisation entier, et
 * non la seule ligne fautive — `PIEGES.md` § 3.4). Le motif tient toujours,
 * mais il a changé de nature : inventer une origine `'piece-jointe'` obligerait
 * `diffMentions` à savoir laquelle il a le droit de supprimer, alors que sa
 * règle actuelle — « ne retire que ce qui vient d'un texte, jamais un
 * rattachement manuel » — est exactement la bonne pour les trois familles.
 *
 * ⚠️ Elles sont donc réconciliées **ENSEMBLE, EN UNE SEULE PASSE**, sur l'union
 * de ce que le corps contient maintenant. C'est ce qui rend impossible
 * qu'enregistrer une carte détruise une arête créée par un `@` du même texte,
 * ou qu'une frappe efface le lien vers un PDF joint trois lignes plus haut :
 * `diffMentions` ne supprime que ce qui n'est plus voulu, et les trois familles
 * sont dans le même « voulu ». Trois appels séparés se seraient effacés les uns
 * les autres — un test le garde (`carte.test.ts`, § porte 3).
 */
export function useLiens(kind: LinkKind, id: number | null) {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    if (id == null) {
      setUid(null);
      return;
    }
    void uidDe(kind, id).then((u) => {
      if (!annule) setUid(u);
    });
    return () => {
      annule = true;
    };
  }, [kind, id]);

  /**
   * Réécrit les titres affichés — ceux des jetons `@` ET ceux des nœuds de
   * carte — à partir de l'état actuel des objets cités.
   *
   * ⚠️ À appeler au CHARGEMENT, pas à chaque frappe : réécrire le HTML pendant
   * la frappe déplacerait le curseur.
   *
   * Les titres des deux familles sont chargés en UNE requête : une note qui
   * cite le même objet dans son texte et dans sa carte ne doit pas interroger
   * la base deux fois.
   */
  const rafraichir = useCallback(async (html: string): Promise<string> => {
    const desMentions = extraireMentions(html);
    const desCartes = refsDesCartes(html);
    const desFichiers = extrairePiecesJointes(html);
    if (desMentions.length === 0 && desCartes.length === 0 && desFichiers.length === 0) return html;

    let sortie = html;

    if (desMentions.length > 0 || desCartes.length > 0) {
      const titres = await titresDesMentions([...desMentions, ...desCartes]);
      const titreDe = (k: LinkKind, u: string) => titres.get(`${k}:${u}`) ?? null;
      sortie = rafraichirMentions(sortie, titreDe);
      if (desCartes.length > 0) {
        sortie = rafraichirBlocs(sortie, (c) => rafraichirReferences(c, titreDe));
      }
    }

    // ⭐ LES PIÈCES JOINTES SE RAFRAÎCHISSENT ICI, avec les deux autres familles,
    // et pas dans un second chemin appelé par chaque vue. `NotesView` et
    // `KnowledgeView` en bénéficient sans une ligne de plus — et surtout, il
    // n'existe pas de vue qui puisse oublier de le faire.
    //
    // ⚠️ Ce rafraîchissement ne sert pas qu'à réécrire un nom : c'est lui qui
    // distingue les TROIS états d'une pièce jointe — présente, « pas sur cet
    // appareil » (ses octets ne se synchronisent pas), et supprimée. Sans lui,
    // un fichier effacé sur le Mac s'afficherait encore comme ouvrable sur
    // l'iPhone, et le clic ne ferait rien.
    if (desFichiers.length > 0) {
      const etats = await fetchPiecesJointes(desFichiers.map((f) => f.uid));
      sortie = rafraichirPiecesJointes(
        sortie,
        (uid) => {
          const l = etats.get(uid);
          return l ? { nom: l.name, mime: l.mime, taille: l.size, presente: l.presente } : null;
        },
        localeTag(),
      );
    }

    return sortie;
  }, []);

  /**
   * Met les arêtes en accord avec ce que le texte contient MAINTENANT.
   *
   * ⚠️ `uidCible` EST OBLIGATOIRE DÈS QUE L'ÉCRITURE EST DIFFÉRÉE, et c'est le
   * correctif du 2026-09-05. Par défaut la fonction écrit sous l'uid de l'objet
   * actuellement ouvert — ce qui est juste tant qu'on l'appelle tout de suite.
   * Un enregistrement débouncé, lui, peut partir APRÈS un changement de note :
   * l'uid par défaut serait alors celui de la NOUVELLE note, et les mentions de
   * l'ancienne s'écriraient comme les arêtes de l'autre. Un appelant qui diffère
   * doit donc capturer l'uid au moment de la FRAPPE et le passer ici.
   */
  const enregistrerLiens = useCallback(
    async (html: string, uidCible?: string | null): Promise<void> => {
      const cible = uidCible ?? uid;
      if (!cible) return;
      // ⚠️ LES TROIS FAMILLES, EN UNE SEULE LISTE. Retirer l'une d'elles d'ici
      // ne casserait rien de visible tout de suite : c'est au PROCHAIN
      // enregistrement que ses arêtes disparaîtraient, une par une, sans erreur.
      const citations = [
        ...extraireMentions(html),
        ...refsDesCartes(html),
        ...extrairePiecesJointes(html).map((p) => ({ kind: "file" as const, uid: p.uid })),
      ];
      await synchroniserMentions(
        kind,
        cible,
        citations.map((m) => ({
          from_kind: kind,
          from_uid: cible,
          to_kind: m.kind,
          to_uid: m.uid,
          origin: "mention" as const,
        })),
      );
    },
    [kind, uid],
  );

  return { uid, rafraichir, enregistrerLiens };
}
