// Éditeur de blocs des notes « Savoir » — une note contient TOUT :
// texte mis en forme, liens, images, croquis, listes à cocher, citations.
//
// Parti pris d'UI (Apple Notes / Notion) :
//   - **pas de barre d'outils permanente** : un seul bouton « Insérer »
//     discret, et une bulle de mise en forme qui n'apparaît QUE sur une
//     sélection de texte, là où l'œil est déjà ;
//   - le contenu est toujours modifiable (aucun aller-retour lecture/édition),
//     un mode `reading` retire simplement l'édition pour une lecture immersive ;
//   - tout média est inséré en **bloc de premier niveau** (jamais imbriqué
//     dans un paragraphe) : le HTML enregistré reste valide et prévisible.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SketchPad, { parseSketch, type SketchData } from "./SketchPad";
import {
  IconBrush,
  IconImage,
  IconLink,
  IconPlus,
  IconX,
} from "./icons";
import { encodeImage, imageFilesOf, normalizeUrl, openExternal } from "../lib/knowledge";
import { toEditorHtml } from "../lib/richtext";
import { zoomFactor } from "../lib/uiConfig";

import { t } from "../lib/i18n";
interface Props {
  /** Change d'identité → recharge le contenu (sinon on ne touche pas au DOM). */
  noteId: number;
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Lecture immersive : édition désactivée, barre d'insertion masquée. */
  reading?: boolean;
  autoFocus?: boolean;
}

/** Couleurs de texte : variables de thème, donc lisibles en clair comme en sombre. */
const textColors = () => [
  { name: t("Défaut"), value: "var(--color-text)" },
  { name: "Bleu", value: "var(--color-blue)" },
  { name: "Vert", value: "var(--color-green)" },
  { name: "Ambre", value: "var(--color-yellow)" },
  { name: "Rouge", value: "var(--color-red)" },
  { name: "Violet", value: "var(--color-violet)" },
];

export default function NoteComposer({
  noteId,
  initialHtml,
  onChange,
  placeholder,
  reading = false,
  autoFocus = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Dernière sélection connue DANS l'éditeur : les menus flottants la perdent. */
  const savedRange = useRef<Range | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sketch, setSketch] = useState<
    { data: SketchData | null; target: HTMLImageElement | null } | null
  >(null);
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);

  // (re)charge le contenu quand on change de note, jamais pendant la frappe
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = toEditorHtml(initialHtml);
    savedRange.current = null;
    setBubble(null);
    if (autoFocus && !reading) {
      // laisse le DOM se poser avant de placer le curseur
      window.setTimeout(() => placeCaretAtEnd(), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const emit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const placeCaretAtEnd = () => {
    const root = ref.current;
    if (!root) return;
    root.focus();
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    savedRange.current = range.cloneRange();
  };

  /** Range utilisable : la dernière sélection dans l'éditeur, sinon la fin. */
  const workingRange = (): Range => {
    const root = ref.current!;
    const saved = savedRange.current;
    if (saved && root.contains(saved.commonAncestorContainer)) return saved;
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    return range;
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    const range = workingRange();
    ref.current?.focus();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const exec = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    emit();
    syncBubble();
  };

  /** Couleur via CSS inline : produit `<span style="color: var(…)">`, donc themé. */
  const execColor = (value: string) => {
    restoreSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, value);
    document.execCommand("styleWithCSS", false, "false");
    emit();
  };

  /**
   * Insère un élément comme BLOC de premier niveau, juste après le bloc courant.
   * Évite `<figure>` dans `<p>` (HTML invalide) et garantit qu'on peut toujours
   * continuer à écrire dessous.
   */
  const insertBlock = (node: HTMLElement) => {
    const root = ref.current;
    if (!root) return;
    const range = workingRange();
    let block: Node | null = range.startContainer;
    while (block && block.parentNode && block.parentNode !== root) block = block.parentNode;
    if (block && block.parentNode === root) root.insertBefore(node, block.nextSibling);
    else root.appendChild(node);

    // paragraphe vide sous le bloc : le curseur y atterrit, l'écriture continue
    const after = document.createElement("p");
    after.appendChild(document.createElement("br"));
    node.parentNode?.insertBefore(after, node.nextSibling);

    const caret = document.createRange();
    caret.setStart(after, 0);
    caret.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(caret);
    savedRange.current = caret.cloneRange();
    ref.current?.focus();
    emit();
  };

  const insertFigure = (src: string, alt: string, sketchData?: string) => {
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    if (sketchData) img.dataset.sketch = sketchData;
    figure.appendChild(img);
    insertBlock(figure);
  };

  /** Import d'images : bouton, collage ou glisser-déposer — même chemin. */
  const addImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      try {
        for (const file of files) {
          const { media } = await encodeImage(file);
          insertFigure(media, file.name.replace(/\.[^.]+$/, ""));
        }
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // — Bulle de mise en forme : uniquement sur une sélection de texte —
  const syncBubble = useCallback(() => {
    if (reading) return;
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0) return setBubble(null);
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    savedRange.current = range.cloneRange();
    if (sel.isCollapsed) {
      setBubble(null);
      setLinkDraft(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return setBubble(null);
    const z = zoomFactor();
    // coordonnées ÉCRAN → espace local (la densité zoome tout le document)
    setBubble({ x: (rect.left + rect.width / 2) / z, y: rect.top / z });
  }, [reading]);

  useEffect(() => {
    document.addEventListener("selectionchange", syncBubble);
    return () => document.removeEventListener("selectionchange", syncBubble);
  }, [syncBubble]);

  // Le menu d'insertion se referme au clic ailleurs et à Échap.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e.type === "keydown") {
        if ((e as KeyboardEvent).key !== "Escape") return;
        // Échap referme le MENU, pas le lecteur derrière lui : on marque la
        // touche comme traitée (le lecteur teste `defaultPrevented`).
        e.preventDefault();
      }
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const openSketch = (target: HTMLImageElement | null) => {
    setSketch({
      data: target ? parseSketch(target.dataset.sketch ?? null) : null,
      target,
    });
  };

  const applyLink = (raw: string) => {
    const url = normalizeUrl(raw);
    setLinkDraft(null);
    if (!url) return;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      // rien de sélectionné : on insère le lien avec l'URL comme libellé
      document.execCommand("insertHTML", false, `<a href="${url}">${url}</a>&nbsp;`);
    } else {
      document.execCommand("createLink", false, url);
    }
    emit();
    setBubble(null);
  };

  // — Rendu —

  /** Ligne du menu. `hint` n'est affiché que là où il apporte vraiment
   *  quelque chose (médias) : un menu compact reste lisible d'un coup d'œil. */
  const menuItem = (
    label: string,
    hint: string | null,
    icon: React.ReactNode,
    run: () => void,
  ) => (
    <button
      key={label}
      type="button"
      // preventDefault : la sélection dans l'éditeur ne doit jamais être perdue
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setMenuOpen(false);
        run();
      }}
      className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-overlay"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-[10px] text-text-dim">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-text">{label}</span>
        {hint && <span className="block truncate text-[11px] text-text-dim">{hint}</span>}
      </span>
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!reading && (
        <div className="relative mb-2 flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMenuOpen((v) => !v)}
            data-tip={t("Insérer un élément")}
            data-tip-sub="Image, croquis, lien, titre, liste, citation…"
            className={`pill inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors ${
              menuOpen
                ? "border-blue/50 bg-blue/10 text-blue"
                : "border-border bg-surface-2 text-text-dim hover:text-text"
            } disabled:opacity-50`}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {busy ? "import…" : t("Insérer")}
          </button>
          <span className="text-[11px] text-text-dim">
            {t("ou colle une image · glisse un fichier")}
          </span>

          {menuOpen && (
            <div
              className="glass absolute left-0 top-full z-30 mt-1.5 max-h-[min(56vh,420px)] w-60 overflow-y-auto rounded-[var(--radius-card)] border border-border p-1.5 shadow-lg"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {menuItem("Image", "Capture, photo, graphique", <IconImage className="h-3.5 w-3.5" />, () =>
                fileRef.current?.click(),
              )}
              {menuItem("Croquis", t("Schéma tracé à la main"), <IconBrush className="h-3.5 w-3.5" />, () =>
                openSketch(null),
              )}
              {menuItem("Lien", t("Vers une ressource externe"), <IconLink className="h-3.5 w-3.5" />, () =>
                setLinkDraft(""),
              )}
              <span className="my-1 block h-px bg-border" />
              {menuItem("Titre", null, "H1", () => exec("formatBlock", "<h1>"))}
              {menuItem("Sous-titre", null, "H2", () => exec("formatBlock", "<h2>"))}
              {menuItem("Texte", null, "¶", () => exec("formatBlock", "<p>"))}
              {menuItem(t("Liste à puces"), null, "•", () =>
                exec("insertUnorderedList"),
              )}
              {menuItem(t("Liste numérotée"), null, "1.", () =>
                exec("insertOrderedList"),
              )}
              {menuItem(t("Case à cocher"), null, "☑", () => {
                const ul = document.createElement("ul");
                ul.className = "cl";
                const li = document.createElement("li");
                li.dataset.checked = "false";
                li.appendChild(document.createElement("br"));
                ul.appendChild(li);
                insertBlock(ul);
              })}
              {menuItem("Citation", null, "❝", () =>
                exec("formatBlock", "<blockquote>"),
              )}
              {menuItem(t("Séparateur"), null, "—", () =>
                insertBlock(document.createElement("hr")),
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addImages(imageFilesOf(e.target.files));
          e.target.value = ""; // réimporter le même fichier reste possible
        }}
      />

      <div
        ref={ref}
        contentEditable={!reading}
        suppressContentEditableWarning
        spellCheck
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onKeyUp={syncBubble}
        onMouseUp={syncBubble}
        onKeyDown={(e) => {
          // ⌘K : poser un lien sur la sélection, comme partout ailleurs sur macOS
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            syncBubble();
            setLinkDraft("");
          }
        }}
        onPaste={(e) => {
          const files = imageFilesOf(Array.from(e.clipboardData.files) as File[]);
          if (files.length > 0) {
            e.preventDefault();
            addImages(files);
            return;
          }
          // Colle du texte SANS mise en forme étrangère (polices, fonds blancs…)
          const text = e.clipboardData.getData("text/plain");
          if (text) {
            e.preventDefault();
            document.execCommand("insertText", false, text);
          }
        }}
        onDrop={(e) => {
          const files = imageFilesOf(e.dataTransfer.files);
          if (files.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          addImages(files);
        }}
        onDoubleClick={(e) => {
          // un croquis se rouvre d'un double-clic : ses traits sont conservés
          const img = (e.target as HTMLElement).closest?.(
            "img[data-sketch]",
          ) as HTMLImageElement | null;
          if (img) {
            e.preventDefault();
            openSketch(img);
          }
        }}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          // Case à cocher : la boîte est un ::before, on teste la zone à gauche
          const li = el.closest?.("ul.cl > li") as HTMLElement | null;
          if (li && !reading) {
            const rect = li.getBoundingClientRect();
            if (e.clientX - rect.left < 26) {
              li.dataset.checked = li.dataset.checked === "true" ? "false" : "true";
              emit();
              return;
            }
          }
          // Lien : en lecture (ou ⌘-clic), on ouvre dans le navigateur système —
          // jamais dans la webview, qui quitterait l'application.
          const a = el.closest?.("a[href]") as HTMLAnchorElement | null;
          if (a && (reading || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            const href = a.getAttribute("href");
            if (href) openExternal(normalizeUrl(href));
          }
        }}
        className={`note-rich min-h-0 flex-1 overflow-y-auto text-text focus:outline-none ${
          reading ? "note-reading" : ""
        }`}
      />

      {/* Bulle de mise en forme — n'existe que le temps d'une sélection.
          PORTAIL OBLIGATOIRE : le lecteur de note porte une animation, donc un
          `transform`, ce qui fait de lui le bloc conteneur de ses descendants
          `position: fixed`. Sans portail vers <body>, la bulle se placerait par
          rapport à la carte et non à la fenêtre (décalage de plusieurs centaines
          de pixels). Même raison pour la feuille de croquis plein écran. */}
      {bubble && !reading &&
        createPortal(
        <div
          className="fixed z-[78] -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: bubble.x, top: bubble.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="glass flex items-center gap-0.5 rounded-[12px] border border-border p-1 shadow-lg">
            {linkDraft === null ? (
              <>
                <BubbleBtn label={<b>B</b>} tip="Gras" kbd="⌘B" onDo={() => exec("bold")} />
                <BubbleBtn label={<i>I</i>} tip="Italique" kbd="⌘I" onDo={() => exec("italic")} />
                <BubbleBtn label={<u>U</u>} tip={t("Souligné")} kbd="⌘U" onDo={() => exec("underline")} />
                <BubbleBtn label={<s>S</s>} tip={t("Barré")} onDo={() => exec("strikeThrough")} />
                <span className="mx-1 h-5 w-px bg-border" />
                {textColors().map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => execColor(c.value)}
                    data-tip={`Texte ${c.name.toLowerCase()}`}
                    aria-label={`Couleur ${c.name}`}
                    className="h-4 w-4 rounded-full border border-border transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                <BubbleBtn
                  label={<IconLink className="h-3.5 w-3.5" />}
                  tip="Lien"
                  kbd="⌘K"
                  onDo={() => setLinkDraft("")}
                />
                <BubbleBtn label="⌫" tip={t("Effacer la mise en forme")} onDo={() => exec("removeFormat")} />
              </>
            ) : (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyLink(linkDraft);
                }}
              >
                <input
                  autoFocus
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    // Idem : Échap abandonne la saisie du lien, sans fermer
                    // le lecteur par la même occasion.
                    if (e.key !== "Escape") return;
                    e.preventDefault();
                    setLinkDraft(null);
                  }}
                  placeholder="https://…"
                  className="w-52 rounded-lg border border-border bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
                />
                <button
                  type="submit"
                  data-tip={t("Poser le lien")}
                  className="pill bg-blue px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setLinkDraft(null)}
                  data-tip={t("Annuler")}
                  className="rounded-lg p-1 text-text-dim hover:text-text"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}

      {sketch &&
        createPortal(
        <SketchPad
          title={sketch.target ? t("Modifier le croquis") : t("Nouveau croquis")}
          initial={sketch.data}
          onCancel={() => setSketch(null)}
          onSave={(png, data) => {
            const target = sketch.target;
            setSketch(null);
            if (target) {
              // remplacement en place : la position du croquis dans la note ne bouge pas
              target.src = png;
              target.dataset.sketch = data;
              emit();
            } else {
              insertFigure(png, "Croquis", data);
            }
          }}
        />,
        document.body,
      )}
    </div>
  );
}

function BubbleBtn({
  label,
  tip,
  kbd,
  onDo,
}: {
  label: React.ReactNode;
  tip: string;
  kbd?: string;
  onDo: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onDo}
      data-tip={tip}
      data-tip-kbd={kbd}
      aria-label={tip}
      className="flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[13px] text-text-dim transition-colors hover:bg-overlay hover:text-text"
    >
      {label}
    </button>
  );
}
