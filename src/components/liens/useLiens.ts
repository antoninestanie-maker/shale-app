import { useCallback, useEffect, useState } from "react";
import { extraireMentions, rafraichirMentions } from "../../lib/mentions";
import { synchroniserMentions, titresDesMentions, uidDe } from "../../lib/repo";
import type { LinkKind } from "../../lib/types";

/**
 * Ce qu'il faut à un écran pour porter des mentions : l'identité globale de
 * l'objet édité, de quoi rafraîchir ses jetons, et de quoi enregistrer ses
 * arêtes.
 *
 * ⚠️ POURQUOI UN CROCHET ET PAS TROIS APPELS À LA MAIN. Trois écrans portent
 * des mentions (Notes, Savoir, Objets). Recopier la séquence dans chacun, c'est
 * garantir qu'un des trois oubliera `synchroniserMentions` — et l'oubli est
 * silencieux : le texte affiche le jeton, mais aucun backlink n'apparaît en
 * face. Personne ne cherche un défaut qui ne se voit que de l'autre côté.
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
   * Réécrit les titres affichés des jetons à partir de l'état actuel.
   * ⚠️ À appeler au CHARGEMENT, pas à chaque frappe : réécrire le HTML pendant
   * la frappe déplacerait le curseur.
   */
  const rafraichir = useCallback(async (html: string): Promise<string> => {
    const refs = extraireMentions(html);
    if (refs.length === 0) return html;
    const titres = await titresDesMentions(refs);
    return rafraichirMentions(html, (k, u) => titres.get(`${k}:${u}`) ?? null);
  }, []);

  /** Met les arêtes en accord avec ce que le texte contient MAINTENANT. */
  const enregistrerMentions = useCallback(
    async (html: string): Promise<void> => {
      if (!uid) return;
      await synchroniserMentions(
        kind,
        uid,
        extraireMentions(html).map((m) => ({
          from_kind: kind,
          from_uid: uid,
          to_kind: m.kind,
          to_uid: m.uid,
          origin: "mention" as const,
        })),
      );
    },
    [kind, uid],
  );

  return { uid, rafraichir, enregistrerMentions };
}
