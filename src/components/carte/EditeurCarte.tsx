import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  agencer,
  ajouterEnfant,
  ajouterFrere,
  annuler,
  appliquer,
  basculerPli,
  deplacer,
  historiqueDe,
  noeudDe,
  poserReference,
  rendreSvg,
  renommer,
  retablir,
  supprimerNoeud,
  voisin,
  type Carte,
  type Direction,
} from "../../lib/carte";
import { pngDeCarte, svgExportable } from "../../lib/carteDom";
import { requeteEnCours } from "../../lib/mentions";
import { rechercherPartout } from "../../lib/repo";
import { enregistrerFichier } from "../../lib/fichiers";
import { zoomFactor } from "../../lib/uiConfig";
import type { Trouvaille } from "../../lib/recherche";
import type { LinkKind } from "../../lib/types";
import MentionPicker from "../liens/MentionPicker";
import { IconCheck, IconExpand, IconExternal, IconReset, IconSave, IconTrash, IconX } from "../icons";
import { t } from "../../lib/i18n";
import { kbd } from "../../lib/platform";

/**
 * L'éditeur de carte mentale — plein écran, au-dessus de la note.
 *
 * ⚠️ PLEIN ÉCRAN, ET CE N'EST PAS DU CONFORT. Une carte se construit en
 * regardant l'ensemble ; un éditeur logé dans une colonne de note obligerait à
 * défiler pour voir ce qu'on vient d'ajouter. Le lecteur immersif du Savoir et
 * `SketchPad` ont tranché pareil, et pour la même raison.
 *
 * ⚠️ TOUT LE MODÈLE VIT DANS `lib/carte.ts`, en fonctions pures et testées. Ce
 * composant ne fait que trois choses : montrer, écouter, et transmettre. C'est
 * délibéré — le § 7.1 de `PIEGES.md` rappelle qu'aucun test de ce dépôt ne
 * prouve une interface, donc tout ce qui peut sortir d'ici doit en sortir.
 */

interface Props {
  titre: string;
  carte: Carte;
  /** L'objet qui PORTE la carte : on ne se propose pas à soi-même dans le `@`. */
  source?: { kind: LinkKind; uid: string };
  /**
   * Appelé à chaque enregistrement automatique ET à la fermeture.
   * ⚠️ L'appelant écrit dans le corps de la note : il doit être idempotent.
   */
  onEnregistrer: (carte: Carte) => void;
  onFermer: () => void;
  /** Clic sur un nœud-référence. Sans elle, le nœud n'ouvre rien. */
  onOuvrirRef?: (kind: LinkKind, uid: string) => void;
}

/**
 * Ouvrir la cible d'un nœud REFERME la carte.
 *
 * ⚠️ Vu à l'écran le 2026-09-07 : sans cela, la demande de navigation partait
 * bien, la vue changeait DERRIÈRE — et l'utilisateur restait devant la carte
 * plein écran, persuadé que le clic n'avait rien fait. Une navigation qu'on ne
 * voit pas est une navigation qui n'a pas eu lieu.
 */

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
/** Au-delà, un geste au doigt est un défilement, pas un glissement (§ 7.4 ter). */
const APPUI_LONG_MS = 400;
/** Sous ce déplacement, on considère qu'on a cliqué, pas glissé. */
const SEUIL_GLISSE = 5;

export default function EditeurCarte({ titre, carte, source, onEnregistrer, onFermer, onOuvrirRef }: Props) {
  const ouvrirCible = (kind: LinkKind, uid: string) => {
    onOuvrirRef?.(kind, uid);
    onFermer();
  };
  const [histoire, setHistoire] = useState(() => historiqueDe(carte));
  const courante = histoire.present;
  const [selection, setSelection] = useState<string>(courante.noeuds[0]?.id ?? "r");
  const [edition, setEdition] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [vue, setVue] = useState({ x: 0, y: 0, z: 1 });
  const [glisse, setGlisse] = useState<{ id: string; cible: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const scene = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const agencement = useMemo(() => agencer(courante), [courante]);

  const svg = useMemo(
    () => rendreSvg(courante, { mode: "theme", selection: edition ? null : selection }),
    [courante, selection, edition],
  );

  /** Toute modification passe par ici : un seul point d'entrée pour l'historique. */
  const modifier = useCallback((f: (c: Carte) => Carte) => {
    setHistoire((h) => appliquer(h, f(h.present)));
  }, []);

  // ─── Enregistrement automatique débouncé, et flush garanti ─────────────────
  //
  // ⚠️ 600 ms, comme le lecteur immersif du Savoir. Et un flush au DÉMONTAGE,
  // parce que Notes n'en avait pas et que ce qui était tapé dans la dernière
  // seconde était perdu sans un mot (chantier H, 2026-09-06).
  const aEnregistrer = useRef<Carte | null>(null);
  const enregistrerRef = useRef(onEnregistrer);
  enregistrerRef.current = onEnregistrer;
  const premierRendu = useRef(true);

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    aEnregistrer.current = courante;
    const minuteur = window.setTimeout(() => {
      const p = aEnregistrer.current;
      aEnregistrer.current = null;
      if (p) enregistrerRef.current(p);
    }, 600);
    return () => window.clearTimeout(minuteur);
  }, [courante]);

  // ⚠️ Effet SANS dépendance : il ne part qu'au vrai démontage, et il écrit ce
  // qui attendait encore. Sans lui, fermer la carte moins de 600 ms après la
  // dernière frappe perdrait cette frappe.
  useEffect(
    () => () => {
      const p = aEnregistrer.current;
      aEnregistrer.current = null;
      if (p) enregistrerRef.current(p);
    },
    [],
  );

  // ─── La couche modale ──────────────────────────────────────────────────────
  //
  // Repris de `SketchPad` : le voile s'occupe du visible, `inert` s'occupe du
  // clavier. Sans lui, tabuler depuis la carte finit par atteindre les boutons
  // du lecteur de note caché derrière.
  useEffect(() => {
    const app = document.getElementById("root");
    app?.setAttribute("inert", "");
    return () => app?.removeAttribute("inert");
  }, []);

  // ─── Le sélecteur `@` ──────────────────────────────────────────────────────
  //
  // ⭐ AUTONOME, ET C'EST CE QUI LE FAIT MARCHER DES DEUX CÔTÉS. Les mentions du
  // corps de texte ne sont branchées que dans Notes ; le Savoir n'en a pas.
  // Mais `MentionPicker` est purement présentationnel et `requeteEnCours()`
  // travaille sur une CHAÎNE — dans un champ, `value.slice(0, selectionStart)`
  // suffit, et `mentionsDom.ts` n'est même pas nécessaire. La carte porte donc
  // son propre sélecteur, identique dans les deux éditeurs.
  const [mention, setMention] = useState<{
    requete: string;
    resultats: Trouvaille[];
    position: { x: number; y: number };
  } | null>(null);
  const [choix, setChoix] = useState(0);
  /** Compteur de course : deux frappes rapides lancent deux recherches. */
  const requeteId = useRef(0);

  const fermerMention = useCallback(() => {
    setMention(null);
    setChoix(0);
    requeteId.current++;
  }, []);

  const verifierMention = useCallback(
    async (valeur: string, curseur: number) => {
      const requete = requeteEnCours(valeur.slice(0, curseur));
      if (requete === null) {
        fermerMention();
        return;
      }
      const rect = champ.current?.getBoundingClientRect();
      if (!rect) return;
      const id = ++requeteId.current;
      const resultats = await rechercherPartout(requete, { limite: 8, exclure: source });
      if (id !== requeteId.current) return; // une frappe plus récente a pris la main
      // ⚠️ Coordonnées ÉCRAN divisées par la densité : le sélecteur est porté sur
      // `document.body`, et le `zoom` CSS de l'app multiplie tout le document.
      const z = zoomFactor();
      setMention({ requete, resultats, position: { x: rect.left / z, y: rect.bottom / z } });
      setChoix(0);
    },
    [fermerMention, source],
  );

  const choisirMention = useCallback(
    (r: Trouvaille) => {
      if (!edition) return;
      modifier((c) => poserReference(c, edition, { kind: r.kind, uid: r.uid }, r.titre));
      fermerMention();
      setEdition(null);
      setSelection(edition);
    },
    [edition, fermerMention, modifier],
  );

  // ─── L'édition d'un nœud ───────────────────────────────────────────────────

  /**
   * ⚠️ LE TEXTE EST UN ARGUMENT, JAMAIS RELU DANS LA CARTE — et c'est un défaut
   * vu à l'écran le 2026-09-07, pas une précaution théorique.
   *
   * La première version cherchait le nœud (`noeudDe(courante, id)`) et
   * abandonnait s'il était absent. Or on ouvre l'édition juste APRÈS avoir créé
   * le nœud : la `courante` capturée par la fermeture est celle d'AVANT, le
   * nouveau nœud n'y est pas, et l'édition ne s'ouvrait donc jamais. Symptôme à
   * l'écran : Tab créait bien un nœud, mais tout ce qu'on tapait ensuite partait
   * dans le vide — sans erreur, sans curseur, sans rien.
   *
   * C'est la même famille que le § 6.5 de `PIEGES.md` : une fonction ne doit
   * jamais dépendre d'un état qu'elle n'a pas reçu.
   */
  /** Faut-il sélectionner tout le texte à l'ouverture ? Lu par l'effet de focus. */
  const selectionnerALOuverture = useRef(false);

  const ouvrirEdition = useCallback(
    (id: string, texte: string, selectionner: boolean) => {
      selectionnerALOuverture.current = selectionner;
      setEdition(id);
      setBrouillon(texte);
      fermerMention();
    },
    [fermerMention],
  );

  /**
   * ⚠️ LE FOCUS PASSE PAR UN EFFET, PAS PAR UN `setTimeout`, et c'est un défaut
   * vu à l'écran le 2026-09-07 : le champ s'ouvrait bien, mais `document.
   * activeElement` restait `BODY` et tout ce qu'on tapait tombait à côté.
   *
   * Un `setTimeout(0)` posé juste après un `setState` ne garantit RIEN : il
   * n'existe aucune promesse que React ait commité le rendu quand la minuterie
   * se déclenche, donc `champ.current` peut encore être nul. Un effet, lui,
   * s'exécute par construction APRÈS le commit. C'est la même leçon que le
   * § 6.2 bis, prise par l'autre bout : là il fallait NE PAS attendre l'effet,
   * ici il faut l'attendre.
   *
   * ⚠️ On ne SÉLECTIONNE le texte que quand on rouvre un nœud existant (F2,
   * double-clic). Quand l'édition s'ouvre parce que l'utilisateur a commencé à
   * TAPER, sélectionner ferait remplacer par la frappe suivante ce qu'il vient
   * d'écrire : taper « Plan » ne laisserait que « n ».
   */
  useEffect(() => {
    if (!edition) return;
    const el = champ.current;
    if (!el) return;
    el.focus();
    if (selectionnerALOuverture.current) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition]);

  const validerEdition = useCallback(
    (id: string, texte: string): Carte => {
      const n = noeudDe(courante, id);
      // Un nœud-référence garde son identité : on ne réécrit que le texte libre.
      if (!n || n.ref || n.texte === texte) return courante;
      return renommer(courante, id, texte);
    },
    [courante],
  );

  const fermerEdition = useCallback(
    (garder: boolean) => {
      if (!edition) return;
      if (garder) {
        const suivante = validerEdition(edition, brouillon);
        if (suivante !== courante) setHistoire((h) => appliquer(h, suivante));
      }
      setEdition(null);
      fermerMention();
    },
    [brouillon, courante, edition, fermerMention, validerEdition],
  );

  // ─── Les raccourcis ────────────────────────────────────────────────────────
  //
  // ⚠️ EN CAPTURE, comme `SketchPad`. La carte s'ouvre AU-DESSUS du lecteur de
  // note, qui écoute lui aussi Échap sur `window` et s'y est abonné en premier :
  // en phase de bouillonnement, Échap fermerait la carte ET le lecteur d'un seul
  // coup. La capture passe avant, `preventDefault` marque la touche, et le
  // lecteur (qui teste `defaultPrevented`) laisse passer son tour.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        setHistoire((h) => (e.shiftKey ? retablir(h) : annuler(h)));
        setEdition(null);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (mention) fermerMention();
        else if (edition) fermerEdition(true);
        else onFermer();
        return;
      }
      // Tout le reste n'a de sens que hors édition : le champ a ses propres règles.
      //
      // ⚠️ On teste AUSSI l'élément actif, et pas seulement l'état React.
      // `setEdition` ne réabonne cet écouteur qu'au rendu suivant : une frappe
      // qui arrive entre les deux verrait encore `edition === null` et serait
      // traitée comme un raccourci de carte alors qu'elle est destinée au champ.
      // C'est étroit, mais une frappe perdue dans un éditeur de texte se
      // remarque tout de suite.
      const actif = document.activeElement;
      if (edition) {
        // Le champ a la main : c'est lui qui décide, on ne double pas ses règles.
        if (actif === champ.current) return;
        // ⭐ SINON, LE CHAMP N'EST PAS ENCORE MONTÉ, ET LA FRAPPE SERAIT PERDUE.
        // `setEdition` ne fait apparaître le champ qu'au rendu suivant. Entre
        // les deux, tout ce qu'on tape tombe dans le vide : vu à l'écran le
        // 2026-09-07, « Plan de trading » ne laissait rien du tout dans le
        // nœud. On récupère donc la frappe à la main plutôt que de l'avaler.
        if (!meta && !e.altKey && e.key.length === 1) {
          e.preventDefault();
          setBrouillon((b) => b + e.key);
        }
        return;
      }
      if (actif?.tagName === "INPUT") return;

      const n = noeudDe(courante, selection);
      if (!n) return;

      if (e.key === "Enter") {
        e.preventDefault();
        const { carte: suivante, neuf } = ajouterFrere(courante, selection);
        setHistoire((h) => appliquer(h, suivante));
        setSelection(neuf);
        ouvrirEdition(neuf, "", false);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const { carte: suivante, neuf } = ajouterEnfant(courante, selection);
        setHistoire((h) => appliquer(h, suivante));
        setSelection(neuf);
        ouvrirEdition(neuf, "", false);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (n.parent === null) return; // la racine ne se supprime pas
        const parent = n.parent;
        modifier((c) => supprimerNoeud(c, selection));
        setSelection(parent);
        return;
      }
      const fleches: Record<string, Direction> = {
        ArrowUp: "haut",
        ArrowDown: "bas",
        ArrowLeft: "gauche",
        ArrowRight: "droite",
      };
      if (fleches[e.key]) {
        e.preventDefault();
        const cible = voisin(courante, selection, fleches[e.key]);
        if (cible) setSelection(cible);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        modifier((c) => basculerPli(c, selection));
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        ouvrirEdition(selection, n.texte, true);
        return;
      }
      // Une frappe imprimable ouvre l'édition et REMPLACE le texte : c'est ce
      // qu'on attend d'une carte mentale, où l'on renomme plus qu'on ne corrige.
      if (!meta && !e.altKey && e.key.length === 1) {
        e.preventDefault();
        ouvrirEdition(selection, e.key, false);
      }
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
  }, [courante, edition, fermerEdition, fermerMention, mention, modifier, onFermer, ouvrirEdition, selection]);

  // ─── Panoramique, zoom, et « tout voir » ───────────────────────────────────

  const toutVoir = useCallback(() => {
    const boite = scene.current?.getBoundingClientRect();
    if (!boite) return;
    const z = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min(boite.width / agencement.largeur, boite.height / agencement.hauteur, 1)),
    );
    setVue({
      x: (boite.width - agencement.largeur * z) / 2,
      y: (boite.height - agencement.hauteur * z) / 2,
      z,
    });
  }, [agencement.hauteur, agencement.largeur]);

  // Au montage seulement : recadrer à chaque modification ferait sauter la carte
  // sous le curseur à chaque nœud ajouté.
  useEffect(() => {
    toutVoir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const surMolette = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const boite = scene.current?.getBoundingClientRect();
      if (!boite) return;
      const px = e.clientX - boite.left;
      const py = e.clientY - boite.top;
      setVue((v) => {
        const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * (1 - e.deltaY / 500)));
        const k = z / v.z;
        // le point sous le curseur ne bouge pas : c'est ce qu'on appelle
        // « zoomer au pointeur », et sans ce recalage la carte fuit sur le côté
        return { x: px - (px - v.x) * k, y: py - (py - v.y) * k, z };
      });
      return;
    }
    setVue((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };

  /**
   * ⚠️ LES ÉCOUTEURS SONT POSÉS DANS LE `pointerdown` LUI-MÊME, jamais dans un
   * `useEffect`. Un effet ne s'exécute qu'APRÈS le rendu : un geste dont
   * l'appui, le déplacement et le relâchement tiennent dans la même tâche du
   * navigateur se termine avant que le moindre écouteur n'existe, et il ne se
   * passe rien. Ce piège a été payé une fois, sur le calendrier, en septembre
   * (`PIEGES.md` § 6.2 bis).
   */
  const surAppui = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const cible = (e.target as HTMLElement).closest?.("[data-noeud]") as HTMLElement | null;
    const id = cible?.dataset.noeud ?? null;
    const depart = { x: e.clientX, y: e.clientY };
    const vueDepart = { ...vue };
    const tactile = e.pointerType === "touch";
    let mode: "attente" | "panoramique" | "glisse" = "attente";
    let survole: string | null = null;
    let minuteurAppui = 0;

    if (id) {
      setSelection(id);
      if (edition && edition !== id) fermerEdition(true);
    }

    const armerGlisse = () => {
      if (!id || id === courante.noeuds.find((n) => n.parent === null)?.id) return;
      mode = "glisse";
      setGlisse({ id, cible: null });
    };

    if (id && tactile) {
      // ⚠️ Au doigt, glisser et défiler sont le MÊME geste : on exige un appui
      // long avant d'armer, et on annule si le doigt bouge avant l'échéance —
      // c'est un défilement, on rend la main (`PIEGES.md` § 7.4 ter).
      minuteurAppui = window.setTimeout(armerGlisse, APPUI_LONG_MS);
    }

    const bouge = (ev: PointerEvent) => {
      const dx = ev.clientX - depart.x;
      const dy = ev.clientY - depart.y;
      if (mode === "attente") {
        if (Math.hypot(dx, dy) < SEUIL_GLISSE) return;
        if (tactile) {
          // le doigt a bougé avant l'appui long : c'est un panoramique
          window.clearTimeout(minuteurAppui);
          mode = "panoramique";
        } else mode = id ? "glisse" : "panoramique";
        if (mode === "glisse") armerGlisse();
      }
      if (mode === "panoramique") {
        setVue({ ...vueDepart, x: vueDepart.x + dx, y: vueDepart.y + dy });
        return;
      }
      // En glissement : où tomberait le nœud ? `elementFromPoint` dit sur quoi
      // on tire vraiment — le § 6.2 bis rappelle qu'il faut le VÉRIFIER plutôt
      // que de conclure qu'un geste est cassé.
      const sous = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const dessus = sous?.closest?.("[data-noeud]") as HTMLElement | null;
      const nouveau = dessus?.dataset.noeud ?? null;
      if (nouveau !== survole) {
        survole = nouveau;
        setGlisse({ id: id!, cible: nouveau });
      }
    };

    const fini = (ev: PointerEvent) => {
      window.clearTimeout(minuteurAppui);
      window.removeEventListener("pointermove", bouge);
      window.removeEventListener("pointerup", fini);
      window.removeEventListener("pointercancel", fini);
      setGlisse(null);
      if (mode === "glisse" && id && survole && survole !== id) {
        modifier((c) => deplacer(c, id, survole!, null));
        return;
      }
      if (mode !== "attente") return;
      // Un simple clic : ouvrir la cible d'un nœud-référence, sinon éditer.
      const bouge2 = Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y);
      if (!id || bouge2 >= SEUIL_GLISSE) return;
      const n = noeudDe(courante, id);
      if (n?.ref && !n.mort && (ev.metaKey || ev.ctrlKey)) {
        ouvrirCible(n.ref.kind, n.ref.uid);
      }
    };

    window.addEventListener("pointermove", bouge);
    window.addEventListener("pointerup", fini);
    window.addEventListener("pointercancel", fini);
  };

  // ─── L'export ──────────────────────────────────────────────────────────────

  const nomFichier = (ext: string) =>
    `${(titre || t("Carte mentale")).replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "carte"}.${ext}`;

  const exporter = async (format: "png" | "svg") => {
    try {
      const contenu =
        format === "png" ? await pngDeCarte(courante) : svgExportable(courante);
      const ok = await enregistrerFichier(nomFichier(format), contenu, format);
      if (ok) setMessage(t("Carte exportée"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    window.setTimeout(() => setMessage(null), 3000);
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  const boiteEnEdition = edition ? agencement.boites.get(edition) : null;
  const noeudSel = noeudDe(courante, selection);
  const outil =
    "pill flex h-8 items-center gap-1.5 px-3 text-xs font-medium text-text-dim transition-colors hover:bg-overlay hover:text-text disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-black/60 p-4 backdrop-blur-sm sm:p-6">
      <div className="card card-solid animate-fade-up flex min-h-0 w-full flex-1 flex-col p-4">
        {/* En-tête */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* ⚠️ `basis-40` : sur un écran de 375 pt, la barre passe à la ligne, et
              sans plancher de largeur le titre se faisait rogner jusqu'à une
              seule lettre (« M. »). Avec lui, il prend sa propre ligne au lieu
              de disparaître. Vu sur viewport téléphone le 2026-09-07. */}
          <h3 className="min-w-0 flex-1 basis-40 truncate font-display text-lg font-bold text-text">
            {titre || t("Carte mentale")}
          </h3>
          {message && <span className="text-xs text-green">{message}</span>}
          <button
            type="button"
            onClick={() => setHistoire(annuler)}
            disabled={histoire.passe.length === 0}
            data-tip={t("Annuler")}
            data-tip-kbd={kbd("⌘Z")}
            className={outil}
          >
            <IconReset className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setHistoire(retablir)}
            disabled={histoire.futur.length === 0}
            data-tip={t("Rétablir")}
            data-tip-kbd={kbd("⌘⇧Z")}
            className={`${outil} [&>svg]:-scale-x-100`}
          >
            <IconReset className="h-3.5 w-3.5" />
          </button>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <button type="button" onClick={toutVoir} data-tip={t("Tout voir")} className={outil}>
            <IconExpand className="h-3.5 w-3.5" /> {t("Tout voir")}
          </button>
          <button
            type="button"
            onClick={() => void exporter("png")}
            data-tip={t("Exporter en PNG")}
            data-tip-sub={t("Une image qui se colle partout.")}
            className={outil}
          >
            <IconSave className="h-3.5 w-3.5" /> PNG
          </button>
          <button
            type="button"
            onClick={() => void exporter("svg")}
            data-tip={t("Exporter en SVG")}
            data-tip-sub={t("Net à n'importe quel agrandissement.")}
            className={outil}
          >
            <IconSave className="h-3.5 w-3.5" /> SVG
          </button>
          <button
            type="button"
            onClick={onFermer}
            data-tip={t("Terminé")}
            data-tip-sub={t("La carte est déjà enregistrée.")}
            aria-label={t("Terminé")}
            className="pill ml-1 inline-flex h-8 items-center gap-1.5 bg-blue px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <IconCheck className="h-3.5 w-3.5" /> {t("Terminé")}
          </button>
          <button
            type="button"
            onClick={onFermer}
            aria-label={t("Fermer")}
            className="rounded-md p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* La scène */}
        <div
          ref={scene}
          onPointerDown={surAppui}
          onWheel={surMolette}
          onDoubleClick={(e) => {
            const cible = (e.target as HTMLElement).closest?.("[data-noeud]") as HTMLElement | null;
            const id = cible?.dataset.noeud;
            if (id) ouvrirEdition(id, noeudDe(courante, id)?.texte ?? "", true);
          }}
          className="carte-scene relative mt-3 min-h-0 flex-1 overflow-hidden rounded-[var(--radius-field)] border border-border bg-surface-2 touch-none"
        >
          <div
            style={{
              position: "absolute",
              transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.z})`,
              transformOrigin: "0 0",
              width: agencement.largeur,
              height: agencement.hauteur,
            }}
          >
            <div
              // Le SVG est une CHAÎNE produite par une fonction pure : c'est ce
              // qui rend le rendu testable, et ce qui garantit que l'export est
              // exactement ce qu'on voit.
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            {/* Le champ d'édition, posé EXACTEMENT sur la boîte du nœud. Il vit
                dans le même conteneur transformé, donc il suit le zoom sans
                calcul supplémentaire. */}
            {edition && boiteEnEdition && (
              <input
                ref={champ}
                value={brouillon}
                onChange={(e) => {
                  setBrouillon(e.target.value);
                  void verifierMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onBlur={() => fermerEdition(true)}
                onKeyDown={(e) => {
                  // ⚠️ Le sélecteur passe AVANT tout le reste : sa flèche du bas
                  // n'est pas celle de la carte.
                  if (mention) {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const n = mention.resultats.length;
                      if (n) setChoix((s) => (e.key === "ArrowDown" ? (s + 1) % n : (s - 1 + n) % n));
                      return;
                    }
                    // Tab autant qu'Entrée : dans une liste de suggestions, les
                    // deux veulent dire « celle-ci » (comme `RichNoteEditor`).
                    if ((e.key === "Enter" || e.key === "Tab") && mention.resultats[choix]) {
                      e.preventDefault();
                      choisirMention(mention.resultats[choix]);
                      return;
                    }
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const id = edition;
                    const base = validerEdition(id, brouillon);
                    const r = e.key === "Tab" ? ajouterEnfant(base, id) : ajouterFrere(base, id);
                    setHistoire((h) => appliquer(h, r.carte));
                    setSelection(r.neuf);
                    setEdition(null);
                    ouvrirEdition(r.neuf, "", false);
                    return;
                  }
                  if ((e.key === "Backspace" || e.key === "Delete") && brouillon === "") {
                    const n = noeudDe(courante, edition);
                    if (n?.parent) {
                      e.preventDefault();
                      const parent = n.parent;
                      const id = edition;
                      setEdition(null);
                      modifier((c) => supprimerNoeud(c, id));
                      setSelection(parent);
                    }
                  }
                }}
                className="absolute rounded-[9px] border-2 border-blue bg-surface px-3 text-[14px] text-text focus:outline-none"
                style={{
                  left: boiteEnEdition.x,
                  top: boiteEnEdition.y,
                  width: Math.max(boiteEnEdition.w, 160),
                  height: boiteEnEdition.h,
                }}
              />
            )}
          </div>

          {/* Ce qu'un glissement va faire, dit à l'écran plutôt que deviné. */}
          {glisse && (
            <div className="glass pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border px-3 py-1.5 text-[11px] text-text">
              {glisse.cible && glisse.cible !== glisse.id
                ? t("Déposer sous « {cible} »", {
                    cible: noeudDe(courante, glisse.cible)?.texte || t("sans titre"),
                  })
                : t("Relâche sur un nœud pour l'y rattacher")}
            </div>
          )}
        </div>

        {/* Le pied d'aide : les raccourcis ne servent que si on les connaît. */}
        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim">
          <span>
            <b className="text-text">{t("Entrée")}</b> {t("frère")}
          </span>
          <span>
            <b className="text-text">Tab</b> {t("enfant")}
          </span>
          <span>
            <b className="text-text">{t("Flèches")}</b> {t("se déplacer")}
          </span>
          <span>
            <b className="text-text">{t("Espace")}</b> {t("replier")}
          </span>
          <span>
            <b className="text-text">@</b> {t("citer un objet")}
          </span>
          <span>
            <b className="text-text">{kbd("⌘Z")}</b> {t("annuler")}
          </span>
          <span className="text-text-dim/70">{t("molette : déplacer · ⌘molette : zoomer")}</span>
          {noeudSel?.ref && !noeudSel.mort && (
            <button
              type="button"
              onClick={() => ouvrirCible(noeudSel.ref!.kind, noeudSel.ref!.uid)}
              className="pill ml-auto inline-flex h-6 items-center gap-1 border border-border px-2 text-[11px] text-text-dim hover:text-text"
            >
              <IconExternal className="h-3 w-3" /> {t("Ouvrir « {titre} »", { titre: noeudSel.texte })}
            </button>
          )}
          {noeudSel?.mort && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-dim">
              <IconTrash className="h-3 w-3" /> {t("La cible de ce nœud n'existe plus.")}
            </span>
          )}
        </div>
      </div>

      {/*
        ⚠️ LE SÉLECTEUR EST RENDU ICI, DANS LE CALQUE DE LA CARTE, ET SURTOUT
        PAS PORTÉ SUR `document.body` — vu à l'écran le 2026-09-07 : porté sur
        `body`, il devenait un FRÈRE de ce voile, et comme il est en `z-50`
        quand le voile est en `z-[75]`, il se peignait DESSOUS. Il existait, il
        contenait les bons résultats, et on ne le voyait pas.

        Ici, il hérite du `z-[75]` de ce conteneur et passe donc au-dessus.

        ⚠️ Et il doit rester en dehors de `.carte-scene` : la scène porte un
        `transform`, ce qui ferait d'elle le bloc conteneur d'un descendant
        `position: fixed` — le sélecteur se placerait alors par rapport à la
        carte zoomée au lieu de la fenêtre. Ce voile-ci, lui, couvre exactement
        la fenêtre, donc les deux repères coïncident.
      */}
      {mention && (
        <MentionPicker
          resultats={mention.resultats}
          selection={choix}
          position={mention.position}
          onChoisir={choisirMention}
        />
      )}
    </div>
  );
}
