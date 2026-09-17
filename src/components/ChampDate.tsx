import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { t } from "../lib/i18n";
import { grilleDuMois, moisDe } from "../lib/calendrier/agenda";
import {
  formaterChamp,
  formaterComplet,
  formaterMois,
  gabaritDeSaisie,
  libelleRelatif,
  moisDecale,
  parserSaisie,
  pasDeTouche,
  raccourcis,
} from "../lib/calendrier/champDate";
import { ORDRE_SEMAINE, nomCourtDuJour, todayStr } from "../lib/logic";
import { zoomFactor } from "../lib/uiConfig";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from "./icons";

/**
 * ⭐ LE CHAMP DE DATE DE L'APP — il remplace `<input type="date">` PARTOUT.
 *
 * Demandé par Antonin le 2026-09-18 : « quelque chose de plus qualitatif, dans
 * le style d'Apple ». Le contrôle natif avait trois défauts, et le troisième
 * était un vrai bogue :
 *   • sur le bureau, un rectangle gris dont le gabarit `jj/mm/aaaa` n'annonce
 *     rien et qui ignore le thème de l'app ;
 *   • au doigt, iOS ouvre son propre panneau, TOUJOURS en clair, par-dessus une
 *     app sombre — et rien à y faire, ce n'est pas une affaire de
 *     `color-scheme` (vérifié le 2026-08-27) ;
 *   • ⚠️ VIDE, il n'affiche RIEN du tout sur iOS : pas même le gabarit. Trois
 *     vues portaient donc une étiquette et une icône POUR COMPENSER
 *     (`TasksView`, `EventModal`, `icons.tsx` en gardent la trace). Ici la
 *     valeur est écrite en clair, donc l'étiquette redevient facultative.
 *
 * ⚠️ LE CLAVIER RESTE LE CHEMIN RAPIDE, et c'est la leçon que `RouletteHeure` a
 * laissée écrite : « taper 1437 au clavier est plus rapide que faire tourner
 * deux molettes ». Un calendrier qui ne se pointe qu'à la souris demanderait six
 * clics de flèche là où trois frappes suffisent. D'où, dans le panneau : les
 * flèches qui déplacent un curseur, `Entrée` qui valide, ET un petit champ où
 * l'on tape « 24/09 » (`parserSaisie`, dans l'ordre de la langue).
 *
 * ⚠️ LE PANNEAU VIT DANS UN PORTAIL, en `position: fixed`, divisé par
 * `zoomFactor()`, retourné vers le haut s'il ne tient pas, et il SUIT le
 * défilement. Posé en `absolute`, il serait rongé sous la dernière ligne d'une
 * carte de grille (`overflow: clip`) : c'est exactement ce qui avait rendu le
 * menu « ⋯ » de la feuille de route incliquable (PIEGES § 14.1). Et plusieurs de
 * ces champs vivent précisément dans des panneaux de grille — le filtre de
 * Tâches, les bornes de Flux, celles de Factures.
 */
export default function ChampDate(props: {
  /** 'YYYY-MM-DD', ou '' quand aucune date n'est posée. */
  valeur: string;
  onChange: (jour: string) => void;
  /** Ce que lit un lecteur d'écran, et ce que dit le bouton vide. */
  aria: string;
  /** Texte du bouton quand rien n'est posé. Par défaut : « Choisir une date ». */
  placeholder?: string;
  /** Une date peut-elle être retirée ? Faux pour un événement, qui en exige une. */
  effacable?: boolean;
  /** Classes du bouton — pour reprendre la forme du champ qu'on remplace. */
  className?: string;
  /** Info-bulle de l'app (`data-tip`), quand le champ en portait une. */
  tip?: string;
  /**
   * Bornes, 'YYYY-MM-DD' — reprises de l'attribut `min` du champ natif.
   *
   * ⚠️ Elles ferment les deux chemins, la grille ET la frappe : une borne qui
   * ne griserait que les cellules laisserait taper la date interdite, et
   * l'événement naîtrait avec une fin avant son début.
   */
  min?: string;
  max?: string;
  disabled?: boolean;
  id?: string;
}) {
  const { valeur, onChange, aria, effacable = true, disabled, min, max } = props;
  const [ouvert, setOuvert] = useState(false);
  const aujourdHui = todayStr();
  /** Le jour mis en évidence : il se déplace aux flèches sans rien choisir. */
  const [curseur, setCurseur] = useState(valeur || aujourdHui);
  const [saisie, setSaisie] = useState("");
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const cellule = useRef<HTMLButtonElement>(null);
  const titreId = useId();

  // Ouvrir remet le curseur sur la date en place — ou sur aujourd'hui. Sans ça,
  // rouvrir le panneau rendrait le mois où l'on avait navigué la fois d'avant.
  useEffect(() => {
    if (ouvert) {
      const depart = valeur || aujourdHui;
      setCurseur(min && depart < min ? min : max && depart > max ? max : depart);
      setSaisie("");
    }
  }, [ouvert]);

  /**
   * ⭐ LA HAUTEUR UTILE, PAS LA HAUTEUR DE LA FENÊTRE.
   *
   * ⚠️ Sur iPhone, ouvrir le clavier logiciel ne change PAS `innerHeight` : la
   * fenêtre garde sa taille, le clavier se pose PAR-DESSUS. Or ce panneau porte
   * un champ de frappe — le toucher ouvre donc le clavier, et un panneau placé
   * d'après `innerHeight` se retrouverait dessous, invisible et inatteignable.
   * `visualViewport` mesure ce qui reste visible, clavier déduit ; c'est la
   * seule mesure qui dise la vérité ici (même parade que `MentionPicker`).
   *
   * `offsetTop` compte aussi : la partie visible peut être DÉCALÉE vers le bas
   * quand la page a été poussée. Repli sur `innerHeight` pour le bureau, où les
   * deux coïncident.
   */
  const vu = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    const haut = vv?.offsetTop ?? 0;
    return {
      haut,
      bas: haut + (vv?.height ?? window.innerHeight),
      largeur: vv?.width ?? window.innerWidth,
    };
  };

  const placer = () => {
    const ancre = bouton.current?.getBoundingClientRect();
    const boite = panneau.current?.getBoundingClientRect();
    if (!ancre || !boite) return;
    /**
     * ⚠️ L'ANCRE PEUT AVOIR QUITTÉ L'ÉCRAN — on referme, on ne rattrape pas.
     *
     * Le panneau suit le défilement (voir plus bas) : si le champ sort de la
     * fenêtre, le panneau le suit dehors et devient invisible sans être fermé.
     * Mesuré le 2026-09-18 sur l'export comptable de Finance, tout en bas d'une
     * page longue : `top: 1606px` dans une fenêtre de 900.
     *
     * Le recaler de force serait pire : un calendrier posé au milieu de l'écran,
     * détaché du champ auquel il appartient, ne dit plus ce qu'il modifie.
     */
    const ecran = vu();
    if (ancre.bottom < ecran.haut || ancre.top > ecran.bas) {
      setOuvert(false);
      return;
    }
    const z = zoomFactor();
    const marge = 8;
    const enDessous = ancre.bottom + 6 + boite.height <= ecran.bas - marge;
    const brut = enDessous ? ancre.bottom + 6 : ancre.top - 6 - boite.height;
    // Une ancre à demi visible ne doit pas produire un panneau à demi dehors :
    // on borne des deux côtés, le haut gagnant si la place manque (on préfère
    // voir le mois que les raccourcis).
    const top = Math.max(ecran.haut + marge, Math.min(brut, ecran.bas - boite.height - marge));
    const left = Math.min(
      Math.max(marge, ancre.left),
      Math.max(marge, ecran.largeur - boite.width - marge),
    );
    setPlace({ top: top / z, left: left / z });
  };

  useLayoutEffect(() => {
    if (!ouvert) return setPlace(null);
    placer();
  }, [ouvert, curseur]);

  // La cellule du curseur porte le focus : c'est ce qui rend les flèches
  // utilisables dès l'ouverture, sans cliquer d'abord.
  useEffect(() => {
    if (ouvert) cellule.current?.focus();
  }, [ouvert, curseur]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (!bouton.current?.contains(cible) && !panneau.current?.contains(cible)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      // ⚠️ Une couche AU-DESSUS a déjà traité la touche : elle l'a marquée. Sans
      // ce garde, un seul Échap ferme le calendrier ET le formulaire qui le
      // porte, et la saisie part avec (convention de l'app depuis le 2026-08-28).
      if (e.defaultPrevented || e.key !== "Escape") return;
      e.preventDefault();
      setOuvert(false);
      bouton.current?.focus();
    };
    // Défiler déplace l'ancre : le panneau la SUIT plutôt que de se refermer
    // sous les doigts — un défilement involontaire ne doit rien coûter.
    const suivre = () => placer();
    window.addEventListener("pointerdown", dehors);
    window.addEventListener("keydown", touche);
    window.addEventListener("scroll", suivre, true);
    window.addEventListener("resize", suivre);
    /**
     * ⚠️ ET SUR `visualViewport`, sans quoi tout ce qui précède est inutile sur
     * iPhone : l'ouverture du clavier logiciel NE déclenche PAS `resize` sur
     * `window` (la fenêtre n'a pas changé de taille), seulement sur le viewport
     * visuel. Sans ces deux écouteurs, le panneau resterait placé d'après une
     * hauteur qui n'existe plus.
     */
    const vv = window.visualViewport;
    vv?.addEventListener("resize", suivre);
    vv?.addEventListener("scroll", suivre);
    return () => {
      window.removeEventListener("pointerdown", dehors);
      window.removeEventListener("keydown", touche);
      window.removeEventListener("scroll", suivre, true);
      window.removeEventListener("resize", suivre);
      vv?.removeEventListener("resize", suivre);
      vv?.removeEventListener("scroll", suivre);
    };
  }, [ouvert]);

  const jours = useMemo(() => grilleDuMois(curseur), [curseur]);
  const moisAffiche = moisDe(curseur);

  /** Hors bornes, un jour ne se choisit ni au clic, ni à la flèche, ni à la frappe. */
  const admis = (jour: string) => !(min && jour < min) && !(max && jour > max);

  const choisir = (jour: string) => {
    if (!admis(jour)) return;
    onChange(jour);
    setOuvert(false);
    bouton.current?.focus();
  };

  const auClavier = (e: React.KeyboardEvent) => {
    const pas = pasDeTouche(e.key);
    if (pas != null) {
      e.preventDefault();
      // Le mois suit le curseur : franchir le bord de la grille fait tourner la
      // page, comme dans le calendrier du système.
      setCurseur((j) => {
        const d = new Date(`${j}T12:00:00`);
        d.setDate(d.getDate() + pas);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      });
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setCurseur((j) => moisDecale(j, e.key === "PageUp" ? -1 : 1));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choisir(curseur);
    }
  };

  const etiquette = valeur ? formaterChamp(valeur, aujourdHui) : (props.placeholder ?? t("Choisir une date"));

  const cellulePleine =
    "cible-tactile relative flex h-8 w-9 items-center justify-center rounded-[9px] text-[13px] tabular-nums outline-none transition-colors";

  return (
    <>
      <button
        ref={bouton}
        id={props.id}
        type="button"
        disabled={disabled}
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label={valeur ? `${aria} : ${formaterComplet(valeur)}` : aria}
        data-tip={props.tip}
        className={
          props.className ??
          "cible-tactile flex w-full items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-left text-sm text-text transition-colors hover:border-border-strong focus:border-blue focus:outline-none disabled:opacity-40"
        }
      >
        <IconCalendar className="h-3.5 w-3.5 shrink-0 text-text-dim" />
        {/* La valeur est ÉCRITE : c'est elle qui rend le contrôle identifiable,
            là où le natif laissait un rectangle muet au doigt. */}
        <span className={`min-w-0 flex-1 truncate ${valeur ? "" : "text-text-dim"}`}>{etiquette}</span>
        {valeur && effacable && (
          // Une croix DANS le bouton : retirer une échéance est un geste courant,
          // et l'aller-retour par le panneau le rendait trois fois plus long.
          <span
            role="button"
            tabIndex={-1}
            aria-label={t("Retirer la date")}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="cible-tactile -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-text-dim hover:bg-overlay hover:text-text"
          >
            <IconX className="h-3 w-3" />
          </span>
        )}
      </button>

      {ouvert &&
        createPortal(
          <div
            ref={panneau}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titreId}
            /* `card-solid` et pas `card` : un panneau qui flotte au-dessus du
               reste prend un aplat opaque, le dégradé de `.card` laissant
               transparaître la vue (règle du design system V6). */
            className="card card-solid fixed z-[190] w-[17.5rem] rounded-2xl p-3 shadow-2xl"
            style={{
              top: place?.top ?? -9999,
              left: place?.left ?? -9999,
              // Tant que la mesure n'est pas faite, le panneau est hors champ :
              // sans ça, il apparaît un éclair en haut à gauche de l'écran.
              visibility: place ? "visible" : "hidden",
            }}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                id={titreId}
                onClick={() => setCurseur(aujourdHui)}
                data-tip={t("Revenir au mois en cours")}
                className="cible-tactile-ligne min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm font-medium text-text first-letter:uppercase hover:bg-overlay"
              >
                {formaterMois(curseur)}
              </button>
              <button
                type="button"
                onClick={() => setCurseur((j) => moisDecale(j, -1))}
                aria-label={t("Mois précédent")}
                className="cible-tactile flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-overlay hover:text-text"
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurseur((j) => moisDecale(j, 1))}
                aria-label={t("Mois suivant")}
                className="cible-tactile flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-overlay hover:text-text"
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* ⚠️ La semaine commence le LUNDI — `ORDRE_SEMAINE`, comme partout
                dans l'app, et `nomCourtDuJour` demande les noms à `Intl` plutôt
                qu'à une table figée en français (PIEGES § 4.2 et § 5.2 bis). */}
            <div className="mt-2 grid grid-cols-7 gap-0.5" aria-hidden>
              {ORDRE_SEMAINE.map((j) => (
                <span key={j} className="flex h-6 items-center justify-center text-[10px] font-semibold uppercase text-text-dim">
                  {nomCourtDuJour(j).slice(0, 2)}
                </span>
              ))}
            </div>

            <div role="grid" aria-labelledby={titreId} className="grid grid-cols-7 gap-0.5">
              {jours.map((jour) => {
                const dehors = moisDe(jour) !== moisAffiche;
                const choisi = jour === valeur;
                const cejour = jour === aujourdHui;
                const surLeCurseur = jour === curseur;
                return (
                  <button
                    key={jour}
                    ref={surLeCurseur ? cellule : undefined}
                    type="button"
                    role="gridcell"
                    aria-selected={choisi}
                    aria-current={cejour ? "date" : undefined}
                    aria-label={formaterComplet(jour)}
                    /* Un seul arrêt de tabulation dans la grille : celui du
                       curseur. Quarante-deux cellules tabulables auraient rendu
                       la sortie du panneau interminable au clavier. */
                    tabIndex={surLeCurseur ? 0 : -1}
                    disabled={!admis(jour)}
                    onKeyDown={auClavier}
                    onClick={() => choisir(jour)}
                    className={`${cellulePleine} disabled:cursor-not-allowed disabled:text-text-dim/30 disabled:hover:bg-transparent ${
                      choisi
                        ? "bg-blue font-semibold text-white"
                        : cejour
                          ? "font-semibold text-blue hover:bg-overlay"
                          : dehors
                            ? "text-text-dim/55 hover:bg-overlay"
                            : "text-text hover:bg-overlay"
                    } ${surLeCurseur && !choisi ? "ring-1 ring-border-strong" : ""}`}
                  >
                    {Number(jour.slice(8, 10))}
                  </button>
                );
              })}
            </div>

            {/* Les trois dates qu'on pose le plus souvent. Celle qui est déjà en
                place se marque, pour qu'un second clic ne se cherche pas. */}
            <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
              {raccourcis(aujourdHui).map((r) => (
                <button
                  key={r.cle}
                  type="button"
                  onClick={() => choisir(r.jour)}
                  className={`pill cible-tactile-ligne border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    valeur === r.jour
                      ? "border-blue/40 bg-blue/15 text-text"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  {r.libelle}
                </button>
              ))}
              {valeur && effacable && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOuvert(false);
                  }}
                  className="pill cible-tactile-ligne ml-auto px-2.5 py-1 text-[11px] font-medium text-text-dim hover:text-text"
                >
                  {t("Effacer")}
                </button>
              )}
            </div>

            {/* ⚠️ LE CHEMIN CLAVIER, celui qui garde la frappe plus rapide que
                le clic. `inputMode="numeric"` pour que le doigt reçoive le pavé
                de chiffres et non l'alphabet. */}
            <div className="mt-2">
              <input
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  // Le formulaire qui porte le champ ne doit PAS être soumis par
                  // cette touche : on la consomme ici.
                  e.preventDefault();
                  e.stopPropagation();
                  const lu = parserSaisie(saisie, curseur);
                  if (lu && admis(lu)) choisir(lu);
                }}
                inputMode="numeric"
                placeholder={gabaritDeSaisie()}
                aria-label={t("Taper une date")}
                aria-invalid={saisie.trim() !== "" && parserSaisie(saisie, curseur) === null}
                className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-center text-[13px] tabular-nums text-text placeholder:text-text-dim focus:border-blue focus:outline-none aria-[invalid=true]:border-red/60"
              />
              {/* Ce qui a été lu, AVANT de valider : « 24/09 » est ambigu pour
                  qui doute de l'ordre des champs, et la réponse lève le doute
                  sans qu'il faille essayer. */}
              {saisie.trim() !== "" && (
                <p className="mt-1 text-center text-[11px] text-text-dim">
                  {(() => {
                    const lu = parserSaisie(saisie, curseur);
                    if (!lu) return t("Date illisible");
                    // Une date lue mais hors bornes le DIT : muette, elle
                    // laisserait croire que `Entrée` n'a pas marché.
                    if (!admis(lu)) return t("Date hors des bornes");
                    return libelleRelatif(lu, aujourdHui) ?? formaterComplet(lu);
                  })()}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
