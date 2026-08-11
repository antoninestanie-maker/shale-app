import { useState } from "react";
import { IconAlert, IconEye, IconEyeOff } from "../icons";
import { ACCOUNT_PAGES, AUTH_CONFIGURED } from "../../lib/auth/config";
import { sendPasswordReset } from "../../lib/auth/supabase";
import { openExternal } from "../../lib/auth/external";
import { useAppTexts } from "../../lib/appTexts";
import ShaleMark from "./ShaleMark";

import { t } from "../../lib/i18n";
interface Props {
  onSignIn: (email: string, password: string, remember: boolean) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    remember: boolean,
  ) => Promise<{ needsConfirmation: boolean }>;
}

/**
 * Longueur minimale exigée par GoTrue par défaut. On la vérifie ici pour
 * répondre tout de suite plutôt que d'attendre un aller-retour réseau et un
 * message d'erreur en anglais.
 */
const MIN_PASSWORD = 6;

export default function LoginScreen({ onSignIn, onSignUp }: Props) {
  const texts = useAppTexts();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signingUp = mode === "signUp";

  const switchMode = () => {
    setMode(signingUp ? "signIn" : "signUp");
    setError(null);
    setNotice(null);
    setConfirm("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError(t("Renseigne ton e-mail et ton mot de passe."));
      return;
    }
    if (signingUp) {
      if (password.length < MIN_PASSWORD) {
        setError(t("Le mot de passe doit faire au moins 6 caractères."));
        return;
      }
      if (password !== confirm) {
        setError(t("Les deux mots de passe ne correspondent pas."));
        return;
      }
    }
    setBusy(true);
    try {
      if (signingUp) {
        const { needsConfirmation } = await onSignUp(email, password, remember);
        // Compte créé mais pas encore ouvert : sans ce message, l'écran ne
        // bougerait pas et l'utilisateur croirait que rien ne s'est passé.
        if (needsConfirmation) {
          setMode("signIn");
          setConfirm("");
          setNotice(
            t("Compte créé. Clique le lien envoyé par e-mail, puis reviens te connecter."),
          );
        }
      } else {
        await onSignIn(email, password, remember);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : signingUp
            ? t("Création de compte impossible.")
            : t("Connexion impossible."),
      );
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setNotice(null);
    if (!AUTH_CONFIGURED) {
      openExternal(ACCOUNT_PAGES.reset);
      return;
    }
    if (!email.trim()) {
      setError(t("Entre ton e-mail d'abord, puis clique sur « Mot de passe oublié »."));
      return;
    }
    try {
      await sendPasswordReset(email.trim(), ACCOUNT_PAGES.reset);
      setNotice(t("E-mail de réinitialisation envoyé. Vérifie ta boîte de réception."));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Envoi impossible."));
    }
  };

  const field =
    "w-full rounded-[12px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text " +
    "outline-none transition-colors focus:border-blue/60 placeholder:text-text-dim";

  return (
    // Pas de `bg-bg` ici : le fond appartient au parent (`Mur`, dans AuthGate),
    // qui peint aussi le décor. Un fond opaque à ce niveau le recouvrirait —
    // et l'écran perdrait la profondeur qui distingue « l'app est là, derrière »
    // de « l'app n'a pas démarré ».
    <div className="flex h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <ShaleMark size={52} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-text">Shale</h1>
          <p className="mt-1 text-sm text-text-dim">{texts.loginSubtitle}</p>
        </div>

        <form onSubmit={submit} className="card p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-red/40 bg-red/10 px-3 py-2.5 text-sm text-text">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-red" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-[12px] border border-green/40 bg-green/10 px-3 py-2.5 text-sm text-text">
              {notice}
            </div>
          )}

          <label className="hud-label mb-1.5 block">E-mail</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("toi@exemple.com")}
            className={field}
          />

          <div className="mt-4 mb-1.5 flex items-center justify-between">
            <label className="hud-label">{t("Mot de passe")}</label>
            {!signingUp && (
              <button
                type="button"
                onClick={forgot}
                className="text-xs text-blue transition-opacity hover:opacity-80"
              >
                {t("Mot de passe oublié ?")}
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              autoComplete={signingUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={field + " pr-11"}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
              aria-label={showPw ? t("Masquer") : t("Afficher")}
              data-tip={showPw ? t("Masquer") : t("Afficher")}
            >
              {showPw ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            </button>
          </div>

          {signingUp && (
            <>
              <label className="hud-label mt-4 mb-1.5 block">
                {t("Confirme le mot de passe")}
              </label>
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={field}
              />
            </>
          )}

          <label className="mt-4 flex cursor-pointer select-none items-center gap-2 text-sm text-text-dim">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-blue)]"
            />
            {t("Rester connecté")}
          </label>

          <button
            type="submit"
            disabled={busy}
            className="pill mt-5 w-full bg-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy
              ? signingUp
                ? t("Création…")
                : t("Connexion…")
              : signingUp
                ? t("Créer mon compte")
                : t("Se connecter")}
          </button>
        </form>

        {/* L'inscription se fait ici, dans l'app. Elle renvoyait vers le site :
            un aller-retour par le navigateur pour revenir taper les mêmes
            identifiants, alors que GoTrue expose le même endpoint aux deux. */}
        <p className="mt-5 text-center text-sm text-text-dim">
          {signingUp ? t("Déjà un compte ?") : t("Pas encore de compte ?")}{" "}
          <button
            onClick={switchMode}
            className="font-medium text-blue transition-opacity hover:opacity-80"
          >
            {signingUp ? t("Se connecter") : t("Créer un compte")}
          </button>
        </p>

        {!AUTH_CONFIGURED && (
          <p className="mt-6 text-center text-xs text-text-dim opacity-70">
            {t(
              "Mode démo — auth non configurée (voir src/lib/auth/config.ts). N'importe quel identifiant déverrouille l'app.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
