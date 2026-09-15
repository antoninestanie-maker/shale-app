import { useEffect, useRef, useState } from "react";
import { t } from "../../lib/i18n";
import type { Trouvaille } from "../../lib/recherche";
import { createTask, rattacherTache, rechercherPartout } from "../../lib/repo";
import type { AppData, Goal } from "../../lib/types";
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
 * ⚠️ Une tâche se rattache par `tasks.goal_id`, le seul chemin qui la fasse
 * compter (audit du 2026-09-14). Elle n'a donc qu'UN objectif : la rattacher ici
 * la retire de l'autre, et la ligne le dit avant qu'on valide.
 *
 * Clavier : ↑↓ choisissent, `Entrée` rattache et garde le champ ouvert pour la
 * suivante, `Échap` vide puis referme.
 */
export default function RattacherElement(props: { goal: Goal; data: AppData; refresh: () => Promise<void> }) {
  const { goal, data, refresh } = props;
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
      const trouves = await rechercherPartout(q, { familles: ["task"], limite: 6 });
      // Une réponse plus ancienne que la dernière frappe ne remplace rien.
      if (n !== tour.current) return;
      setResultats(trouves.filter((r) => data.tasks.find((x) => x.id === r.id)?.goal_id !== goal.id));
      setActif(0);
    }, 120);
    return () => window.clearTimeout(minuteur);
  }, [q, data.tasks, goal.id]);

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
      if (o.type === "rattacher") await rattacherTache(o.r.id, goal.id);
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
        placeholder={t("Rattacher une tâche, ou en créer une…")}
        aria-label={t("Rattacher une tâche à « {titre} »", { titre: goal.title })}
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
                    <span className="min-w-0 flex-1 truncate text-text">{o.r.titre}</span>
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
