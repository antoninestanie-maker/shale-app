// Savoir — base de connaissances personnelle (section Productivité).
//
// DEUX NIVEAUX DE LECTURE, et c'est toute la structure du module :
//   1. l'ACCUEIL est une grille de THÈMES. Une grosse case par thème, plus une
//      case « Sans thème » dès qu'une note n'en a pas, plus la case de
//      création. Rien n'y devient invisible : les vues transverses (toutes les
//      notes, épinglées) restent à portée dans la barre d'outils, et la
//      recherche de l'accueil balaie TOUS les thèmes d'un coup ;
//   2. entrer dans une case ouvre ses NOTES — la même grille de cartes
//      qu'avant — avec un retour toujours visible et un fil d'Ariane.
// Le lecteur immersif s'ouvre par-dessus les deux.
//
// Une seule unité de création : la NOTE. Tout vit dans son corps — texte,
// liens, images, croquis, listes à cocher (cf. `NoteComposer`).
//
// Contraintes respectées (cf. CLAUDE.md / DESIGN.md) :
// - vue à hauteur pleine, hors `ResizableGrid` (comme Notes) ;
// - la liste ne charge JAMAIS le corps des notes (images en data URL) : elle
//   vit sur `text` (recherche + extrait) et `thumb` (couverture) ;
// - zéro couleur codée en dur hors couleurs de DONNÉES (teinte des thèmes) ;
// - aucun emoji : icônes maison ; toute action non triviale porte une bulle ;
// - les deux grilles partagent `.auto-cards` : le nombre de colonnes retombe
//   tout seul quand la fenêtre rétrécit, sans point de rupture de viewport.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import NoteComposer from "../components/NoteComposer";
import { useIsPhone } from "../lib/platform";
import {
  IconCheck,
  IconChevronUp,
  IconExpand,
  IconFolder,
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
  sameTopicName,
  serializeTags,
  thumbFromDataUrl,
} from "../lib/knowledge";
import { firstImageSrc, plainText } from "../lib/richtext";
import { t, tp } from "../lib/i18n";
import GalerieObjets from "../components/liens/GalerieObjets";
import { consommerDemande, regarderDemande } from "../lib/naviguer";
import {
  createKnowledgeEntry,
  createKnowledgeTopic,
  deleteKnowledgeEntry,
  deleteKnowledgeTopic,
  fetchKnowledge,
  fetchKnowledgeEntry,
  markKnowledgeViewed,
  reorderKnowledgeTopics,
  updateKnowledgeEntry,
  updateKnowledgeTopic,
  type KnowledgeInput,
} from "../lib/repo";
import type {
  KnowledgeEntry,
  KnowledgeEntryLite,
  KnowledgeTopic,
} from "../lib/types";

/**
 * Ce qu'on regarde. `null` = l'ACCUEIL, c'est-à-dire la grille de thèmes ;
 * toute autre valeur est une liste de notes (un thème, ou une vue transverse).
 */
type Scope = number | "all" | "pinned" | "none";

/** Les trois états de chargement, rendus dans le même gabarit (aucun saut). */
type Status = "loading" | "ready" | "error";

const newTitle = () => t("Nouvelle note");

/** Thèmes proposés à qui n'en a aucun — créés en un seul clic. */
const suggestions = () => [t("Productivité"), t("Trading"), t("Lectures")];

/** Une note appartient-elle au périmètre demandé ? */
function inScope(entry: KnowledgeEntryLite, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "pinned") return entry.pinned === 1;
  if (scope === "none") return entry.topic_id === null;
  return entry.topic_id === scope;
}

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

/** Ce que la grille doit savoir d'un thème : volume, fraîcheur, aperçu. */
type TopicStats = { count: number; last: string | null; recent: string[] };

const EMPTY_STATS: TopicStats = { count: 0, last: null, recent: [] };

export default function KnowledgeView() {
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntryLite[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  /** `null` = accueil (grille de thèmes). */
  const [scope, setScope] = useState<Scope | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  /**
   * Onglet du module. ⭐ Les objets personnalisés vivent ICI et non dans un 14ᵉ
   * module — décision d'Antonin du 2026-09-02 : un module de plus aurait refait
   * tout le travail du compte de modules (app ET site) pour une fonctionnalité
   * qui est, littéralement, de la base de connaissances.
   */
  const [onglet, setOnglet] = useState<"savoir" | "objets">("savoir");

  /**
   * Ouverture demandée par une mention. Deux chemins, et il faut les deux :
   * l'événement quand le module est déjà à l'écran, la demande en attente quand
   * il vient d'être chargé en `lazy` (voir `lib/naviguer.ts`).
   */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      if (id) {
        setOnglet("savoir");
        setOpenId(id);
      }
    };
    window.addEventListener("sb:open-knowledge", onOpen);
    const enAttente = consommerDemande("knowledge");
    if (enAttente) {
      setOnglet("savoir");
      setOpenId(enAttente);
    }
    // Une mention vers un OBJET arrive aussi ici : c'est le même module. On
    // REGARDE sans consommer — c'est `GalerieObjets`, montée juste après, qui
    // ouvrira la fiche.
    if (regarderDemande("object")) setOnglet("objets");
    return () => window.removeEventListener("sb:open-knowledge", onOpen);
  }, []);
  const [dropping, setDropping] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reindexed = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchKnowledge();
      setTopics(data.topics);
      setEntries(data.entries);
      setStatus("ready");
    } catch {
      // Écrire d'abord en local, lire d'abord en local : un échec ici est un
      // échec SQLite, pas un aléa réseau. On le dit, on propose de réessayer.
      setStatus("error");
    }
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

  const searching = query.trim() !== "";
  /**
   * Chercher DEPUIS L'ACCUEIL balaie tous les thèmes : c'est la promesse de la
   * grille — on range par thème sans se condamner à savoir dans lequel chercher.
   * Chaque résultat porte le nom de son thème (cf. `EntryCard`).
   */
  const listScope: Scope = scope ?? "all";
  const showGrid = scope === null && !searching;

  // — Filtrage : périmètre → tag → recherche —
  const scoped = useMemo(
    () => entries.filter((e) => inScope(e, listScope)),
    [entries, listScope],
  );

  const passesTag = useCallback(
    (e: KnowledgeEntryLite) =>
      tagFilter === null ||
      parseTags(e.tags).some((x) => x.toLowerCase() === tagFilter.toLowerCase()),
    [tagFilter],
  );

  const visible = useMemo(
    () => scoped.filter((e) => passesTag(e) && matchesQuery(e, query)),
    [scoped, passesTag, query],
  );

  /**
   * Résultats que le périmètre courant CACHE. Sans ce compte, chercher dans un
   * thème donnerait « aucun résultat » alors que la note existe deux cases plus
   * loin — le reproche exact qu'on fait à un classement.
   */
  const elsewhere = useMemo(() => {
    if (!searching || listScope === "all") return 0;
    return entries.filter(
      (e) => !inScope(e, listScope) && passesTag(e) && matchesQuery(e, query),
    ).length;
  }, [entries, searching, listScope, passesTag, query]);

  /** Tags présents dans le périmètre courant (le filtre reste toujours utile). */
  const tagsInScope = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of scoped) for (const x of parseTags(e.tags)) seen.set(x.toLowerCase(), x);
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
  }, [scoped]);

  const countOf = useCallback(
    (s: Scope) => entries.filter((e) => inScope(e, s)).length,
    [entries],
  );

  /**
   * Volume, fraîcheur et aperçu, par thème — en UNE passe sur les fiches.
   * `entries` arrive trié `pinned DESC, updated_at DESC` : les trois premiers
   * titres rencontrés sont donc bien les plus en avant.
   */
  const stats = useMemo(() => {
    const byTopic = new Map<number, TopicStats>();
    for (const topic of topics) byTopic.set(topic.id, { count: 0, last: null, recent: [] });
    for (const e of entries) {
      if (e.topic_id === null) continue;
      const s = byTopic.get(e.topic_id);
      if (!s) continue;
      s.count += 1;
      if (s.last === null || e.updated_at > s.last) s.last = e.updated_at;
      if (s.recent.length < 3) s.recent.push(e.title);
    }
    return byTopic;
  }, [topics, entries]);

  const unfiled = useMemo(() => entries.filter((e) => e.topic_id === null), [entries]);
  const pinnedCount = useMemo(() => entries.filter((e) => e.pinned === 1).length, [entries]);

  const scopeTopic = typeof scope === "number" ? topics.find((x) => x.id === scope) ?? null : null;

  /** Un thème supprimé pendant qu'on le regarde renvoie à l'accueil. */
  useEffect(() => {
    if (typeof scope === "number" && status === "ready" && !scopeTopic) setScope(null);
  }, [scope, status, scopeTopic]);

  const scopeTitle =
    scope === null
      ? t("Savoir")
      : scope === "all"
        ? t("Toutes les notes")
        : scope === "pinned"
          ? t("Épinglés")
          : scope === "none"
            ? t("Sans thème")
            : (scopeTopic?.name ?? t("Savoir"));

  /** Changer de périmètre remet la liste à plat : ni tag ni recherche hérités. */
  const goTo = useCallback((next: Scope | null) => {
    setScope(next);
    setTagFilter(null);
    setQuery("");
  }, []);

  /** Élargit la recherche à tout Savoir SANS faire retaper les mots cherchés. */
  const chercherPartout = useCallback(() => {
    setScope("all");
    setTagFilter(null);
  }, []);

  /**
   * `Échap` remonte d'un cran : d'une liste de notes vers la grille de thèmes.
   * La bulle du fil d'Ariane l'ANNONCE, donc il doit exister — trois gardes
   * pour qu'il ne vole le geste à personne : pas quand le lecteur est ouvert
   * (il se ferme lui-même), pas depuis un champ de saisie (le champ de
   * recherche vide sa propre valeur), et pas depuis l'accueil (rien au-dessus).
   */
  useEffect(() => {
    if (scope === null || openId !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || inTextField(e.target)) return;
      goTo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scope, openId, goTo]);

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

  /**
   * Fermeture du lecteur — porte unique, quelle qu'en soit l'origine : bouton
   * « Terminé », croix d'en-tête, Échap, clic hors du cadre. Le focus revient
   * sur la carte d'où l'on venait : la grille n'a jamais été démontée (le
   * lecteur est son frère, pas son remplaçant), donc sa position de défilement
   * et son thème sont intacts — mais le focus, lui, disparaissait avec le
   * lecteur, et la tabulation repartait du haut de la page.
   */
  const closeReader = useCallback(() => {
    const id = openId;
    setOpenId(null);
    if (id === null) return;
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-entry-id="${id}"]`);
      if (!card) return; // note supprimée depuis le lecteur : plus rien à viser
      // `preventScroll` : sans lui, `focus()` recadre « au plus près » et
      // déplace la grille de quelques dizaines de pixels quand la carte était
      // à cheval sur le bord. On revient EXACTEMENT là où l'on était.
      card.focus({ preventScroll: true });
      // Seule exception : la carte a quitté l'écran pendant l'édition (une
      // écriture touche `updated_at`, donc la note remonte en tête de liste).
      // Poser le focus hors champ ferait repartir la tabulation d'un point
      // invisible — là, et là seulement, on va la chercher.
      const box = card.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= window.innerHeight) {
        card.scrollIntoView({ block: "nearest" });
      }
    });
  }, [openId]);

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
      {/* En-tête : fil d'Ariane à deux niveaux — on sait toujours où on est. */}
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {scope === null ? (
            <p className="hud-label">{t("connaissances")}</p>
          ) : (
            <button
              type="button"
              onClick={() => goTo(null)}
              data-tip={t("Revenir aux thèmes")}
              data-tip-kbd={t("Échap")}
              className="hud-label -ml-1 inline-flex items-center gap-1 rounded-[var(--radius-field)] px-1 py-0.5 text-text-dim transition-colors hover:text-text"
            >
              <IconChevronUp className="h-3 w-3 -rotate-90" aria-hidden />
              {t("Savoir")}
            </button>
          )}
          <h1 className="mt-2 flex min-w-0 items-center gap-2.5 text-[32px] text-text">
            {scopeTopic && (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: scopeTopic.color }}
                aria-hidden
              />
            )}
            <span className="truncate" title={scopeTitle}>
              {scopeTitle}
            </span>
          </h1>
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
            {busy ? t("import…") : t("Image")}
          </button>
          <button
            type="button"
            onClick={() => addNote()}
            data-tip={t("Nouvelle note")}
            data-tip-sub={
              scopeTopic
                ? t("Elle sera classée dans « {nom} ».", { nom: scopeTopic.name })
                : t("Texte, liens, images et croquis vivent tous dans la note.")
            }
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

      {/* Les deux moitiés du module. Les fiches du Savoir décrivent ce qu'on
          SAIT ; les objets décrivent ce qu'on SUIT — des personnes, des
          ressources, des projets, des setups. */}
      <div className="mt-5 flex shrink-0 gap-1.5">
        {([
          ["savoir", "Fiches"],
          ["objets", "Objets"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOnglet(id)}
            data-tip={t(label)}
            data-tip-sub={
              id === "savoir"
                ? t("Ce que tu sais, classé par thème.")
                : t("Ce que tu suis : personnes, ressources, projets, setups.")
            }
            className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
              onglet === id
                ? "border-border-strong bg-overlay-2 text-text"
                : "border-border text-text-dim hover:text-text"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {onglet === "objets" && <GalerieObjets />}

      <section className={`mt-6 flex min-h-0 flex-1 flex-col ${onglet === "objets" ? "hidden" : ""}`}>
        {/* Barre d'outils : même position à l'accueil et dans un thème. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="relative min-w-[180px] flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.stopPropagation();
                  setQuery("");
                }
              }}
              placeholder={
                scope === null
                  ? t("Rechercher dans tous les thèmes…")
                  : t("Rechercher dans « {nom} »…", { nom: scopeTitle })
              }
              data-tip={t("Recherche")}
              data-tip-sub={t("Titre, tags et contenu — tous les mots doivent correspondre.")}
              className="w-full rounded-[var(--radius-field)] border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
          </label>

          {/* Vues transverses : rien ne disparaît derrière le classement. */}
          {scope !== "all" && (
            <button
              type="button"
              onClick={() => goTo("all")}
              data-tip={t("Toutes les notes")}
              data-tip-sub={t("Tous thèmes confondus, sans quitter Savoir.")}
              className="pill inline-flex shrink-0 items-center gap-1.5 border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-text-dim transition-colors hover:text-text"
            >
              <IconNote className="h-3 w-3" /> {countOf("all")}
            </button>
          )}
          {pinnedCount > 0 && scope !== "pinned" && (
            <button
              type="button"
              onClick={() => goTo("pinned")}
              data-tip={t("Épinglés")}
              data-tip-sub={t("Les notes mises en avant, à garder sous la main.")}
              className="pill inline-flex shrink-0 items-center gap-1.5 border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-text-dim transition-colors hover:text-text"
            >
              <IconPin className="h-3 w-3" /> {pinnedCount}
            </button>
          )}

          <p className="shrink-0 font-mono text-[11px] text-text-dim">
            {showGrid
              ? tp(topics.length, "{n} thème", "{n} thèmes")
              : tp(visible.length, "{n} note", "{n} notes")}
          </p>
        </div>

        {!showGrid && tagsInScope.length > 0 && (
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
          {status === "loading" ? (
            <Placeholder title={t("Chargement…")} />
          ) : status === "error" ? (
            <Placeholder
              title={t("Le savoir n’a pas pu être ouvert")}
              body={t("La base locale n’a pas répondu. Rien n’est perdu : réessaie.")}
              action={{ label: t("Réessayer"), onClick: () => void load() }}
            />
          ) : showGrid ? (
            <TopicGrid
              topics={topics}
              stats={stats}
              unfiledCount={unfiled.length}
              onOpen={goTo}
              reload={load}
            />
          ) : (
            <>
              {visible.length === 0 ? (
                // ⚠️ Quand la liste est vide, le renvoi « chercher partout » doit
                // vivre DANS cet écran : placé après lui, il tombait sous la ligne
                // de flottaison (le gabarit prend toute la hauteur) — une sortie
                // invisible ne vaut pas mieux qu'une absence de sortie.
                <Placeholder
                  title={
                    searching
                      ? t("Aucune note ne correspond")
                      : typeof scope === "number"
                        ? t("Ce thème est encore vide")
                        : // « Toutes les notes » sur une base neuve n'est pas un
                          // thème vide : c'est un savoir qui n'a pas commencé.
                          t("Ton savoir commence ici")
                  }
                  body={
                    !searching
                      ? t("Une note contient tout : du texte, des liens, des images, des croquis. Colle une capture (⌘V) ou dépose un fichier pour aller encore plus vite.")
                      : elsewhere > 0
                        ? tp(
                            elsewhere,
                            "Une note correspond, mais elle est rangée ailleurs.",
                            "{n} notes correspondent, mais elles sont rangées ailleurs.",
                          )
                        : t("Essaie un autre mot-clé, ou retire le filtre de tag.")
                  }
                  action={
                    !searching
                      ? { label: t("Écrire une note"), onClick: () => void addNote() }
                      : elsewhere > 0
                        ? { label: t("Chercher partout"), onClick: chercherPartout }
                        : undefined
                  }
                />
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

              {elsewhere > 0 && visible.length > 0 && (
                <div className="mt-3 flex justify-center pb-1">
                  <button
                    type="button"
                    onClick={chercherPartout}
                    data-tip={t("Chercher partout")}
                    data-tip-sub={t("Quitte ce périmètre et garde les mots cherchés.")}
                    className="pill border border-border bg-surface-2 px-3.5 py-1.5 text-xs text-text-dim transition-colors hover:text-text"
                  >
                    {tp(
                      elsewhere,
                      "{n} résultat ailleurs — chercher partout",
                      "{n} résultats ailleurs — chercher partout",
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center bg-bg/70 backdrop-blur-sm">
          {/* `card-solid` : au-dessus d'un `backdrop-filter`, le dégradé de
              `--card-bg` laisse transparaître la vue floutée (DESIGN.md,
              § Matériaux & élévation). */}
          <div className="card card-solid flex flex-col items-center gap-2 px-8 py-6">
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
          onClose={closeReader}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ grille thèmes

/**
 * L'ACCUEIL du module. Une grosse case par thème, au même format que les cartes
 * de notes (`.card` dans `.auto-cards`) : c'est la même grille, donc la même
 * réduction de colonnes quand la fenêtre rétrécit.
 *
 * Trois natures de case, volontairement distinctes à l'œil :
 *   - un THÈME : carte pleine, filet de couleur à gauche, actions au survol ;
 *   - « Sans thème » : carte à bordure tiretée, sans couleur — ce n'est pas un
 *     thème, c'est le reste. Elle n'apparaît que s'il y a effectivement des
 *     notes non classées, et elle est la garantie que rien ne devient
 *     inatteignable à cause du classement ;
 *   - « Nouveau thème » : bordure tiretée et pas de matériau de carte — une
 *     action, pas un contenu.
 */
function TopicGrid({
  topics,
  stats,
  unfiledCount,
  onOpen,
  reload,
}: {
  topics: KnowledgeTopic[];
  stats: Map<number, TopicStats>;
  unfiledCount: number;
  onOpen: (scope: Scope) => void;
  reload: () => Promise<unknown>;
}) {
  /** `"new"` = la case de création est dépliée ; un nombre = ce thème s'édite. */
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeTopic | null>(null);

  const create = useCallback(
    async (name: string) => {
      // Teinte attribuée d'office : créer un thème ne doit demander qu'un nom.
      // Elle reste modifiable ensuite, dans le formulaire d'édition.
      const color = TOPIC_COLORS[topics.length % TOPIC_COLORS.length];
      await createKnowledgeTopic(name, color);
      setEditing(null);
      await reload();
    },
    [topics.length, reload],
  );

  /** Déplace un thème d'un cran et réécrit l'ordre complet. */
  const move = useCallback(
    async (index: number, delta: number) => {
      const next = [...topics];
      const cible = index + delta;
      if (cible < 0 || cible >= next.length) return;
      [next[index], next[cible]] = [next[cible], next[index]];
      await reorderKnowledgeTopics(next.map((x) => x.id));
      await reload();
    },
    [topics, reload],
  );

  if (topics.length === 0 && editing === null) {
    return (
      <ThemesEmptyState
        unfiledCount={unfiledCount}
        onCreate={() => setEditing("new")}
        onSuggest={create}
        onSeeUnfiled={() => onOpen("none")}
      />
    );
  }

  return (
    <>
      <div className="auto-cards gap-3 pb-1">
        {topics.map((topic, index) =>
          editing === topic.id ? (
            <TopicForm
              key={topic.id}
              initial={topic}
              others={topics.filter((x) => x.id !== topic.id)}
              onCancel={() => setEditing(null)}
              onSubmit={async (name, color) => {
                await updateKnowledgeTopic(topic.id, name, color);
                setEditing(null);
                await reload();
              }}
            />
          ) : (
            <TopicTile
              key={topic.id}
              topic={topic}
              stats={stats.get(topic.id) ?? EMPTY_STATS}
              first={index === 0}
              last={index === topics.length - 1}
              onOpen={() => onOpen(topic.id)}
              onEdit={() => setEditing(topic.id)}
              onMove={(delta) => void move(index, delta)}
              onDelete={() => setPendingDelete(topic)}
            />
          ),
        )}

        {unfiledCount > 0 && (
          <UnfiledTile count={unfiledCount} onOpen={() => onOpen("none")} />
        )}

        {editing === "new" ? (
          <TopicForm
            others={topics}
            onCancel={() => setEditing(null)}
            onSubmit={async (name) => create(name)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing("new")}
            data-tip={t("Nouveau thème")}
            data-tip-sub={t("Un tiroir de plus pour ranger tes notes.")}
            className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border p-4 text-text-dim transition-colors hover:border-text-dim/60 hover:text-text"
          >
            <IconPlus className="h-5 w-5" />
            <span className="text-[13px] font-medium">{t("Nouveau thème")}</span>
          </button>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDeleteTopic
          topic={pendingDelete}
          count={stats.get(pendingDelete.id)?.count ?? 0}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteKnowledgeTopic(pendingDelete.id);
            setPendingDelete(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

/** Une case de thème : nom, volume, fraîcheur, aperçu des dernières notes. */
function TopicTile({
  topic,
  stats,
  first,
  last,
  onOpen,
  onEdit,
  onMove,
  onDelete,
}: {
  topic: KnowledgeTopic;
  stats: TopicStats;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  return (
    // Même construction que `EntryCard` : la case entière porte le rôle bouton,
    // les actions internes sont de vrais boutons — d'où le conteneur en <div>.
    <div
      role="button"
      tabIndex={0}
      aria-label={t("Ouvrir le thème « {nom} »", { nom: topic.name })}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="card group/topic relative flex min-h-[150px] cursor-pointer flex-col overflow-hidden text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: topic.color }}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: topic.color }}
            aria-hidden
          />
          <span className="hud-label">{t("thème")}</span>
        </span>

        <h3
          className="clamp-2 mt-1.5 font-display text-[15px] font-bold leading-snug text-text"
          title={topic.name}
        >
          {topic.name}
        </h3>

        {stats.recent.length > 0 ? (
          <ul className="mt-2 min-w-0 space-y-0.5">
            {stats.recent.map((title, i) => (
              <li key={i} className="clamp-1 text-xs leading-relaxed text-text-dim">
                {title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs italic leading-relaxed text-text-dim">
            {t("Aucune note pour l’instant.")}
          </p>
        )}

        <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-3">
          <span className="pill bg-overlay px-2 py-0.5 text-[10px] text-text-dim">
            {tp(stats.count, "{n} note", "{n} notes")}
          </span>
          {stats.last && (
            <span className="ml-auto shrink-0 font-mono text-[10px] text-text-dim">
              {fmtDay(stats.last)}
            </span>
          )}
        </div>
      </div>

      {/* Gérer le thème : barre de verre, révélée au survol ou au focus clavier */}
      <span
        className="glass absolute right-2 top-2 flex gap-0.5 rounded-[11px] border border-border p-0.5 opacity-0 shadow-sm transition-opacity duration-150 focus-within:opacity-100 group-hover/topic:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={first}
          data-tip={t("Déplacer avant")}
          aria-label={t("Déplacer avant")}
          className="rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text disabled:opacity-30"
        >
          <IconChevronUp className="h-3.5 w-3.5 -rotate-90" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          data-tip={t("Déplacer après")}
          aria-label={t("Déplacer après")}
          className="rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text disabled:opacity-30"
        >
          <IconChevronUp className="h-3.5 w-3.5 rotate-90" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          data-tip={t("Renommer le thème")}
          data-tip-sub={t("Change aussi sa teinte.")}
          aria-label={t("Renommer le thème")}
          className="rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
        >
          <IconPencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          data-tip={t("Supprimer le thème")}
          data-tip-sub={t("Les notes ne sont pas supprimées : elles passent « sans thème ».")}
          aria-label={t("Supprimer le thème")}
          className="rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-red"
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

/** Les notes qui n'ont pas de thème. N'apparaît que s'il y en a. */
function UnfiledTile({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("Ouvrir les notes sans thème")}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex min-h-[150px] cursor-pointer flex-col rounded-[var(--radius-card)] border border-dashed border-border p-4 text-left transition-colors hover:border-text-dim/60"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <IconFolder className="h-3 w-3 shrink-0 text-text-dim" aria-hidden />
        <span className="hud-label">{t("hors classement")}</span>
      </span>
      <h3 className="clamp-2 mt-1.5 font-display text-[15px] font-bold leading-snug text-text">
        {t("Sans thème")}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-text-dim">
        {t("Ces notes existent et restent trouvables : elles n’ont simplement pas encore de thème.")}
      </p>
      <div className="mt-auto flex items-center pt-3">
        <span className="pill bg-overlay px-2 py-0.5 text-[10px] text-text-dim">
          {tp(count, "{n} note", "{n} notes")}
        </span>
      </div>
    </div>
  );
}

/**
 * Création et édition d'un thème, EN PLACE dans la grille — jamais de modale
 * pour un champ unique. `Entrée` valide, `Échap` annule, le focus est posé.
 * La teinte n'apparaît qu'à l'édition : à la création, on ne demande qu'un nom.
 */
function TopicForm({
  initial,
  others,
  onCancel,
  onSubmit,
}: {
  initial?: KnowledgeTopic;
  others: KnowledgeTopic[];
  onCancel: () => void;
  onSubmit: (name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? TOPIC_COLORS[0]);
  const [doublon, setDoublon] = useState(false);
  const [busy, setBusy] = useState(false);

  const valider = async () => {
    const label = name.trim();
    if (!label || busy) return;
    // Un doublon est SIGNALÉ, jamais créé : deux tiroirs du même nom, c'est
    // exactement le désordre que le classement était censé supprimer.
    if (others.some((x) => sameTopicName(x.name, label))) {
      setDoublon(true);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(label, color);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void valider();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="card flex min-h-[150px] flex-col p-4"
    >
      <p className="hud-label">{initial ? t("modifier le thème") : t("nouveau thème")}</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setDoublon(false);
        }}
        onKeyDown={(e) => {
          // `Entrée` valide EXPLICITEMENT. La soumission implicite du
          // navigateur suffirait sur le papier, mais elle dépend de détails de
          // l'événement clavier : mieux vaut tenir la promesse dans le code que
          // dans la spécification. `preventDefault` empêche le double envoi.
          if (e.key !== "Enter") return;
          e.preventDefault();
          void valider();
        }}
        placeholder={t("Nom du thème")}
        aria-label={t("Nom du thème")}
        className="mt-2 w-full rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
      />
      {doublon && (
        <p className="mt-1.5 text-[11px] text-red">{t("Ce thème existe déjà.")}</p>
      )}

      {initial && (
        <div className="mt-2 flex flex-wrap gap-1">
          {TOPIC_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={t("Teinte du thème")}
              aria-pressed={color === c}
              className={`h-4 w-4 rounded-full transition-transform ${
                color === c ? "scale-110 ring-2 ring-blue" : "hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-1.5 pt-3">
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="pill flex-1 bg-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {initial ? t("Enregistrer") : t("Créer")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("Annuler")}
          className="pill border border-border px-3 py-1.5 text-xs text-text-dim hover:text-text"
        >
          <IconX className="h-3 w-3" />
        </button>
      </div>
    </form>
  );
}

/**
 * Suppression d'un thème : elle DIT ce qu'elle fait aux notes. Elles ne partent
 * jamais avec le thème — elles redeviennent « sans thème », et la case du même
 * nom réapparaît aussitôt dans la grille pour les récupérer.
 */
function ConfirmDeleteTopic({
  topic,
  count,
  onCancel,
  onConfirm,
}: {
  topic: KnowledgeTopic;
  count: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Supprimer le thème")}
        className="card card-solid animate-fade-up w-full max-w-sm p-6"
      >
        <p className="font-display text-lg font-bold text-text">
          {t("Supprimer « {nom} » ?", { nom: topic.name })}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          {count === 0
            ? t("Ce thème ne contient aucune note.")
            : tp(
                count,
                "Sa note n’est pas supprimée : elle passe « sans thème » et reste accessible depuis l’accueil.",
                "Ses {n} notes ne sont pas supprimées : elles passent « sans thème » et restent accessibles depuis l’accueil.",
              )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text-dim hover:text-text"
          >
            {t("Annuler")}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => void onConfirm()}
            className="pill bg-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {t("Supprimer le thème")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * L'écran qui compte : aucun thème n'existe encore. Il ne constate pas une
 * absence, il propose un premier geste — soit un nom libre, soit l'un des trois
 * thèmes tout prêts, créés en UN clic. Et si des notes traînent sans thème, il
 * le dit au lieu de les laisser hors de vue.
 */
function ThemesEmptyState({
  unfiledCount,
  onCreate,
  onSuggest,
  onSeeUnfiled,
}: {
  unfiledCount: number;
  onCreate: () => void;
  onSuggest: (name: string) => Promise<void>;
  onSeeUnfiled: () => void;
}) {
  return (
    <div className="card flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center">
      <IconFolder className="h-8 w-8 text-text-dim/60" aria-hidden />
      <p className="font-display text-lg font-bold text-text">
        {t("Un thème, c’est un tiroir pour tes notes")}
      </p>
      <p className="max-w-sm text-sm text-text-dim">
        {t("Range par sujet, et retrouve tout d’un clic au lieu de chercher.")}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="pill mt-1 bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        {t("Créer mon premier thème")}
      </button>

      <p className="hud-label mt-4">{t("ou commence par")}</p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {suggestions().map((nom) => (
          <button
            key={nom}
            type="button"
            onClick={() => void onSuggest(nom)}
            data-tip={t("Créer le thème « {nom} »", { nom })}
            data-tip-sub={t("Créé immédiatement, renommable ensuite.")}
            className="pill inline-flex items-center gap-1.5 border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-dim transition-colors hover:text-text"
          >
            <IconPlus className="h-3 w-3" /> {nom}
          </button>
        ))}
      </div>

      {unfiledCount > 0 && (
        <p className="mt-4 text-xs text-text-dim">
          {tp(unfiledCount, "{n} note attend un thème.", "{n} notes attendent un thème.")}{" "}
          <button
            type="button"
            onClick={onSeeUnfiled}
            className="font-medium text-blue underline-offset-2 hover:underline"
          >
            {t("Les voir")}
          </button>
        </p>
      )}
    </div>
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
      data-entry-id={entry.id}
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


/**
 * Gabarit UNIQUE des états « rien à montrer » : chargement, erreur, liste vide.
 * Même conteneur, même hauteur minimale pour les trois — passer de l'un à
 * l'autre ne fait donc sauter aucune mise en page.
 */
function Placeholder({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="card flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center">
      <IconNote className="h-8 w-8 text-text-dim/60" aria-hidden />
      <p className="font-display text-lg font-bold text-text">{title}</p>
      {body && <p className="max-w-sm text-sm text-text-dim">{body}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="pill mt-1 bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {action.label}
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
  const isPhone = useIsPhone();
  const [reading, setReading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  /** Dernière écriture refusée. L'indicateur du pied LIT cet état, il ne le devine pas. */
  const [saveError, setSaveError] = useState(false);
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
    try {
      await updateKnowledgeEntry(entryId, patch);
    } catch {
      // L'écriture a été refusée : on REND le patch à la file (ce qui a été
      // frappé entre-temps reste prioritaire) pour que la frappe suivante, ou
      // le bouton « Terminé », retente. Sans ça le contenu serait perdu en
      // silence et l'indicateur resterait bloqué sur « Enregistrement… ».
      pending.current = { ...patch, ...pending.current };
      setSaveError(true);
      return;
    }
    setSaveError(false);
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

  /**
   * Sortie explicite. L'ordre compte : on PURGE d'abord l'enregistrement
   * débouncé — par `flush`, jamais par une réimplémentation — et seulement
   * ensuite on ferme. Cliquer « Terminé » à la seconde où l'on finit de taper
   * doit conserver le texte, c'est la promesse même du bouton.
   *
   * Si l'écriture échoue, on ferme quand même : les données locales priment et
   * enfermer quelqu'un dans un lecteur pour une erreur d'écriture serait pire
   * que le mal. `flush` a rendu le patch à la file, il repartira.
   */
  const done = useCallback(async () => {
    await flush();
    onClose();
  }, [flush, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Une sous-couche (croquis, menu d'insertion, champ de lien) a déjà
      // traité la touche : elle l'a marquée. Le lecteur ne doit pas se fermer
      // par-dessus — sinon Échap referme deux étages d'un coup.
      if (e.defaultPrevented) return;
      const inField = inTextField(e.target);
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void done();
      } else if (!inField && e.key === "ArrowLeft" && prevId) {
        onNavigate(prevId);
      } else if (!inField && e.key === "ArrowRight" && nextId) {
        onNavigate(nextId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, prevId, nextId, done]);

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
      // ⚠️ Sur téléphone, la barre d'onglets est en `fixed` PAR-DESSUS cette
      // couche : sans réserve, le PIED du lecteur — état d'enregistrement,
      // tags, corbeille et « Terminé » — passe dessous et devient
      // inatteignable. Mesuré au premier essai du portage, le 2026-08-27 :
      // seule la croix de l'en-tête restait cliquable, c'est-à-dire exactement
      // la sortie que ce pied était censé rendre inutile.
      //
      // Même expression que la réserve des vues (`App.tsx`), une encoche de
      // plus pour le haut : ici la couche est plein écran, elle ne bénéficie
      // pas de la réserve du conteneur de vue.
      style={
        isPhone
          ? {
              paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 4.75rem)",
            }
          : undefined
      }
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card card-solid animate-fade-up flex h-full max-h-[calc(88vh*var(--zoom-inv))] w-full max-w-3xl flex-col p-0">
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
            <button
              type="button"
              onClick={() => setReading((v) => !v)}
              data-tip={reading ? t("Reprendre l’édition") : t("Lecture immersive")}
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
            placeholder={t("Titre")}
            className="w-full shrink-0 bg-transparent font-display text-2xl font-extrabold tracking-tight text-text placeholder:text-text-dim/60 focus:outline-none"
          />
          <p className="mt-1 shrink-0 font-mono text-[11px] text-text-dim">
            {t("créée le {creee} · modifiée le {modifiee}", {
                    creee: fmtDay(entry.created_at),
                    modifiee: fmtDay(entry.updated_at),
                  })}
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

        {/*
          Pied : tags, suppression, état d'enregistrement, SORTIE.
          Il n'a besoin ni de `sticky` ni de portail : la carte est une colonne
          flex dont seul le corps défile (le `overflow-y-auto` vit sur la zone
          éditable de `NoteComposer`). Ce pied est donc déjà hors de la boîte
          qui défile — permanent par construction, et le texte ne passe jamais
          dessous. C'est aussi ce qui évite le piège du `transform` :
          `animate-fade-up` sur la carte ferait d'elle le bloc conteneur de
          tout descendant `position: fixed`.
        */}
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
                data-tip={t("Retirer « {tag} »", { tag })}
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
              // ⌘↵ appartient à la sortie, même depuis ce champ : on le laisse
              // remonter au lecteur au lieu de le consommer comme un « Entrée ».
              if (e.metaKey || e.ctrlKey) return;
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder={t("+ tag")}
            data-tip={t("Ajouter un tag")}
            data-tip-sub={t("Entrée pour valider. Les tags filtrent les notes, tous thèmes confondus.")}
            className="w-24 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          {/* Bloc d'actions : solidaire, jamais coupé, toujours à droite —
              même quand les tags passent à la ligne dans une fenêtre étroite. */}
          <span className="ml-auto flex shrink-0 items-center gap-2">
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
              className={`rounded-lg p-2 transition-colors ${
                confirmDelete ? "bg-red/20 text-red" : "text-text-dim hover:text-red"
              }`}
            >
              <IconTrash className="h-4 w-4" />
            </button>

            {/*
              Indicateur d'enregistrement — DÉRIVÉ de l'état réel (`saveError`,
              `dirty`), jamais une chaîne posée par habitude.
              En lecture immersive il n'y a rien à écrire : afficher
              « Enregistré » laisserait croire qu'une écriture vient d'avoir
              lieu. On ne montre alors QUE ce qui est vrai — une écriture en
              vol (l'épingle et le thème restent modifiables en lecture) ou un
              échec. Le reste du temps : silence.
            */}
            {(!reading || dirty || saveError) && (
              <span
                aria-live="polite"
                className="flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[10px]"
              >
                {saveError ? (
                  <span className="text-red">{t("Enregistrement impossible")}</span>
                ) : dirty ? (
                  <span className="text-text-dim">{t("Enregistrement…")}</span>
                ) : (
                  <>
                    <IconCheck className="h-3 w-3 text-text-dim" />
                    <span className="text-text-dim">{t("Enregistré")}</span>
                  </>
                )}
              </span>
            )}

            {/* Sortie explicite. Pas d'info-bulle : l'action est libellée et
                évidente (cf. DESIGN.md). Le raccourci vit DANS le bouton. */}
            <button
              type="button"
              onClick={() => void done()}
              className="pill inline-flex shrink-0 items-center gap-2 whitespace-nowrap bg-blue px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("Terminé")}
              {/* ⚠️ Pas de raccourci affiché sur téléphone : il n'y a pas de
                  touche ⌘ à y presser. Une pastille qui annonce un geste
                  impossible n'est pas un indice, c'est du bruit — et elle
                  vole la place du libellé sur 402 pt. Même raisonnement que
                  les poignées de panneau masquées au doigt. */}
              {!isPhone && (
                <span
                  aria-hidden
                  className="rounded-md border border-current px-1.5 py-px font-mono text-[10px] font-normal opacity-70"
                >
                  ⌘↵
                </span>
              )}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
