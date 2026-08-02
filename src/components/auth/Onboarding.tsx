import { useState } from "react";
import { IconTarget, IconBolt, IconCheckCircle } from "../icons";
import { WEBSITE_URL } from "../../lib/auth/config";
import { openExternal } from "../../lib/auth/external";
import { useAppTexts } from "../../lib/appTexts";
import ShaleMark from "./ShaleMark";

import { t } from "../../lib/i18n";
const KEY = "shale.onboarded";

/** Vrai si l'utilisateur a déjà vu l'accueil (persisté hors DB → marche démo + natif). */
export function needsOnboarding(): boolean {
  try {
    return localStorage.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

interface Slide {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const slidesRest = (): Slide[] => [
  {
    icon: <IconTarget className="h-10 w-10 text-blue" />,
    title: t("Exécute proprement"),
    body: t("Calcule ta taille de position, envoie-la au tracker live, dénoue en un clic. Ton journal en R se remplit tout seul et calcule tes stats."),
  },
  {
    icon: <IconBolt className="h-10 w-10 text-blue" />,
    title: t("Garde le cap"),
    body: t("Le Market-Brain te prépare un briefing deux fois par jour ; la jauge de discipline et les objectifs te gardent dans ta zone de décision."),
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const texts = useAppTexts();
  const SLIDES: Slide[] = [
    { icon: <ShaleMark size={44} />, title: texts.onboardingTitle, body: texts.onboardingBody },
    ...slidesRest(),
  ];
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* stockage indisponible : on ferme quand même */
    }
    onDone();
  };

  const s = SLIDES[i];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
      <div className="card-solid w-full max-w-md animate-fade-up rounded-[18px] border border-border p-8 text-center">
        <div className="mb-5 flex justify-center">{s.icon}</div>
        <h2 className="text-xl font-bold tracking-tight text-text">{s.title}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-dim">{s.body}</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          {SLIDES.map((_, k) => (
            <span
              key={k}
              className={`h-1.5 rounded-full transition-all ${
                k === i ? "w-6 bg-blue" : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-2">
          <button
            onClick={() => (last ? finish() : setI(i + 1))}
            className="pill w-full bg-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {last ? (
              <span className="inline-flex items-center gap-2">
                <IconCheckCircle className="h-4 w-4" /> Commencer
              </span>
            ) : (
              "Suivant"
            )}
          </button>
          {!last && (
            <button
              onClick={finish}
              className="text-xs text-text-dim transition-opacity hover:opacity-80"
            >
              Passer
            </button>
          )}
        </div>

        {last && (
          <p className="mt-5 text-xs text-text-dim">
            En continuant, tu acceptes nos{" "}
            <button
              onClick={() => openExternal(`${WEBSITE_URL}/cgu.html`)}
              className="text-blue hover:opacity-80"
            >
              CGU
            </button>{" "}
            et notre{" "}
            <button
              onClick={() => openExternal(`${WEBSITE_URL}/confidentialite.html`)}
              className="text-blue hover:opacity-80"
            >
              {t("politique de confidentialité")}
            </button>
            .
          </p>
        )}
      </div>
    </div>
  );
}
