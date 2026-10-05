// ─────────────────────────────────────────────────────────────────────────────
// La carte « Brief du jour » d'Aujourd'hui (fonctions #1, #2, #3).
//
// Le texte du modèle est rendu en NŒUDS TEXTE React, jamais en HTML : une
// sortie de modèle injectée par `innerHTML` serait une XSS avec accès à l'IPC
// Tauri (`csp: null`, CLAUDE.md, section datée du 2026-09-29). Les liens ne
// s'ouvrent que s'ils sont http(s), et le serveur a déjà vérifié qu'ils sont
// ceux d'articles fournis.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { openExternal } from "../../lib/auth/external";
import { formatHeure, t } from "../../lib/i18n";
import { useBrief, type BriefDuJour } from "../../lib/ia/useBrief";
import type { AppData } from "../../lib/types";
import { IconExternal } from "../icons";
import { ClotureSoir } from "./ClotureSoir";
import { EtatIa } from "./EtatIa";
import { FenetreIa } from "./FenetreIa";
import { IconeIa } from "./IconeIa";

export function ouvrirLien(lien: string): void {
  if (/^https?:\/\//i.test(lien)) void openExternal(lien);
}

function Points({ brief, parSujet }: { brief: BriefDuJour; parSujet?: number }) {
  const sujets = brief.sujets.filter((s) => s.points.length > 0);
  if (sujets.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {sujets.map((s) => (
        <div key={s.nom}>
          <p className="hud-label">{s.nom}</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {s.points.slice(0, parSujet ?? s.points.length).map((p, i) => (
              <li key={`${s.nom}-${i}`} className="grid grid-cols-[1fr_auto] items-start gap-2 text-[13.5px] leading-relaxed text-text">
                <span>{p.texte}</span>
                <button
                  type="button"
                  onClick={() => ouvrirLien(p.lien)}
                  title={p.lien}
                  aria-label={t("Ouvrir la source")}
                  className="mt-0.5 rounded p-1 text-text-dim transition-colors hover:bg-overlay hover:text-text"
                >
                  <IconExternal className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function CarteBrief({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const b = useBrief(data, true);
  const [lecture, setLecture] = useState(false);
  const [cloture, setCloture] = useState(false);

  const ouvrir = () => {
    setLecture(true);
    void b.marquerLu();
  };

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="hud-label flex items-center gap-2">
          <IconeIa className="h-3.5 w-3.5" />
          {t("Brief du jour")}
        </h2>
        {b.brief && (
          <button type="button" onClick={ouvrir} className="text-xs font-medium text-blue hover:underline">
            {b.lu ? t("Relire") : t("Lire en entier")}
          </button>
        )}
      </div>

      {b.brief ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-text">{b.brief.journee}</p>
          <Points brief={b.brief} parSujet={1} />
        </div>
      ) : b.etat.etat === "repos" ? (
        <p className="text-sm text-text-dim">
          {t("Ton brief arrive à {heure}.", { heure: formatHeure(b.heures.brief) })}
        </p>
      ) : null}

      <div className="mt-3">
        <EtatIa etat={b.etat} onReessayer={b.reessayer} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setCloture(true)}
          className={`pill px-4 py-1.5 text-sm ${
            b.heureDeCloture ? "fill-primary font-semibold" : "border border-border bg-surface-2 text-text hover:border-blue/50"
          }`}
        >
          {t("Clôturer la journée")}
        </button>
        {b.brief && (
          <button
            type="button"
            onClick={b.regenerer}
            disabled={b.etat.etat === "chargement"}
            title={t("Rédige un nouveau brief : c'est un nouvel appel à l'IA, décompté.")}
            className="text-xs text-text-dim hover:text-text disabled:opacity-50"
          >
            {t("Régénérer")}
          </button>
        )}
      </div>

      {lecture && b.brief && (
        <FenetreIa titre={t("Brief du jour")} onFermer={() => setLecture(false)} large>
          <div className="flex flex-col gap-5">
            <p className="text-[15px] leading-relaxed text-text">{b.brief.journee}</p>
            <Points brief={b.brief} />
            <p className="text-xs text-text-dim">
              {t("Rédigé par l'IA à partir de tes sources et de ton agenda. Chaque point renvoie à son article.")}
            </p>
          </div>
        </FenetreIa>
      )}

      {cloture && <ClotureSoir data={data} refresh={refresh} onFermer={() => setCloture(false)} />}
    </section>
  );
}
