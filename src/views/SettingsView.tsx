import { useEffect, useState } from "react";
import { todayStr } from "../lib/logic";
import {
  exportDb,
  fetchTrackerSettings,
  getSetting,
  isTauri,
  saveTrackerSettings,
  setSetting,
  TRACKER_DEFAULTS,
  type TrackerSettings,
} from "../lib/repo";
import { loadTheme, saveTheme, type ThemePref } from "../lib/theme";
import { getLang, setLangPref, useLangPref, type LangPref } from "../lib/i18n";
import {
  loadMentalLoadConfig,
  saveMentalLoadConfig,
  MENTAL_LOAD_DEFAULTS,
} from "../lib/mentalLoad";
import {
  fetchPrefs,
  fetchStatus,
  formatWhen,
  ruleMeta,
  runNow,
  savePrefs,
  sendTest,
  syncLang,
  type NotifPrefs,
  type NotifStatus,
  type RulePrefsPatch,
} from "../lib/notifications";
import { IconSave } from "../components/icons";
import { MENTAL_LOAD_CONFIG_EVENT } from "../components/MentalLoadGauge";
import { useSession } from "../components/auth/AuthGate";
import { useEntitlements, tierLabel } from "../lib/entitlements";
import { AUTH_CONFIGURED, WEBSITE_URL } from "../lib/auth/config";
import { openExternal } from "../lib/auth/external";
import { getApiKey, setApiKey } from "../lib/llm/provider";
import { keychainAvailable } from "../lib/llm/secrets";
import { demoTier, setDemoTier } from "../lib/auth/useAuth";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { t } from "../lib/i18n";
/** Interrupteur avec libellé + description (sauvegarde immédiate au clic). */
function ToggleRow({
  title,
  desc,
  value,
  onChange,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-4 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-overlay"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">
          {desc}
        </span>
      </span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          value ? "bg-blue" : "bg-surface-2"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            value ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Champ numérique à validation différée : la saisie reste libre pendant la
 * frappe, et n'est bornée qu'à la sortie du champ. Borner à chaque touche
 * rendrait les champs inutilisables (taper « 1 » dans un champ de minimum 5
 * deviendrait aussitôt « 5 »).
 */
function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // La valeur peut être corrigée par le Rust (bornage) : on resynchronise.
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const bounded = Math.min(max, Math.max(min, Math.round(n)));
    setDraft(String(bounded));
    if (bounded !== value) onCommit(bounded);
  };

  return (
    <label className="block min-w-0">
      <span className="hud-label">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/50"
        />
        {suffix && <span className="shrink-0 text-xs text-text-dim">{suffix}</span>}
      </span>
    </label>
  );
}

export default function SettingsView() {
  const { session, subscription, signOut } = useSession();
  const { tier, isTrialing, hasTrading, billingPeriod } = useEntitlements();
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [provider, setProvider] = useState<"auto" | "gemini" | "groq">("auto");
  const [keySaved, setKeySaved] = useState(false);
  /** Trousseau disponible ? `null` tant que la sonde n'a pas répondu. */
  const [keychain, setKeychain] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<ThemePref>("system");
  const langPref = useLangPref();
  // Tracker live (workflow "Trader" → dénouement)
  const [tracker, setTracker] = useState<TrackerSettings>(TRACKER_DEFAULTS);
  // Charge mentale (jauge d'énergie) — coefficients réglables
  const [energyStart, setEnergyStart] = useState(String(MENTAL_LOAD_DEFAULTS.startEnergy));
  const [energyTrade, setEnergyTrade] = useState(String(MENTAL_LOAD_DEFAULTS.costPerTrade));
  const [energyHour, setEnergyHour] = useState(String(MENTAL_LOAD_DEFAULTS.costPerHour));
  const [energySaved, setEnergySaved] = useState(false);
  // Notifications intelligentes (moteur de règles Rust)
  const [notif, setNotif] = useState<NotifPrefs | null>(null);
  const [notifStatus, setNotifStatus] = useState<NotifStatus | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const exportBackup = async () => {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      defaultPath: `shale-backup-${todayStr()}.db`,
      filters: [{ name: "Base SQLite", extensions: ["db"] }],
    });
    if (!dest) return;
    try {
      await exportDb(dest);
      setBackupMsg(t("Sauvegarde exportée"));
      window.setTimeout(() => setBackupMsg(null), 3000);
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    // Les clés passent par le trousseau quand il répond (cf. lib/llm/secrets.ts) ;
    // la première lecture migre au passage une clé restée en clair dans la base.
    getApiKey("gemini").then((v) => setGeminiKey(v ?? ""));
    getApiKey("groq").then((v) => setGroqKey(v ?? ""));
    keychainAvailable().then(setKeychain);
    getSetting("market.llm_provider").then((v) =>
      setProvider(v === "gemini" || v === "groq" ? v : "auto"),
    );
    loadTheme().then(setTheme);
    fetchTrackerSettings().then(setTracker);
    loadMentalLoadConfig().then((c) => {
      setEnergyStart(String(c.startEnergy));
      setEnergyTrade(String(c.costPerTrade));
      setEnergyHour(String(c.costPerHour));
    });
    fetchPrefs().then(setNotif).catch(() => {});
    fetchStatus().then(setNotifStatus).catch(() => {});
  }, []);

  /**
   * Sauvegarde immédiate, et on RÉAFFICHE ce que le Rust a réellement stocké :
   * il borne les valeurs et complète les règles manquantes, donc l'écran ne
   * doit pas montrer autre chose que la vérité du fichier.
   */
  const patchNotif = async (patch: Partial<NotifPrefs>) => {
    if (!notif) return;
    const next = { ...notif, ...patch };
    setNotif(next);
    setNotif(await savePrefs(next));
  };

  const patchRule = async (id: string, patch: RulePrefsPatch) => {
    if (!notif) return;
    const next = {
      ...notif,
      rules: { ...notif.rules, [id]: { ...notif.rules[id], ...patch } },
    };
    setNotif(next);
    setNotif(await savePrefs(next));
  };

  const sendTestNotif = async () => {
    const entry = await sendTest();
    setTestMsg(
      entry
        ? t("Test envoyé. Aucune bannière ? Autorise Shale dans Réglages macOS → Notifications — il est déjà dans la cloche, lui.")
        : null,
    );
    window.setTimeout(() => setTestMsg(null), 10000);
  };

  const evaluateNow = async () => {
    await runNow();
    // L'évaluation est asynchrone côté Rust : on relit l'état juste après.
    window.setTimeout(() => {
      fetchStatus().then(setNotifStatus).catch(() => {});
    }, 800);
  };

  /** Sauvegarde immédiate d'une option du tracker (pas de bouton Enregistrer). */
  const setTrackerOption = async <K extends keyof TrackerSettings>(
    key: K,
    value: TrackerSettings[K],
  ) => {
    const next = { ...tracker, [key]: value };
    setTracker(next);
    await saveTrackerSettings(next);
    window.dispatchEvent(new CustomEvent("sb:tracker-config"));
  };

  const saveEnergyConfig = async () => {
    const n = (s: string, f: number) => {
      const v = Number(s);
      return Number.isFinite(v) && v >= 0 ? v : f;
    };
    await saveMentalLoadConfig({
      startEnergy: Math.max(1, n(energyStart, MENTAL_LOAD_DEFAULTS.startEnergy)),
      costPerTrade: n(energyTrade, MENTAL_LOAD_DEFAULTS.costPerTrade),
      costPerHour: n(energyHour, MENTAL_LOAD_DEFAULTS.costPerHour),
    });
    window.dispatchEvent(new CustomEvent(MENTAL_LOAD_CONFIG_EVENT));
    setEnergySaved(true);
    window.setTimeout(() => setEnergySaved(false), 2500);
  };

  /**
   * Bascule de langue. En mode démo, le jeu de données factices est construit
   * au CHARGEMENT du module (`lib/demo.ts`) : ses libellés resteraient dans
   * l'ancienne langue. On recharge donc la fenêtre — il n'y a rien à perdre,
   * ces données ne vivent qu'en mémoire. En natif, le simple remontage de
   * l'arbre (LangRoot) suffit.
   */
  const changeLang = (pref: LangPref) => {
    setLangPref(pref);
    void setSetting("ui.lang", pref).catch(() => {});
    // Le moteur de rappels Rust tourne hors webview : il faut lui POUSSER la
    // langue, sinon une notification envoyée la nuit repart en français.
    void syncLang(getLang()).then(() => fetchPrefs().then(setNotif).catch(() => {}));
    if (!isTauri) window.location.reload();
  };

  const changeTheme = async (pref: ThemePref) => {
    setTheme(pref);
    await saveTheme(pref);
  };

  const saveMarketKeys = async () => {
    await setApiKey("gemini", geminiKey);
    await setApiKey("groq", groqKey);
    await setSetting("market.llm_provider", provider);
    setKeySaved(true);
    window.setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl text-text">{t("Réglages")}</h1>

      <ResizableGrid gridId="settings" className="mt-6">
      <ResizablePanel id="settings-compte" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">compte</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 basis-[15rem]">
            <p className="truncate text-sm text-text">{session?.user.email}</p>
            <p className="text-xs text-text-dim">
              {subscription
                ? [
                    tierLabel(tier),
                    isTrialing
                      ? t("essai en cours")
                      : billingPeriod === "annual"
                        ? t("annuel")
                        : billingPeriod === "monthly"
                          ? t("mensuel")
                          : subscription.status,
                  ].join(" · ")
                : "Session locale"}
            </p>
            {!hasTrading && (
              <button
                type="button"
                onClick={() => openExternal(`${WEBSITE_URL}/account`)}
                className="mt-1 text-xs text-blue underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
              >
                {t("Passer à Shale Trade")}
              </button>
            )}
          </div>
          <button
            onClick={() => signOut()}
            className="pill shrink-0 border border-border bg-surface-2 px-4 py-2 text-sm text-text transition-colors hover:border-red/50 hover:text-red"
          >
            {t("Se déconnecter")}
          </button>
        </div>

        {/* Mode démo : sans backend, `useAuth` fabrique un abonnement. Ce
            sélecteur permet de vérifier le gating (sidebar verrouillée, paywall,
            widgets retirés) sans Supabase. Invisible dès que l'auth est configurée. */}
        {!AUTH_CONFIGURED && (
          <div className="mt-4 border-t border-border pt-4">
            <label className="hud-label">{t("offre simulée (démo)")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["shale", "Shale"],
                  ["shale_trade", "Shale Trade"],
                  ["trialing", t("essai en cours")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setDemoTier(value);
                    // `useAuth` construit l'abonnement démo au montage : il faut
                    // recharger pour que tout l'arbre reparte du nouveau droit.
                    window.location.reload();
                  }}
                  className={`pill border px-4 py-1.5 text-sm transition-colors ${
                    demoTier() === value
                      ? "border-blue/50 bg-blue/10 text-blue"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      </ResizablePanel>
      <ResizablePanel id="settings-langue" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("langue")}</h2>
        <p className="mt-2 text-sm text-text-dim">
          {t("« Système » suit la langue de macOS. Le changement s'applique immédiatement, partout dans l'app.")}
        </p>
        <div className="pill mt-3 inline-flex flex-wrap items-center gap-0.5 border border-border bg-surface-2 p-1">
          {(
            [
              { id: "system", label: t("Système") },
              { id: "fr", label: t("Français") },
              { id: "en", label: "English" },
            ] as { id: LangPref; label: string }[]
          ).map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => changeLang(it.id)}
              data-tip={it.label}
              data-tip-sub={
                it.id === "system"
                  ? t("Suit la langue de macOS ; anglais si elle n'est ni française ni anglaise.")
                  : t("La langue des briefings du Market-Brain suit ce réglage.")
              }
              className={`pill px-4 py-1.5 text-xs font-medium transition-colors ${
                langPref === it.id ? "bg-overlay-2 text-text" : "text-text-dim hover:text-text"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      </section>
      </ResizablePanel>

      <ResizablePanel id="settings-apparence" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("apparence")}</h2>
        <p className="mt-2 text-sm text-text-dim">
          {t("Choisis le thème de l'interface. « Système » suit le réglage de macOS.")}
        </p>
        <div className="pill mt-3 inline-flex flex-wrap items-center gap-0.5 border border-border bg-surface-2 p-1">
          {(
            [
              { id: "system", label: t("Système") },
              { id: "light", label: t("Clair") },
              { id: "dark", label: t("Sombre") },
            ] as { id: ThemePref; label: string }[]
          ).map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => changeTheme(it.id)}
              data-tip={it.label}
              data-tip-sub={
                it.id === "system"
                  ? t("Suit l’apparence de macOS, jour et nuit.")
                  : it.id === "light"
                    ? t("Palette claire « Alabaster », en toutes circonstances.")
                    : t("Palette sombre « Obsidian », en toutes circonstances.")
              }
              className={`pill px-4 py-1.5 text-xs font-medium transition-colors ${
                theme === it.id
                  ? "bg-overlay-2 text-text"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      </section>
      </ResizablePanel>

      <ResizablePanel id="settings-notifications" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">notifications</h2>
        <p className="mt-2 text-sm text-text-dim">
          Shale évalue quelques règles locales (habitudes non cochées, savoir délaissé)
          et te relance au bon moment. Rien ne sort de la machine, et jamais plus d'une
          notification à la fois : plusieurs rappels le même soir sont regroupés.
        </p>

        {!notif ? (
          <p className="mt-4 text-sm text-text-dim">Chargement…</p>
        ) : (
          <>
            <div className="mt-3 flex flex-col">
              <ToggleRow
                title={t("Activer les notifications")}
                desc={t("Coupe tout : plus aucune évaluation, plus aucun rappel.")}
                value={notif.enabled}
                onChange={(v) => patchNotif({ enabled: v })}
              />
              <ToggleRow
                title={t("Garder Shale actif en arrière-plan")}
                desc={t("Fermer la fenêtre laisse Shale dans la barre de menus, seul moyen qu'un rappel parte fenêtre fermée. En plein écran, fermer quitte toujours l'app.")}
                value={notif.keep_running_in_background}
                onChange={(v) => patchNotif({ keep_running_in_background: v })}
              />
            </div>

            <div className="auto-tiles-lg mt-4 gap-3">
              <NumberField
                label={t("pas avant")}
                value={notif.quiet_hours.start}
                min={0}
                max={23}
                suffix="h"
                onCommit={(v) =>
                  patchNotif({ quiet_hours: { ...notif.quiet_hours, start: v } })
                }
              />
              <NumberField
                label={t("pas après")}
                value={notif.quiet_hours.end}
                min={1}
                max={24}
                suffix="h"
                onCommit={(v) =>
                  patchNotif({ quiet_hours: { ...notif.quiet_hours, end: v } })
                }
              />
              <NumberField
                label="maximum par jour"
                value={notif.daily_cap}
                min={1}
                max={20}
                onCommit={(v) => patchNotif({ daily_cap: v })}
              />
              <NumberField
                label={t("vérifier toutes les")}
                value={notif.check_interval_min}
                min={5}
                max={240}
                suffix="min"
                onCommit={(v) => patchNotif({ check_interval_min: v })}
              />
            </div>

            <h3 className="hud-label mt-6">{t("règles")}</h3>
            <div className="mt-2 flex flex-col gap-1">
              {Object.entries(notif.rules).map(([id, rule]) => {
                const meta = ruleMeta()[id];
                return (
                  <div key={id} className="rounded-[10px] border border-border p-1">
                    <ToggleRow
                      title={meta?.label ?? id}
                      desc={meta?.desc ?? t("Règle ajoutée par une version plus récente.")}
                      value={rule.enabled}
                      onChange={(v) => patchRule(id, { enabled: v })}
                    />
                    {rule.enabled && (
                      <div className="auto-tiles-lg gap-3 px-2 pb-2">
                        {meta?.params?.map((p) => (
                          <NumberField
                            key={p.key}
                            label={p.label}
                            value={Number(rule[p.key] ?? 0)}
                            min={p.min}
                            max={p.max}
                            suffix={p.suffix}
                            onCommit={(v) => patchRule(id, { [p.key]: v })}
                          />
                        ))}
                        <NumberField
                          label={t("pas plus souvent que")}
                          value={rule.cooldown_h}
                          min={0}
                          max={720}
                          suffix="h"
                          onCommit={(v) => patchRule(id, { cooldown_h: v })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* macOS ne dit PAS si les bannières ont été refusées : le plugin
                renvoie toujours « autorisé » et l'envoi réel est asynchrone,
                résultat jeté. On ne prétend donc rien savoir — on donne de quoi
                vérifier soi-même. */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={sendTestNotif}
                disabled={!isTauri}
                data-tip={t("Envoyer une notification de test")}
                data-tip-sub={t("Emprunte exactement le même chemin qu'un vrai rappel.")}
                className="pill border border-border px-4 py-2 text-sm text-text hover:border-blue/50 disabled:opacity-40"
              >
                {t("Envoyer un test")}
              </button>
              <button
                type="button"
                onClick={evaluateNow}
                disabled={!isTauri}
                data-tip={t("Évaluer les règles maintenant")}
                data-tip-sub={t("Sans attendre le prochain passage du planificateur.")}
                className="pill border border-border px-4 py-2 text-sm text-text hover:border-blue/50 disabled:opacity-40"
              >
                {t("Évaluer maintenant")}
              </button>
              {notifStatus?.last_run_at && (
                <span className="text-xs text-text-dim">
                  dernière évaluation {formatWhen(notifStatus.last_run_at)}
                </span>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-text-dim">
              {!isTauri
                ? t("Mode démo : le planificateur et les notifications système n'existent que dans l'app native. Les réglages ci-dessus restent manipulables, mais ne sont pas enregistrés.")
                : (testMsg ??
                  t("Si le test n'affiche aucune bannière, autorise Shale dans Réglages macOS → Notifications. macOS ne nous le signale pas : la cloche de la barre latérale, elle, reçoit les rappels dans tous les cas."))}
            </p>
          </>
        )}
      </section>
      </ResizablePanel>

      {/* Clés IA + tracker : les deux ne servent qu'aux modules trading, donc
          réservés à Shale Trade. Rendu conditionnel plutôt que masquage, pour
          les mêmes raisons que les panneaux de Performance. */}
      {hasTrading && (
      <ResizablePanel id="settings-market" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("market-brain — clés IA")}</h2>
        {/* Phrases ENTIÈRES passées à `t()` : découper une phrase autour d'un
            <span> produit des fragments intraduisibles (l'ordre des mots change
            d'une langue à l'autre). */}
        <p className="mt-2 text-sm text-text-dim">
          {t(
            "Tu fournis ta propre clé, gratuite chez les deux fournisseurs. Elle ne sert qu'à l'analyse du briefing et n'est jamais envoyée ailleurs.",
          )}
        </p>
        <p className="mt-1.5 text-sm text-text-dim">
          {t(
            "En mode Auto, si le quota Gemini est atteint (429), Market-Brain bascule automatiquement sur Groq.",
          )}
        </p>
        {/* Dire OÙ la clé est rangée, sans promettre un chiffrement qui n'a pas
            eu lieu : le trousseau peut être indisponible (preview navigateur,
            trousseau verrouillé), auquel cas on retombe sur la base en clair. */}
        <p className="mt-1.5 text-xs text-text-dim">
          {keychain === null
            ? ""
            : keychain
              ? t("Chiffrée dans le trousseau macOS.")
              : t("Stockée dans la base locale de l'app, en clair (trousseau indisponible).")}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="hud-label">{t("clé Gemini (Google AI Studio)")}</label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza…"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/50"
            />
          </div>
          <div>
            <label className="hud-label">{t("clé Groq (console.groq.com)")}</label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_…"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/50"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="hud-label">fournisseur</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["auto", "gemini", "groq"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                data-tip={p === "auto" ? "Bascule automatique" : p === "gemini" ? "Google Gemini" : "Groq"}
                data-tip-sub={
                  p === "auto"
                    ? "Gemini d’abord, bascule sur Groq en cas de quota atteint ou d’indisponibilité."
                    : p === "gemini"
                      ? "gemini-2.5-flash — analyse la plus fine."
                      : "llama-3.3-70b — très rapide, quotas plus serrés."
                }
                className={`pill border px-4 py-1.5 text-sm capitalize transition-colors ${
                  provider === p
                    ? "border-blue/50 bg-blue/10 text-blue"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {p === "auto" ? "Auto (Gemini→Groq)" : p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={saveMarketKeys}
            data-tip={t("Enregistrer les clés")}
            data-tip-sub="Stockées en local dans la base de l’app, jamais envoyées ailleurs."
            className="pill border border-border px-4 py-2 text-sm text-text hover:border-blue/50"
          >
            {keySaved ? t("Enregistré") : t("Enregistrer")}
          </button>
        </div>
      </section>
      </ResizablePanel>
      )}

      {hasTrading && (
      <ResizablePanel id="settings-tracker" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">tracker live trading — workflow « trader »</h2>
        <p className="mt-2 text-sm text-text-dim">
          {t("Le bouton")} <span className="font-semibold text-blue">Trader</span> (vue
          Position) envoie instantanément la position vers le tracker de la vue
          Trading : heure d'entrée, paire, prix, SL/TP et R:R sont capturés
          automatiquement. Il ne reste qu'à cliquer{" "}
          <span className="font-semibold text-green">Gagnante</span> ou{" "}
          <span className="font-semibold text-red">Perdante</span> {t("au dénouement.")}
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <ToggleRow
            title="Mode fast-track"
            desc="Envoi en arrière-plan sans interruption visuelle (un toast discret confirme). Désactivé : une mini-popup de confirmation s'ouvre avant l'envoi, TP encore éditable."
            value={tracker.fastTrack}
            onChange={(v) => setTrackerOption("fastTrack", v)}
          />
          <ToggleRow
            title="Ouvrir le tracker après envoi"
            desc={t("Bascule automatiquement sur la vue Trading dès qu'une position est envoyée.")}
            value={tracker.autoOpen}
            onChange={(v) => setTrackerOption("autoOpen", v)}
          />
          <ToggleRow
            title="Bouton break-even"
            desc={t("Affiche « BE » dans le tracker pour clôturer à 0R le restant de la position (les sorties partielles déjà prises restent comptées).")}
            value={tracker.allowBe}
            onChange={(v) => setTrackerOption("allowBe", v)}
          />
        </div>
      </section>
      </ResizablePanel>
      )}

      <ResizablePanel id="settings-data" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("données")}</h2>
        <p className="mt-2 text-sm text-text-dim">
          Exporte une copie propre de toute la base (tâches, objectifs, notes,
          trades…) — à garder sur un disque externe ou un cloud perso.
        </p>
        <div className="mt-3 flex items-center gap-3">
          {isTauri ? (
            <button
              type="button"
              onClick={exportBackup}
            data-tip="Exporter une sauvegarde"
            data-tip-sub={t("Copie propre et complète de la base (tâches, notes, trades…) dans un fichier unique.")}
              className="pill border border-border px-4 py-2 text-sm text-text hover:border-blue/50"
            >
              <IconSave className="mr-1.5 inline h-4 w-4 align-[-3px]" /> {t("Exporter une sauvegarde…")}
            </button>
          ) : (
            <span className="text-xs text-text-dim">
              {t("Disponible dans l'app native.")}
            </span>
          )}
          {backupMsg && <span className="text-xs text-green">{backupMsg}</span>}
        </div>
      </section>
      </ResizablePanel>

      <ResizablePanel id="settings-energy" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("charge mentale — énergie restante")}</h2>
        <p className="mt-2 text-sm text-text-dim">
          La jauge « énergie restante » du tableau de bord part de l'énergie de départ et
          baisse selon les trades pris et le temps passé devant l'écran aujourd'hui. Ajuste
          l'impact de chaque facteur.
        </p>
        <div className="auto-tiles-lg mt-4 gap-3">
          <label className="block">
            <span className="hud-label">{t("énergie de départ")}</span>
            <input
              type="number"
              min={1}
              value={energyStart}
              onChange={(e) => setEnergyStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/50"
            />
          </label>
          <label className="block">
            <span className="hud-label">{t("coût par trade")}</span>
            <input
              type="number"
              min={0}
              value={energyTrade}
              onChange={(e) => setEnergyTrade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/50"
            />
          </label>
          <label className="block">
            <span className="hud-label">{t("coût / heure d'écran")}</span>
            <input
              type="number"
              min={0}
              value={energyHour}
              onChange={(e) => setEnergyHour(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/50"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={saveEnergyConfig}
            data-tip={t("Enregistrer")}
            data-tip-sub="Recalcule immédiatement la jauge d’énergie du tableau de bord."
            className="pill border border-border px-4 py-2 text-sm text-text hover:border-blue/50"
          >
            {energySaved ? t("Enregistré") : t("Enregistrer")}
          </button>
        </div>
      </section>
      </ResizablePanel>

      <ResizablePanel id="settings-shortcuts" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">raccourcis</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-text">
          <li className="flex justify-between">
            <span>Capture rapide (global)</span>
            <kbd className="font-mono text-xs text-text-dim">⌥ Espace</kbd>
          </li>
          <li className="flex justify-between">
            <span>{t("Palette de commandes")}</span>
            <kbd className="font-mono text-xs text-text-dim">⌘ K</kbd>
          </li>
          <li className="flex justify-between">
            <span>{t("Nouvelle note")}</span>
            <kbd className="font-mono text-xs text-text-dim">⌘⇧ N</kbd>
          </li>
        </ul>
      </section>
      </ResizablePanel>
      </ResizableGrid>
    </div>
  );
}
