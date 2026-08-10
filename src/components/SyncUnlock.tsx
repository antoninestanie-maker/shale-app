import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { t } from "../lib/i18n";
import { useSyncApi } from "./SyncProvider";

/**
 * Déverrouillage au lancement.
 *
 * ─── POURQUOI UN ÉCRAN, ET PAS SEULEMENT LA SECTION DES RÉGLAGES ───────────
 * Le trousseau garde la clé, donc ce moment est RARE : nouvel appareil, clé
 * oubliée volontairement, trousseau muet. Rare, mais silencieux — et c'est le
 * problème. Sans rien à l'écran, l'app démarre normalement, les saisies
 * s'empilent dans la file d'attente, et rien ne part. L'utilisateur croit
 * synchroniser. Il découvre le contraire sur l'autre appareil, plus tard.
 *
 * ⚠️ IL EST ESQUIVABLE, ET C'EST VOULU. Shale fonctionne entièrement hors
 * ligne : bloquer l'entrée sur un mot de passe pour une fonctionnalité
 * facultative transformerait un confort en péage. « Plus tard » referme pour
 * la session, et l'indicateur de la sidebar reste le chemin du retour — c'est
 * précisément son rôle, et pourquoi il est cliquable dans cet état.
 */

/** Reproposer à chaque rendu serait du harcèlement. Une fois par session. */
let esquiveePourLaSession = false;

export default function SyncUnlock() {
  const sync = useSyncApi();
  const [ferme, setFerme] = useState(esquiveePourLaSession);
  const [parCode, setParCode] = useState(false);
  const [secret, setSecret] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const visible = sync.statut === "verrouillee" && !ferme;

  useEffect(() => {
    if (!visible) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        esquiveePourLaSession = true;
        setFerme(true);
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [visible]);

  if (!visible) return null;

  const plusTard = () => {
    esquiveePourLaSession = true;
    setFerme(true);
  };

  const ouvrir = async () => {
    setOccupe(true);
    setErreur(null);
    try {
      // ⚠️ ~150 ms d'Argon2id, sur le thread de la webview : le bouton DOIT
      // dire qu'il travaille, sinon l'utilisateur le reclique et lance une
      // seconde dérivation par-dessus la première.
      if (parCode) await sync.deverrouillerAvecCode(secret);
      else await sync.deverrouiller(secret);
      setSecret("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  // En portal, comme toutes les surfaces modales : montée depuis un conteneur
  // qui crée un contexte d'empilement, elle passerait sous le contenu.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-6 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={t("Déverrouiller la synchronisation")}
    >
      <div className="card-solid w-full max-w-md p-6">
        <h2 className="hud-label">{t("synchronisation verrouillée")}</h2>

        <p className="mt-3 text-sm leading-relaxed text-text-dim">
          {parCode
            ? t("Saisis ton code de récupération pour rouvrir tes données sur cet appareil.")
            : t(
                "Tes données chiffrées sont dans le cloud. Ton mot de passe est nécessaire une fois, pour les rouvrir sur cet appareil.",
              )}
        </p>

        <label className="mt-4 block">
          <span className="hud-label">
            {parCode ? t("code de récupération") : t("ton mot de passe Shale")}
          </span>
          <input
            type={parCode ? "text" : "password"}
            value={secret}
            autoFocus
            placeholder={parCode ? "SHALE-XXXX-XXXX-…" : undefined}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && secret.length > 0 && !occupe) void ouvrir();
            }}
            className={`mt-1.5 w-full rounded-[--radius-field] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-blue ${
              parCode ? "font-mono" : ""
            }`}
          />
        </label>

        {erreur && (
          <p className="mt-3 rounded-[10px] border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
            {erreur}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={occupe || secret.length === 0}
            onClick={() => void ouvrir()}
            className="pill bg-blue px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {occupe ? t("ouverture…") : t("Déverrouiller")}
          </button>
          <button
            type="button"
            onClick={plusTard}
            className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text transition-colors hover:border-blue/50"
          >
            {t("Plus tard")}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setParCode((v) => !v);
            setSecret("");
            setErreur(null);
          }}
          className="mt-4 text-xs text-blue underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
        >
          {parCode ? t("Revenir au mot de passe") : t("J'ai perdu mon mot de passe")}
        </button>

        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-dim">
          {t(
            "Shale fonctionne normalement sans cette étape : tes données restent sur cet appareil et tes modifications sont conservées. Elles partiront au déverrouillage.",
          )}
        </p>
      </div>
    </div>,
    document.body,
  );
}
