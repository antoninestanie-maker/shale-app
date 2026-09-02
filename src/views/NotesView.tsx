import { useEffect, useMemo, useRef, useState } from "react";
import RichNoteEditor from "../components/RichNoteEditor";
import PanneauLiens from "../components/liens/PanneauLiens";
import { useLiens } from "../components/liens/useLiens";
import { consommerDemande, ouvrirObjet } from "../lib/naviguer";
import { norm } from "../lib/actions";
import { createNote, deleteNote, searchNotes, updateNote } from "../lib/repo";
import type { AppData, LinkKind, Note } from "../lib/types";

import { t } from "../lib/i18n";
import { kbd, useIsPhone } from "../lib/platform";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

const WIKI_RE = /\[\[([^\]]+)\]\]/g;

export default function NotesView({ data, refresh }: Props) {
  // ⚠️ Sur téléphone, la vue est un MAÎTRE-DÉTAIL : la liste OU l'éditeur,
  // jamais les deux. Les 402 pt d'un iPhone ne peuvent pas porter deux
  // colonnes — mesuré : la liste gardait son plancher de 220 px et il restait
  // 134 px à l'éditeur, où la barre d'outils s'empilait à la verticale et le
  // texte tombait en colonne d'un mot par ligne.
  const isPhone = useIsPhone();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[] | null>(null);
  // Sur téléphone on ouvre sur la LISTE, pas sur une note : présélectionner
  // reviendrait à cacher l'écran d'accueil du module derrière son détail.
  // Sur le bureau la présélection reste juste — les deux colonnes coexistent.
  const [selectedId, setSelectedId] = useState<number | null>(() =>
    isPhone ? null : (data.notes[0]?.id ?? null),
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const deleteTimer = useRef<number | undefined>(undefined);

  const list = results ?? data.notes;
  const selected = data.notes.find((n) => n.id === selectedId) ?? null;
  const { uid, rafraichir, enregistrerMentions } = useLiens("note", selectedId);
  /**
   * Le corps AVEC ses jetons rafraîchis. `null` tant que la résolution des
   * titres n'a pas répondu : on n'affiche pas le corps brut entre-temps, sinon
   * un titre périmé clignoterait à chaque ouverture de note.
   */
  const [corpsFrais, setCorpsFrais] = useState<string | null>(null);

  /**
   * Ouvrir une mention.
   *
   * ⚠️ TOUT passe par `ouvrirObjet`, y compris une note citée depuis une note.
   * Le raccourci « si c'est une note, je change juste ma sélection » semblait
   * plus direct : il obligeait à retraduire l'uid en numéro local ICI, donc à
   * recopier une résolution qui vit déjà ailleurs. `App.tsx` renvoie de toute
   * façon l'événement `sb:open-note`, que cette vue écoute déjà.
   */
  const ouvrirMention = (kind: LinkKind, mentionUid: string) => {
    void ouvrirObjet(kind, mentionUid);
  };

  // charge la note sélectionnée dans l'éditeur
  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setBody(selected.body);
      setSaved(true);
      setDeleting(false);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // recherche (FTS en natif, LIKE en démo)
  useEffect(() => {
    const t = window.setTimeout(async () => {
      setResults(query.trim() ? await searchNotes(query) : null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, data.notes]);

  // ouverture d'une note demandée depuis ailleurs (revue hebdo…)
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      if (id) setSelectedId(id);
    };
    window.addEventListener("sb:open-note", onOpen);
    // ⚠️ Et au MONTAGE : la vue est chargée en `lazy`, elle n'existait pas
    // encore quand l'événement est parti (voir `lib/naviguer.ts`).
    const enAttente = consommerDemande("note");
    if (enAttente) setSelectedId(enAttente);
    return () => window.removeEventListener("sb:open-note", onOpen);
  }, []);

  // ⚠️ Au CHARGEMENT seulement : réécrire le HTML pendant la frappe
  // déplacerait le curseur au début de la note à chaque lettre.
  useEffect(() => {
    let annule = false;
    if (!selected) {
      setCorpsFrais(null);
      return;
    }
    void rafraichir(selected.body).then((html) => {
      if (!annule) setCorpsFrais(html);
    });
    return () => {
      annule = true;
    };
  }, [selectedId, rafraichir]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    setSaved(false);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (selectedId === null) return;
      await updateNote(selectedId, nextTitle.trim() || "Sans titre", nextBody);
      // Les arêtes suivent l'ENREGISTREMENT, pas la frappe : écrire une arête à
      // chaque lettre remplirait l'outbox de synchronisation de centaines
      // d'entrées pour une seule mention tapée.
      await enregistrerMentions(nextBody);
      setSaved(true);
      await refresh();
    }, 700);
  };

  const handleNew = async () => {
    const id = await createNote(t("Nouvelle note"), "");
    await refresh();
    setQuery("");
    setSelectedId(id);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!deleting) {
      setDeleting(true);
      window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeleting(false), 3000);
      return;
    }
    await deleteNote(selected.id);
    await refresh();
    setSelectedId(null);
    setDeleting(false);
  };

  // liens [[wiki]] sortants + backlinks
  const links = useMemo(() => {
    if (!selected) return { out: [], back: [] as Note[] };
    const out: { label: string; note: Note | null }[] = [];
    for (const m of body.matchAll(WIKI_RE)) {
      const label = m[1].trim();
      out.push({
        label,
        note: data.notes.find((n) => norm(n.title) === norm(label)) ?? null,
      });
    }
    const back = data.notes.filter(
      (n) =>
        n.id !== selected.id &&
        [...n.body.matchAll(WIKI_RE)].some(
          (m) => norm(m[1].trim()) === norm(selected.title),
        ),
    );
    return { out, back };
  }, [selected, body, data.notes]);

  return (
    // La colonne de liste était figée à 280 px. À 900 px de fenêtre — la taille
    // minimale — il ne restait que 86 px au champ de recherche, dont le texte
    // d'invite se faisait couper net. `minmax()` la laisse se resserrer jusqu'à
    // 220 px avant que la colonne d'édition ne cède, et `clamp` sur le padding
    // rend 32 px de chaque côté aux fenêtres étroites.
    <div
      className={`mx-auto grid h-full max-w-6xl gap-4 p-4 lg:p-8 ${
        isPhone ? "grid-cols-1" : "grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"
      }`}
    >
      {/* Liste + recherche — masquée sur téléphone dès qu'une note est ouverte */}
      {(!isPhone || !selected) && (
      <div className="card flex min-h-0 flex-col p-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Rechercher…")}
            className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />
          <button
            type="button"
            onClick={handleNew}
            data-tip={t("Nouvelle note")}
            data-tip-kbd={kbd("⌘⇧N")}
            className="pill shrink-0 bg-blue px-3 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            +
          </button>
        </div>
        <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {list.length === 0 && (
            <li className="py-8 text-center text-sm text-text-dim">
              {query ? t("Aucun résultat.") : t("Aucune note. Crée la première !")}
            </li>
          )}
          {list.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => setSelectedId(note.id)}
                className={`w-full rounded-[10px] px-3 py-2 text-left transition-colors ${
                  note.id === selectedId
                    ? "bg-surface-2 text-text"
                    : "text-text-dim hover:bg-surface-2/50 hover:text-text"
                }`}
              >
                <p className="truncate text-sm font-medium">{note.title}</p>
                <p className="mt-0.5 font-mono text-[10px] text-text-dim">
                  {note.updated_at.slice(0, 10)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      )}

      {/* Éditeur */}
      {selected ? (
        <div className="card flex min-h-0 flex-col p-4 lg:p-5">
          {/* Le retour, sur sa propre ligne : entassé avec le titre, l'état
              d'enregistrement et « supprimer », il ne resterait rien au titre
              sur 370 px. Sur le bureau il n'a pas lieu d'être — la liste est
              là, à gauche. */}
          {isPhone && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="-ml-1 mb-2 self-start rounded-md px-1 py-1 text-sm text-text-dim transition-colors hover:text-text"
            >
              ← {t("Toutes les notes")}
            </button>
          )}
          <div className="flex items-center gap-3">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                scheduleSave(e.target.value, body);
              }}
              className="min-w-0 flex-1 bg-transparent font-display text-xl font-extrabold text-text focus:outline-none"
            />
            <span className="hud-label shrink-0">
              {saved ? t("enregistrée") : "…"}
            </span>
            <button
              type="button"
              onClick={handleDelete}
              data-tip={deleting ? t("Confirmer la suppression") : t("Supprimer la note")}
              data-tip-sub={t("Un second clic supprime définitivement la note.")}
              className={`shrink-0 rounded-md px-2 py-1 text-xs transition-colors ${
                deleting
                  ? "bg-red/20 font-semibold text-red"
                  : "text-text-dim hover:text-red"
              }`}
            >
              {deleting ? t("sûr ?") : t("supprimer")}
            </button>
          </div>

          <RichNoteEditor
            noteId={selected.id}
            initialHtml={corpsFrais ?? selected.body}
            source={uid ? { kind: "note", uid } : undefined}
            onOuvrirMention={(k, u) => ouvrirMention(k, u)}
            onChange={(html) => {
              setBody(html);
              scheduleSave(title, html);
            }}
            placeholder={t("Écris ta note. Tape @ pour citer une note, une fiche, un objectif…")}
          />

          {uid && <PanneauLiens kind="note" uid={uid} onOuvrir={ouvrirMention} />}

          {(links.out.length > 0 || links.back.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {links.out.map((l, i) => (
                <button
                  key={`o${i}`}
                  type="button"
                  disabled={!l.note}
                  onClick={() => l.note && setSelectedId(l.note.id)}
                  className={`pill border px-2.5 py-1 text-[11px] font-medium ${
                    l.note
                      ? "border-blue/40 bg-blue/10 text-blue hover:bg-blue/20"
                      : "border-border text-text-dim opacity-60"
                  }`}
                  data-tip={l.note ? t("Ouvrir « {label} »", { label: l.label }) : t("Note inexistante")}
                  data-tip-sub={l.note ? undefined : t("Crée une note portant ce titre pour activer le lien.")}
                >
                  [[{l.label}]]
                </button>
              ))}
              {links.back.length > 0 && (
                <>
                  <span className="hud-label ml-2">{t("référencée par")}</span>
                  {links.back.map((n) => (
                    <button
                      key={`b${n.id}`}
                      type="button"
                      onClick={() => setSelectedId(n.id)}
                      className="pill border border-green/40 bg-green/10 px-2.5 py-1 text-[11px] font-medium text-green hover:bg-green/20"
                    >
                      ← {n.title}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        // Sur téléphone la liste occupe déjà tout l'écran : une seconde carte
        // qui répète « sélectionne une note » n'aurait rien à dire, et prendrait
        // la moitié de la hauteur pour le dire.
        !isPhone && (
          <div className="card flex items-center justify-center">
            <p className="text-sm text-text-dim">
              {t("Sélectionne une note, ou crée-en une nouvelle.")}
            </p>
          </div>
        )
      )}
    </div>
  );
}
