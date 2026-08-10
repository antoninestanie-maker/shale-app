import { useMemo, useState } from "react";

import { t } from "../lib/i18n";
import { canoniser, genererCode } from "../lib/sync/recovery";
import { useSyncApi } from "./SyncProvider";

/**
 * Activation de la synchronisation, en quatre temps.
 *
 * ─── POURQUOI UN PARCOURS ET PAS UN BOUTON ─────────────────────────────────
 * C'est le seul écran de l'app dont une erreur est DÉFINITIVE. Le chiffrement
 * de bout en bout signifie que personne — ni le support, ni l'administrateur de
 * la base — ne peut rouvrir les données d'un compte dont les secrets sont
 * perdus. Un bouton unique ferait porter cette conséquence à un clic distrait.
 *
 * L'ordre est donc contraint, et il n'est pas cosmétique :
 *   1. ce que ça fait, et ce que ça coûte      → avant de demander quoi que ce soit
 *   2. le mot de passe
 *   3. le code de récupération, MONTRÉ         → avant que quoi que ce soit existe
 *   4. la preuve qu'il a été noté              → avant que ça devienne irréversible
 *   puis, et seulement là, l'activation.
 *
 * ⚠️ LE CODE EST TIRÉ ICI, PAS PAR `activer()`. C'est ce qui rend l'ordre
 * ci-dessus possible : `activer()` écrit les enveloppes chez Supabase, donc
 * quand elle rend la main la synchronisation EXISTE. Si le code en sortait, on
 * ne pourrait le montrer qu'après — et la case « je l'ai noté » deviendrait une
 * formalité cochée après coup, sur un fait accompli, ce qui est exactement
 * l'inverse de son rôle. `genererCode()` est pure : la tirer ici ne coûte rien
 * et n'engage rien tant que l'étape 4 n'est pas franchie.
 */

type Etape = "presentation" | "motDePasse" | "code" | "preuve";

/** Nombre de groupes à retaper pour prouver que le code a été noté. */
const GROUPES_A_PROUVER = 2;

/** Découpe `SHALE-4T7K-9BQZ-…` en ses groupes, sans le préfixe. */
function groupes(code: string): string[] {
  return code.split("-").slice(1);
}

/**
 * Compare un groupe recopié à l'original, avec EXACTEMENT les tolérances du
 * déverrouillage — c'est `canoniser()` de `recovery.ts` qui les détient, pas
 * une seconde copie ici. Un contrôle de saisie plus sévère que la porte qu'il
 * prépare rejetterait un code parfaitement valable.
 */
function memeGroupe(saisi: string, attendu: string): boolean {
  return canoniser(saisi) === canoniser(attendu);
}

/**
 * Deux groupes tirés au hasard, JAMAIS les deux premiers : ce sont ceux qu'on
 * retient sans avoir rien noté, et la preuve ne prouverait alors que la mémoire
 * immédiate. Tirés une seule fois (`useMemo`) — les rejouer à chaque frappe
 * changerait la question sous les doigts de l'utilisateur.
 */
function aDemander(code: string): number[] {
  const total = groupes(code).length;
  const candidats = Array.from({ length: total }, (_, i) => i).slice(1);
  for (let i = candidats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidats[i], candidats[j]] = [candidats[j], candidats[i]];
  }
  return candidats.slice(0, GROUPES_A_PROUVER).sort((a, b) => a - b);
}

function Avertissement({ children }: { children: React.ReactNode }) {
  // ⚠️ `yellow`, pas `amber` : un token inexistant ne génère AUCUNE classe et
  // la couleur retombe sur l'héritage, sans la moindre erreur. Cf. CLAUDE.md.
  return (
    <p className="mt-3 rounded-[10px] border border-yellow/30 bg-yellow/10 px-3 py-2 text-xs leading-relaxed text-yellow">
      {children}
    </p>
  );
}

const BOUTON = "pill bg-blue px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40";
const BOUTON_2 =
  "pill border border-border bg-surface-2 px-4 py-2 text-sm text-text transition-colors hover:border-blue/50 disabled:opacity-40";

export default function SyncOnboarding({ onFini }: { onFini: () => void }) {
  const sync = useSyncApi();

  const [etape, setEtape] = useState<Etape>("presentation");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [avecCode, setAvecCode] = useState(true);
  const [copie, setCopie] = useState(false);
  const [saisies, setSaisies] = useState<Record<number, string>>({});
  const [sansFilet, setSansFilet] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Tiré une fois pour toute la durée du parcours. Revenir en arrière et
  // repasser ne doit pas fabriquer un second code : l'utilisateur aurait alors
  // noté celui qui n'a pas été scellé.
  const code = useMemo(() => genererCode(), []);
  const demandes = useMemo(() => aDemander(code), [code]);

  const parts = groupes(code);
  const preuveOk = demandes.every((i) => memeGroupe(saisies[i] ?? "", parts[i]));

  /** L'étape irréversible. Tout ce qui précède ne touche à rien. */
  const activer = async (codeAsceller: string | null) => {
    setOccupe(true);
    setErreur(null);
    try {
      await sync.activer(motDePasse, codeAsceller);
      onFini();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  // ── 1. Ce que ça fait, ce que ça coûte ───────────────────────────────────
  if (etape === "presentation") {
    return (
      <div className="mt-3">
        <p className="text-sm leading-relaxed text-text-dim">
          {t(
            "Retrouve tes tâches, notes et trades sur tes autres appareils. Tout est chiffré sur cet appareil avant d'être envoyé : le serveur ne voit que des données illisibles.",
          )}
        </p>
        <Avertissement>
          {t(
            "Personne ne peut rouvrir tes données à ta place — ni le support, ni nous. C'est la contrepartie du chiffrement de bout en bout : ton mot de passe et ton code de récupération sont les deux seules clés qui existent.",
          )}
        </Avertissement>
        <div className="mt-4">
          <button type="button" onClick={() => setEtape("motDePasse")} className={BOUTON}>
            {t("Commencer")}
          </button>
        </div>
      </div>
    );
  }

  // ── 2. Le mot de passe ───────────────────────────────────────────────────
  if (etape === "motDePasse") {
    // Saisi deux fois : une faute de frappe ici ne se découvrirait qu'au
    // prochain déverrouillage, sur un autre appareil, sans plus aucun moyen de
    // savoir ce qui a été tapé.
    const concorde = motDePasse.length > 0 && motDePasse === confirmation;
    return (
      <div className="mt-3">
        <p className="text-sm leading-relaxed text-text-dim">
          {t("Ce mot de passe dérive la clé qui chiffre tes données. Il n'est jamais envoyé.")}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block min-w-0 flex-1 basis-[14rem]">
            <span className="hud-label">{t("ton mot de passe Shale")}</span>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="mt-1.5 w-full rounded-[--radius-field] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-blue"
            />
          </label>
          <label className="block min-w-0 flex-1 basis-[14rem]">
            <span className="hud-label">{t("confirme-le")}</span>
            <input
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-1.5 w-full rounded-[--radius-field] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-blue"
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-text-dim">
          <input
            type="checkbox"
            checked={avecCode}
            onChange={(e) => setAvecCode(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-blue)]"
          />
          {t("créer un code de récupération (recommandé)")}
        </label>

        {!avecCode && (
          <Avertissement>
            {t(
              "Sans code de récupération, un mot de passe perdu rendra tes données du cloud DÉFINITIVEMENT illisibles — même pour nous. Tes données locales, elles, resteront intactes.",
            )}
          </Avertissement>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEtape("presentation")} className={BOUTON_2}>
            {t("Retour")}
          </button>
          <button
            type="button"
            disabled={!concorde || occupe}
            onClick={() => (avecCode ? setEtape("code") : void activer(null))}
            className={BOUTON}
          >
            {avecCode ? t("Continuer") : occupe ? t("activation…") : t("Activer sans filet")}
          </button>
        </div>

        {motDePasse.length > 0 && confirmation.length > 0 && !concorde && (
          <p className="mt-3 text-xs text-red">{t("Les deux saisies diffèrent.")}</p>
        )}
        {erreur && (
          <p className="mt-3 rounded-[10px] border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
            {erreur}
          </p>
        )}
      </div>
    );
  }

  // ── 3. Le code, montré avant que quoi que ce soit existe ─────────────────
  if (etape === "code") {
    return (
      <div className="mt-3">
        <p className="text-sm leading-relaxed text-text-dim">
          {t("Voici ton code de récupération. Il ne sera plus jamais affiché.")}
        </p>

        <div className="mt-3 rounded-[12px] border border-blue/30 bg-blue/5 p-4">
          <p className="hud-label text-blue">{t("code de récupération")}</p>
          <p className="mt-2 select-all font-mono text-[15px] leading-relaxed tracking-wide text-text">
            {code}
          </p>
          <Avertissement>
            {t(
              "Note-le HORS de cet appareil — sur papier, ou dans un gestionnaire de mots de passe. Le garder uniquement ici ne servirait à rien : c'est justement cet appareil qui peut tomber en panne.",
            )}
          </Avertissement>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(code).then(() => setCopie(true));
              }}
              className="pill border border-border bg-surface-2 px-3 py-1.5 text-xs text-text transition-colors hover:border-blue/50"
            >
              {copie ? t("copié") : t("copier")}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEtape("motDePasse")} className={BOUTON_2}>
            {t("Retour")}
          </button>
          <button type="button" onClick={() => setEtape("preuve")} className={BOUTON}>
            {t("Je l'ai noté")}
          </button>
        </div>
      </div>
    );
  }

  // ── 4. La preuve, puis l'activation ──────────────────────────────────────
  return (
    <div className="mt-3">
      <p className="text-sm leading-relaxed text-text-dim">
        {t(
          "Dernière vérification : recopie les groupes manquants. Une case cochée ne prouve rien — celle-ci se coche aussi quand le code est resté à l'écran.",
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2 font-mono text-sm">
        <span className="py-2 text-text-dim">SHALE</span>
        {parts.map((groupe, i) => {
          const aSaisir = demandes.includes(i);
          if (!aSaisir)
            return (
              <span key={i} className="py-2 text-text-dim">
                –&nbsp;{groupe}
              </span>
            );
          const saisi = saisies[i] ?? "";
          const juste = memeGroupe(saisi, parts[i]);
          return (
            <span key={i} className="flex items-end gap-2">
              <span className="py-2 text-text-dim">–</span>
              <input
                aria-label={t("groupe {n}", { n: String(i + 1) })}
                value={saisi}
                maxLength={groupe.length}
                onChange={(e) => setSaisies((s) => ({ ...s, [i]: e.target.value }))}
                className={`w-[5.5rem] rounded-[--radius-field] border bg-surface-2 px-2 py-2 text-center uppercase text-text outline-none transition-colors ${
                  saisi.length === 0
                    ? "border-border focus:border-blue"
                    : juste
                      ? "border-green/50"
                      : "border-red/50"
                }`}
              />
            </span>
          );
        })}
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs text-text-dim">
        <input
          type="checkbox"
          checked={sansFilet}
          onChange={(e) => setSansFilet(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-blue)]"
        />
        <span>
          {t(
            "J'ai compris que si je perds à la fois mon mot de passe et ce code, mes données du cloud seront définitivement illisibles.",
          )}
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setEtape("code")} className={BOUTON_2}>
          {t("Revoir le code")}
        </button>
        <button
          type="button"
          disabled={!preuveOk || !sansFilet || occupe}
          onClick={() => void activer(code)}
          className={BOUTON}
        >
          {occupe ? t("activation…") : t("Activer la synchronisation")}
        </button>
      </div>

      {erreur && (
        <p className="mt-3 rounded-[10px] border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
          {erreur}
        </p>
      )}
    </div>
  );
}
