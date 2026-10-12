import { useCallback, useEffect, useRef, useState } from "react";
import { ICONE_DE_KIND, LIBELLE_DE_KIND, LIBELLE_PLURIEL } from "./libelles";
import { aretesResolues, grouperParKind, LINK_KINDS } from "../../lib/liens";
import { createLink, deleteLink, fetchLinksTo, rechercherPartout } from "../../lib/repo";
import type { Trouvaille } from "../../lib/recherche";
import type { LinkKind, ObjectLink } from "../../lib/types";
import { IconExpand, IconPlus, IconX } from "../icons";
import MenuContextuel from "../menu/MenuContextuel";
import { useMenuContextuel } from "../menu/useMenuContextuel";
import { t } from "../../lib/i18n";

/**
 * « Mentionné dans » et « Lié à » — les deux moitiés qui donnent sa valeur au
 * système.
 *
 * ⚠️ Une mention SANS backlink n'est qu'un lien hypertexte. C'est le panneau
 * qui fait de Shale un graphe : la fiche « Silver Bullet » apprend qu'elle est
 * citée par trois notes et deux trades, ce que personne n'avait écrit
 * explicitement.
 *
 * Le rattachement MANUEL est dans le même panneau, et c'est délibéré : tout ne
 * se dit pas dans un texte, et séparer les deux gestes obligerait à savoir
 * d'avance lequel on veut.
 */
interface Props {
  kind: LinkKind;
  uid: string;
  /** Ouvre l'objet cité. Sans elle, le panneau reste lisible mais inerte. */
  onOuvrir?: (kind: LinkKind, uid: string) => void;
  /**
   * Combien d'arêtes RÉSOLUES le panneau affiche.
   *
   * ⚠️ Sert à un appelant qui doit décider s'il y a quelque chose à montrer —
   * la page d'un sujet se replie quand elle est vide. Le compte ne peut pas
   * être calculé dehors : seul ce panneau sait quelles arêtes se résolvent
   * vraiment, et une arête orpheline ne compte pas.
   */
  onCompte?: (n: number) => void;
  /**
   * Un rattachement vient d'être AJOUTÉ ou RETIRÉ ici, à la main.
   *
   * Pour l'appelant qui tient un compte dépendant des arêtes — l'onglet
   * « À trier » de la vue Notes. ⚠️ Distinct d'`onCompte`, qui part aussi au
   * simple chargement : s'en servir pour recharger ferait une requête de plus
   * à chaque note ouverte.
   */
  onModifie?: () => void;
  /**
   * Ouvre le champ « Lier » depuis l'extérieur : chaque NOUVELLE valeur (un
   * compteur) l'ouvre et amène le panneau à l'écran. `0` ou absent : rien.
   *
   * ⭐ Règle 18 : le bouton « Rattacher… » de la vue Notes ne refait pas le
   * rattachement — il ouvre CE champ, celui que le bouton « Lier » ouvre.
   */
  demandeAjout?: number;
}

export default function PanneauLiens({ kind, uid, onOuvrir, onCompte, onModifie, demandeAjout }: Props) {
  const [liens, setLiens] = useState<ObjectLink[]>([]);
  const [titres, setTitres] = useState<Map<string, string>>(new Map());
  const [ajout, setAjout] = useState(false);
  /** Le clic droit sur un lien : l'ouvrir, ou retirer un rattachement fait à la main (règle 18). */
  const menu = useMenuContextuel<ObjectLink>();
  const retirerLien = async (id: number) => {
    await deleteLink(id);
    await charger();
    modifieRef.current?.();
  };
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<Trouvaille[]>([]);
  // ⚠️ Par REF, pas en dépendance : `onCompte` est souvent une lambda recréée à
  // chaque rendu du parent, et la mettre dans les dépendances de `charger`
  // relancerait la requête à chaque frappe du parent.
  const compteRef = useRef(onCompte);
  compteRef.current = onCompte;
  const modifieRef = useRef(onModifie);
  modifieRef.current = onModifie;
  const cadre = useRef<HTMLElement>(null);
  const champAjout = useRef<HTMLInputElement>(null);

  /** Le geste du bouton « Lier » — et de quiconque demande l'ajout du dehors. */
  const ouvrirAjout = useCallback(() => {
    setAjout(true);
    setRequete("");
  }, []);
  useEffect(() => {
    if (!demandeAjout) return;
    ouvrirAjout();
    // Le panneau vit SOUS l'éditeur : sur une note longue, il est hors champ.
    cadre.current?.scrollIntoView({ block: "nearest" });
    // ⚠️ Le focus, UNE IMAGE PLUS TARD. Demandé depuis un menu contextuel, le
    // champ prend bien le focus à son montage (`autoFocus`) — puis le menu, en
    // se fermant, le REND à la ligne qui l'avait ouvert, lui aussi à l'image
    // suivante (`useMenuContextuel.fermer`). Sa demande est partie avant
    // celle-ci : elle passe donc avant, et le champ garde la frappe.
    const image = requestAnimationFrame(() => champAjout.current?.focus());
    return () => cancelAnimationFrame(image);
  }, [demandeAjout, ouvrirAjout]);

  const charger = useCallback(async () => {
    if (!uid) return;
    const entrants = await fetchLinksTo(kind, uid);
    // On résout les titres en une seule recherche, puis on écarte les arêtes
    // dont la source n'existe plus ici — elle peut être arrivée AVANT son
    // objet (l'ordre des lignes distantes n'est pas garanti), ou avoir été
    // supprimée sur un appareil resté longtemps hors ligne.
    const corpus = await rechercherPartout("", { limite: 500 });
    const parCle = new Map(corpus.map((d) => [`${d.kind}:${d.uid}`, d.titre]));
    setTitres(parCle);
    const resolues = aretesResolues(entrants, (k, u) =>
      k === kind && u === uid ? true : parCle.has(`${k}:${u}`),
    );
    setLiens(resolues);
    compteRef.current?.(resolues.length);
  }, [kind, uid]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    let annule = false;
    void (async () => {
      if (!ajout) return;
      const r = await rechercherPartout(requete, { limite: 8, exclure: { kind, uid } });
      if (!annule) setResultats(r);
    })();
    return () => {
      annule = true;
    };
  }, [ajout, requete, kind, uid]);

  const groupes = grouperParKind(liens);

  return (
    <section ref={cadre} className="card mt-4 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-text-dim">
          {t("Mentionné dans")}
        </h3>
        <button
          type="button"
          onClick={() => {
            if (ajout) setAjout(false);
            else ouvrirAjout();
          }}
          data-tip={t("Rattacher à la main")}
          data-tip-sub={t("Tout ne se dit pas dans un texte.")}
          className="pill cible-tactile flex items-center justify-center gap-1 px-2 py-1 text-xs text-text-dim hover:bg-overlay hover:text-text"
        >
          <IconPlus className="h-3.5 w-3.5" />
          {t("Lier")}
        </button>
      </header>

      {ajout && (
        <div className="mt-3">
          <input
            ref={champAjout}
            autoFocus
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder={t("Chercher une note, une fiche, un objet…")}
            className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
          />
          <ul className="mt-2 space-y-0.5">
            {resultats.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  type="button"
                  onClick={async () => {
                    // L'arête part de l'objet TROUVÉ vers celui qu'on regarde :
                    // c'est bien « r me mentionne », donc `r` est la source.
                    await createLink({
                      from_kind: r.kind,
                      from_uid: r.uid,
                      to_kind: kind,
                      to_uid: uid,
                      origin: "manual",
                    });
                    setAjout(false);
                    setRequete("");
                    await charger();
                    modifieRef.current?.();
                  }}
                  className="cible-tactile-ligne flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text-dim hover:bg-overlay hover:text-text"
                >
                  <span className="shrink-0">{ICONE_DE_KIND[r.kind]}</span>
                  <span className="truncate">{r.titre}</span>
                  <span className="ml-auto shrink-0 text-[0.65rem] text-text-dim">
                    {t(LIBELLE_DE_KIND[r.kind])}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {liens.length === 0 && !ajout ? (
        <p className="mt-3 text-sm text-text-dim">
          {t("Rien ne cite encore ceci.")}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {LINK_KINDS.filter((k) => groupes.has(k)).map((k) => (
            <div key={k}>
              <h4 className="text-[0.65rem] uppercase tracking-wide text-text-dim">
                {t(LIBELLE_PLURIEL[k])}
              </h4>
              <ul className="mt-1 space-y-0.5">
                {groupes.get(k)!.map((l) => (
                  <li key={l.id} className="group flex items-center gap-2" onContextMenu={(e) => menu.ouvrirAuPoint(e, l)}>
                    <button
                      type="button"
                      onClick={() => onOuvrir?.(l.from_kind, l.from_uid)}
                      disabled={!onOuvrir}
                      className="cible-tactile-ligne flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-text hover:bg-overlay disabled:cursor-default"
                    >
                      <span className="shrink-0 text-text-dim">{ICONE_DE_KIND[l.from_kind]}</span>
                      <span className="truncate">
                        {titres.get(`${l.from_kind}:${l.from_uid}`) ?? t("Sans titre")}
                      </span>
                      {l.origin === "manual" && (
                        <span className="ml-auto shrink-0 text-[0.6rem] uppercase text-text-dim">
                          {t("à la main")}
                        </span>
                      )}
                    </button>
                    {/* ⚠️ On ne peut retirer QUE ce qui a été rattaché à la
                        main. Une mention se retire en effaçant le `@` dans le
                        texte : la supprimer ici la ferait réapparaître au
                        prochain enregistrement, sans que rien ne l'explique. */}
                    {l.origin === "manual" && (
                      <button
                        type="button"
                        onClick={() => void retirerLien(l.id)}
                        data-tip={t("Retirer ce rattachement")}
                        aria-label={t("Retirer ce rattachement")}
                        className="cible-tactile shrink-0 rounded p-1 text-text-dim transition-opacity hover:text-red focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur le lien")}
        entrees={(() => {
          const l = menu.cible && liens.find((x) => x.id === menu.cible!.id);
          if (!l) return [];
          return [
            onOuvrir && { id: "ouvrir", libelle: t("Ouvrir"), icone: <IconExpand />, executer: () => onOuvrir(l.from_kind, l.from_uid) },
            {
              id: "retirer",
              libelle: t("Retirer ce rattachement"),
              icone: <IconX />,
              danger: true,
              // Une MENTION se retire dans le texte, pas ici : la retirer d'ici la
              // ferait revenir au prochain enregistrement (voir le bouton).
              desactive: l.origin === "manual" ? undefined : { raison: t("Une mention se retire en effaçant le @ dans le texte.") },
              executer: () => retirerLien(l.id),
            },
          ];
        })()}
      />
    </section>
  );
}
