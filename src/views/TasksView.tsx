import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import TaskModal from "../components/TaskModal";
import { recurrenceLabel, todayStr } from "../lib/logic";
import { addTag, basculerTache, createTask, deleteTag, renommerTache } from "../lib/repo";
import { CaseACocher, useCochesOptimistes } from "../components/CaseACocher";
import type { AppData, Priority, Tag, Task } from "../lib/types";
import { IconChevronDown, IconPlus, IconSearch, IconSliders, IconTarget, IconTrash, IconX } from "../components/icons";

import { pick, t, tp } from "../lib/i18n";
import ConfirmationEnLigne from "../components/ConfirmationEnLigne";
import BadgeExemple from "../components/onboarding/BadgeExemple";
import { estExemple } from "../lib/onboarding/exemples";
import { consommerDemande, ouvrirParId } from "../lib/naviguer";
import MenuContextuel, { BoutonMenu } from "../components/menu/MenuContextuel";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import { entreesTache, gestesCommunsTache, type GestesTache } from "../components/menu/catalogue/tache";
import { formaterChamp, libelleRelatif } from "../lib/calendrier/champDate";
import { ORDRE_SECTIONS, correspond, ranger, type CleSection, type LigneVue } from "../lib/tachesVue";

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

/**
 * ⭐ LA VUE TÂCHES — rangée par MOMENT (refonte du 2026-09-30).
 *
 * Antonin : « améliore le design de l'onglet Tâches, son intuitivité ». Avant :
 * une liste plate triée par priorité, sans une seule date à l'écran, trois
 * familles de filtres qui se recouvraient (statut, tag, « échéance »), et le
 * panneau de gestion des tags collé sous la liste. Maintenant :
 *   • une ligne d'AJOUT RAPIDE en haut (Entrée) — la fenêtre complète reste
 *     derrière « + Nouvelle tâche » ;
 *   • les tâches rangées par moment (`lib/tachesVue.ts`) : En retard,
 *     Aujourd'hui, À venir, Sans date, Routines, Faites (repliées) ;
 *   • UNE ligne de méta sous chaque tâche — l'échéance, le créneau, le rythme,
 *     l'objectif (cliquable), le report. La priorité, qui n'était qu'un point
 *     de 6 px, colore maintenant le contour de la case ;
 *   • les tags comme seul filtre, avec une recherche ; leur gestion derrière
 *     « Gérer », dépliée à la demande.
 *
 * ⚠️ Plus de filtre « échéance » (un jour précis) : les sections disent déjà
 * quand, et le Calendrier montre un jour donné. Plus de grille redimensionnable
 * non plus — une liste se lit en une colonne, comme la vue Objectifs refaite
 * la veille.
 */

/**
 * Le contour de la case selon la priorité. Basse = la case de tout le monde.
 * ⚠️ Des `var(...)`, jamais d'hex : ce sont les tokens des deux thèmes.
 */
const ANNEAU: Record<Priority, string | undefined> = {
  high: "var(--color-red)",
  medium: "var(--color-yellow)",
  low: undefined,
};

/** Les couleurs proposées pour un nouveau tag. ⚠️ Accordées aux tokens (DESIGN.md). */
const TAG_COLORS = [
  "var(--color-blue)",
  "var(--color-green)",
  "var(--color-yellow)",
  "var(--color-red)",
  "var(--color-violet)",
  "#fb8b4e",
  "#ef6ba8",
  "#3cc4de",
];

/** Combien de tâches faites on montre avant « Afficher les autres ». */
const FAITES_VISIBLES = 20;
/** Combien de temps une tâche qu'on vient de cocher reste là où on l'a cochée. */
const DELAI_DEPART_MS = 1200;
/** La clé des sections repliées — une commodité de CE poste, jamais synchronisée. */
const CLE_REPLIS = "shale.taches.replis";

/** Les libellés des sections. ⚠️ Une FONCTION : `t()` à l'affichage, jamais à l'import. */
function libelleSection(s: CleSection): string {
  switch (s) {
    case "retard":
      return t("En retard");
    case "aujourdhui":
      return t("Aujourd'hui");
    case "avenir":
      return t("À venir");
    case "sansDate":
      return t("Sans date");
    case "routines":
      return t("Routines");
    case "faites":
      return t("Faites");
  }
}

/** Ce que dit la section, pour qui passe sur son titre. */
function aideSection(s: CleSection): string {
  switch (s) {
    case "retard":
      return t("Datées d'avant aujourd'hui, pas encore faites.");
    case "aujourdhui":
      return t("Datées d'aujourd'hui, et les routines du jour.");
    case "avenir":
      return t("Datées de demain ou plus tard.");
    case "sansDate":
      return t("Ni date ni rythme : à faire quand tu peux.");
    case "routines":
      return t("Les tâches récurrentes qui ne tombent pas aujourd'hui.");
    case "faites":
      return t("Les ponctuelles cochées, et les routines cochées aujourd'hui.");
  }
}

function lireReplis(): Set<CleSection> {
  try {
    const brut = localStorage.getItem(CLE_REPLIS);
    if (brut) return new Set(JSON.parse(brut) as CleSection[]);
  } catch {
    /* stockage indisponible : les défauts */
  }
  return new Set<CleSection>(["faites"]);
}

/** « hier », « demain », sinon « mar. 22 sept. » — une date au fil d'une ligne. */
function auFilDeLaLigne(jour: string, aujourdHui: string): string {
  const relatif = libelleRelatif(jour, aujourdHui);
  return relatif ? relatif.toLocaleLowerCase() : formaterChamp(jour, aujourdHui);
}

export default function TasksView({ data, refresh }: Props) {
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  /** La tâche dont le libellé est en cours de renommage, EN PLACE. */
  const [renommeId, setRenommeId] = useState<number | null>(null);
  const [replis, setReplis] = useState<Set<CleSection>>(lireReplis);
  const [toutesFaites, setToutesFaites] = useState(false);
  const [gererTags, setGererTags] = useState(false);
  /** La tâche qu'on vient d'ajouter : surlignée un instant, pour qu'on la voie arriver. */
  const [nouvelle, setNouvelle] = useState<number | null>(null);
  /** Les tâches qu'on vient de cocher ou de rouvrir restent un instant à leur place. */
  const [garder, setGarder] = useState<ReadonlyMap<number, CleSection>>(new Map());
  const [brouillon, setBrouillon] = useState("");
  const menu = useMenuContextuel<LigneVue>();

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const today = todayStr();

  /**
   * Ouvrir la tâche qu'on demande d'ailleurs — une mention `@`, ou « Modifier… »
   * dans le menu d'une tâche du widget d'Aujourd'hui (`lib/naviguer.ts`).
   *
   * ⚠️ Les tâches sont lues par une RÉFÉRENCE : l'écouteur est posé une fois, et
   * une fermeture sur `data.tasks` garderait la liste du premier affichage —
   * une tâche créée depuis ne s'ouvrirait jamais (PIEGES § 6.5, transposé aux
   * fermetures).
   */
  const tachesRef = useRef(data.tasks);
  tachesRef.current = data.tasks;
  useEffect(() => {
    const ouvrir = (id: number) => {
      const tache = tachesRef.current.find((x) => x.id === id);
      if (tache) setEditing(tache);
    };
    const onOpen = (e: Event) => ouvrir((e as CustomEvent<number>).detail);
    window.addEventListener("sb:open-task", onOpen);
    const enAttente = consommerDemande("task");
    if (enAttente) ouvrir(enAttente);
    return () => window.removeEventListener("sb:open-task", onOpen);
  }, []);

  // action palette "Nouvelle tâche" → ouvre le formulaire
  useEffect(() => {
    const onNew = () => setCreating(true);
    window.addEventListener("sb:new-task", onNew);
    return () => window.removeEventListener("sb:new-task", onNew);
  }, []);

  const { etat, basculer } = useCochesOptimistes();

  const objectifDe = (goalId: number | null) =>
    goalId == null ? null : (data.goals.find((g) => g.id === goalId) ?? null);
  const tagColor = (name: string | null) => data.tags.find((x) => x.name === name)?.color ?? "var(--color-blue)";

  // ─── Le rangement ────────────────────────────────────────────────────────

  const filtrees = useMemo(
    () =>
      data.tasks.filter(
        (x) =>
          (!tagFilter || x.tag === tagFilter) &&
          correspond(x, data.goals.find((g) => g.id === x.goal_id)?.title ?? null, recherche),
      ),
    [data.tasks, data.goals, tagFilter, recherche],
  );

  const sections = useMemo(
    () =>
      ranger(filtrees, data.completions, today, {
        coche: (task, faite) => etat(`t${task.id}:${today}`, faite),
        garder,
      }),
    [filtrees, data.completions, today, etat, garder],
  );
  /** Toutes les lignes affichées, à plat — pour le menu, qui relit la ligne FRAÎCHE. */
  const lignes = useMemo(() => ORDRE_SECTIONS.flatMap((s) => sections.get(s)!), [sections]);

  const ouvertes = (s: CleSection) => sections.get(s)!.filter((x) => !x.done).length;
  const nAujourdhui = ouvertes("aujourdhui");
  const nRetard = ouvertes("retard");
  const resume = [
    nAujourdhui > 0 && tp(nAujourdhui, "{n} tâche aujourd'hui", "{n} tâches aujourd'hui"),
    nRetard > 0 && tp(nRetard, "{n} en retard", "{n} en retard"),
  ].filter((x): x is string => !!x);

  // ─── Les gestes ──────────────────────────────────────────────────────────

  /**
   * Cocher. La tâche reste un instant dans la section du clic, barrée, puis
   * rejoint « Faites » (ou en revient) : une ligne qui s'enfuit sous le curseur
   * au moment du clic, on ne voit même pas qu'on l'a cochée.
   *
   * ⚠️ Décocher une PONCTUELLE efface toutes ses coches (`basculerTache`) : elle
   * s'affiche faite dès qu'un jour quelconque la dit faite.
   */
  const handleToggle = (task: LigneVue) => {
    const ici = ORDRE_SECTIONS.find((s) => sections.get(s)!.some((x) => x.id === task.id));
    if (ici) {
      setGarder((m) => new Map(m).set(task.id, ici));
      window.setTimeout(
        () =>
          setGarder((m) => {
            const n = new Map(m);
            n.delete(task.id);
            return n;
          }),
        DELAI_DEPART_MS,
      );
    }
    return basculer(`t${task.id}:${today}`, task.done, async (fait) => {
      await basculerTache(task, today, fait);
      await refresh();
    });
  };

  /**
   * ⭐ Les gestes du menu contextuel — et du bouton « ⋯ », qui en est le jumeau.
   * Chacun est la fonction du geste qui existait déjà (règle 18) : la case,
   * le clic sur la tâche, et pour le reste les gestes communs aux vues qui
   * montrent une tâche (`catalogue/tache.tsx`).
   */
  const gestes: GestesTache = {
    ...gestesCommunsTache(refresh),
    basculer: (task) => void handleToggle(task as LigneVue),
    renommer: (task) => setRenommeId(task.id),
    modifier: (task) => setEditing(task),
  };

  const validerRenommage = async (task: Task, libelle: string) => {
    setRenommeId(null);
    if (libelle.trim() && libelle.trim() !== task.label) {
      await renommerTache(task.id, libelle);
      await refresh();
    }
  };

  /**
   * ⭐ L'AJOUT RAPIDE : un libellé, Entrée. La tâche naît sans date, avec le
   * tag qu'on regarde — comme la ligne d'ajout du widget d'Aujourd'hui. Le
   * reste (date, rythme, objectif) se règle ensuite, au menu ou en l'ouvrant.
   */
  const ajouter = async () => {
    const label = brouillon.trim();
    if (!label) return;
    setBrouillon("");
    const id = await createTask({ label, tag: tagFilter, priority: "medium", recurrence: "none", goal_id: null });
    // Elle doit se VOIR arriver : sa section se déplie, la recherche s'efface.
    setRecherche("");
    setReplis((r) => {
      if (!r.has("sansDate")) return r;
      const n = new Set(r);
      n.delete("sansDate");
      return n;
    });
    await refresh();
    setNouvelle(id);
  };

  useEffect(() => {
    if (nouvelle == null) return;
    document.querySelector(`[data-tache="${nouvelle}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const minuterie = window.setTimeout(() => setNouvelle(null), 1600);
    return () => window.clearTimeout(minuterie);
  }, [nouvelle]);

  const replier = (s: CleSection) =>
    setReplis((r) => {
      const n = new Set(r);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      try {
        localStorage.setItem(CLE_REPLIS, JSON.stringify([...n]));
      } catch {
        /* stockage indisponible : le repli vaut pour la séance */
      }
      return n;
    });

  // ─── Les tags ────────────────────────────────────────────────────────────

  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    await addTag(name, newTagColor);
    setNewTagName("");
    await refresh();
  };

  /**
   * Supprimer un tag le RETIRE de toutes ses tâches, sans retour : rien ne
   * garde la trace de qui le portait. Utilisé, il demande donc confirmation, et
   * dit combien de tâches le perdent (2026-09-24). Inutilisé, il part d'un clic.
   */
  const [tagASupprimer, setTagASupprimer] = useState<Tag | null>(null);
  /** Le clic droit sur un tag : filtrer, ou supprimer (avec la même question que la croix). */
  const menuTag = useMenuContextuel<Tag>();
  const tachesDuTag = (tag: Tag) => data.tasks.filter((x) => x.tag === tag.name).length;
  const effacerTag = async (tag: Tag) => {
    setTagASupprimer(null);
    await deleteTag(tag);
    if (tagFilter === tag.name) setTagFilter(null);
    await refresh();
  };
  const handleDeleteTag = async (tag: Tag) => {
    if (tachesDuTag(tag) > 0) {
      // La question vit dans le panneau de gestion : on l'ouvre pour la poser.
      setGererTags(true);
      setTagASupprimer(tag);
      return;
    }
    await effacerTag(tag);
  };

  // ─── Une ligne ───────────────────────────────────────────────────────────

  /**
   * Les morceaux de la ligne de méta. `classe` habille le morceau ET son
   * séparateur : un morceau masqué sur bureau (le tag) ne doit pas laisser son
   * « · » traîner en fin de ligne — vu à l'écran le 2026-09-30.
   */
  const meta = (task: LigneVue, section: CleSection): { noeud: ReactNode; classe?: string }[] => {
    const out: { noeud: ReactNode; classe?: string }[] = [];
    const push = (noeud: ReactNode, classe?: string) => out.push({ noeud, classe });
    if (task.due_date && (section === "retard" || section === "avenir")) {
      push(
        <span key="date" className={section === "retard" ? "font-medium text-red" : undefined}>
          {auFilDeLaLigne(task.due_date, today)}
        </span>,
      );
    }
    if (task.start_at && task.due_date) {
      push(
        <span key="heure" className="tabular-nums">
          {task.end_at ? `${task.start_at}–${task.end_at}` : task.start_at}
        </span>,
      );
    }
    const rythme = recurrenceLabel(task.recurrence);
    if (rythme) {
      push(
        <span key="rythme">
          <span aria-hidden>↻ </span>
          {/* En français, le rythme se lit en minuscule au fil de la ligne. */}
          {pick(rythme.toLocaleLowerCase("fr"), rythme)}
        </span>,
      );
    }
    const objectif = objectifDe(task.goal_id);
    if (objectif) {
      push(
        <button
          key="objectif"
          type="button"
          onClick={() => ouvrirParId("goal", objectif.id)}
          data-tip={t("Ouvrir l'objectif")}
          data-tip-sub={objectif.title}
          className="cible-tactile-ligne inline-flex min-w-0 max-w-full items-center gap-1 rounded transition-colors hover:text-text"
        >
          <IconTarget className="h-3 w-3 shrink-0" />
          <span className="truncate">{objectif.title}</span>
        </button>,
      );
    }
    if (task.postponed_count > 0 && !task.done) {
      push(
        <span key="report" className="text-yellow">
          {tp(task.postponed_count, "reportée une fois", "reportée {n} fois")}
        </span>,
      );
    }
    if (task.tag) {
      // Au doigt, le tag passe dans la méta : la pastille de droite mangerait le libellé.
      push(
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(task.tag) }} aria-hidden />
          {task.tag}
        </span>,
        "sm:hidden",
      );
    }
    return out;
  };

  const ligne = (task: LigneVue, section: CleSection) => {
    const infos = meta(task, section);
    const priorite = task.priority === "high" ? t("Haute") : task.priority === "low" ? t("Basse") : t("Moyenne");
    return (
      /* ⚠️ Clic droit et touches de LIGNE sur le <li> : ils marchent que le
         focus soit sur la case, sur le libellé ou sur « ⋯ ». F2 renomme
         (c'est ce qu'annonce le menu), Maj+F10 / touche Menu ouvre le menu —
         macOS ne le fait pas tout seul (PIEGES § 19.2). */
      <li
        key={task.id}
        data-tache={task.id}
        className={`group/ligne flex items-start gap-3 rounded-[10px] px-3 py-2 transition-colors duration-500 hover:bg-surface-2 ${
          nouvelle === task.id ? "bg-blue/10" : ""
        }`}
        onContextMenu={(e) => menu.ouvrirAuPoint(e, task)}
        onKeyDown={(e) => {
          if (renommeId === task.id) return; // le champ gère ses touches
          if (menu.ouvrirAuClavier(e, task)) return;
          if (e.key !== "F2" || e.defaultPrevented) return;
          e.preventDefault();
          setRenommeId(task.id);
        }}
      >
        <span className="pt-px">
          <CaseACocher
            cochee={task.done}
            onBascule={() => void handleToggle(task)}
            libelle={task.label}
            anneau={ANNEAU[task.priority]}
            tip={task.done ? t("Marquer à faire") : t("Marquer faite")}
            tipSub={t("Priorité {p}", { p: pick(priorite.toLocaleLowerCase("fr"), priorite) })}
          />
        </span>

        <div className="min-w-0 flex-1">
          {renommeId === task.id ? (
            /* ⭐ RENOMMER EN PLACE, jamais dans une fenêtre (cahier des
               charges, § 7). Entrée valide, Échap annule, quitter le champ
               valide — comme un nom de fichier dans le Finder. */
            <input
              autoFocus
              defaultValue={task.label}
              aria-label={t("Nouveau nom de la tâche")}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void validerRenommage(task, e.currentTarget.value);
                } else if (e.key === "Escape") {
                  // On MARQUE la touche : Échap ne doit rien fermer d'autre.
                  e.preventDefault();
                  e.stopPropagation();
                  setRenommeId(null);
                }
              }}
              onBlur={(e) => void validerRenommage(task, e.currentTarget.value)}
              className="w-full rounded-md border border-blue bg-surface px-2 py-0.5 text-sm text-text focus:outline-none"
            />
          ) : (
            /* ⭐ Toucher la tâche l'OUVRE — sa date, son rythme, son objectif
               se règlent là. Avant, le libellé ne répondait à rien : il
               fallait trouver le crayon, qui n'apparaissait qu'au survol. */
            <button
              type="button"
              onClick={() => setEditing(task)}
              title={task.label}
              className={`clamp-2 block w-full text-left text-sm leading-snug ${
                task.done ? "text-text-dim line-through" : "text-text"
              }`}
            >
              {task.label}
            </button>
          )}
          {(infos.length > 0 || estExemple(task)) && (
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-text-dim sm:gap-x-1.5">
              {/* Les « · » au bureau seulement : au doigt, la ligne se replie, et
                  un point en tête de ligne ne sépare plus rien (vu à 390 pt). */}
              {infos.map((x, i) => (
                <span key={i} className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${x.classe ?? ""}`}>
                  {i > 0 && (
                    <span aria-hidden className="hidden sm:inline">
                      ·
                    </span>
                  )}
                  {x.noeud}
                </span>
              ))}
              {estExemple(task) && <BadgeExemple />}
            </div>
          )}
        </div>

        {task.tag && (
          <span
            className="pill mt-0.5 hidden max-w-[28%] shrink-0 truncate px-2 py-0.5 text-[11px] font-medium sm:inline-block"
            style={{
              // color-mix : marche aussi quand la couleur est un token
              // `var(--color-x)` (l'ancien `+ "22"` produisait une valeur
              // invalide → fond transparent).
              backgroundColor: `color-mix(in srgb, ${tagColor(task.tag)} 16%, transparent)`,
              color: tagColor(task.tag),
            }}
            title={task.tag}
          >
            {task.tag}
          </span>
        )}

        <BoutonMenu
          onOuvrir={(e) => menu.ouvrirSousLeBouton(e, task)}
          ouvert={menu.ouvert && menu.cible?.id === task.id}
          libelle={t("Actions sur « {titre} »", { titre: task.label })}
        />
      </li>
    );
  };

  // ─── Une section ─────────────────────────────────────────────────────────

  const section = (s: CleSection) => {
    const rangees = sections.get(s)!;
    if (rangees.length === 0) return null;
    const replie = replis.has(s);
    const visibles = s === "faites" && !toutesFaites ? rangees.slice(0, FAITES_VISIBLES) : rangees;
    const idTitre = `taches-${s}`;
    return (
      <section key={s} aria-labelledby={idTitre}>
        <h2 id={idTitre}>
          <button
            type="button"
            onClick={() => replier(s)}
            aria-expanded={!replie}
            data-tip={libelleSection(s)}
            data-tip-sub={aideSection(s)}
            className="cible-tactile-ligne flex w-full items-center gap-2 rounded-md px-3 pb-1 pt-3 text-left"
          >
            <span className={`hud-label ${s === "retard" ? "text-red" : ""}`}>{libelleSection(s)}</span>
            <span className="text-xs tabular-nums text-text-dim">{rangees.length}</span>
            <IconChevronDown
              className={`h-3.5 w-3.5 text-text-dim transition-transform duration-200 ${replie ? "-rotate-90" : ""}`}
            />
          </button>
        </h2>
        {!replie && (
          <ul className="flex flex-col">
            {visibles.map((x) => ligne(x, s))}
            {visibles.length < rangees.length && (
              <li className="px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => setToutesFaites(true)}
                  className="cible-tactile-ligne text-xs font-medium text-text-dim hover:text-text"
                >
                  {tp(rangees.length - visibles.length, "Afficher la dernière", "Afficher les {n} autres")}
                </button>
              </li>
            )}
          </ul>
        )}
      </section>
    );
  };

  const filtresActifs = !!tagFilter || !!recherche.trim();

  const chip = (active: boolean) =>
    `pill cible-tactile-ligne shrink-0 border px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "border-text/30 bg-surface-2 text-text" : "border-border text-text-dim hover:text-text"
    }`;

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-8">
      <header className="view-head">
        <div className="min-w-0">
          <h1 className="text-3xl text-text">{t("Tâches")}</h1>
          <p className="mt-1 text-sm text-text-dim">
            {resume.length > 0 ? resume.join(" · ") : t("Rien de prévu aujourd'hui.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-tip={t("Nouvelle tâche")}
          data-tip-sub={t("Libellé, tag, priorité, récurrence et objectif lié.")}
          className="pill fill-primary shrink-0 px-4 py-2 text-sm font-semibold"
        >
          {t("+ Nouvelle tâche")}
        </button>
      </header>

      {/* ⭐ L'ajout rapide : un libellé, Entrée. */}
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void ajouter();
        }}
      >
        <label className="flex items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 transition-colors focus-within:border-blue">
          <IconPlus className="h-4 w-4 shrink-0 text-text-dim" />
          <input
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            placeholder={t("Ajouter une tâche…")}
            aria-label={t("Ajouter une tâche")}
            className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-dim focus:outline-none"
          />
          {tagFilter && (
            <span
              className="pill shrink-0 px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${tagColor(tagFilter)} 16%, transparent)`, color: tagColor(tagFilter) }}
              data-tip={t("Elle prendra ce tag")}
              data-tip-sub={t("C'est le tag que tu regardes. Retire le filtre pour ajouter sans tag.")}
            >
              {tagFilter}
            </span>
          )}
          {brouillon.trim() && (
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-dim sm:inline-block">
              {t("Entrée")}
            </kbd>
          )}
        </label>
      </form>

      {/* Les filtres : les tags, et une recherche. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
          <button type="button" onClick={() => setTagFilter(null)} className={chip(tagFilter === null)}>
            {t("Toutes")}
          </button>
          {data.tags.map((tag) => {
            const actif = tagFilter === tag.name;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTagFilter(actif ? null : tag.name)}
                onContextMenu={(e) => menuTag.ouvrirAuPoint(e, tag)}
                data-tip={tag.name}
                data-tip-sub={actif ? t("Retirer ce filtre.") : t("N’afficher que les tâches de ce tag.")}
                className="pill cible-tactile-ligne inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors"
                style={
                  actif
                    ? {
                        borderColor: tag.color,
                        backgroundColor: `color-mix(in srgb, ${tag.color} 16%, transparent)`,
                        color: tag.color,
                      }
                    : { borderColor: "var(--color-border)", color: "var(--color-text-dim)" }
                }
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />
                {tag.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setGererTags((v) => !v)}
            aria-expanded={gererTags}
            data-tip={t("Gérer les tags")}
            data-tip-sub={t("Créer un tag, choisir sa couleur, en supprimer un.")}
            className={`${chip(gererTags)} inline-flex items-center gap-1.5`}
          >
            <IconSliders className="h-3.5 w-3.5" />
            {t("Gérer")}
          </button>
        </div>

        <label className="flex w-full items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5 transition-colors focus-within:border-blue sm:w-56">
          <IconSearch className="h-3.5 w-3.5 shrink-0 text-text-dim" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && recherche) {
                e.preventDefault();
                e.stopPropagation();
                setRecherche("");
              }
            }}
            placeholder={t("Rechercher")}
            aria-label={t("Rechercher une tâche")}
            className="min-w-0 flex-1 bg-transparent text-xs text-text placeholder:text-text-dim focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              aria-label={t("Effacer la recherche")}
              className="cible-tactile shrink-0 text-text-dim hover:text-text"
            >
              <IconX className="h-3 w-3" />
            </button>
          )}
        </label>
      </div>

      {/* La gestion des tags — dépliée à la demande, plus collée sous la liste. */}
      {gererTags && (
        <section className="card mt-3 p-4" aria-label={t("Gérer les tags")}>
          <div className="flex flex-wrap items-center gap-2">
            {data.tags.length === 0 && <span className="text-xs text-text-dim">{t("Aucun tag pour l'instant.")}</span>}
            {data.tags.map((tag) => (
              <span
                key={tag.id}
                onContextMenu={(e) => menuTag.ouvrirAuPoint(e, tag)}
                className="pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: `color-mix(in srgb, ${tag.color} 16%, transparent)`, color: tag.color }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag)}
                  className="cible-tactile opacity-60 hover:opacity-100"
                  aria-label={t("Supprimer le tag {name}", { name: tag.name })}
                  data-tip={t("Supprimer le tag « {name} »", { name: tag.name })}
                  data-tip-sub={t("Les tâches concernées sont conservées, simplement sans tag.")}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {tagASupprimer && (
            <ConfirmationEnLigne
              className="mt-3"
              question={tp(
                tachesDuTag(tagASupprimer),
                "Supprimer le tag « {name} » ? 1 tâche le perd — elle reste, sans tag. C'est définitif.",
                "Supprimer le tag « {name} » ? {n} tâches le perdent — elles restent, sans tag. C'est définitif.",
                { name: tagASupprimer.name },
              )}
              libelle={t("Supprimer")}
              onRenoncer={() => setTagASupprimer(null)}
              onConfirmer={() => effacerTag(tagASupprimer)}
            />
          )}

          <form
            className="mt-3 flex min-w-0 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAddTag();
            }}
          >
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t("Nouveau tag…")}
              aria-label={t("Nom du nouveau tag")}
              className="w-40 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <span className="flex flex-wrap gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`cible-tactile h-5 w-5 rounded-full transition-transform ${newTagColor === c ? "scale-110 ring-2 ring-blue" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={t("Couleur {name}", { name: c })}
                  aria-pressed={newTagColor === c}
                  data-tip={t("Couleur du tag")}
                />
              ))}
            </span>
            <button
              type="submit"
              disabled={!newTagName.trim()}
              className="pill border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </section>
      )}

      {/* La liste, rangée par moment. */}
      <div className="card mt-4 p-2">
        {data.tasks.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-text">{t("Aucune tâche pour l'instant.")}</p>
            <p className="mt-1 text-xs text-text-dim">{t("Écris-en une juste au-dessus, puis Entrée.")}</p>
          </div>
        ) : lignes.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-text-dim">{t("Aucune tâche ne correspond.")}</p>
            {filtresActifs && (
              <button
                type="button"
                onClick={() => {
                  setTagFilter(null);
                  setRecherche("");
                }}
                className="cible-tactile-ligne mt-2 text-xs font-medium text-blue hover:underline"
              >
                {t("Effacer les filtres")}
              </button>
            )}
          </div>
        ) : (
          ORDRE_SECTIONS.map(section)
        )}
      </div>

      {(creating || editing) && (
        <TaskModal
          task={editing}
          tags={data.tags}
          goals={data.goals}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <MenuContextuel
        etat={menuTag}
        libelle={t("Actions sur le tag « {name} »", { name: menuTag.cible?.name ?? "" })}
        entrees={(() => {
          const tag = menuTag.cible && data.tags.find((x) => x.id === menuTag.cible!.id);
          if (!tag) return [];
          return [
            {
              id: "filtrer",
              libelle: tagFilter === tag.name ? t("Ne plus filtrer") : t("Filtrer les tâches"),
              icone: <IconSearch />,
              executer: () => setTagFilter(tagFilter === tag.name ? null : tag.name),
            },
            {
              id: "supprimer",
              // « … » seulement quand une question suivra : un tag inutilisé part d'un coup.
              libelle: tachesDuTag(tag) > 0 ? t("Supprimer…") : t("Supprimer"),
              icone: <IconTrash />,
              danger: true,
              executer: () => handleDeleteTag(tag),
            },
          ];
        })()}
      />

      {/* ⭐ UN SEUL menu pour toute la liste. Les entrées sont recalculées depuis
          les lignes FRAÎCHES : si la synchronisation retire la tâche pendant que
          le menu est ouvert, le tableau devient vide et le menu se ferme seul. */}
      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur « {titre} »", { titre: menu.cible?.label ?? "" })}
        entrees={(() => {
          const fraiche = menu.cible && lignes.find((r) => r.id === menu.cible!.id);
          return fraiche ? entreesTache(fraiche, gestes, { faite: fraiche.done, objectifs: data.goals }) : [];
        })()}
      />
    </div>
  );
}
