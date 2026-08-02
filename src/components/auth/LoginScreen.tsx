import { useState } from "react";
import { IconAlert, IconEye, IconEyeOff } from "../icons";
import { AUTH_CONFIGURED, WEBSITE_URL } from "../../lib/auth/config";
import { sendPasswordReset } from "../../lib/auth/supabase";
import { openExternal } from "../../lib/auth/external";
import { useAppTexts } from "../../lib/appTexts";
import ShaleMark from "./ShaleMark";

import { t } from "../../lib/i18n";
interface Props {
  onSignIn: (email: string, password: string, remember: boolean) => Promise<void>;
}

export default function LoginScreen({ onSignIn }: Props) {
  const texts = useAppTexts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError(t("Renseigne ton e-mail et ton mot de passe."));
      return;
    }
    setBusy(true);
    try {
      await onSignIn(email, password, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Connexion impossible."));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setNotice(null);
    if (!AUTH_CONFIGURED) {
      openExternal(`${WEBSITE_URL}/reset`);
      return;
    }
    if (!email.trim()) {
      setError(t("Entre ton e-mail d'abord, puis clique sur « Mot de passe oublié »."));
      return;
    }
    try {
      await sendPasswordReset(email.trim(), `${WEBSITE_URL}/reset`);
      setNotice(t("E-mail de réinitialisation envoyé. Vérifie ta boîte de réception."));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Envoi impossible."));
    }
  };

  const field =
    "w-full rounded-[12px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text " +
    "outline-none transition-colors focus:border-blue/60 placeholder:text-text-dim";

  return (
    <div className="flex h-screen items-center justify-center bg-bg px-6">
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
            <button
              type="button"
              onClick={forgot}
              className="text-xs text-blue transition-opacity hover:opacity-80"
            >
              {t("Mot de passe oublié ?")}
            </button>
          </div>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
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
            {busy ? t("Connexion…") : t("Se connecter")}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-text-dim">
          {t("Pas encore de compte ?")}{" "}
          <button
            onClick={() => openExternal(`${WEBSITE_URL}/signup`)}
            className="font-medium text-blue transition-opacity hover:opacity-80"
          >
            {t("Créer un compte")}
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
