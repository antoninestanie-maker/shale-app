// ─────────────────────────────────────────────────────────────────────────────
// L'IA dans une note (Phase F) : UN bouton, posé dans la barre existante de
// l'éditeur, et derrière lui le catalogue `menu/catalogue/ia.tsx`.
//
//   Résumer (#20)      bloc résumé en tête, ou simple lecture — au choix
//   Réécrire (#21)     la sélection ou la note, trois tons, AVANT / APRÈS
//   Liens @ (#24)      candidats choisis ICI, acceptés un par un
//   Développer (#25)   des puces sélectionnées → un texte, inséré après elles
//   Traduire (#26)     une NOUVELLE note, reliée à l'originale — rien n'est écrasé
//   Carte mentale (#27) la structure → un bloc carte normal, modifiable
//
// ⭐ TOUTE insertion de texte passe par `execCommand("insertHTML")` : c'est la
// pile d'annulation du navigateur, donc ⌘Z défait une réécriture acceptée
// (audit § 7). La carte, elle, suit le chemin des cartes (`insererBloc`).
//
// ⚠️ Rien du modèle n'entre comme balise : `htmlDeTexte` et `blocResume`
// échappent tout (`csp: null`). Les aperçus sont des nœuds texte.
// ⚠️ La sélection est PHOTOGRAPHIÉE à l'ouverture du menu : le menu puis la
// fenêtre prennent le focus, et la sélection de l'éditeur serait perdue.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ecrireCarte, lireCarte, type Carte } from "../../lib/carte";
import { getLang, t, tp } from "../../lib/i18n";
import {
  aDesBlocs,
  blocResume,
  candidatsLiens,
  carteDepuisIa,
  htmlDeTexte,
  liensUtilisables,
  texteDeHtml,
  type Candidat,
  type LienPropose,
} from "../../lib/ia/texteNote";
import { useIaPossible } from "../../lib/ia/useIa";
import { extraireMentions, jetonMention } from "../../lib/mentions";
import { createLink, createNote, rechercherPartout, uidDe } from "../../lib/repo";
import { afficherToast } from "../../lib/toast";
import type { LinkKind } from "../../lib/types";
import MenuContextuel from "../menu/MenuContextuel";
import { entreesIaNote, nomDeLangue, nomDeTon, type ActionNoteIa } from "../menu/catalogue/ia";
import { useMenuContextuel } from "../menu/useMenuContextuel";
import { Avant, useAppel } from "./communs";
import { FenetreIa } from "./FenetreIa";
import { IconeIa } from "./IconeIa";

/** Ce que l'éditeur prête à l'IA. */
export interface EditeurIa {
  racine: () => HTMLElement | null;
  /** Le contenu a changé par programme : `aTape` + `emit()` (voir `RichNoteEditor`). */
  marquerModifie: () => void;
  /** Pose une carte comme un bloc carte normal. Absent = l'éditeur n'a pas de cartes. */
  insererCarte?: (c: Carte) => void;
}

interface Photo {
  action: ActionNoteIa;
  /** La sélection au moment du clic, ou `null` (pas de sélection dans la note). */
  selection: { range: Range; html: string } | null;
  /** Le corps de la note à ce moment-là. */
  html: string;
}

/** Les familles qu'une note peut citer par `@` et que l'IA peut proposer. */
const FAMILLES_LIENS: readonly LinkKind[] = ["note", "knowledge", "task", "goal", "event"];

const LIMITES = { resumer: 60_000, reecrire: 20_000, developper: 4_000, liens: 20_000, traduire: 20_000, carte: 20_000 };

function selectionDans(racine: HTMLElement): Photo["selection"] {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!racine.contains(range.commonAncestorContainer)) return null;
  const boite = document.createElement("div");
  boite.appendChild(range.cloneContents());
  return { range: range.cloneRange(), html: boite.innerHTML };
}

function poser(racine: HTMLElement, range: Range): void {
  racine.focus();
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Insère du HTML (déjà échappé) À LA PLACE de `range` — annulable par ⌘Z. */
function inserer(racine: HTMLElement, range: Range, html: string): void {
  poser(racine, range);
  document.execCommand("insertHTML", false, html);
}

/** Le bloc de premier niveau de la note qui contient `noeud`. */
function blocRacine(racine: HTMLElement, noeud: Node): Node {
  let n: Node = noeud;
  while (n.parentNode && n.parentNode !== racine) n = n.parentNode;
  return n;
}

/**
 * Où finit la première occurrence de `passage` dans le TEXTE de la note —
 * jamais dans une mention existante ni dans un bloc. `null` si introuvable
 * (le passage chevauche deux mises en forme, ou la note a changé).
 */
function finDuPassage(racine: HTMLElement, passage: string): Range | null {
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      (n.parentElement?.closest(".mention, figure") ?? null) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    const i = (n.textContent ?? "").replace(/ /g, " ").indexOf(passage);
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i + passage.length);
    r.collapse(true);
    return r;
  }
  return null;
}

export function NoteIa({
  editeur,
  titre,
  source,
  onNoteCreee,
  classeBouton,
}: {
  editeur: EditeurIa;
  titre: string;
  source?: { kind: LinkKind; uid: string };
  /** Une note traduite vient d'être créée : l'appelant relit sa liste. */
  onNoteCreee?: (id: number) => void | Promise<void>;
  classeBouton?: string;
}) {
  const possible = useIaPossible();
  const menu = useMenuContextuel<{ selection: boolean }>();
  const [photo, setPhoto] = useState<Photo | null>(null);
  // La sélection, prise au clic sur le bouton — AVANT que le menu ne prenne le focus.
  const [prise, setPrise] = useState<Photo["selection"]>(null);
  if (!possible) return null;

  return (
    <>
      <button
        type="button"
        data-tip={t("IA")}
        data-tip-sub={t("Résumer, réécrire, relier, développer, traduire, faire une carte. Tu valides avant que rien ne change.")}
        aria-label={t("Actions d'IA sur la note")}
        aria-haspopup="menu"
        aria-expanded={menu.ouvert}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          const racine = editeur.racine();
          const s = racine ? selectionDans(racine) : null;
          setPrise(s);
          menu.ouvrirSousLeBouton(e, { selection: !!s });
        }}
        className={
          classeBouton ??
          "flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
        }
      >
        <IconeIa className="h-3.5 w-3.5" />
        <span className="text-xs">{t("IA")}</span>
      </button>
      <MenuContextuel
        etat={menu}
        libelle={t("Actions d'IA sur la note")}
        entrees={entreesIaNote(
          (action) => {
            const racine = editeur.racine();
            if (racine) setPhoto({ action, selection: prise, html: racine.innerHTML });
          },
          { selection: !!menu.cible?.selection },
        )}
      />
      {photo && (
        <Fenetre
          photo={photo}
          editeur={editeur}
          titre={titre}
          source={source}
          onNoteCreee={onNoteCreee}
          fermer={() => setPhoto(null)}
        />
      )}
    </>
  );
}

// ── La fenêtre ──────────────────────────────────────────────────────────────

interface PropsFenetre {
  photo: Photo;
  editeur: EditeurIa;
  titre: string;
  source?: { kind: LinkKind; uid: string };
  onNoteCreee?: (id: number) => void | Promise<void>;
  fermer: () => void;
}

function Fenetre(p: PropsFenetre) {
  switch (p.photo.action.genre) {
    case "resumer":
      return <Resumer {...p} />;
    case "reecrire":
      return <Reecrire {...p} ton={p.photo.action.ton} />;
    case "developper":
      return <Developper {...p} />;
    case "liens":
      return <Liens {...p} />;
    case "traduire":
      return <Traduire {...p} cible={p.photo.action.cible} />;
    case "carte":
      return <CarteIa {...p} />;
  }
}

function Vide({ titre, fermer, children }: { titre: string; fermer: () => void; children: ReactNode }) {
  return (
    <FenetreIa titre={titre} onFermer={fermer}>
      <p className="text-sm leading-relaxed text-text">{children}</p>
    </FenetreIa>
  );
}

/** Un texte du modèle, rendu en NŒUDS TEXTE — jamais interprété. */
function Texte({ children }: { children: string }) {
  return (
    <pre className="max-h-[22rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 font-sans text-sm leading-relaxed text-text">
      {children}
    </pre>
  );
}

function Boutons({ libelle, onValider, fermer, second }: { libelle: string; onValider: () => void | Promise<void>; fermer: () => void; second?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void onValider()} className="pill fill-primary px-4 py-2 text-sm font-semibold">
        {libelle}
      </button>
      <button type="button" onClick={fermer} className="pill border border-border px-4 py-2 text-sm hover:bg-overlay">
        {second ?? t("Annuler")}
      </button>
    </div>
  );
}

// ── #20 Résumer ─────────────────────────────────────────────────────────────

function Resumer({ photo, editeur, titre, fermer }: PropsFenetre) {
  const texte = useMemo(() => texteDeHtml(photo.html).slice(0, LIMITES.resumer), [photo.html]);
  const payload = { lang: getLang(), titre: titre.slice(0, 300), texte };
  const { etat, sortie, lancer } = useAppel("resumer");
  const nom = t("Résumer la note");
  if (!texte) return <Vide titre={nom} fermer={fermer}>{t("La note est vide : il n'y a rien à résumer.")}</Vide>;

  return (
    <FenetreIa titre={nom} onFermer={fermer}>
      {sortie ? (
        <div className="flex flex-col gap-3 text-sm text-text">
          <p className="leading-relaxed">{sortie.resume}</p>
          {sortie.points.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {sortie.points.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          )}
          <Boutons
            libelle={t("Insérer en tête de la note")}
            second={t("Fermer sans insérer")}
            fermer={fermer}
            onValider={() => {
              const racine = editeur.racine();
              if (racine) {
                const debut = document.createRange();
                debut.setStart(racine, 0);
                debut.collapse(true);
                inserer(racine, debut, blocResume(t("Résumé"), sortie));
                editeur.marquerModifie();
              }
              fermer();
            }}
          />
        </div>
      ) : (
        <Avant payload={payload} libelle={t("Résumer")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>{t("L'IA résume la note en quelques phrases et en points clés. Tu choisis ensuite de poser le résumé en tête de la note, ou de simplement le lire.")}</p>
        </Avant>
      )}
    </FenetreIa>
  );
}

// ── #21 Réécrire ────────────────────────────────────────────────────────────

function Reecrire({ photo, editeur, fermer, ton }: PropsFenetre & { ton: "clair" | "court" | "pro" }) {
  const source = photo.selection?.html ?? photo.html;
  const texte = useMemo(() => texteDeHtml(source), [source]);
  const payload = { lang: getLang(), ton, texte: texte.slice(0, LIMITES.reecrire) };
  const { etat, sortie, lancer } = useAppel("reecrire");
  const nom = `${photo.selection ? t("Réécrire la sélection") : t("Réécrire la note")} — ${nomDeTon(ton)}`;

  if (!texte) return <Vide titre={nom} fermer={fermer}>{t("Il n'y a pas de texte à réécrire.")}</Vide>;
  // ⚠️ Réécrire la note ENTIÈRE remplacerait ses blocs (carte, image, pièce
  // jointe) et ses mentions par du texte : on le refuse, et on dit quoi faire.
  if (!photo.selection && aDesBlocs(photo.html))
    return (
      <Vide titre={nom} fermer={fermer}>
        {t("Cette note contient des blocs ou des liens @ (carte, image, fichier, mention) qu'une réécriture complète détruirait. Sélectionne le passage à réécrire, puis relance.")}
      </Vide>
    );
  if (texte.length > LIMITES.reecrire)
    return <Vide titre={nom} fermer={fermer}>{t("Ce texte est trop long pour être réécrit d'un coup. Sélectionne un passage plus court.")}</Vide>;

  return (
    <FenetreIa titre={nom} onFermer={fermer} large>
      {sortie ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="hud-label mb-1.5">{t("Avant")}</p>
              <Texte>{texte}</Texte>
            </div>
            <div>
              <p className="hud-label mb-1.5">{t("Après")}</p>
              <Texte>{sortie.texte}</Texte>
            </div>
          </div>
          <p className="text-xs text-text-dim">
            {t("La mise en forme en ligne (gras, couleurs) n'est pas conservée. Après acceptation, « Annuler » (⌘Z) dans la note revient au texte d'avant.")}
          </p>
          <Boutons
            libelle={t("Accepter")}
            fermer={fermer}
            onValider={() => {
              const racine = editeur.racine();
              if (racine) {
                let range = photo.selection?.range ?? null;
                if (!range) {
                  range = document.createRange();
                  range.selectNodeContents(racine);
                }
                inserer(racine, range, htmlDeTexte(sortie.texte));
                editeur.marquerModifie();
              }
              fermer();
            }}
          />
        </div>
      ) : (
        <Avant payload={payload} libelle={t("Réécrire")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>{t("L'IA propose une nouvelle version, affichée à côté de l'originale. Rien ne change dans la note avant que tu acceptes.")}</p>
        </Avant>
      )}
    </FenetreIa>
  );
}

// ── #25 Développer ──────────────────────────────────────────────────────────

function Developper({ photo, editeur, titre, fermer }: PropsFenetre) {
  const puces = useMemo(() => texteDeHtml(photo.selection?.html ?? ""), [photo.selection]);
  const payload = { lang: getLang(), titre: titre.slice(0, 300), puces: puces.slice(0, LIMITES.developper) };
  const { etat, sortie, lancer } = useAppel("developper");
  const nom = t("Développer la sélection");
  if (!photo.selection || !puces) return <Vide titre={nom} fermer={fermer}>{t("Sélectionne d'abord les puces à développer.")}</Vide>;
  if (puces.length > LIMITES.developper)
    return <Vide titre={nom} fermer={fermer}>{t("La sélection est trop longue : développer part de quelques puces.")}</Vide>;

  return (
    <FenetreIa titre={nom} onFermer={fermer} large={!!sortie}>
      {sortie ? (
        <div className="flex flex-col gap-3">
          <Texte>{sortie.texte}</Texte>
          <Boutons
            libelle={t("Insérer après la sélection")}
            fermer={fermer}
            onValider={() => {
              const racine = editeur.racine();
              const sel = photo.selection;
              if (racine && sel && racine.contains(sel.range.endContainer)) {
                // Après le BLOC qui porte la fin de la sélection : le texte
                // développé ne s'imbrique pas dans la liste de puces.
                const apres = document.createRange();
                apres.setStartAfter(blocRacine(racine, sel.range.endContainer));
                apres.collapse(true);
                inserer(racine, apres, htmlDeTexte(sortie.texte));
                editeur.marquerModifie();
              }
              fermer();
            }}
          />
        </div>
      ) : (
        <Avant payload={payload} libelle={t("Développer")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>{t("L'IA rédige un texte à partir des puces sélectionnées, sans rien y ajouter de son cru. Le texte arrive en proposition, à insérer après la sélection.")}</p>
        </Avant>
      )}
    </FenetreIa>
  );
}

// ── #24 Liens @ ─────────────────────────────────────────────────────────────

function Liens({ photo, editeur, source, fermer }: PropsFenetre) {
  const texte = useMemo(() => texteDeHtml(photo.html).slice(0, LIMITES.liens), [photo.html]);
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const { etat, sortie, lancer } = useAppel("liens");
  const [restants, setRestants] = useState<LienPropose[] | null>(null);
  const nom = t("Suggérer des liens @");

  // ⭐ La présélection est LOCALE : la recherche de l'app, sur les mots de la note.
  useEffect(() => {
    let vivant = true;
    const exclus = [...(source ? [source] : []), ...extraireMentions(photo.html).map((m) => ({ kind: m.kind, uid: m.uid }))];
    candidatsLiens(texte, (mot) => rechercherPartout(mot, { limite: 8, familles: FAMILLES_LIENS, exclure: source }), exclus)
      .then((c) => vivant && setCandidats(c))
      .catch(() => vivant && setCandidats([]));
    return () => {
      vivant = false;
    };
  }, [texte, photo.html, source]);

  useEffect(() => {
    if (sortie && candidats) setRestants(liensUtilisables(texte, candidats, sortie.liens));
  }, [sortie, candidats, texte]);

  if (!texte) return <Vide titre={nom} fermer={fermer}>{t("La note est vide : il n'y a rien à relier.")}</Vide>;
  if (!candidats) return <Vide titre={nom} fermer={fermer}>{t("Recherche des objets proches de cette note…")}</Vide>;
  if (candidats.length === 0)
    return <Vide titre={nom} fermer={fermer}>{t("Aucun objet de Shale ne ressemble à cette note : rien à relier. Aucune action n'a été consommée.")}</Vide>;

  const payload = {
    lang: getLang(),
    texte,
    candidats: candidats.map((c) => ({ id: c.id, genre: c.kind as "note" | "knowledge" | "task" | "goal" | "event", titre: c.titre })),
  };

  const relier = (l: LienPropose) => {
    const racine = editeur.racine();
    const ou = racine ? finDuPassage(racine, l.passage) : null;
    if (racine && ou) {
      inserer(racine, ou, ` ${jetonMention(l.candidat.kind, l.candidat.uid, l.candidat.titre)}&nbsp;`);
      editeur.marquerModifie();
    } else {
      afficherToast({ msg: t("Ce passage n'est plus dans la note : lien non posé.") });
    }
    setRestants((r) => (r ?? []).filter((x) => x !== l));
  };

  return (
    <FenetreIa titre={nom} onFermer={fermer} large={!!restants}>
      {restants ? (
        restants.length === 0 ? (
          <div className="text-sm text-text">
            <p>{sortie && sortie.liens.length === 0 ? t("L'IA n'a trouvé aucun lien pertinent.") : t("Plus de suggestion.")}</p>
            <button type="button" onClick={fermer} className="mt-3 text-sm font-medium text-blue hover:underline">
              {t("Fermer")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="hud-label">{tp(restants.length, "{n} suggestion", "{n} suggestions")}</p>
            <ul className="flex flex-col gap-2">
              {restants.map((l, i) => (
                <li key={`${i}-${l.candidat.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="text-text-dim">« {l.passage} »</span>
                    <span className="mx-1.5 text-text-dim">→</span>
                    <span className="font-medium text-text">@{l.candidat.titre}</span>
                  </span>
                  <button type="button" onClick={() => relier(l)} className="pill fill-primary px-3 py-1 text-xs font-semibold">
                    {t("Relier")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestants((r) => (r ?? []).filter((x) => x !== l))}
                    className="pill border border-border px-3 py-1 text-xs hover:bg-overlay"
                  >
                    {t("Ignorer")}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-dim">{t("Le lien @ est posé juste après le passage. Rien n'est relié sans ton clic.")}</p>
          </div>
        )
      ) : (
        <Avant payload={payload} libelle={t("Suggérer des liens")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>
            {tp(
              candidats.length,
              "Shale a trouvé {n} objet proche de cette note. L'IA ne voit que cette liste et propose où le citer ; tu acceptes ou refuses chaque lien.",
              "Shale a trouvé {n} objets proches de cette note. L'IA ne voit que cette liste et propose où les citer ; tu acceptes ou refuses chaque lien.",
            )}
          </p>
        </Avant>
      )}
    </FenetreIa>
  );
}

// ── #26 Traduire ────────────────────────────────────────────────────────────

function Traduire({ photo, titre, source, onNoteCreee, fermer, cible }: PropsFenetre & { cible: "fr" | "en" | "es" | "de" | "it" | "pt" }) {
  const texte = useMemo(() => texteDeHtml(photo.html), [photo.html]);
  const payload = { lang: getLang(), cible, titre: titre.slice(0, 300), texte: texte.slice(0, LIMITES.traduire) };
  const { etat, sortie, lancer } = useAppel("traduire");
  const nom = t("Traduire en {langue}", { langue: nomDeLangue(cible).toLowerCase() });
  if (!texte) return <Vide titre={nom} fermer={fermer}>{t("La note est vide : il n'y a rien à traduire.")}</Vide>;
  if (texte.length > LIMITES.traduire)
    return <Vide titre={nom} fermer={fermer}>{t("Cette note est trop longue pour être traduite d'un coup.")}</Vide>;

  const creer = async () => {
    if (!sortie) return;
    const id = await createNote(sortie.titre.trim() || titre, htmlDeTexte(sortie.texte));
    // Reliée à l'originale : la traduction la cite, l'originale la voit en retour.
    const uid = await uidDe("note", id);
    if (source && uid) await createLink({ from_kind: "note", from_uid: uid, to_kind: source.kind, to_uid: source.uid, origin: "manual" });
    await onNoteCreee?.(id);
    afficherToast({ msg: t("Traduction créée : « {titre} »", { titre: sortie.titre.trim() || titre }) });
    fermer();
  };

  return (
    <FenetreIa titre={nom} onFermer={fermer} large={!!sortie}>
      {sortie ? (
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold text-text">{sortie.titre}</p>
          <Texte>{sortie.texte}</Texte>
          <Boutons libelle={t("Créer la note traduite")} fermer={fermer} onValider={creer} />
        </div>
      ) : (
        <Avant payload={payload} libelle={t("Traduire")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>
            {t("La traduction devient une nouvelle note, reliée à celle-ci. L'originale n'est pas modifiée.")}{" "}
            {aDesBlocs(photo.html) ? t("Les blocs (carte, image, fichier) ne sont pas repris ; les liens @ deviennent du texte.") : ""}
          </p>
        </Avant>
      )}
    </FenetreIa>
  );
}

// ── #27 Carte mentale ───────────────────────────────────────────────────────

function CarteIa({ photo, editeur, titre, fermer }: PropsFenetre) {
  const texte = useMemo(() => texteDeHtml(photo.html).slice(0, LIMITES.carte), [photo.html]);
  const payload = { lang: getLang(), titre: titre.slice(0, 300), texte };
  const { etat, sortie, lancer } = useAppel("carte");
  const nom = t("Faire une carte mentale");
  // ⭐ Validée par le lecteur EXISTANT (`lireCarte`) : ids, racine unique, orphelins.
  const carte = useMemo(() => (sortie ? lireCarte(ecrireCarte(carteDepuisIa(sortie))) : null), [sortie]);
  if (!texte) return <Vide titre={nom} fermer={fermer}>{t("La note est vide : il n'y a rien à mettre en carte.")}</Vide>;
  if (!editeur.insererCarte) return <Vide titre={nom} fermer={fermer}>{t("Cet éditeur ne porte pas de carte mentale.")}</Vide>;

  return (
    <FenetreIa titre={nom} onFermer={fermer} large={!!sortie}>
      {sortie ? (
        carte && carte.noeuds.length > 1 ? (
          <div className="flex flex-col gap-3">
            <ul className="max-h-[22rem] overflow-auto rounded-lg bg-surface-2 p-3 text-sm text-text">
              {carte.noeuds.map((n) => {
                let profondeur = 0;
                for (let p = n.parent; p; p = carte.noeuds.find((x) => x.id === p)?.parent ?? null) profondeur++;
                return (
                  <li key={n.id} style={{ paddingLeft: `${profondeur * 1.1}rem` }} className={profondeur === 0 ? "font-semibold" : ""}>
                    {profondeur > 0 ? "– " : ""}
                    {n.texte}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-text-dim">{t("La carte est insérée en fin de note, comme un bloc normal : double-clic pour la modifier.")}</p>
            <Boutons
              libelle={t("Insérer la carte")}
              fermer={fermer}
              onValider={() => {
                editeur.insererCarte?.(carte);
                fermer();
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-text">{t("L'IA n'a pas trouvé de structure à mettre en carte.")}</p>
        )
      ) : (
        <Avant payload={payload} libelle={t("Faire la carte")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>{t("L'IA dégage la structure de la note : une idée centrale, des branches, leurs détails. Tu vois le plan avant de l'insérer.")}</p>
        </Avant>
      )}
    </FenetreIa>
  );
}
