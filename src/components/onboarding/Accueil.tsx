import { useMemo, useState } from "react";

import { useAppTexts } from "../../lib/appTexts";
import { t } from "../../lib/i18n";
import { nomCourtDuJour, ORDRE_SEMAINE } from "../../lib/logic";
import { bornesDuCurseur, grilleSemaine, heuresLibres, valeurProposee } from "../../lib/onboarding/grille";
import {
  REGLAGES_PAR_DEFAUT,
  type BlocContraint,
  type ReglagesHoraires,
} from "../../lib/onboarding/reglages";
import {
  creerObjectifDuCurseur,
  creerPremiereTache,
  enregistrerReglages,
  marquerAccueilFait,
  semerExemples,
} from "../../lib/onboarding/semer";
import { IconCheckCircle, IconPlus, IconTrash } from "../icons";
import ShaleMark from "../auth/ShaleMark";
import GrilleSemaine from "./GrilleSemaine";

/**
 * ⭐ L'accueil du premier démarrage — il CONFIGURE, il ne présente pas.
 *
 * ─── CE QU'IL REMPLACE, ET POURQUOI ─────────────────────────────────────────
 *
 * L'ancien `auth/Onboarding.tsx` affichait trois écrans de présentation
 * (« Exécute proprement », « Garde le cap »). Ils ne branchaient RIEN : après
 * les avoir lus, l'utilisateur retrouvait une app aussi vide qu'avant. La règle
 * de ce chantier est l'inverse — **chaque question posée configure quelque
 * chose, et une question qui ne branche rien n'a pas à exister.**
 *
 * Les deux textes éditables depuis « Personnaliser » (`onboardingTitle` /
 * `onboardingBody` d'`appTexts.ts`) sont CONSERVÉS, en tête du premier écran :
 * retirer l'accueil sans les reprendre aurait cassé une fonction d'admin en
 * silence.
 *
 * ─── OÙ VONT LES RÉPONSES ───────────────────────────────────────────────────
 *
 *   lever / coucher      → la grille, et l'habitude de régularité du coucher
 *   plages de travail    → le REPLI du profil de disponibilité, donc les
 *                          créneaux libres du calendrier et la capacité d'une
 *                          journée, donc la détection de surcharge
 *   blocs contraints     → la grille et les créneaux libres
 *   curseur de clôture   → un objectif dans le module Objectifs
 *
 * ─── CE QUI EST INTERDIT ICI, ET LE RESTE ───────────────────────────────────
 *
 *   • aucune estimation de « temps perdu sans Shale », aucun coefficient
 *     inventé, aucune projection de gain calculée par l'app ;
 *   • aucune formulation en perte — « il te reste N h libres », jamais « tu
 *     perds N h ». `grille.ts` n'expose d'ailleurs AUCUN compte d'heures
 *     occupées, ce qui rend la formule fautive mécaniquement inatteignable ;
 *   • le sommeil est incompressible. Rien, nulle part, ne suggère d'en
 *     retirer : l'habitude et les textes parlent de RÉGULARITÉ de l'heure de
 *     coucher, jamais de durée.
 */

/** Les étapes, dans l'ordre. Trois questions, la grille, la première action. */
type Etape = "heures" | "travail" | "contraints" | "grille" | "action";
const ETAPES: readonly Etape[] = ["heures", "travail", "contraints", "grille", "action"];

/** Au-delà, l'écran devient un formulaire — et la question était optionnelle. */
const MAX_CONTRAINTS = 3;

export default function Accueil({ onDone }: { onDone: (allerAuxTaches: boolean) => void }) {
  const textes = useAppTexts();
  const [etape, setEtape] = useState<Etape>("heures");
  const [reglages, setReglages] = useState<ReglagesHoraires>(REGLAGES_PAR_DEFAUT);
  const [heuresVoulues, setHeuresVoulues] = useState<number | null>(null);
  const [premiereTache, setPremiereTache] = useState("");
  const [enCours, setEnCours] = useState(false);

  const grille = useMemo(() => grilleSemaine(reglages), [reglages]);
  const bornes = bornesDuCurseur(grille);
  const libres = heuresLibres(grille);
  const curseur = heuresVoulues ?? valeurProposee(grille);

  const index = ETAPES.indexOf(etape);
  const patch = (p: Partial<ReglagesHoraires>) => setReglages((r) => ({ ...r, ...p }));

  /**
   * ⭐ La sortie, unique — que l'accueil ait été suivi ou PASSÉ.
   *
   * Un skip complet doit laisser une app utilisable : les réglages par défaut
   * sont donc écrits dans tous les cas (ils reproduisent exactement le repli
   * qui existait avant ce chantier, cf. `REGLAGES_PAR_DEFAUT`), et le contenu
   * de départ est semé dans tous les cas.
   *
   * ⚠️ L'objectif, LUI, n'est créé que si le curseur a été posé. « La réponse
   * crée un objectif » : pas de réponse, pas d'objectif. Fabriquer un objectif
   * par défaut mettrait dans le module Objectifs un chiffre que personne n'a
   * choisi — exactement ce que le cahier des charges interdit.
   */
  const terminer = async (options: { avecObjectif: boolean; avecTache: boolean }) => {
    if (enCours) return;
    setEnCours(true);
    try {
      await enregistrerReglages(reglages);
      if (options.avecObjectif && heuresVoulues != null && heuresVoulues > 0) {
        await creerObjectifDuCurseur(heuresVoulues);
      }
      if (options.avecTache) await creerPremiereTache(premiereTache);
      await semerExemples();
      await marquerAccueilFait();
      onDone(options.avecTache && premiereTache.trim().length > 0);
    } catch {
      // ⚠️ Un accueil qui échoue ne doit pas emprisonner l'utilisateur dans son
      // propre écran de bienvenue. On sort, l'app est utilisable avec ce qui a
      // pu s'écrire, et le rejeu depuis les Réglages reste disponible.
      onDone(false);
    }
  };

  const suivant = () => {
    if (etape === "action") return void terminer({ avecObjectif: true, avecTache: true });
    setEtape(ETAPES[index + 1]);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="card-solid w-full max-w-lg animate-fade-up rounded-[18px] border border-border p-6 sm:p-7">
        {etape === "heures" && (
          <div className="mb-5 flex items-center gap-3">
            <ShaleMark size={30} />
            <div>
              <h2 className="text-lg font-bold leading-tight tracking-tight text-text">
                {textes.onboardingTitle}
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-text-dim">
                {textes.onboardingBody}
              </p>
            </div>
          </div>
        )}

        {etape === "heures" && <EtapeHeures reglages={reglages} patch={patch} />}
        {etape === "travail" && <EtapeTravail reglages={reglages} patch={patch} />}
        {etape === "contraints" && <EtapeContraints reglages={reglages} patch={patch} />}
        {etape === "grille" && (
          <EtapeGrille
            reglages={reglages}
            libres={libres}
            bornes={bornes}
            curseur={curseur}
            onCurseur={setHeuresVoulues}
          />
        )}
        {etape === "action" && (
          <EtapeAction valeur={premiereTache} onChange={setPremiereTache} />
        )}

        {/* ── Pied : progression, suivant, passer ─────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {ETAPES.map((e, k) => (
            <span
              key={e}
              className={`h-1.5 rounded-full transition-all ${
                k === index ? "w-6 bg-blue" : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={enCours}
            onClick={suivant}
            className="pill cible-tactile w-full bg-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {etape === "action" ? (
              <span className="inline-flex items-center gap-2">
                <IconCheckCircle className="h-4 w-4" />
                {/* Le libellé dit ce que le bouton FAIT : il crée la tâche. */}
                {premiereTache.trim() ? t("Créer et commencer") : t("Commencer")}
              </span>
            ) : (
              t("Suivant")
            )}
          </button>
          {/* ⚠️ Skippable à TOUTES les étapes, y compris la dernière. */}
          <button
            type="button"
            disabled={enCours}
            onClick={() => void terminer({ avecObjectif: etape === "action", avecTache: false })}
            className="cible-tactile-ligne text-xs text-text-dim transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {t("Passer")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Écran 1 — les heures ────────────────────────────────────────────────────

function EtapeHeures({
  reglages,
  patch,
}: {
  reglages: ReglagesHoraires;
  patch: (p: Partial<ReglagesHoraires>) => void;
}) {
  return (
    <Bloc
      titre={t("À quelle heure te lèves-tu et te couches-tu, d'habitude ?")}
      aide={t("Ces deux heures dessinent ta semaine et servent à repérer la régularité de ton coucher. Elles ne servent jamais à te proposer de dormir moins.")}
    >
      <div className="flex gap-3">
        <Heure
          libelle={t("Lever")}
          valeur={reglages.lever}
          onChange={(v) => patch({ lever: v })}
        />
        <Heure
          libelle={t("Coucher")}
          valeur={reglages.coucher}
          onChange={(v) => patch({ coucher: v })}
        />
      </div>
    </Bloc>
  );
}

// ─── Écran 2 — les plages de travail ─────────────────────────────────────────

function EtapeTravail({
  reglages,
  patch,
}: {
  reglages: ReglagesHoraires;
  patch: (p: Partial<ReglagesHoraires>) => void;
}) {
  const basculer = (j: number) => {
    const jours = reglages.travail.jours.includes(j)
      ? reglages.travail.jours.filter((x) => x !== j)
      : [...reglages.travail.jours, j].sort((a, b) => a - b);
    patch({ travail: { ...reglages.travail, jours } });
  };

  return (
    <Bloc
      titre={t("Quand travailles-tu ?")}
      aide={t("C'est de là que partent les créneaux que le calendrier te proposera, jusqu'à ce qu'il ait appris tes heures réelles.")}
    >
      <div className="flex flex-wrap gap-1.5">
        {ORDRE_SEMAINE.map((j) => (
          <button
            key={j}
            type="button"
            onClick={() => basculer(j)}
            aria-pressed={reglages.travail.jours.includes(j)}
            className={`cible-tactile h-9 w-10 rounded-[8px] border text-xs font-medium transition-colors ${
              reglages.travail.jours.includes(j)
                ? "border-blue bg-blue/20 text-text"
                : "border-border text-text-dim hover:text-text"
            }`}
          >
            {nomCourtDuJour(j)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-3">
        <Heure
          libelle={t("Début")}
          valeur={reglages.travail.debut}
          onChange={(v) => patch({ travail: { ...reglages.travail, debut: v } })}
        />
        <Heure
          libelle={t("Fin")}
          valeur={reglages.travail.fin}
          onChange={(v) => patch({ travail: { ...reglages.travail, fin: v } })}
        />
      </div>
    </Bloc>
  );
}

// ─── Écran 3 — les blocs contraints (optionnel) ──────────────────────────────

function EtapeContraints({
  reglages,
  patch,
}: {
  reglages: ReglagesHoraires;
  patch: (p: Partial<ReglagesHoraires>) => void;
}) {
  const [brouillon, setBrouillon] = useState<BlocContraint>({
    label: "",
    jours: reglages.travail.jours,
    debut: "08:00",
    fin: "09:00",
  });

  const ajouter = () => {
    if (reglages.contraints.length >= MAX_CONTRAINTS) return;
    patch({
      contraints: [
        ...reglages.contraints,
        { ...brouillon, label: brouillon.label.trim() || t("Trajet") },
      ],
    });
    setBrouillon({ label: "", jours: reglages.travail.jours, debut: "08:00", fin: "09:00" });
  };

  const retirer = (i: number) =>
    patch({ contraints: reglages.contraints.filter((_, k) => k !== i) });

  return (
    <Bloc
      titre={t("Un trajet, un cours, une garde ?")}
      aide={t("Tout bloc qui revient et que tu ne choisis pas. Facultatif — tu peux passer.")}
    >
      {reglages.contraints.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5">
          {reglages.contraints.map((c, i) => (
            <li
              key={`${c.label}-${i}`}
              className="cible-tactile-ligne flex items-center justify-between rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text"
            >
              <span className="truncate">{c.label}</span>
              <button
                type="button"
                onClick={() => retirer(i)}
                aria-label={t("Retirer")}
                className="cible-tactile shrink-0 text-text-dim transition-opacity hover:opacity-80"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {reglages.contraints.length < MAX_CONTRAINTS && (
        <>
          <input
            value={brouillon.label}
            onChange={(e) => setBrouillon({ ...brouillon, label: e.target.value })}
            placeholder={t("Trajet, cours, garde…")}
            className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none placeholder:text-text-dim focus:border-border-strong"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ORDRE_SEMAINE.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() =>
                  setBrouillon({
                    ...brouillon,
                    jours: brouillon.jours.includes(j)
                      ? brouillon.jours.filter((x) => x !== j)
                      : [...brouillon.jours, j].sort((a, b) => a - b),
                  })
                }
                aria-pressed={brouillon.jours.includes(j)}
                className={`cible-tactile h-9 w-10 rounded-[8px] border text-xs font-medium transition-colors ${
                  brouillon.jours.includes(j)
                    ? "border-blue bg-blue/20 text-text"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {nomCourtDuJour(j)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-end gap-3">
            <Heure
              libelle={t("Début")}
              valeur={brouillon.debut}
              onChange={(v) => setBrouillon({ ...brouillon, debut: v })}
            />
            <Heure
              libelle={t("Fin")}
              valeur={brouillon.fin}
              onChange={(v) => setBrouillon({ ...brouillon, fin: v })}
            />
            <button
              type="button"
              onClick={ajouter}
              disabled={brouillon.jours.length === 0}
              aria-label={t("Ajouter")}
              className="cible-tactile mb-[1px] shrink-0 rounded-lg border border-border bg-overlay px-3 py-2 text-text-dim transition-colors hover:text-text disabled:opacity-40"
            >
              <IconPlus className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </Bloc>
  );
}

// ─── Écran 4 — la grille, puis la seule question de clôture ──────────────────

function EtapeGrille({
  reglages,
  libres,
  bornes,
  curseur,
  onCurseur,
}: {
  reglages: ReglagesHoraires;
  libres: number;
  bornes: { minimum: number; maximum: number };
  curseur: number;
  onCurseur: (n: number) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-tight text-text">{t("Ta semaine")}</h3>
      {/* ⚠️ LE CHIFFRE PARLE TOUT SEUL — il n'est pas commenté, et il est dit
          en SOLDE. « Tu perds N heures » est interdit dans toute l'app. */}
      <p className="mt-1 text-sm text-text-dim">
        {t("Il te reste {n} h libres.", { n: libres })}
      </p>

      <div className="mt-4">
        <GrilleSemaine reglages={reglages} compact />
      </div>

      {bornes.maximum > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <label
            htmlFor="accueil-curseur"
            className="block text-sm font-medium text-text"
          >
            {t("Combien d'heures veux-tu récupérer par semaine ?")}
          </label>
          <div className="mt-3 flex items-center gap-3">
            <input
              id="accueil-curseur"
              type="range"
              min={bornes.minimum}
              max={bornes.maximum}
              step={1}
              value={curseur}
              onChange={(e) => onCurseur(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-overlay-2 accent-blue"
            />
            <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-text">
              {t("{n} h", { n: curseur })}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-dim">
            {/* ⚠️ On dit d'où vient la BORNE, pas ce que l'app promet. */}
            {t("Au plus {n} h — c'est ce que ta semaine laisse de libre. Ça devient un objectif que tu pourras changer.", { n: bornes.maximum })}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Écran 5 — une première action, en une étape ─────────────────────────────

function EtapeAction({
  valeur,
  onChange,
}: {
  valeur: string;
  onChange: (v: string) => void;
}) {
  return (
    <Bloc
      titre={t("Une première tâche, pour commencer")}
      aide={t("Quelque chose que tu dois vraiment faire. Elle t'attendra dans Tâches.")}
    >
      <input
        autoFocus
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("Ce que je fais en premier…")}
        className="w-full rounded-lg border border-border bg-overlay px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dim focus:border-border-strong"
      />
    </Bloc>
  );
}

// ─── Briques communes ────────────────────────────────────────────────────────

function Bloc({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold leading-snug tracking-tight text-text">{titre}</h3>
      <p className="mt-1 text-xs leading-relaxed text-text-dim">{aide}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/**
 * ⚠️ `<input type="time">` et non la roulette : c'est le champ PRIMAIRE partout
 * dans l'app (`EventModal`), il se tape au clavier sur un Mac, et iOS lui
 * substitue de lui-même sa propre molette native. La roulette maison reste le
 * confort d'un formulaire qu'on ouvre longtemps, pas d'un écran de cinq
 * secondes.
 */
function Heure({
  libelle,
  valeur,
  onChange,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-medium uppercase tracking-wide text-text-dim">
        {libelle}
      </label>
      <input
        type="time"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="cible-tactile mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
      />
    </div>
  );
}
