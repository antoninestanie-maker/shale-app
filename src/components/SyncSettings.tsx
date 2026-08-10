import { useState } from "react";

import { t } from "../lib/i18n";
import { formatWhen } from "../lib/notifications";
import { AUTH_CONFIGURED } from "../lib/auth/config";
import { setStatutDemo, statutDemo, type Statut } from "../lib/sync/useSync";
import SyncOnboarding from "./SyncOnboarding";
import { useSyncApi } from "./SyncProvider";

/**
 * Réglages de la synchronisation chiffrée.
 *
 * ⚠️ LE POINT DÉLICAT DE TOUT L'ÉCRAN. Le chiffrement de bout en bout signifie
 * que personne — ni le support, ni l'administrateur de la base — ne peut
 * récupérer les données d'un compte dont les secrets sont perdus. Ce n'est pas
 * une lacune, c'est la contrepartie de la promesse. Elle doit donc être écrite
 * AVANT l'activation, en clair, pas découverte le jour où ça arrive.
 */

function Avertissement({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-[10px] border border-yellow/30 bg-yellow/10 px-3 py-2 text-xs leading-relaxed text-yellow">
      {children}
    </p>
  );
}

function Champ({
  label,
  value,
  onChange,
  type = "password",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0 flex-1 basis-[14rem]">
      <span className="hud-label">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[--radius-field] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-blue"
      />
    </label>
  );
}

/** Le code, montré une seule fois — avec de quoi le mettre à l'abri. */
function CodeAMettreALAbri({ code, onFini }: { code: string; onFini: () => void }) {
  const [copie, setCopie] = useState(false);
  const [confirme, setConfirme] = useState(false);

  return (
    <div className="mt-4 rounded-[12px] border border-blue/30 bg-blue/5 p-4">
      <p className="hud-label text-blue">{t("code de récupération")}</p>
      <p className="mt-2 select-all font-mono text-[15px] leading-relaxed tracking-wide text-text">
        {code}
      </p>

      <Avertissement>
        {t(
          "Note ce code hors de cet appareil. Il est le SEUL moyen de retrouver tes données si tu oublies ton mot de passe — personne, pas même nous, ne peut les déchiffrer sans lui.",
        )}
      </Avertissement>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopie(true));
          }}
          className="pill border border-border bg-surface-2 px-3 py-1.5 text-xs text-text transition-colors hover:border-blue/50"
        >
          {copie ? t("copié") : t("copier")}
        </button>
        <label className="flex items-center gap-2 text-xs text-text-dim">
          <input
            type="checkbox"
            checked={confirme}
            onChange={(e) => setConfirme(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-blue)]"
          />
          {t("je l'ai noté en lieu sûr")}
        </label>
        <button
          type="button"
          disabled={!confirme}
          onClick={onFini}
          className="pill bg-blue px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {t("Terminé")}
        </button>
      </div>
    </div>
  );
}

export default function SyncSettings() {
  const sync = useSyncApi();

  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [parCode, setParCode] = useState(false);
  const [codeAMontrer, setCodeAMontrer] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Rien à régler quand la synchronisation n'a pas lieu d'être (preview
  // navigateur, auth non configurée). ⚠️ Sauf en démo : sinon choisir l'état
  // « indisponible » ferait disparaître la section, donc le sélecteur qui
  // permet d'en revenir — un cul-de-sac dans mon propre écran de réglages.
  if (sync.statut === "indisponible" && AUTH_CONFIGURED) return null;

  /** Enveloppe une action : occupe l'UI, capte l'erreur, nettoie les champs. */
  const agir = async (action: () => Promise<void>) => {
    setOccupe(true);
    setErreur(null);
    try {
      await action();
      setMotDePasse("");
      setCode("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  const bouton = "pill bg-blue px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40";
  const boutonSecondaire =
    "pill border border-border bg-surface-2 px-4 py-2 text-sm text-text transition-colors hover:border-blue/50 disabled:opacity-40";

  return (
    <section className="card p-5">
      <h2 className="hud-label">{t("synchronisation chiffrée")}</h2>

      {/* ── Jamais activée : le parcours d'activation, pas un bouton ────── */}
      {sync.statut === "inactive" && !codeAMontrer && (
        <SyncOnboarding
          onFini={() => {
            setMotDePasse("");
            setErreur(null);
          }}
        />
      )}

      {/* ── Activée ailleurs, verrouillée ici ───────────────────────────── */}
      {sync.statut === "verrouillee" && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-text-dim">
            {t(
              "Tes données chiffrées sont dans le cloud. Ton mot de passe est nécessaire une fois, pour les rouvrir sur cet appareil.",
            )}
          </p>

          {!parCode ? (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Champ label={t("ton mot de passe Shale")} value={motDePasse} onChange={setMotDePasse} />
                <button
                  type="button"
                  disabled={occupe || motDePasse.length === 0}
                  onClick={() => agir(() => sync.deverrouiller(motDePasse))}
                  className={bouton}
                >
                  {occupe ? t("ouverture…") : t("Déverrouiller")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setParCode(true)}
                className="mt-3 text-xs text-blue underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
              >
                {t("J'ai perdu mon mot de passe")}
              </button>
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Champ
                  label={t("code de récupération")}
                  value={code}
                  onChange={setCode}
                  type="text"
                  placeholder="SHALE-XXXX-XXXX-…"
                />
                <button
                  type="button"
                  disabled={occupe || code.length === 0}
                  onClick={() => agir(() => sync.deverrouillerAvecCode(code))}
                  className={bouton}
                >
                  {occupe ? t("ouverture…") : t("Rouvrir avec le code")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setParCode(false)}
                className="mt-3 text-xs text-text-dim underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
              >
                {t("Revenir au mot de passe")}
              </button>
            </>
          )}
        </>
      )}

      {/* ── En service ──────────────────────────────────────────────────── */}
      {sync.statut === "active" && !codeAMontrer && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 basis-[15rem]">
              <p className="text-sm text-text">
                {sync.enAttente > 0
                  ? t("{n} modification(s) en attente", { n: String(sync.enAttente) })
                  : t("Tout est synchronisé")}
              </p>
              <p className="text-xs text-text-dim">
                {sync.dernierSucces
                  ? t("dernier échange {when}", { when: formatWhen(sync.dernierSucces) })
                  : t("aucun échange pour l'instant")}
              </p>
            </div>
            <button
              type="button"
              disabled={sync.activite === "enCours"}
              onClick={() => void sync.synchroniserMaintenant()}
              className={boutonSecondaire}
            >
              {sync.activite === "enCours" ? t("synchronisation…") : t("Synchroniser maintenant")}
            </button>
          </div>

          {!sync.clePersistee && (
            <Avertissement>
              {t(
                "Le trousseau du système n'a pas répondu : la clé n'est gardée que le temps de cette session, et ton mot de passe sera redemandé au prochain lancement.",
              )}
            </Avertissement>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              type="button"
              disabled={occupe}
              onClick={() =>
                agir(async () => setCodeAMontrer(await sync.regenererCodeRecuperation()))
              }
              className={boutonSecondaire}
              data-tip={t("Un nouveau code annule et remplace le précédent.")}
            >
              {t("Voir un nouveau code de récupération")}
            </button>
            <button
              type="button"
              disabled={occupe}
              onClick={() => agir(() => sync.supprimerCodeRecuperation())}
              className={boutonSecondaire}
              data-tip={t("Le code déjà noté cessera de fonctionner.")}
            >
              {t("Supprimer le code de récupération")}
            </button>
            <button
              type="button"
              disabled={occupe}
              onClick={() => agir(() => sync.oublierClé())}
              className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text transition-colors hover:border-red/50 hover:text-red"
              data-tip={t("Tes données locales ne sont pas touchées ; la synchronisation s'arrête ici.")}
            >
              {t("Oublier la clé sur cet appareil")}
            </button>
          </div>
        </>
      )}

      {codeAMontrer && (
        <CodeAMettreALAbri code={codeAMontrer} onFini={() => setCodeAMontrer(null)} />
      )}

      {erreur && (
        <p className="mt-3 rounded-[10px] border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
          {erreur}
        </p>
      )}

      {/* Sans backend ni app native, la synchronisation est inerte et TOUS ces
          écrans seraient invisibles. Ce sélecteur permet de les relire et de les
          ajuster — même parti que « offre simulée », qui rend le paywall
          vérifiable sans Supabase. Disparaît dès que l'auth est configurée. */}
      {!AUTH_CONFIGURED && (
        <div className="mt-4 border-t border-border pt-4">
          <span className="hud-label">{t("état simulé (démo)")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["inactive", "verrouillee", "active", "indisponible"] as Statut[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatutDemo(s);
                  location.reload();
                }}
                className={`pill border px-3 py-1.5 text-xs transition-colors ${
                  statutDemo() === s
                    ? "border-blue/50 bg-blue/10 text-blue"
                    : "border-border bg-surface-2 text-text-dim hover:border-blue/30"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
