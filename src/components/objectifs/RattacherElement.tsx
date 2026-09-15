import { useEffect, useRef, useState } from "react";
import { t } from "../../lib/i18n";
import type { Trouvaille } from "../../lib/recherche";
import { FAMILLES_RATTACHABLES, rattachementsDe, type ContexteObjectifs } from "../../lib/objectifs/contexte";
import { uidDeLigne } from "../../lib/objectifs/progression";
import { createLink, createTask, rattacherTache, rechercherPartout } from "../../lib/repo";
import type { AppData, Goal, LinkKind } from "../../lib/types";
import { IconPlus } from "../icons";

/**
 * ⭐ Rattacher sans quitter la feuille de route.
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
        placeholder={t("Rattacher une tâche, une note, un événement… ou créer une tâche")}
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
