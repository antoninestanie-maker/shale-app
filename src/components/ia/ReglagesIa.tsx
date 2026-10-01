// ─────────────────────────────────────────────────────────────────────────────
// Réglages → « Intelligence artificielle ».
//
//   · un interrupteur général, ÉTEINT par défaut ;
//   · à la PREMIÈRE activation, l'écran de consentement : quelles données
//     partent, vers qui, ce qui n'est pas conservé, et que ces données-là ne
//     profitent pas du chiffrement de bout en bout le temps de l'appel ;
//   · un interrupteur par famille ;
//   · le compteur « X actions restantes, réinitialisation le … ».
//
// ⚠️ Le TEXTE du consentement est réservé à Antonin (cahier des charges § 9.4).
// Celui-ci est la proposition soumise à l'arrêt de la phase C ; le changer sur
// le fond = monter `VERSION_CONSENTEMENT` (`lib/ia/reglages.ts`).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../lib/auth/config";
import { COMMERCE_AUTORISE } from "../../lib/boutique";
import { useEntitlements } from "../../lib/entitlements";
import { formatDate, formatNumber, t } from "../../lib/i18n";
import { EVENEMENT_USAGE_IA, lireCompteur } from "../../lib/ia/compteur";
import { FAMILLES, QUOTA_ESSAI, QUOTA_PRO, type FamilleIa } from "../../lib/ia/contrats";
import { activerIa, desactiverIa, rallumerIa, reglerFamille } from "../../lib/ia/reglages";
import type { UsageIa } from "../../lib/ia/runAi";
import { usePrefsIa } from "../../lib/ia/useIa";
import { isTauri } from "../../lib/repo";
import { useSession } from "../auth/AuthGate";
import UpgradeModal from "../UpgradeModal";
import { SujetsBrief } from "./SujetsBrief";

function libelleFamille(f: FamilleIa, finance: boolean): { titre: string; desc: string } {
  switch (f) {
    case "brief":
      return { titre: t("Brief du matin et clôture du soir"), desc: t("Tes sujets suivis, ta journée, et le bilan du soir.") };
    case "capture":
      return {
        titre: t("Capture"),
        desc: finance
          ? t("Un texte, un PDF ou une image devient des tâches, des événements ou une facture à valider.")
          : t("Un texte, un PDF ou une image devient des tâches, des événements ou des notes à valider."),
      };
    case "taches":
      return { titre: t("Tâches et objectifs"), desc: t("Découper, estimer, décomposer, proposer des étapes.") };
    case "notes":
      return { titre: t("Notes"), desc: t("Résumer, réécrire, traduire, développer, suggérer des liens, carte mentale.") };
    case "revue":
      return { titre: t("Revue hebdomadaire"), desc: t("Ce qui a tenu, ce qui a glissé, trois ajustements.") };
    case "finance":
      return { titre: t("Finance"), desc: t("Ton runway expliqué, et les scénarios « et si… ».") };
  }
}

function Interrupteur({
  titre,
  desc,
  valeur,
  inactif,
  onChange,
}: {
  titre: string;
  desc: string;
  valeur: boolean;
  inactif?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valeur}
      disabled={inactif}
      onClick={() => onChange(!valeur)}
      className="flex w-full items-center justify-between gap-4 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-overlay disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">{titre}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">{desc}</span>
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${valeur ? "bg-blue" : "bg-surface-2"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            valeur ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/** L’écran de consentement — proposition v1, soumise à Antonin. Il NOMME le fournisseur (Google, depuis le 2026-10-01) : changer de fournisseur pour de bon, c’est changer ce texte ET monter `VERSION_CONSENTEMENT`. */
function Consentement({ onAccepter, onAnnuler }: { onAccepter: () => void; onAnnuler: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onAnnuler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnnuler]);

  const points = [
    t("Quand tu utilises une fonction d'IA, le contenu concerné — la note, les tâches, le fichier que tu choisis — part vers Shale, puis vers Google, qui rédige la réponse avec son modèle Gemini."),
    t("Pendant cet envoi, ce contenu ne profite pas du chiffrement de bout en bout : le modèle doit pouvoir le lire pour répondre. Le reste de tes données n'est pas concerné."),
    t("Shale ne conserve ni ce qui part ni ce qui revient. Seul un compteur d'actions est gardé, sans aucun texte."),
    t("L'IA ne modifie rien seule : chaque proposition attend ta validation."),
    t("Tu peux désactiver l'IA à tout moment, en entier ou par famille."),
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-6 py-10"
      onClick={onAnnuler}
      role="dialog"
      aria-modal="true"
      aria-label={t("Activer l'intelligence artificielle")}
    >
      <div
        className="card-solid animate-fade-up relative max-h-full w-full max-w-lg overflow-y-auto p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[20px] font-bold leading-tight tracking-tight text-text">
          {t("Activer l'intelligence artificielle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">{t("Avant de l'activer, voici ce qui se passe.")}</p>
        <ul className="mt-5 flex flex-col gap-3">
          {points.map((p) => (
            <li key={p} className="grid grid-cols-[auto_1fr] gap-3 text-[13.5px] leading-relaxed text-text">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" onClick={onAccepter} className="pill flex-1 basis-[12rem] fill-primary py-2.5 text-sm font-semibold">
            {t("Activer l'IA")}
          </button>
          <button
            type="button"
            onClick={onAnnuler}
            className="pill border border-border bg-surface-2 px-5 py-2.5 text-sm text-text transition-colors hover:border-blue/50"
          >
            {t("Annuler")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ReglagesIa() {
  const { aIa, isTrialing, afficheModule } = useEntitlements();
  const finance = afficheModule("finance");
  const { subscription, jetonFrais } = useSession();
  const prefs = usePrefsIa();
  const [consentement, setConsentement] = useState(false);
  const [pro, setPro] = useState(false);
  const [usage, setUsage] = useState<UsageIa | null>(null);
  const active = !!prefs && prefs.active && prefs.consentiLe !== null;

  // Le compteur : lu dans `ai_usage` à l'ouverture, puis tenu à jour par les
  // réponses de la fonction (`useIa` diffuse le reste après chaque appel).
  useEffect(() => {
    if (!aIa || !active) return;
    let vivant = true;
    if (isTauri)
      lireCompteur(isTrialing, subscription?.trial_ends_at, {
        url: SUPABASE_URL,
        cleAnon: SUPABASE_ANON_KEY,
        jeton: () => jetonFrais(),
      }).then((u) => vivant && u && setUsage(u));
    const suivre = (e: Event) => setUsage((e as CustomEvent<UsageIa>).detail);
    window.addEventListener(EVENEMENT_USAGE_IA, suivre);
    return () => {
      vivant = false;
      window.removeEventListener(EVENEMENT_USAGE_IA, suivre);
    };
  }, [aIa, active, isTrialing, subscription?.trial_ends_at, jetonFrais]);

  if (!aIa)
    return (
      <section className="card p-5">
        <h2 className="hud-label">{t("intelligence artificielle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">{t("L'intelligence artificielle fait partie de Shale Pro.")}</p>
        {COMMERCE_AUTORISE && (
          <>
            <button type="button" onClick={() => setPro(true)} className="mt-3 text-sm font-medium text-blue hover:underline">
              {t("Découvrir Shale Pro")}
            </button>
            {pro && <UpgradeModal offre="pro" onClose={() => setPro(false)} />}
          </>
        )}
      </section>
    );

  const basculer = (v: boolean) => {
    if (!prefs) return;
    if (!v) void desactiverIa();
    else if (prefs.consentiLe) void rallumerIa();
    else setConsentement(true);
  };

  const quota = isTrialing ? QUOTA_ESSAI : QUOTA_PRO;

  return (
    <section className="card p-5">
      <h2 className="hud-label">{t("intelligence artificielle")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-text-dim">
        {t("Désactivée par défaut. Quand elle est active, seul le contenu que tu soumets à une fonction d'IA part vers Google, le temps de la réponse ; Shale n'en garde rien.")}
      </p>

      <div className="mt-3">
        <Interrupteur
          titre={t("Activer l'IA")}
          desc={t("Rédigée par Gemini, le modèle de Google, avec la clé de Shale : tu n'as rien à configurer.")}
          valeur={active}
          inactif={!prefs}
          onChange={basculer}
        />
      </div>

      <div className={`mt-2 border-t border-border pt-2 ${active ? "" : "opacity-60"}`}>
        {/* Finance mise de côté (2026-10-01) : sa famille sort avec elle — et
            aucune fonction d'IA n'y est branchée (#39 reportée avec le module). */}
        {FAMILLES.filter((f) => f !== "finance" || finance).map((f) => {
          const l = libelleFamille(f, finance);
          return (
            <Interrupteur
              key={f}
              titre={l.titre}
              desc={l.desc}
              valeur={!!prefs?.familles[f]}
              inactif={!active}
              onChange={(v) => prefs && void reglerFamille(prefs, f, v)}
            />
          );
        })}
      </div>

      {active && prefs?.familles.brief && <SujetsBrief />}

      {active && (
        <p className="mt-3 px-2 text-xs text-text-dim">
          {usage
            ? usage.resetsAt
              ? t("{n} actions restantes sur {quota} · réinitialisation le {date}", {
                  n: formatNumber(usage.actionsLeft),
                  quota: formatNumber(quota),
                  date: formatDate(new Date(usage.resetsAt), { day: "numeric", month: "long", timeZone: "UTC" }),
                })
              : t("{n} actions restantes sur {quota}", { n: formatNumber(usage.actionsLeft), quota: formatNumber(quota) })
            : isTrialing
              ? t("{quota} actions pendant l'essai.", { quota: formatNumber(quota) })
              : t("{quota} actions par mois.", { quota: formatNumber(quota) })}
        </p>
      )}

      {consentement && (
        <Consentement
          onAccepter={() => {
            setConsentement(false);
            void activerIa();
          }}
          onAnnuler={() => setConsentement(false)}
        />
      )}
    </section>
  );
}
