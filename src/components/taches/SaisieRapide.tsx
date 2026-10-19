import { useRef, useState, type ReactNode } from "react";
import { IconCalendar, IconPlus, IconX } from "../icons";
import { dateAuFil, formaterComplet } from "../../lib/calendrier/champDate";
import { formatHeure, t } from "../../lib/i18n";
import { todayStr } from "../../lib/logic";
import { ancreSurElement, ouvrirSelecteurDate } from "../../lib/selecteurDate";
import { resoudreSaisie, type Saisie } from "../../lib/taches/saisieRapide";

/**
 * ⭐ LA LIGNE D'AJOUT RAPIDE D'UNE TÂCHE — celle de Tâches et celle de la carte
 * d'Aujourd'hui (2026-10-11).
 *
 * Le crible du labo (constat 6) : « Relancer le devis jeudi » tombait dans
 * « Sans date », le mot resté dans le titre, et la ligne n'offrait aucun moyen
 * de dater. Maintenant :
 *   • la date écrite dans la phrase est LUE (`lib/taches/saisieRapide.ts`) et
 *     montrée en PASTILLE avant validation — jamais appliquée en silence ;
 *   • un jour de la semaine suivi d'un numéro (« avant jeudi 22 ») désigne CE
 *     jour du mois, et l'heure accolée (« jeudi 14h30 ») est lue avec la date :
 *     la pastille écrit le jour, le numéro ET l'heure (« jeu. 22 oct. · 14:30 »)
 *     — seconde passe du labo, 2026-10-12, constat 2 ;
 *   • la croix de la pastille (ou Échap) l'écarte : le mot reste dans le titre
 *     (« Lire Vendredi ou la vie sauvage » reste entier) ;
 *   • le bouton calendrier date sans rien taper (le calendrier de l'app,
 *     `lib/selecteurDate.ts`) ;
 *   • `parDefaut` : la date d'une tâche ajoutée sans en donner. La carte
 *     d'Aujourd'hui passe le jour — c'est la liste du jour, une tâche sans date
 *     n'y paraîtrait pas ; Tâches ne passe rien (décision du 2026-09-30).
 *
 * ⭐ 2026-10-12 — LA LIGNE ANNONCE TOUJOURS SA RÈGLE, PAR UNE PASTILLE. Antonin,
 * après essai : « Corrige aussi le souci d'une tâche sans date. » Le labo
 * (seconde passe, rang 7, cinq utilisateurs) : les deux champs se ressemblent
 * et ne font pas pareil — celui d'Aujourd'hui date d'office et le montre
 * (« aujourd'hui »), celui de Tâches rangeait dans « Sans date » sans rien
 * dire : il ne montrait qu'une icône de calendrier. La règle de Tâches ne
 * change pas ; elle s'ÉCRIT : une pastille « sans date », au même endroit et de
 * la même forme que la pastille « aujourd'hui ». Elle se touche pour dater (le
 * calendrier de l'app, sur place) et devient la pastille de date dès qu'une
 * date est lue ou choisie. Il n'y a donc plus d'état où la ligne ne dit rien.
 *
 * Ce composant ne crée rien : il rend un titre, un jour et une heure à
 * `onAjouter`, qui écrit par `planificationRapide` (`lib/taches/saisieRapide.ts`).
 */
export default function SaisieRapide(props: {
  /** `heure` : 'HH:MM', lue dans la phrase avec la date — ou `null`. */
  onAjouter: (titre: string, jour: string | null, heure: string | null) => void | Promise<void>;
  /** 'YYYY-MM-DD' : la date posée quand on n'en donne aucune. */
  parDefaut?: string | null;
  placeholder: string;
  /** Le nom du champ pour un lecteur d'écran. */
  aria: string;
  /** Ce que la ligne porte en plus, à droite : le tag regardé, la priorité. */
  children?: ReactNode;
  /** Un « + » devant le champ (la ligne de Tâches). */
  plus?: boolean;
  className?: string;
}) {
  const [saisie, setSaisie] = useState<Saisie>({ texte: "", choisie: null, ecartee: null });
  const champ = useRef<HTMLInputElement>(null);
  const zoneDate = useRef<HTMLSpanElement>(null);
  const aujourdHui = todayStr();
  const resolue = resoudreSaisie(saisie, aujourdHui, props.parDefaut ?? null);

  const valider = () => {
    if (!resolue.titre) return;
    setSaisie({ texte: "", choisie: null, ecartee: null });
    void props.onAjouter(resolue.titre, resolue.jour, resolue.heure);
  };

  /** Retirer la date montrée — d'un geste, sans toucher au texte. */
  const ecarter = () =>
    setSaisie((s) => (resolue.origine === "lue" ? { ...s, ecartee: resolue.mots } : { ...s, choisie: null }));

  const ouvrirCalendrier = () => {
    const zone = zoneDate.current;
    if (!zone) return;
    ouvrirSelecteurDate({
      ancre: ancreSurElement(zone),
      ami: () => zoneDate.current,
      // Le focus revient au CHAMP : Entrée valide alors la tâche, date comprise.
      focusApres: () => champ.current,
      valeur: resolue.jour ?? "",
      onChoisir: (jour) =>
        setSaisie((s) =>
          jour
            ? { ...s, choisie: jour }
            : // « Effacer » : plus de date choisie, et la date lue est écartée elle aussi.
              { ...s, choisie: null, ecartee: resolue.origine === "lue" ? resolue.mots : s.ecartee },
        ),
    });
  };

  const retirable = resolue.origine === "lue" || resolue.origine === "choisie";
  /** L'heure lue, dans la langue de l'app : « 14:30 », “2:30 PM”. */
  const heure = resolue.heure ? formatHeure(resolue.heure) : null;

  return (
    <form
      className={props.className}
      onSubmit={(e) => {
        e.preventDefault();
        valider();
      }}
    >
      {/* Un <div>, pas un <label> : la pastille de priorité en est un, et un
          <label> dans un <label> n'est pas du HTML. `flex-wrap` : à 390 px, les
          pastilles passent sous le champ au lieu de l'écraser. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border border-border bg-surface py-1.5 pl-3.5 pr-1.5 transition-colors focus-within:border-accent">
        {props.plus && <IconPlus className="h-4 w-4 shrink-0 text-text-dim" />}
        <input
          ref={champ}
          value={saisie.texte}
          onChange={(e) => {
            const texte = e.target.value;
            // Une ligne vidée repart de zéro : l'écart ne vaut que pour la phrase en cours.
            setSaisie((s) => (texte.trim() ? { ...s, texte } : { ...s, texte, ecartee: null }));
          }}
          onKeyDown={(e) => {
            // Échap écarte la date LUE — et marque la touche : rien d'autre ne se ferme.
            if (e.key !== "Escape" || e.defaultPrevented || resolue.origine !== "lue") return;
            e.preventDefault();
            e.stopPropagation();
            ecarter();
          }}
          placeholder={props.placeholder}
          aria-label={props.aria}
          // Le correcteur d'iOS remplacerait « jeudi » en cours de frappe par autre chose.
          autoComplete="off"
          // `cible-tactile-ligne` : 44 pt de haut au doigt — le champ mesurait
          // 28 px, « petit pour un doigt » (relevé par le pilote à 390 px).
          className="cible-tactile-ligne min-w-[9rem] flex-1 bg-transparent py-1 text-sm text-text placeholder:text-text-dim focus:outline-none"
        />
        <span className="flex shrink-0 items-center gap-1.5">
          <span ref={zoneDate} className="inline-flex shrink-0 items-center">
            {resolue.jour ? (
              <span
                className={`pill inline-flex items-center border text-[11px] font-medium ${
                  retirable ? "border-accent/40 bg-accent/10 text-text" : "border-border text-text-dim"
                }`}
              >
                <button
                  type="button"
                  onClick={ouvrirCalendrier}
                  aria-label={t("Date de la tâche : {date}. Changer", {
                    date: heure ? `${formaterComplet(resolue.jour)}, ${heure}` : formaterComplet(resolue.jour),
                  })}
                  data-tip={resolue.origine === "lue" ? t("Date lue dans la phrase") : t("Changer la date")}
                  data-tip-sub={
                    resolue.origine === "lue"
                      ? t("« {mots} » quittera le titre. La croix garde le titre entier.", { mots: resolue.mots ?? "" })
                      : resolue.origine === "defaut"
                        ? t("Ajoutée ici, la tâche est prévue aujourd'hui.")
                        : undefined
                  }
                  className={`cible-tactile-ligne inline-flex items-center gap-1 py-1 pl-2 ${retirable ? "pr-1" : "pr-2"}`}
                >
                  <IconCalendar className="h-3 w-3 shrink-0" />
                  <span className="whitespace-nowrap">
                    {dateAuFil(resolue.jour, aujourdHui)}
                    {heure && ` · ${heure}`}
                  </span>
                </button>
                {retirable && (
                  <button
                    type="button"
                    onClick={() => {
                      ecarter();
                      champ.current?.focus();
                    }}
                    aria-label={t("Retirer la date")}
                    data-tip={t("Retirer la date")}
                    data-tip-sub={resolue.origine === "lue" ? t("Le titre reste entier.") : undefined}
                    className="cible-tactile -ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-text-dim hover:text-text"
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                )}
              </span>
            ) : (
              /* ⭐ « sans date » — la même pastille que « aujourd'hui » sur la
                 carte du jour (bordée, estompée : une règle, pas un choix). Avant
                 le 2026-10-12, une icône seule : rien ne disait où irait la tâche. */
              <span className="pill inline-flex items-center border border-border text-[11px] font-medium text-text-dim">
                <button
                  type="button"
                  onClick={ouvrirCalendrier}
                  aria-haspopup="dialog"
                  aria-label={t("Sans date. Choisir une date")}
                  data-tip={t("Choisir une date")}
                  data-tip-sub={t("Ajoutée ainsi, la tâche n'est prévue aucun jour. Ou écris le jour dans la phrase : « jeudi 14h30 », « demain », « le 22 ».")}
                  className="cible-tactile-ligne inline-flex items-center gap-1 py-1 pl-2 pr-2 transition-colors hover:text-text"
                >
                  <IconCalendar className="h-3 w-3 shrink-0" />
                  <span className="whitespace-nowrap">{t("sans date")}</span>
                </button>
              </span>
            )}
          </span>
          {props.children}
        </span>
      </div>
    </form>
  );
}
