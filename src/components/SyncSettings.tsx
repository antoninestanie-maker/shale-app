import { useState } from "react";

import { t } from "../lib/i18n";
import { formatWhen } from "../lib/notifications";
import { isTauri } from "../lib/repo";
import { setStatutDemo, statutDemo, type Statut } from "../lib/sync/useSync";
import { useSyncApi } from "./SyncProvider";

/**
 * Réglages de la synchronisation chiffrée.
 *
 * ─── UN ÉCRAN DE CONSTAT, PLUS DE COMMANDE ─────────────────────────────────
 * Il n'y a plus rien à activer : se connecter suffit, la clé est créée ou
 * rouverte à partir du mot de passe que l'utilisateur vient de taper. Cet écran
 * DIT ce qui se passe et offre les deux seules manœuvres qui restent :
 * synchroniser tout de suite, et retirer la clé de cet appareil.
 *
 * Il ne reste donc ici qu'un seul écran à conséquence : la republication, quand
 * la copie cloud est devenue illisible. Il est le seul à demander une
 * confirmation, parce qu'il est le seul à détruire quelque chose.
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0 flex-1 basis-[14rem]">
      <span className="hud-label">{label}</span>
      <input
        type="password"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[--radius-field] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-blue"
      />
    </label>
  );
}

export default function SyncSettings() {
  const sync = useSyncApi();

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmeRepublication, setConfirmeRepublication] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Rien à régler quand la synchronisation n'a pas lieu d'être.
  //
  // ⚠️ Le garde est `isTauri`, PAS `AUTH_CONFIGURED`. Ce qui rend la
  // synchronisation impossible en preview navigateur est l'absence de Tauri
  // (donc de SQLite et du trousseau), pas celle des clés Supabase. Tant que le
  // backend n'était pas branché les deux coïncidaient ; depuis qu'il l'est,
  // fonder le garde sur la config faisait disparaître l'état simulé — et avec
  // lui toute possibilité de relire ces écrans hors de l'app native.
  if (sync.statut === "indisponible" && isTauri) return null;

  const agir = async (action: () => Promise<void>) => {
    setOccupe(true);
    setErreur(null);
    try {
      await action();
      setMotDePasse("");
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

      {/* ── En service : le cas normal ───────────────────────────────────── */}
      {sync.statut === "active" && (
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

          <p className="mt-3 text-xs leading-relaxed text-text-dim">
            {t(
              "Tes données sont chiffrées sur cet appareil avant d'être envoyées : le serveur ne voit que des données illisibles. La clé se déduit de ton mot de passe — personne d'autre ne peut la reconstituer.",
            )}
          </p>

          {!sync.clePersistee && (
            <Avertissement>
              {t(
                "Le trousseau du système n'a pas répondu : la clé n'est gardée que le temps de cette session, et ton mot de passe sera redemandé à la prochaine connexion.",
              )}
            </Avertissement>
          )}

          <div className="mt-4 border-t border-border pt-4">
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

      {/* ── En attente d'un mot de passe ─────────────────────────────────── */}
      {(sync.statut === "verrouillee" || sync.statut === "inactive") && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-text-dim">
            {t(
              "La synchronisation se met en route toute seule à la connexion. Déconnecte-toi puis reconnecte-toi pour la réactiver sur cet appareil — tes modifications sont conservées en attendant.",
            )}
          </p>
          <p className="mt-2 text-xs text-text-dim">
            {t("{n} modification(s) en attente", { n: String(sync.enAttente) })}
          </p>
        </>
      )}

      {/* ── Copie cloud illisible : le seul écran à conséquence ──────────── */}
      {sync.statut === "orpheline" && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-text">
            {t(
              "Ton mot de passe a été réinitialisé depuis un autre appareil. Les données déjà dans le cloud avaient été chiffrées avec l'ancien : plus personne ne peut les rouvrir, nous compris.",
            )}
          </p>

          <Avertissement>
            {t(
              "Republier remplace le contenu du cloud par celui de CET appareil. Tes données locales ne risquent rien — mais ce qui n'existait que sur un autre appareil, et n'est jamais arrivé ici, sera perdu.",
            )}
          </Avertissement>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Champ
              label={t("ton mot de passe Shale")}
              value={motDePasse}
              onChange={setMotDePasse}
              placeholder={t("le nouveau, celui que tu viens de définir")}
            />
            <button
              type="button"
              disabled={occupe || motDePasse.length === 0 || !confirmeRepublication}
              onClick={() => agir(() => sync.republier(motDePasse))}
              className={bouton}
            >
              {occupe ? t("republication…") : t("Republier depuis cet appareil")}
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-text-dim">
            <input
              type="checkbox"
              checked={confirmeRepublication}
              onChange={(e) => setConfirmeRepublication(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-blue)]"
            />
            {t("j'ai compris que le contenu du cloud sera remplacé")}
          </label>
        </>
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
      {!isTauri && (
        <div className="mt-4 border-t border-border pt-4">
          <span className="hud-label">{t("état simulé (démo)")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["inactive", "verrouillee", "orpheline", "active", "indisponible"] as Statut[]).map((s) => (
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
