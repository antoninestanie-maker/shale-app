import { useRef, useState, type ReactNode } from "react";
import { IconCalendar, IconPlus, IconX } from "../icons";
import { dateAuFil, formaterComplet } from "../../lib/calendrier/champDate";
import { t } from "../../lib/i18n";
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
 *   • la croix de la pastille (ou Échap) l'écarte : le mot reste dans le titre
 *     (« Lire Vendredi ou la vie sauvage » reste entier) ;
 *   • le bouton calendrier date sans rien taper (le calendrier de l'app,
 *     `lib/selecteurDate.ts`) ;
 *   • `parDefaut` : la date d'une tâche ajoutée sans en donner. La carte
 *     d'Aujourd'hui passe le jour — c'est la liste du jour, une tâche sans date
 *     n'y paraîtrait pas ; Tâches ne passe rien (décision du 2026-09-30).
 *
 * Ce composant ne crée rien : il rend un titre et un jour à `onAjouter`, qui
 * écrit par `planificationDeSaisie` (`lib/taches.ts`).
 */
export default function SaisieRapide(props: {
  onAjouter: (titre: string, jour: string | null) => void | Promise<void>;
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
    void props.onAjouter(resolue.titre, resolue.jour);
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border border-border bg-surface py-1.5 pl-3.5 pr-1.5 transition-colors focus-within:border-blue">
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
          className="min-w-[9rem] flex-1 bg-transparent py-1 text-sm text-text placeholder:text-text-dim focus:outline-none"
        />
        <span className="flex shrink-0 items-center gap-1.5">
          <span ref={zoneDate} className="inline-flex shrink-0 items-center">
            {resolue.jour ? (
              <span
                className={`pill inline-flex items-center border text-[11px] font-medium ${
                  retirable ? "border-blue/40 bg-blue/10 text-text" : "border-border text-text-dim"
                }`}
              >
                <button
                  type="button"
                  onClick={ouvrirCalendrier}
                  aria-label={t("Date de la tâche : {date}. Changer", { date: formaterComplet(resolue.jour) })}
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
                  <span className="whitespace-nowrap">{dateAuFil(resolue.jour, aujourdHui)}</span>
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
              <button
                type="button"
                onClick={ouvrirCalendrier}
                aria-label={t("Choisir une date")}
                data-tip={t("Choisir une date")}
                data-tip-sub={t("Ou écris-la dans la phrase : « jeudi », « demain », « 15/10 ».")}
                className="cible-tactile flex h-7 w-7 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
              >
                <IconCalendar className="h-4 w-4" />
              </button>
            )}
          </span>
          {props.children}
        </span>
      </div>
    </form>
  );
}
