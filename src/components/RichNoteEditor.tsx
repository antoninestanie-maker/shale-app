import { useCallback, useEffect, useRef, useState } from "react";
// Normalisation des couleurs + conversion texte → HTML : partagées avec
// l'éditeur de blocs du Savoir (src/lib/richtext.ts).
import { toEditorHtml } from "../lib/richtext";

import { t } from "../lib/i18n";
import { kbd } from "../lib/platform";
import MentionPicker from "./liens/MentionPicker";
import { requeteEnCours } from "../lib/mentions";
import { remplacerParMention, rectDuCurseur, texteAvantCurseur } from "../lib/mentionsDom";
import { rechercherPartout } from "../lib/repo";
import type { Trouvaille } from "../lib/recherche";
import type { LinkKind } from "../lib/types";
interface Props {
  /** Change d'identité → recharge le contenu dans l'éditeur (sinon on ne touche pas au DOM). */
  noteId: number;
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /**
   * L'objet en cours d'édition. Sert à deux choses, et il est facultatif : un
   * éditeur qui ne le donne pas garde exactement le comportement d'avant.
   *   • ne pas se proposer à soi-même dans le sélecteur `@` ;
   *   • savoir quelles arêtes mettre à jour à l'enregistrement.
   */
  source?: { kind: LinkKind; uid: string };
  /** Clic sur un jeton de mention. Sans elle, le jeton reste inerte. */
  onOuvrirMention?: (kind: LinkKind, uid: string) => void;
}

// Noms FRANÇAIS, traduits à l'affichage — comme toute table de libellés.
const textColors = () => [
  { name: "Défaut", value: "var(--color-text)" },
  { name: "Bleu", value: "var(--color-blue)" },
  { name: "Vert", value: "var(--color-green)" },
  { name: "Jaune", value: "var(--color-yellow)" },
  { name: "Rouge", value: "var(--color-red)" },
  { name: "Violet", value: "var(--color-violet)" },
];

const HIGHLIGHTS = [
  { name: "Bleu", value: "color-mix(in srgb, var(--color-blue) 28%, transparent)" },
  { name: "Vert", value: "color-mix(in srgb, var(--color-green) 25%, transparent)" },
  { name: "Jaune", value: "color-mix(in srgb, var(--color-yellow) 28%, transparent)" },
  { name: "Rouge", value: "color-mix(in srgb, var(--color-red) 25%, transparent)" },
];

export default function RichNoteEditor({
  noteId,
  initialHtml,
  onChange,
  placeholder,
  source,
  onOuvrirMention,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // (re)charge le contenu quand on change de note, sans casser le curseur pendant la frappe
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = toEditorHtml(initialHtml);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // ─── Mentions `@` ──────────────────────────────────────────────────────────
  const [mention, setMention] = useState<{
    requete: string;
    resultats: Trouvaille[];
    position: { x: number; y: number };
  } | null>(null);
  const [selection, setSelection] = useState(0);
  /**
   * ⚠️ Compteur de course. Deux frappes rapides lancent deux recherches ; celle
   * qui répond en dernier n'est pas forcément la plus récente. Sans ce garde,
   * le sélecteur afficherait par moments les résultats de l'avant-dernière
   * lettre — un défaut rare, jamais reproductible, et très pénible à traquer.
   */
  const requeteId = useRef(0);

  const fermerMention = useCallback(() => {
    setMention(null);
    setSelection(0);
    requeteId.current++;
  }, []);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const verifierMention = useCallback(async () => {
    if (!ref.current) return;
    const requete = requeteEnCours(texteAvantCurseur(ref.current));
    if (requete === null) {
      fermerMention();
      return;
    }
    const position = rectDuCurseur();
    if (!position) return;
    const id = ++requeteId.current;
    const resultats = await rechercherPartout(requete, { limite: 8, exclure: source });
    if (id !== requeteId.current) return; // une frappe plus récente a pris la main
    setMention({ requete, resultats, position });
    setSelection(0);
  }, [fermerMention, source]);

  const choisir = useCallback(
    (r: Trouvaille) => {
      if (!ref.current || !mention) return;
      ref.current.focus();
      remplacerParMention(ref.current, mention.requete.length, r.kind, r.uid, r.titre);
      fermerMention();
      emit();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mention, fermerMention],
  );

  /** Renvoie vrai quand la frappe était pour le sélecteur, pas pour le texte. */
  const toucheMention = (e: React.KeyboardEvent): boolean => {
    if (!mention) return false;
    if (e.key === "Escape") {
      fermerMention();
      return true;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const n = mention.resultats.length;
      if (n === 0) return true;
      setSelection((s) => (e.key === "ArrowDown" ? (s + 1) % n : (s - 1 + n) % n));
      return true;
    }
    // ⚠️ Tab autant qu'Entrée : dans une liste de suggestions, les deux valent
    // « celle-ci ». N'en accepter qu'une surprend une fois sur deux.
    if ((e.key === "Enter" || e.key === "Tab") && mention.resultats[selection]) {
      choisir(mention.resultats[selection]);
      return true;
    }
    return false;
  };

  /** execCommand en gardant la sélection (le mousedown sur un bouton la perdrait). */
  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  /**
   * Applique une couleur via CSS inline (`styleWithCSS`) pour produire
   * `<span style="color: var(…)">` plutôt qu'un `<font color>` qui casse les
   * variables : la couleur suit ainsi le thème. On rebascule aussitôt en mode
   * balises pour que gras/italique restent sémantiques (`<b>`/`<i>`).
   */
  const execColor = (command: string, value: string) => {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    document.execCommand("styleWithCSS", false, "false");
    emit();
  };

  const Btn = ({
    label,
    title,
    kbd,
    onDo,
    style,
  }: {
    label: React.ReactNode;
    title: string;
    /** Raccourci clavier affiché en pastille dans l'info-bulle. */
    kbd?: string;
    onDo: () => void;
    style?: React.CSSProperties;
  }) => (
    <button
      type="button"
      data-tip={title}
      data-tip-kbd={kbd}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onDo}
      style={style}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
    >
      {label}
    </button>
  );

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border pb-2">
        <Btn label={<b>B</b>} title={t("Gras")} kbd={kbd("⌘B")} onDo={() => exec("bold")} />
        <Btn label={<i>I</i>} title={t("Italique")} kbd={kbd("⌘I")} onDo={() => exec("italic")} />
        <Btn
          label={<u>U</u>}
          title={t("Souligné")}
          kbd={kbd("⌘U")}
          onDo={() => exec("underline")}
        />
        <Btn
          label={<s>S</s>}
          title={t("Barré")}
          onDo={() => exec("strikeThrough")}
        />

        <span className="mx-1 h-5 w-px bg-border" />

        <Btn
          label="H1"
          title={t("Titre")}
          onDo={() => exec("formatBlock", "<h1>")}
        />
        <Btn
          label="H2"
          title={t("Sous-titre")}
          onDo={() => exec("formatBlock", "<h2>")}
        />
        <Btn
          label="¶"
          title={t("Paragraphe")}
          onDo={() => exec("formatBlock", "<p>")}
        />
        <Btn
          label={`• ${t("Liste")}`}
          title={t("Liste à puces")}
          onDo={() => exec("insertUnorderedList")}
        />
        <Btn
          label="❝"
          title={t("Citation")}
          onDo={() => exec("formatBlock", "<blockquote>")}
        />

        <span className="mx-1 h-5 w-px bg-border" />

        {/* Couleurs de texte */}
        <span className="flex items-center gap-1 px-1">
          {textColors().map((c) => (
            <button
              key={c.value}
              type="button"
              data-tip={t("Texte {name}", { name: t(c.name) })}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execColor("foreColor", c.value)}
              className="h-4 w-4 rounded-full border border-border transition-transform hover:scale-110"
              style={{ backgroundColor: c.value }}
              aria-label={t("Couleur de texte {name}", { name: t(c.name) })}
            />
          ))}
        </span>

        <span className="mx-1 h-5 w-px bg-border" />

        {/* Surlignage */}
        <span className="flex items-center gap-1 px-1">
          {HIGHLIGHTS.map((c) => (
            <button
              key={c.value}
              type="button"
              data-tip={t("Surligner {name}", { name: t(c.name) })}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execColor("hiliteColor", c.value)}
              className="h-4 w-4 rounded-[4px] border border-border transition-transform hover:scale-110"
              style={{ backgroundColor: c.value }}
              aria-label={t("Surligner {name}", { name: t(c.name) })}
            />
          ))}
        </span>

        <span className="mx-1 h-5 w-px bg-border" />

        <Btn
          label="⟲"
          title={t("Effacer la mise en forme")}
          onDo={() => exec("removeFormat")}
        />
      </div>

      {/* Zone d'édition */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          emit();
          void verifierMention();
        }}
        onKeyDown={(e) => {
          if (toucheMention(e)) e.preventDefault();
        }}
        onBlur={fermerMention}
        onClick={(e) => {
          // ⚠️ Un jeton MORT ne mène nulle part : sa cible n'existe plus. Le
          // rendre cliquable promettrait une navigation impossible.
          const jeton = (e.target as HTMLElement).closest<HTMLElement>(".mention:not(.mention-morte)");
          const ref = jeton?.dataset.mention?.split(":");
          if (ref && ref.length >= 2) {
            onOuvrirMention?.(ref[0] as LinkKind, ref.slice(1).join(":"));
          }
        }}
        data-placeholder={placeholder}
        className="note-rich mt-3 min-h-0 flex-1 overflow-y-auto text-text focus:outline-none"
      />

      {mention && (
        <MentionPicker
          resultats={mention.resultats}
          selection={selection}
          position={mention.position}
          onChoisir={choisir}
        />
      )}
    </div>
  );
}
