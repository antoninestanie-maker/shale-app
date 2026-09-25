import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../lib/i18n";

/**
 * ⭐ LE FILET CONTRE L'ÉCRAN BLANC.
 *
 * Sans lui, une exception levée PENDANT LE RENDU — une donnée inattendue en
 * base, un chunk `lazy()` introuvable, un `undefined.map` dans un module —
 * démonte TOUT l'arbre React : la fenêtre devient blanche, sans message, sans
 * sortie autre que de quitter l'app. Jusqu'au 2026-09-26, Shale n'en avait
 * aucun (repéré en passant l'app au crible du skill `harden`).
 *
 * Deux portées, deux replis :
 * - `portee="module"` enveloppe la vue courante, dans `App.tsx`. Le module
 *   planté affiche son erreur ; la barre latérale, la navigation et les autres
 *   modules restent utilisables. Le conteneur parent porte `key={view}` :
 *   changer de module remonte le filet, donc efface l'erreur.
 * - `portee="app"` enveloppe tout, dans `main.tsx`. C'est le dernier recours,
 *   pour ce qui plante HORS d'une vue (barre latérale, authentification…) :
 *   il propose de recharger la fenêtre.
 *
 * Le message technique est AFFICHÉ, pas seulement journalisé : sur iPhone,
 * c'est le seul endroit où il pourra être lu (MOBILE.md §14.1, même règle que
 * `EcranDonneesIllisibles`).
 *
 * ⚠️ Un filet ne voit QUE les erreurs de rendu, de cycle de vie et de
 * constructeur. Une erreur dans un gestionnaire d'événement (`onClick`) ou dans
 * une promesse ne remonte pas jusqu'ici — celles-là ont déjà leurs toasts.
 */
type Props = {
  portee: "module" | "app";
  children: ReactNode;
};

type State = { erreur: Error | null; essai: number };

export default class FiletErreur extends Component<Props, State> {
  state: State = { erreur: null, essai: 0 };

  static getDerivedStateFromError(erreur: unknown): Partial<State> {
    return { erreur: erreur instanceof Error ? erreur : new Error(String(erreur)) };
  }

  componentDidCatch(erreur: unknown, info: ErrorInfo) {
    console.error(`[FiletErreur:${this.props.portee}]`, erreur, info.componentStack);
  }

  /** Retente le rendu : l'`essai` sert de `key`, donc les enfants repartent de zéro. */
  private reessayer = () => {
    this.setState((s) => ({ erreur: null, essai: s.essai + 1 }));
  };

  render() {
    const { erreur, essai } = this.state;
    if (!erreur) return <FragmentCle key={essai}>{this.props.children}</FragmentCle>;

    const app = this.props.portee === "app";
    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center gap-4 px-8 text-center ${
          app ? "h-screen bg-bg" : "h-full"
        }`}
      >
        <p className="text-sm text-text">
          {app
            ? t("Shale a rencontré un problème.")
            : t("Ce module a rencontré un problème. Le reste de l'app fonctionne.")}
        </p>
        <p className="max-w-md break-words font-mono text-xs text-text-dim">{erreur.message}</p>
        <button
          type="button"
          onClick={app ? () => location.reload() : this.reessayer}
          className="pill border border-blue/40 bg-blue/10 px-4 py-1.5 text-xs font-semibold text-blue transition-colors hover:bg-blue/20"
        >
          {app ? t("Recharger Shale") : t("Réessayer")}
        </button>
      </div>
    );
  }
}

/** Un fragment qui accepte une `key` sans rien ajouter au DOM. */
function FragmentCle({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
