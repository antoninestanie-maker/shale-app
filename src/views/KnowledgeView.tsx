// Savoir — base de connaissances personnelle (section Productivité).
//
// Une seule unité de création : la NOTE. Tout vit dans son corps — texte,
// liens, images, croquis, listes à cocher (cf. `NoteComposer`). Le rail de
// gauche classe par THÈMES, la grille de droite affiche les notes, et le
// lecteur immersif s'ouvre par-dessus.
//
// Contraintes respectées (cf. CLAUDE.md / DESIGN.md) :
// - vue à hauteur pleine, hors `ResizableGrid` (comme Notes : deux panneaux
//   qui défilent chacun de leur côté, incompatible avec la grille masonry) ;
// - la liste ne charge JAMAIS le corps des notes (images en data URL) : elle
//   vit sur `text` (recherche + extrait) et `thumb` (couverture) ;
// - zéro couleur codée en dur hors couleurs de DONNÉES (teinte des thèmes) ;
// - aucun emoji : icônes maison ; toute action non triviale porte une bulle.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import NoteComposer from "../components/NoteComposer";
import {
  IconExpand,
  IconNote,
  IconPencil,
  IconPin,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "../components/icons";
import {
  TOPIC_COLORS,
  encodeImage,
  excerpt,
  fmtDay,
  imageFilesOf,
  legacyBodyOf,
  matchesQuery,
  parseTags,
  serializeTags,
  thumbFromDataUrl,
} from "../lib/knowledge";
import { firstImageSrc, plainText } from "../lib/richtext";
import { t } from "../lib/i18n";
import { kbd } from "../lib/platform";
import {
  createKnowledgeEntry,
  createKnowledgeTopic,
  deleteKnowledgeEntry,
  deleteKnowledgeTopic,
  fetchKnowledge,
  fetchKnowledgeEntry,
  markKnowledgeViewed,
  updateKnowledgeEntry,
  updateKnowledgeTopic,
  type KnowledgeInput,
} from "../lib/repo";
import type {
  KnowledgeEntry,
  KnowledgeEntryLite,
  KnowledgeTopic,
} from "../lib/types";

/** Sélection du rail : un thème, ou l'une des vues transverses. */
type Scope = number | "all" | "pinned" | "none";

const newTitle = () => t("Nouvelle note");

/** La cible d'un événement n'est pas toujours un élément (window, document). */
function inTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return el.closest("input, textarea, [contenteditable='true']") !== null;
}

/** Corps HTML d'une note créée à partir d'images déposées / collées. */
function figuresHtml(sources: string[]): string {
  return sources.map((src) => `<figure><img src="${src}" alt=""></figure>`).join("");
}

export default function KnowledgeView() {
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntryLite[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reindexed = useRef(false);

  const load = useCallback(async () => {
    const data = await fetchKnowledge();
    setTopics(data.topics);
    setEntries(data.entries);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Trace de consultation, lue par la règle de notification « savoir délaissé ».
   * Posée sur l'ouverture du lecteur — quelle qu'en soit l'origine : clic sur une
   * carte, navigation ←/→, ou création d'une note (qui ouvre le lecteur). Une
   * écriture par ouverture, dans la table `settings` : négligeable, et ça évite
   * de disperser l'instrumentation sur chaque appelant de `setOpenId`.
   */
  useEffect(() => {
    if (openId === null) return;
    markKnowledgeViewed().catch(() => {});
  }, [openId]);

  /**
   * Ré-indexation ponctuelle des notes d'avant l'unification : celles dont le
   * texte brut n'est pas encore matérialisé (colonne ajoutée par la migration
   * 014) et celles créées quand image / croquis / lien étaient des natures
   * séparées. Écriture SANS toucher `updated_at` : ni date faussée, ni
   * réordonnancement de la liste. Ne tourne qu'une fois par montage.
   */
  useEffect(() => {
    if (reindexed.current || entries.length === 0) return;
    reindexed.current = true;
    const stale = entries.filter(
      (e) => e.kind !== "note" || (e.body_len > 0 && !e.text.trim()),
    );
    if (stale.length === 0) return;
    (async () => {
      for (const lite of stale) {
        const full = await fetchKnowledgeEntry(lite.id);
        if (!full) continue;
        const body = legacyBodyOf(full);
        const patch: KnowledgeInput = { kind: "note", body, text: plainText(body) };
        const cover = firstImageSrc(body);
        if (cover && !full.thumb) patch.thumb = await thumbFromDataUrl(cover);
        await updateKnowledgeEntry(lite.id, patch, { touch: false });
      }
      await load();
    })();
  }, [entries, load]);

  /** Thème visé par une création (aucun quand on est sur une vue transverse). */
  const currentTopicId = typeof scope === "number" ? scope : null;

  // — Filtrage : thème → tag → recherche —
  const scoped = useMemo(
    () =>
      entries.filter((e) => {
        if (scope === "pinned") return e.pinned === 1;
        if (scope === "none") return e.topic_id === null;
        if (typeof scope === "number") return e.topic_id === scope;
        return true;
      }),
    [entries, scope],
  );

  const visible = useMemo(
    () =>
      scoped.filter(
        (e) =>
          (tagFilter === null ||
            parseTags(e.tags).some((t) => t.toLowerCase() === tagFilter.toLowerCase())) &&
          matchesQuery(e, query),
      ),
    [scoped, tagFilter, query],
  );

  /** Tags présents dans le périmètre courant (le filtre reste toujours utile). */
  const tagsInScope = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of scoped) for (const t of parseTags(e.tags)) seen.set(t.toLowerCase(), t);
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
  }, [scoped]);

  const countOf = useCallback(
    (s: Scope) =>
      entries.filter((e) =>
        s === "all"
          ? true
          : s === "pinned"
            ? e.pinned === 1
            : s === "none"
              ? e.topic_id === null
              : e.topic_id === s,
      ).length,
    [entries],
  );

  // — Création : une seule porte d'entrée, la note —

  const addNote = useCallback(
    async (extra: KnowledgeInput = {}) => {
      const id = await createKnowledgeEntry({
        kind: "note",
        title: newTitle(),
        topic_id: currentTopicId,
        ...extra,
      });
      await load();
      setOpenId(id);
      return id;
    },
    [currentTopicId, load],
  );

  /**
   * Images déposées ou collées HORS d'une note : elles créent une note qui les
   * contient. Le geste « une capture → une fiche » reste immédiat, sans
   * rouvrir une seconde unité de création.
   */
  const importImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      try {
        const encoded = [];
        for (const file of files) encoded.push(await encodeImage(file));
        await addNote({
          title: files[0].name.replace(/\.[^.]+$/, "") || newTitle(),
          body: figuresHtml(encoded.map((e) => e.media)),
          thumb: encoded[0].thumb,
        });
      } finally {
        setBusy(false);
      }
    },
    [addNote],
  );

  // Collage direct (⌘V) d'une capture d'écran, quand aucune note n'est ouverte.
  useEffect(() => {
    if (openId !== null) return;
    const onPaste = (e: ClipboardEvent) => {
      if (inTextField(e.target)) return;
      const files = imageFilesOf(Array.from(e.clipboardData?.files ?? []) as File[]);
      if (files.length === 0) return;
      e.preventDefault();
      importImages(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [openId, importImages]);

  return (
    <div
      className="mx-auto flex h-full w-full max-w-6xl flex-col p-8"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDropping(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        importImages(imageFilesOf(e.dataTransfer.files));
      }}
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="hud-label">connaissances</p>
          <h1 className="mt-2 text-[32px] text-text">{t("Savoir")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            data-tip={t("Note à partir d'une image")}
            data-tip-sub={t("Raccourci : crée une note contenant l'image choisie.")}
            className="pill inline-flex items-center gap-1.5 border border-border bg-surface-2 px-3.5 py-2 text-xs font-medium text-text-dim transition-colors hover:text-text disabled:opacity-50"
          >
            <IconPlus className="h-3.5 w-3.5" />
            {busy ? "import…" : "Image"}
          </button>
          <button
            type="button"
            onClick={() => addNote()}
            data-tip={t("Nouvelle note")}
            data-tip-sub={t("Texte, liens, images et croquis vivent tous dans la note.")}
            className="pill inline-flex items-center gap-1.5 bg-blue px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <IconPlus className="h-4 w-4" /> {t("Nouvelle note")}
          </button>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          importImages(imageFilesOf(e.target.files));
          e.target.value = ""; // réimporter le même fichier reste possible
        }}
      />

      <div className="mt-6 grid min-h-0 flex-1 grid-cols-[232px_1fr] gap-4">
        <TopicRail
          topics={topics}
          scope={scope}
          onScope={setScope}
          countOf={countOf}
          hasUnfiled={entries.some((e) => e.topic_id === null)}
          reload={load}
        />

        <section className="flex min-h-0 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="relative min-w-[180px] flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Rechercher dans le savoir…")}
                data-tip="Recherche"
                data-tip-sub={t("Titre, tags et contenu — tous les mots doivent correspondre.")}
                className="w-full rounded-[var(--radius-field)] border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
              />
            </label>
            <p className="shrink-0 font-mono text-[11px] text-text-dim">
              {visible.length} note{visible.length > 1 ? "s" : ""}
            </p>
          </div>

          {tagsInScope.length > 0 && (
            <div className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5">
              {tagsInScope.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  data-tip={t("Tag « {tag} »", { tag })}
                  data-tip-sub={
                    tagFilter === tag
                      ? t("Retirer ce filtre.")
                      : t("N’afficher que les notes de ce tag.")
                  }
                  className={`pill px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    tagFilter === tag
                      ? "bg-blue/15 text-blue"
                      : "bg-overlay text-text-dim hover:text-text"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5">
            {visible.length === 0 ? (
              <EmptyState filtered={scoped.length > 0} onCreate={() => addNote()} />
            ) : (
              <div className="auto-cards gap-3 pb-1">
                {visible.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    topic={topics.find((tag) => tag.id === entry.topic_id) ?? null}
                    onOpen={() => setOpenId(entry.id)}
                    onTogglePin={async () => {
                      await updateKnowledgeEntry(
                        entry.id,
                        { pinned: entry.pinned === 1 ? 0 : 1 },
                        { touch: false },
                      );
                      await load();
                    }}
                    onDelete={async () => {
                      await deleteKnowledgeEntry(entry.id);
                      await load();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center bg-bg/70 backdrop-blur-sm">
          <div className="card flex flex-col items-center gap-2 px-8 py-6">
            <IconNote className="h-7 w-7 text-blue" />
            <p className="font-display text-lg font-bold text-text">
              {t("Déposez pour créer une note")}
            </p>
            <p className="text-xs text-text-dim">
              {t("Les images sont recompressées et placées dans la note.")}
            </p>
          </div>
        </div>
      )}

      {openId !== null && (
        <Reader
          entryId={openId}
          topics={topics}
          siblings={visible}
          onNavigate={setOpenId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- rail thèmes

function TopicRail({
  topics,
  scope,
  onScope,
  countOf,
  hasUnfiled,
  reload,
}: {
  topics: KnowledgeTopic[];
  scope: Scope;
  onScope: (s: Scope) => void;
  countOf: (s: Scope) => number;
  hasUnfiled: boolean;
  reload: () => Promise<unknown>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TOPIC_COLORS[0]);
  const [editing, setEditing] = useState<KnowledgeTopic | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = name.trim();
    if (!label) return;
    if (editing) await updateKnowledgeTopic(editing.id, label, color);
    else await createKnowledgeTopic(label, color);
    setName("");
    setColor(TOPIC_COLORS[0]);
    setAdding(false);
    setEditing(null);
    await reload();
  };

  const row = (s: Scope, label: string, icon: ReactNode, tip: string) => {
    const active = scope === s;
    return (
      <button
        type="button"
        onClick={() => onScope(s)}
        data-tip={label}
        data-tip-sub={tip}
        data-tip-side="right"
        className={`flex w-full items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-left text-[13px] transition-colors ${
          active ? "bg-overlay-2 text-text" : "text-text-dim hover:bg-overlay hover:text-text"
        }`}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="shrink-0 font-mono text-[10px] text-text-dim">{countOf(s)}</span>
      </button>
    );
  };

  return (
    <aside className="card flex min-h-0 flex-col p-2.5">
      <div className="flex flex-col gap-0.5">
        {row(
          "all",
          "Tout",
          <span className="h-2 w-2 rounded-full bg-text-dim/50" />,
          t("Toutes les notes, tous thèmes confondus."),
        )}
        {row(
          "pinned",
          t("Épinglés"),
          <IconPin className="h-3.5 w-3.5" />,
          t("Les notes mises en avant, à garder sous la main."),
        )}
      </div>

      <p className="hud-label mt-4 px-2.5">{t("thèmes")}</p>
      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {topics.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-text-dim">
            {t("Aucun thème. Crée-en un pour classer tes notes.")}
          </p>
        )}
        {topics.map((topic) => {
          const active = scope === topic.id;
          return (
            <div key={topic.id} className="group/topic relative">
              <button
                type="button"
                onClick={() => onScope(topic.id)}
                data-tip={topic.name}
                data-tip-sub={t("Afficher les notes de ce thème.")}
                data-tip-side="right"
                className={`flex w-full items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 pr-14 text-left text-[13px] transition-colors ${
                  active
                    ? "bg-overlay-2 text-text"
                    : "text-text-dim hover:bg-overlay hover:text-text"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: topic.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium" title={topic.name}>
                  {topic.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-text-dim">
                  {countOf(topic.id)}
                </span>
              </button>
              {/* Actions du thème : révélées au survol, jamais au-dessus du libellé */}
              <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover/topic:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(topic);
                    setName(topic.name);
                    setColor(topic.color);
                    setAdding(true);
                  }}
                  data-tip={t("Renommer le thème")}
                  className="rounded-md bg-surface p-1 text-text-dim transition-colors hover:text-text"
                >
                  <IconPencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (deletingId !== topic.id) {
                      setDeletingId(topic.id);
                      window.setTimeout(() => setDeletingId(null), 3000);
                      return;
                    }
                    await deleteKnowledgeTopic(topic.id);
                    setDeletingId(null);
                    if (scope === topic.id) onScope("all");
                    await reload();
                  }}
                  data-tip={deletingId === topic.id ? "Confirmer" : t("Supprimer le thème")}
                  data-tip-sub={t("Les notes ne sont pas supprimées : elles passent « non classées ».")}
                  className={`rounded-md p-1 transition-colors ${
                    deletingId === topic.id
                      ? "bg-red/20 text-red"
                      : "bg-surface text-text-dim hover:text-red"
                  }`}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            </div>
          );
        })}

        {hasUnfiled &&
          row(
            "none",
            t("Non classées"),
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-text-dim/60" />,
            t("Notes qui n’appartiennent encore à aucun thème."),
          )}
      </div>

      {adding ? (
        <form onSubmit={submit} className="mt-2 shrink-0 border-t border-border pt-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Nom du thème")}
            className="w-full rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {TOPIC_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                data-tip={t("Teinte du thème")}
                aria-label={`Couleur ${c}`}
                className={`h-4 w-4 rounded-full transition-transform ${
                  color === c ? "scale-110 ring-2 ring-blue" : "hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              type="submit"
              disabled={!name.trim()}
              data-tip={editing ? t("Renommer") : t("Créer le thème")}
              className="pill flex-1 bg-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {editing ? t("Renommer") : t("Créer")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setEditing(null);
                setName("");
              }}
              data-tip={t("Annuler")}
              className="pill border border-border px-3 py-1.5 text-xs text-text-dim hover:text-text"
            >
              <IconX className="h-3 w-3" />
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          data-tip={t("Nouveau thème")}
          data-tip-sub={t("Un dossier de couleur pour regrouper des notes.")}
          data-tip-side="right"
          className="mt-2 flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-field)] border border-dashed border-border py-2 text-xs text-text-dim transition-colors hover:border-text-dim/60 hover:text-text"
        >
          <IconPlus className="h-3.5 w-3.5" /> {t("Nouveau thème")}
        </button>
      )}
    </aside>
  );
}

// ------------------------------------------------------------------ carte

function EntryCard({
  entry,
  topic,
  onOpen,
  onTogglePin,
  onDelete,
}: {
  entry: KnowledgeEntryLite;
  topic: KnowledgeTopic | null;
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const tags = parseTags(entry.tags);
  const text = excerpt(entry.text, 150);

  return (
    // La carte entière est cliquable (rôle bouton) ; les actions internes sont
    // de vrais boutons — d'où le conteneur en <div> (pas de bouton imbriqué).
    // Pas d'info-bulle sur la carte : titre et date y sont déjà lisibles.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="card group/card relative flex cursor-pointer flex-col overflow-hidden text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      {entry.thumb && (
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-surface-2">
          <img
            src={entry.thumb}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03]"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col p-4">
        {topic && (
          <span className="flex min-w-0 items-center gap-1.5" title={topic.name}>
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: topic.color }}
            />
            <span className="hud-label">{topic.name}</span>
          </span>
        )}

        <h3
          className={`clamp-2 font-display text-[15px] font-bold leading-snug text-text ${
            topic ? "mt-1.5" : ""
          }`}
        >
          {entry.title}
        </h3>

        {text && <p className="clamp-3 mt-1.5 text-xs leading-relaxed text-text-dim">{text}</p>}

        <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-3">
          {tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="pill max-w-[45%] truncate bg-overlay px-2 py-0.5 text-[10px] text-text-dim"
            >
              #{t}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="text-[10px] text-text-dim">+{tags.length - 2}</span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[10px] text-text-dim">
            {fmtDay(entry.updated_at)}
          </span>
        </div>
      </div>

      {/* Actions de carte : barre de verre, révélée au survol */}
      <span
        className="glass absolute right-2 top-2 flex gap-0.5 rounded-[11px] border border-border p-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover/card:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onTogglePin}
          data-tip={entry.pinned === 1 ? t("Désépingler") : t("Épingler")}
          data-tip-sub={t("Les notes épinglées remontent en tête de liste.")}
          className={`rounded-lg p-1.5 transition-colors ${
            entry.pinned === 1 ? "text-blue" : "text-text-dim hover:bg-overlay hover:text-text"
          }`}
        >
          <IconPin className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              window.setTimeout(() => setConfirming(false), 3000);
              return;
            }
            onDelete();
          }}
          data-tip={confirming ? t("Confirmer la suppression") : t("Supprimer la note")}
          data-tip-sub={t("Un second clic la supprime définitivement.")}
          className={`rounded-lg p-1.5 transition-colors ${
            confirming ? "bg-red/20 text-red" : "text-text-dim hover:bg-overlay hover:text-red"
          }`}
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      </span>

      {entry.pinned === 1 && (
        <span className="absolute left-0 top-0 h-full w-[3px] bg-blue" aria-hidden />
      )}
    </div>
  );
}

function EmptyState({ filtered, onCreate }: { filtered: boolean; onCreate: () => void }) {
  return (
    <div className="card flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center">
      <IconNote className="h-8 w-8 text-text-dim/60" />
      <p className="font-display text-lg font-bold text-text">
        {filtered ? t("Aucune note ne correspond") : t("Ton savoir commence ici")}
      </p>
      <p className="max-w-sm text-sm text-text-dim">
        {filtered
          ? t("Essaie un autre mot-clé, ou retire le filtre de tag.")
          : // Seul raccourci écrit DANS une phrase traduite. On réécrit la sortie de
            // `t()` plutôt que la clé : la clé est la phrase française elle-même,
            // la toucher casserait la correspondance avec `en.ts`.
            t("Une note contient tout : du texte, des liens, des images, des croquis. Colle une capture (⌘V) ou dépose un fichier pour aller encore plus vite.").replace(
              "⌘V",
              kbd("⌘V"),
            )}
      </p>
      {!filtered && (
        <button
          type="button"
          onClick={onCreate}
          data-tip={t("Créer une première note")}
          className="pill mt-1 bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("Écrire une note")}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------- lecteur immersif

function Reader({
  entryId,
  topics,
  siblings,
  onNavigate,
  onClose,
  onChanged,
}: {
  entryId: number;
  topics: KnowledgeTopic[];
  siblings: KnowledgeEntryLite[];
  onNavigate: (id: number) => void;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [reading, setReading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const pending = useRef<KnowledgeInput>({});
  const timer = useRef<number | undefined>(undefined);
  /** Source de l'image de couverture actuellement reflétée par `thumb`. */
  const coverSrc = useRef<string | null>(null);

  // Position dans la liste filtrée : permet de feuilleter au clavier.
  const index = siblings.findIndex((e) => e.id === entryId);
  const prevId = index > 0 ? siblings[index - 1].id : null;
  const nextId = index >= 0 && index < siblings.length - 1 ? siblings[index + 1].id : null;

  useEffect(() => {
    let alive = true;
    fetchKnowledgeEntry(entryId).then((e) => {
      if (!alive || !e) return;
      // fiche d'avant l'unification : son média redevient un bloc du corps
      const body = legacyBodyOf(e);
      setEntry({ ...e, kind: "note", body });
      coverSrc.current = firstImageSrc(body);
    });
    return () => {
      alive = false;
    };
  }, [entryId]);

  /**
   * Écrit le patch accumulé. Le TEXTE BRUT et la COUVERTURE sont dérivés ici,
   * une seule fois par enregistrement — jamais à chaque frappe : recalculer
   * une vignette à chaque caractère saisi ferait ramer l'éditeur.
   */
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    if (patch.body !== undefined) {
      patch.text = plainText(patch.body ?? "");
      const cover = firstImageSrc(patch.body ?? "");
      if (cover !== coverSrc.current) {
        coverSrc.current = cover;
        patch.thumb = cover ? await thumbFromDataUrl(cover) : null;
      }
    }
    await updateKnowledgeEntry(entryId, patch);
    setDirty(false);
    await onChanged();
  }, [entryId, onChanged]);

  const patch = useCallback(
    (p: KnowledgeInput) => {
      setEntry((cur) => (cur ? { ...cur, ...p } : cur));
      pending.current = { ...pending.current, ...p };
      setDirty(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  // Enregistrement garanti : à la fermeture comme au changement de note.
  useEffect(() => () => void flush(), [flush]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = inTextField(e.target);
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (!inField && e.key === "ArrowLeft" && prevId) {
        onNavigate(prevId);
      } else if (!inField && e.key === "ArrowRight" && nextId) {
        onNavigate(nextId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, prevId, nextId]);

  if (!entry) return null;

  const tags = parseTags(entry.tags);
  const topic = topics.find((t) => t.id === entry.topic_id) ?? null;

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, "");
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase()))
      patch({ tags: serializeTags([...tags, t]) });
    setTagDraft("");
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card card-solid animate-fade-up flex h-full max-h-[88vh] w-full max-w-3xl flex-col p-0">
        {/* En-tête : thème, état d'enregistrement, lecture, épingle, fermeture */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3">
          <select
            value={entry.topic_id ?? ""}
            onChange={(e) =>
              patch({ topic_id: e.target.value === "" ? null : Number(e.target.value) })
            }
            data-tip={t("Thème de classement")}
            data-tip-sub={t("Déplace la note dans un autre thème.")}
            className="min-w-0 max-w-[200px] truncate rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 py-1 text-xs text-text focus:border-blue focus:outline-none"
          >
            <option value="">{t("Non classée")}</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {topic && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: topic.color }}
              aria-hidden
            />
          )}

          <span className="ml-auto flex shrink-0 items-center gap-1">
            <span className="mr-1 font-mono text-[10px] text-text-dim">
              {dirty ? "…" : t("enregistré")}
            </span>
            <button
              type="button"
              onClick={() => setReading((v) => !v)}
              data-tip={reading ? t("Reprendre l’édition") : "Lecture immersive"}
              data-tip-sub={
                reading
                  ? t("Réaffiche le menu d’insertion et réactive la saisie.")
                  : t("Masque les outils : plus que le texte, dans une mesure de lecture confortable.")
              }
              className={`rounded-lg p-1.5 transition-colors ${
                reading ? "text-blue" : "text-text-dim hover:bg-overlay hover:text-text"
              }`}
            >
              {reading ? <IconPencil className="h-4 w-4" /> : <IconExpand className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => patch({ pinned: entry.pinned === 1 ? 0 : 1 })}
              data-tip={entry.pinned === 1 ? t("Désépingler") : t("Épingler")}
              className={`rounded-lg p-1.5 transition-colors ${
                entry.pinned === 1 ? "text-blue" : "text-text-dim hover:bg-overlay hover:text-text"
              }`}
            >
              <IconPin className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              data-tip={t("Fermer")}
              data-tip-kbd={t("Échap")}
              aria-label={t("Fermer")}
              className="rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
            >
              <IconX className="h-4 w-4" />
            </button>
          </span>
        </div>

        {/* Corps : titre puis éditeur de blocs */}
        <div className="flex min-h-0 flex-1 flex-col px-8 py-6">
          <input
            value={entry.title}
            onChange={(e) => patch({ title: e.target.value })}
            data-tip={t("Titre de la note")}
            placeholder="Titre"
            className="w-full shrink-0 bg-transparent font-display text-2xl font-extrabold tracking-tight text-text placeholder:text-text-dim/60 focus:outline-none"
          />
          <p className="mt-1 shrink-0 font-mono text-[11px] text-text-dim">
            créée le {fmtDay(entry.created_at)} · modifiée le {fmtDay(entry.updated_at)}
          </p>

          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <NoteComposer
              noteId={entry.id}
              initialHtml={entry.body}
              reading={reading}
              autoFocus={entry.title === newTitle() && !entry.body}
              onChange={(html) => patch({ body: html })}
              placeholder={t("Écris ici. « Insérer » ajoute une image, un croquis, un lien…")}
            />
          </div>
        </div>

        {/* Pied : tags et suppression */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="pill inline-flex items-center gap-1 bg-overlay px-2.5 py-1 text-[11px] text-text-dim"
            >
              #{tag}
              <button
                type="button"
                onClick={() => patch({ tags: serializeTags(tags.filter((x) => x !== tag)) })}
                data-tip={`Retirer « ${tag} »`}
                aria-label={t("Retirer le tag {tag}", { tag })}
                className="opacity-60 transition-opacity hover:opacity-100"
              >
                <IconX className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="+ tag"
            data-tip={t("Ajouter un tag")}
            data-tip-sub={t("Entrée pour valider. Les tags filtrent les notes, tous thèmes confondus.")}
            className="w-24 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          <button
            type="button"
            onClick={async () => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                window.setTimeout(() => setConfirmDelete(false), 3000);
                return;
              }
              pending.current = {}; // inutile d'écrire dans une note supprimée
              window.clearTimeout(timer.current);
              await deleteKnowledgeEntry(entry.id);
              onClose();
              await onChanged();
            }}
            data-tip={confirmDelete ? t("Confirmer la suppression") : t("Supprimer la note")}
            data-tip-sub={t("Un second clic la supprime définitivement.")}
            className={`ml-auto rounded-lg p-2 transition-colors ${
              confirmDelete ? "bg-red/20 text-red" : "text-text-dim hover:text-red"
            }`}
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
