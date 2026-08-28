// Page "Personnaliser" : l'utilisateur pilote l'app — identité, fenêtre, densité,
// ordre/visibilité/libellés des modules de la sidebar, widgets du dashboard.
// Tout est sauvegardé immédiatement (settings "ui.config") et appliqué en direct.
import { useState } from "react";
import { MODULE_LABELS } from "../components/Sidebar";
import {
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconEyeOff,
  IconMonitor,
  IconReset,
} from "../components/icons";
import { isTauri } from "../lib/repo";
import {
  applyZoom,
  defaultUiConfig,
  WIDGET_LABELS,
  type UiConfig,
  type WidgetConfig,
} from "../lib/uiConfig";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";
import { loadTexts, saveTexts, type AppTexts } from "../lib/appTexts";

import { t } from "../lib/i18n";
interface Props {
  config: UiConfig;
  save: (c: UiConfig) => Promise<void>;
}

/** Déplace l'élément i d'une liste vers le haut (-1) ou le bas (+1). */
function move<T>(list: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ArrowButton({
  onClick,
  disabled,
  up,
}: {
  onClick: () => void;
  disabled: boolean;
  up: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={up ? "Monter" : "Descendre"}
      data-tip={up ? "Monter" : "Descendre"}
      data-tip-sub="Change l’ordre d’affichage."
      className="shrink-0 rounded-md p-1 text-text-dim transition-colors hover:bg-overlay hover:text-text disabled:opacity-25"
    >
      {up ? <IconChevronUp className="h-3.5 w-3.5" /> : <IconChevronDown className="h-3.5 w-3.5" />}
    </button>
  );
}

function VisibilityToggle({
  visible,
  onToggle,
  disabled,
}: {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={visible ? "Masquer" : "Afficher"}
      data-tip={visible ? "Masquer" : "Afficher"}
      data-tip-sub={t("Un élément masqué reste configurable ici.")}
      className={`rounded-md p-1 transition-colors disabled:opacity-25 ${
        visible ? "text-text hover:bg-overlay" : "text-text-dim/60 hover:bg-overlay"
      }`}
    >
      {visible ? <IconEye className="h-4 w-4" /> : <IconEyeOff className="h-4 w-4" />}
    </button>
  );
}

/** Liste réordonnable de widgets du dashboard. */
function WidgetList({
  title,
  list,
  onChange,
}: {
  title: string;
  list: WidgetConfig[];
  onChange: (next: WidgetConfig[]) => void;
}) {
  return (
    <div>
      <p className="hud-label mb-2">{title}</p>
      <div className="flex flex-col gap-1">
        {list.map((w, i) => (
          <div
            key={w.id}
            className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 ${
              w.visible ? "" : "opacity-55"
            }`}
          >
            <VisibilityToggle
              visible={w.visible}
              onToggle={() =>
                onChange(list.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)))
              }
            />
            {/* min-w-0 + truncate : sans ça `flex-1` gardait la largeur du
                libellé, ce qui poussait les flèches ↑↓ hors du panneau (donc
                clippées et incliquables) en fenêtre étroite. */}
            <span
              className="min-w-0 flex-1 truncate text-sm text-text"
              title={t(WIDGET_LABELS[w.id] ?? w.id)}
            >
              {t(WIDGET_LABELS[w.id] ?? w.id)}
            </span>
            <ArrowButton up onClick={() => onChange(move(list, i, -1))} disabled={i === 0} />
            <ArrowButton
              up={false}
              onClick={() => onChange(move(list, i, 1))}
              disabled={i === list.length - 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminView({ config, save }: Props) {
  const [sizeMsg, setSizeMsg] = useState<string | null>(null);
  const [texts, setTexts] = useState<AppTexts>(loadTexts);

  const set = (patch: Partial<UiConfig>) => save({ ...config, ...patch });
  const setText = (patch: Partial<AppTexts>) => {
    setTexts((t) => ({ ...t, ...patch }));
    saveTexts(patch); // persiste + notifie les écrans (login, onboarding…) en direct
  };

  // ---- Fenêtre ----
  const win = config.window ?? { width: 1280, height: 800 };

  const applySizeNow = async () => {
    if (!isTauri) {
      setSizeMsg(t("Disponible dans l'app native uniquement."));
      return;
    }
    const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setSize(new LogicalSize(win.width, win.height));
    setSizeMsg(t("Taille appliquée."));
    window.setTimeout(() => setSizeMsg(null), 2000);
  };

  const useCurrentSize = async () => {
    if (!isTauri) {
      setSizeMsg(t("Disponible dans l'app native uniquement."));
      return;
    }
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    const factor = await w.scaleFactor();
    const size = await w.innerSize();
    await set({
      window: {
        width: Math.round(size.width / factor),
        height: Math.round(size.height / factor),
      },
    });
    setSizeMsg(t("Taille actuelle mémorisée."));
    window.setTimeout(() => setSizeMsg(null), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="view-head items-start">
        <div>
          <p className="hud-label">{t("l'app, à ta main")}</p>
          <h1 className="mt-2 text-[32px] text-text">{t("Personnaliser")}</h1>
        </div>
        <button
          type="button"
          onClick={() => save(defaultUiConfig()).then(() => applyZoom(100))}
          data-tip={t("Tout réinitialiser")}
          data-tip-sub={t("Rétablit l’ordre, la visibilité, les libellés, la densité et l’identité d’origine.")}
          className="pill inline-flex items-center gap-1.5 border border-border bg-surface-2 px-4 py-1.5 text-xs text-text-dim hover:text-text"
        >
          <IconReset className="h-3.5 w-3.5" /> {t("Réinitialiser")}
        </button>
      </header>

      <ResizableGrid gridId="admin" className="mt-6">
      {/* Identité */}
      <ResizablePanel id="admin-identity" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("identité")}</h2>
        <div className="auto-tiles-lg mt-3 gap-3">
          <label className="block">
            <span className="text-xs text-text-dim">Titre</span>
            <input
              value={config.brandTitle}
              onChange={(e) => set({ brandTitle: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-dim">{t("Sous-titre (vide = masqué)")}</span>
            <input
              value={config.brandSubtitle}
              onChange={(e) => set({ brandSubtitle: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
        </div>
      </section>

      </ResizablePanel>
      {/* Textes de l'app (commercial) */}
      <ResizablePanel id="admin-texts" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">textes</h2>
        <p className="mt-2 text-xs text-text-dim">
          Modifie les textes vus par tes utilisateurs (connexion, accueil, abonnement).
          Appliqué en direct.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <label className="block">
            <span className="text-xs text-text-dim">Accueil — titre</span>
            <input
              value={texts.onboardingTitle}
              onChange={(e) => setText({ onboardingTitle: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-dim">Accueil — texte</span>
            <textarea
              rows={2}
              value={texts.onboardingBody}
              onChange={(e) => setText({ onboardingBody: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-dim">Connexion — sous-titre</span>
            <input
              value={texts.loginSubtitle}
              onChange={(e) => setText({ loginSubtitle: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-dim">Abonnement requis — texte</span>
            <textarea
              rows={2}
              value={texts.subRequiredBody}
              onChange={(e) => setText({ subRequiredBody: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
        </div>
      </section>
      </ResizablePanel>
      {/* Fenêtre & densité */}
      <ResizablePanel id="admin-window" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label flex items-center gap-2">
          <IconMonitor className="h-4 w-4" /> {t("fenêtre & densité")}
        </h2>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs text-text-dim">Largeur</span>
            <input
              type="number"
              min={900}
              max={3840}
              value={win.width}
              onChange={(e) =>
                set({ window: { ...win, width: parseInt(e.target.value || "0", 10) || win.width } })
              }
              className="mt-1 w-24 rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-dim">Hauteur</span>
            <input
              type="number"
              min={600}
              max={2400}
              value={win.height}
              onChange={(e) =>
                set({ window: { ...win, height: parseInt(e.target.value || "0", 10) || win.height } })
              }
              className="mt-1 w-24 rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text outline-none focus:border-blue/60"
            />
          </label>
          <button
            type="button"
            onClick={applySizeNow}
            data-tip="Appliquer maintenant"
            data-tip-sub={t("Redimensionne la fenêtre à ces valeurs, sans attendre le prochain lancement.")}
            className="pill bg-blue px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Appliquer
          </button>
          <button
            type="button"
            onClick={useCurrentSize}
            data-tip={t("Mémoriser la taille actuelle")}
            data-tip-sub={t("La fenêtre s’ouvrira à cette taille aux prochains lancements.")}
            className="pill border border-border bg-surface-2 px-4 py-2 text-xs text-text hover:bg-overlay-2"
          >
            {t("Mémoriser la taille actuelle")}
          </button>
          {config.window && (
            <button
              type="button"
              onClick={() => set({ window: null })}
              data-tip={t("Ne plus gérer la taille")}
              data-tip-sub={t("macOS reprend la main sur la taille de la fenêtre.")}
              className="pill border border-border px-4 py-2 text-xs text-text-dim hover:text-text"
            >
              {t("Ne plus gérer")}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-text-dim">
          {config.window
            ? t("Appliquée à chaque lancement : {w} × {h}.", { w: config.window.width, h: config.window.height })
            : t("Aucune taille imposée au lancement (la fenêtre garde sa taille).")}
          {sizeMsg && <span className="ml-2 text-green">{sizeMsg}</span>}
        </p>

        <div className="mt-4">
          <span className="text-xs text-text-dim">{t("Densité de l'interface")}</span>
          <div className="pill mt-1.5 inline-flex flex-wrap items-center gap-0.5 border border-border bg-surface-2 p-1">
            {[
              { z: 90, label: "Compacte" },
              { z: 100, label: "Normale" },
              { z: 110, label: "Confort" },
              { z: 120, label: "Large" },
            ].map((it) => (
              <button
                key={it.z}
                type="button"
                onClick={() => {
                  applyZoom(it.z);
                  set({ zoom: it.z });
                }}
                data-tip={t("Densité {label} — {z} %", { label: it.label.toLowerCase(), z: it.z })}
                data-tip-sub={t("Agrandit ou resserre toute l’interface.")}
                className={`pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  config.zoom === it.z ? "bg-overlay-2 text-text" : "text-text-dim hover:text-text"
                }`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      </ResizablePanel>
      {/* Modules */}
      <ResizablePanel id="admin-modules" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("modules de la sidebar")}</h2>
        <p className="mt-2 text-xs text-text-dim">
          Ordre, visibilité et libellé de chaque module. « Aujourd'hui » reste toujours
          accessible ; Personnaliser et Réglages sont fixes en bas.
        </p>
        <div className="mt-3 flex flex-col gap-1">
          {config.modules.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 ${
                m.visible ? "" : "opacity-55"
              }`}
            >
              <VisibilityToggle
                visible={m.visible}
                disabled={m.id === "today"}
                onToggle={() =>
                  set({
                    modules: config.modules.map((x, k) =>
                      k === i ? { ...x, visible: !x.visible } : x,
                    ),
                  })
                }
              />
              <input
                value={m.label ?? ""}
                placeholder={t(MODULE_LABELS[m.id])}
                onChange={(e) =>
                  set({
                    modules: config.modules.map((x, k) =>
                      k === i ? { ...x, label: e.target.value || undefined } : x,
                    ),
                  })
                }
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none placeholder:text-text-dim/70 focus:border-border focus:bg-surface-2"
              />
              <ArrowButton
                up
                onClick={() => set({ modules: move(config.modules, i, -1) })}
                disabled={i === 0}
              />
              <ArrowButton
                up={false}
                onClick={() => set({ modules: move(config.modules, i, 1) })}
                disabled={i === config.modules.length - 1}
              />
            </div>
          ))}
        </div>
      </section>

      </ResizablePanel>
      {/* Dashboard */}
      <ResizablePanel id="admin-dashboard" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">dashboard — aujourd'hui</h2>
        <p className="mt-2 text-xs text-text-dim">
          {t("Choisis les blocs affichés sur l'écran d'accueil et leur ordre.")}
        </p>
        <div className="mt-4 flex flex-col gap-5">
          <WidgetList
            title="bandeaux (pleine largeur)"
            list={config.dashTop}
            onChange={(l) => set({ dashTop: l })}
          />
          <WidgetList
            title="colonne gauche"
            list={config.dashLeft}
            onChange={(l) => set({ dashLeft: l })}
          />
          <WidgetList
            title="colonne droite"
            list={config.dashRight}
            onChange={(l) => set({ dashRight: l })}
          />
        </div>
      </section>
      </ResizablePanel>
      </ResizableGrid>
    </div>
  );
}
