import { useCallback, useEffect, useState } from "react";
import { rafraichirReferences, refsDesCartes } from "../../lib/carte";
import { rafraichirBlocs } from "../../lib/carteDom";
import { extraireMentions, rafraichirMentions } from "../../lib/mentions";
import { synchroniserMentions, titresDesMentions, uidDe } from "../../lib/repo";
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
 * ⭐ DEUX FAMILLES DE CITATIONS, UN SEUL CALCUL — et c'est la garantie du
 * chantier « cartes mentales » (2026-09-07). Un texte peut citer un objet de
 * deux façons : par un jeton `@` (`<span data-mention>`) ou par un nœud de
 * carte mentale (dans le JSON de `data-mindmap`). Les deux produisent la MÊME
 * arête `object_links`, avec la MÊME origine `'mention'` — le `CHECK` du schéma
 * (migration 020) n'en accepte pas d'autre, et une valeur inconnue arrêterait
 * la synchronisation (`PIEGES.md` § 3.4).
 *
 * ⚠️ Elles sont donc réconciliées **ENSEMBLE, EN UNE SEULE PASSE**, sur l'union
 * de ce que le corps contient maintenant. C'est ce qui rend impossible
 * qu'enregistrer une carte détruise une arête créée par un `@` du même texte :
 * `diffMentions` ne supprime que ce qui n'est plus voulu, et les deux familles
 * sont dans le même « voulu ». Deux appels séparés se seraient effacés l'un
 * l'autre — un test le garde (`carte.test.ts`, § porte 3).
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
    if (desMentions.length === 0 && desCartes.length === 0) return html;
    const titres = await titresDesMentions([...desMentions, ...desCartes]);
    const titreDe = (k: LinkKind, u: string) => titres.get(`${k}:${u}`) ?? null;
    const avecMentions = rafraichirMentions(html, titreDe);
    return desCartes.length === 0
      ? avecMentions
      : rafraichirBlocs(avecMentions, (c) => rafraichirReferences(c, titreDe));
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
      const citations = [...extraireMentions(html), ...refsDesCartes(html)];
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
