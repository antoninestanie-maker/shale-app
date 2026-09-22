import { useEffect, useRef, useState } from "react";
import { t } from "../../lib/i18n";
import type { Trouvaille } from "../../lib/recherche";
import { FAMILLES_RATTACHABLES, rattachementsDe, type ContexteObjectifs } from "../../lib/objectifs/contexte";
import { uidDeLigne } from "../../lib/objectifs/progression";
import { createLink, createTask, rattacherTache, rechercherPartout } from "../../lib/repo";
import { planificationDeSaisie } from "../../lib/taches";
import ChampDate from "../ChampDate";
import type { AppData, Goal, LinkKind } from "../../lib/types";
import { IconLink, IconPlus, IconX } from "../icons";

/**
 * ⭐ Ajouter une tâche, ou rattacher, sans quitter la feuille de route.
 *
 * Un seul champ, qui cherche dans l'existant avec LE moteur de l'app
 * (`rechercherPartout`, celui de ⌘K et de `@`) — deux moteurs finiraient par
 * répondre différemment à la même question. Et qui, si rien ne correspond,
 * propose de CRÉER la tâche : elle naît déjà rattachée. Créer une tâche ailleurs
 * puis revenir la lier, ce serait deux allers-retours pour un seul geste.
 *
 * ⚠️ DEUX CHEMINS, et ils ne se mélangent pas :
 *   • une TÂCHE se rattache par `tasks.goal_id`, le seul chemin qui la fasse
 *     compter (audit du 2026-09-14). Elle n'a donc qu'UN objectif : la rattacher
 *     ici la retire de l'autre, et la ligne le dit avant qu'on valide ;
 *   • une NOTE, une FICHE ou un ÉVÉNEMENT se rattache par une arête
 *     `object_links` d'origine `manual` — qui survit à la réécriture d'un texte
 *     (`diffMentions` ne retire que les arêtes `mention`). Ceux-là peuvent
 *     éclairer plusieurs objectifs à la fois.
 *
 * Seule la tâche se CRÉE d'ici : c'est la seule famille qui naît en une ligne.
 *
 * Clavier : ↑↓ choisissent, `Entrée` rattache et garde le champ ouvert pour la
 * suivante, `Échap` vide puis referme.
 *
 * ⭐ 2026-09-18 — DEUX AFFORDANCES, ANNONCÉES. Antonin : « j'aimerais qu'on
 * puisse directement ajouter des tâches liées aux objectifs dans l'onglet
 * objectif ». C'était déjà possible, et c'est bien le problème : il fallait
 * taper dans un champ intitulé « Rattacher… », puis constater qu'une dernière
 * ligne proposait de créer. Une capacité qu'on ne découvre qu'en se trompant
 * n'existe pas.
 *
 * `BarreAjout` pose donc deux boutons visibles en permanence — « Tâche » et
 * « Rattacher » — et n'ouvre qu'un panneau à la fois. Le coût en gestes ne
 * bouge pas : il fallait déjà cliquer dans le champ pour le remplir.
 *
 * ⚠️ Et la tâche créée depuis la recherche naissait SANS ÉCHÉANCE, donc
 * invisible dans le calendrier et dans « Aujourd'hui » : elle comptait dans
 * l'objectif et nulle part ailleurs. Le composeur porte un `ChampDate`.
 */
const FAMILLES: readonly LinkKind[] = ["task", ...FAMILLES_RATTACHABLES];

export default function RattacherElement(props: {
  goal: Goal;
  data: AppData;
  contexte: ContexteObjectifs;
  refresh: () => Promise<void>;
}) {
  const { goal, data, contexte, refresh } = props;
  const uidObjectif = uidDeLigne("goal", goal);
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<Trouvaille[]>([]);
  const [actif, setActif] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const tour = useRef(0);

  const q = requete.trim();

  // Le panneau s'ouvre sur un clic : le champ prend la frappe sans second clic.
  useEffect(() => {
    champ.current?.focus();
  }, []);

  useEffect(() => {
    if (!q) {
      setResultats([]);
      return;
    }
    const n = ++tour.current;
    const minuteur = window.setTimeout(async () => {
      const trouves = await rechercherPartout(q, { familles: FAMILLES, limite: 8 });
      // Une réponse plus ancienne que la dernière frappe ne remplace rien.
      if (n !== tour.current) return;
      // Ce qui est DÉJÀ rattaché à cet objectif ne se propose pas une seconde fois.
      const deja = new Set(rattachementsDe(uidObjectif, contexte).map((r) => `${r.kind}:${r.uid}`));
      setResultats(
        trouves.filter((r) =>
          r.kind === "task" ? data.tasks.find((x) => x.id === r.id)?.goal_id !== goal.id : !deja.has(`${r.kind}:${r.uid}`),
        ),
      );
      setActif(0);
    }, 120);
    return () => window.clearTimeout(minuteur);
  }, [q, data.tasks, goal.id, uidObjectif, contexte]);

  const identique = resultats.some((r) => r.titre.trim().toLowerCase() === q.toLowerCase());
  // La création est TOUJOURS proposée quand aucun titre n'est identique — en
  // dernier, pour qu'`Entrée` sur une recherche fructueuse rattache l'existant.
  const options: ({ type: "rattacher"; r: Trouvaille } | { type: "creer" })[] = [
    ...resultats.map((r) => ({ type: "rattacher" as const, r })),
    ...(q && !identique ? [{ type: "creer" as const }] : []),
  ];

  const choisir = async (i: number) => {
    const o = options[i];
    if (!o || occupe) return;
    setOccupe(true);
    try {
      if (o.type === "rattacher" && o.r.kind === "task") await rattacherTache(o.r.id, goal.id);
      else if (o.type === "rattacher")
        await createLink({ from_kind: "goal", from_uid: uidObjectif, to_kind: o.r.kind, to_uid: o.r.uid, origin: "manual" });
      else await createTask({ label: q, tag: null, priority: "medium", recurrence: "none", goal_id: goal.id });
      setRequete("");
      setResultats([]);
      await refresh();
    } finally {
      setOccupe(false);
      champ.current?.focus();
    }
  };

  const ailleurs = (r: Trouvaille) => {
    if (r.kind !== "task") return null;
    const tache = data.tasks.find((x) => x.id === r.id);
    if (!tache?.goal_id) return null;
    return data.goals.find((g) => g.id === tache.goal_id)?.title ?? null;
  };

  return (
    <div className="mt-1">
      <input
        ref={champ}
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && options.length) {
            e.preventDefault();
            setActif((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp" && options.length) {
            e.preventDefault();
            setActif((a) => (a - 1 + options.length) % options.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            void choisir(actif);
          } else if (e.key === "Escape" && requete) {
            e.preventDefault();
            setRequete("");
          }
        }}
        placeholder={t("Chercher une tâche, une note, une fiche…")}
        aria-label={t("Rattacher un élément à « {titre} »", { titre: goal.title })}
        aria-autocomplete="list"
        className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
      />
      {options.length > 0 && (
        // ⚠️ DANS le flux, pas en `absolute` : sous la dernière étape, une liste
        // flottante serait rognée par le panneau de grille (même défaut que le
        // menu « ⋯ », vu à l'écran le 2026-09-15). Elle pousse le contenu, elle
        // ne disparaît jamais.
        <ul role="listbox" className="mt-1 max-h-64 overflow-auto rounded-[10px] border border-border bg-surface p-1">
          {options.map((o, i) => (
            <li key={o.type === "creer" ? "creer" : o.r.uid} role="option" aria-selected={i === actif}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActif(i)}
                onClick={() => void choisir(i)}
                className={`cible-tactile-ligne flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${i === actif ? "bg-overlay-2" : ""}`}
              >
                {o.type === "creer" ? (
                  <>
                    <IconPlus className="h-3.5 w-3.5 shrink-0 text-blue" />
                    <span className="min-w-0 truncate text-text">{t("Créer la tâche « {titre} »", { titre: q })}</span>
                  </>
                ) : (
                  <>
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-dim">
                      {famille(o.r.kind)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-text">{o.r.titre || t("Sans titre")}</span>
                    {ailleurs(o.r) && (
                      <span className="shrink-0 truncate text-[11px] text-text-dim">
                        {t("quittera « {titre} »", { titre: ailleurs(o.r)! })}
                      </span>
                    )}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * ⭐ Les deux façons de garnir une étape, posées côte à côte.
 *
 * Un seul panneau ouvert à la fois : deux champs de saisie ouverts sous une
 * même liste ne disent plus lequel reçoit la frappe.
 */
export function BarreAjout(props: {
  goal: Goal;
  data: AppData;
  contexte: ContexteObjectifs;
  refresh: () => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState<"tache" | "rattacher" | null>(null);
  const onglet = (actif: boolean) =>
    `cible-tactile-ligne inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
      actif ? "bg-overlay-2 text-text" : "text-text-dim hover:bg-overlay hover:text-text"
    }`;

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setOuvert((o) => (o === "tache" ? null : "tache"))}
          aria-expanded={ouvert === "tache"}
          className={onglet(ouvert === "tache")}
          data-tip={t("Une tâche neuve, déjà rattachée à cette étape")}
        >
          <IconPlus className="h-3.5 w-3.5" /> {t("Tâche")}
        </button>
        <button
          type="button"
          onClick={() => setOuvert((o) => (o === "rattacher" ? null : "rattacher"))}
          aria-expanded={ouvert === "rattacher"}
          className={onglet(ouvert === "rattacher")}
          data-tip={t("Rattacher quelque chose qui existe déjà")}
          data-tip-sub={t("Une tâche, une note, une fiche du Savoir ou un événement.")}
        >
          <IconLink className="h-3.5 w-3.5" /> {t("Rattacher")}
        </button>
      </div>
      {ouvert === "tache" && (
        <ComposerTache goal={props.goal} refresh={props.refresh} onFermer={() => setOuvert(null)} />
      )}
      {ouvert === "rattacher" && (
        <RattacherElement goal={props.goal} data={props.data} contexte={props.contexte} refresh={props.refresh} />
      )}
    </div>
  );
}

/**
 * ⭐ Une tâche en une ligne : son nom, et sa date si elle en a une.
 *
 * ⚠️ PAS de priorité, PAS de créneau, PAS de récurrence. Ce n'est pas un
 * formulaire réduit, c'est le geste de la feuille de route : nommer ce qu'il
 * reste à faire. Le reste se règle dans Tâches, où le formulaire complet vit
 * déjà — y recopier ses cinq contrôles rendrait une carte de grille illisible
 * et ferait diverger deux écrans de saisie pour la même table.
 *
 * ⚠️ Et la planification passe par `planificationDeSaisie`, jamais par une
 * écriture directe de `due_date` : la frontière datée / récurrente est tenue à
 * un seul endroit (`lib/taches.ts`), et une règle recopiée finit par diverger.
 */
function ComposerTache(props: { goal: Goal; refresh: () => Promise<void>; onFermer: () => void }) {
  const [label, setLabel] = useState("");
  const [echeance, setEcheance] = useState("");
  const [occupe, setOccupe] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  const creer = async () => {
    const nom = label.trim();
    if (!nom || occupe) return;
    setOccupe(true);
    try {
      await createTask({
        label: nom,
        tag: null,
        priority: "medium",
        recurrence: "none",
        goal_id: props.goal.id,
        ...planificationDeSaisie("none", echeance, "", ""),
      });
      /**
       * On vide le nom et on GARDE l'échéance : découper une étape donne
       * souvent trois tâches pour la même date, et la redemander à chaque fois
       * transformerait un geste en corvée. Le bouton de fermeture est là pour
       * qui veut repartir de zéro.
       */
      setLabel("");
      await props.refresh();
    } finally {
      setOccupe(false);
      champ.current?.focus();
    }
  };

  return (
    // ⚠️ `flex-wrap` ET une base flex sur le nom : `min-w-0 flex-1` seul ne
    // déclenche jamais le repli, il comprime le texte jusqu'à une lettre par
    // ligne. Sur iPhone, les trois contrôles passent à la ligne au lieu de
    // sortir du panneau — où l'`overflow: clip` de la grille les rendrait
    // incliquables.
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <input
        ref={champ}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void creer();
          } else if (e.key === "Escape") {
            // ⚠️ On MARQUE la touche : sans ça, un seul Échap referme aussi
            // l'étage du dessus (convention de l'app depuis le 2026-08-28).
            e.preventDefault();
            props.onFermer();
          }
        }}
        placeholder={t("À faire pour cette étape…")}
        aria-label={t("Nouvelle tâche pour « {titre} »", { titre: props.goal.title })}
        className="min-w-0 flex-1 basis-[11rem] rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
      />
      <ChampDate
        valeur={echeance}
        onChange={setEcheance}
        aria={t("Échéance")}
        placeholder={t("Sans échéance")}
        className="cible-tactile-ligne flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-left text-sm text-text transition-colors hover:border-border-strong focus:border-blue focus:outline-none"
      />
      {/* ⚠️ LES DEUX BOUTONS DANS UN SEUL BLOC. Séparés, la croix se retrouvait
          SEULE sur une troisième ligne, loin de tout — vue à l'écran sur
          iPhone 390 pt le 2026-09-18, elle se lisait comme un contrôle égaré.
          Groupés, ils se replient ensemble et la rangée reste une rangée
          d'actions. */}
      <span className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => void creer()}
          disabled={!label.trim() || occupe}
          className="pill cible-tactile-ligne fill-primary px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          {t("Ajouter")}
        </button>
        <button
          type="button"
          onClick={props.onFermer}
          aria-label={t("Fermer")}
          className="cible-tactile flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-surface-2 hover:text-text"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

/** Le nom d'une famille, à l'affichage — une fonction, jamais une table figée à l'import. */
function famille(kind: LinkKind): string {
  switch (kind) {
    case "task":
      return t("Tâche");
    case "note":
      return t("Note");
    case "knowledge":
      return t("Fiche");
    case "event":
      return t("Événement");
    default:
      return kind;
  }
}
