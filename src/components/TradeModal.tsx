import { useEffect, useState } from "react";
import { todayStr } from "../lib/logic";
import { isTauri, updateTrade, type TradeInput } from "../lib/repo";
import { logTrade } from "../lib/trades";
import type { AppData, Trade } from "../lib/types";
import { IconX } from "./icons";

import { t } from "../lib/i18n";
interface Props {
  trade: Trade | null; // null = création
  data: AppData;
  defaultMode?: "live" | "backtest";
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function TradeModal({
  trade,
  data,
  defaultMode = "live",
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<"live" | "backtest">(
    trade?.mode ?? defaultMode,
  );
  const [date, setDate] = useState(trade?.date ?? todayStr());
  const [instrument, setInstrument] = useState(trade?.instrument ?? "");
  const [direction, setDirection] = useState<"long" | "short">(
    trade?.direction ?? "long",
  );
  const [setup, setSetup] = useState(trade?.setup ?? "");
  const [resultR, setResultR] = useState(
    trade ? String(trade.result_r) : "",
  );
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [screenshot, setScreenshot] = useState<string | null>(
    trade?.screenshot_path ?? null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const knownSetups = [
    ...new Set(
      data.trades.map((t) => t.setup?.trim()).filter((s): s is string => !!s),
    ),
  ];

  const parsedR = parseFloat(resultR.replace(",", "."));
  const canSave =
    instrument.trim().length > 0 && !Number.isNaN(parsedR) && !saving;

  const pickScreenshot = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const file = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (typeof file !== "string") return;
    const { invoke } = await import("@tauri-apps/api/core");
    const dest = await invoke<string>("import_screenshot", { src: file });
    setScreenshot(dest);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const input: TradeInput = {
      date,
      instrument: instrument.trim().toUpperCase(),
      direction,
      setup: setup.trim() || null,
      result_r: parsedR,
      screenshot_path: screenshot,
      notes: notes.trim() || null,
      mode,
    };
    if (trade) await updateTrade(trade.id, input);
    else await logTrade(input, data);
    await onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-text">
            {trade ? t("Modifier le trade") : t("Nouveau trade")}
          </h2>
          <div className="flex gap-1">
            {(["live", "backtest"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`pill border px-3 py-1 text-[11px] font-semibold uppercase transition-colors ${
                  mode === m
                    ? m === "live"
                      ? "border-blue/50 bg-blue/15 text-blue"
                      : "border-yellow/50 bg-yellow/15 text-yellow"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="auto-tiles gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">Date</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-blue focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                Instrument
              </p>
              <input
                autoFocus={!trade}
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                placeholder="NQ, EURUSD…"
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm uppercase text-text placeholder:normal-case placeholder:text-text-dim focus:border-blue focus:outline-none"
              />
            </div>
          </div>

          <div className="auto-tiles gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                Direction
              </p>
              <div className="flex gap-1.5">
                {(["long", "short"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={`pill flex-1 border px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
                      direction === d
                        ? d === "long"
                          ? "border-green/50 bg-green/15 text-green"
                          : "border-red/50 bg-red/15 text-red"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                {t("Résultat (en R)")}
              </p>
              <input
                value={resultR}
                onChange={(e) => setResultR(e.target.value)}
                placeholder="+2.5 / -1 / 0"
                inputMode="decimal"
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text placeholder:font-body placeholder:text-text-dim focus:border-blue focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">Setup</p>
            <input
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              placeholder="Silver Bullet, OB, FVG…"
              list="setups"
              className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <datalist id="setups">
              {knownSetups.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("Notes d'exécution (optionnel)")}
            rows={2}
            className="w-full resize-none rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          <div className="flex items-center gap-2">
            {isTauri ? (
              <button
                type="button"
                onClick={pickScreenshot}
                className="pill border border-border px-3 py-1.5 text-xs text-text-dim hover:text-text"
              >
                📷 {screenshot ? t("Changer le screenshot") : t("Joindre un screenshot")}
              </button>
            ) : (
              <span className="text-xs text-text-dim">
                Screenshot : app native uniquement
              </span>
            )}
            {screenshot && (
              <button
                type="button"
                onClick={() => setScreenshot(null)}
                className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-red"
              >
                <IconX className="h-3 w-3" /> retirer
              </button>
            )}
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="pill px-4 py-2 text-sm font-medium text-text-dim hover:text-text"
            >
              {t("Annuler")}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="pill bg-blue px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {trade ? t("Enregistrer") : "Logger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
