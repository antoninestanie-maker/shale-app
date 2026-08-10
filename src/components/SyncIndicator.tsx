import { t } from "../lib/i18n";
import { formatWhen } from "../lib/notifications";
import { useSyncApi } from "./SyncProvider";

/**
 * État de la synchronisation, dans le pied de la sidebar.
 *
 * Même grammaire visuelle que `SessionIndicator` — pastille + libellé court —
 * parce que c'est le même genre d'information : un état de fond, à consulter du
 * coin de l'œil, jamais une alerte.
 *
 * ⚠️ Il ne montre RIEN quand la synchronisation est indisponible (preview
 * navigateur, auth non configurée). Afficher « indisponible » en permanence
 * dans une app qui marche très bien sans cloud transformerait un choix
 * volontaire en défaut apparent.
 */
export default function SyncIndicator({ onOuvrirReglages }: { onOuvrirReglages: () => void }) {
  const sync = useSyncApi();
  if (sync.statut === "indisponible") return null;

  const base =
    "pill inline-flex max-w-full items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors duration-500";

  // Chaque état porte SA raison d'être dans l'info-bulle : un indicateur qui se
  // contente d'un mot laisse l'utilisateur deviner ce qu'il doit faire.
  const etats = {
    inactive: {
      classe: "border-border bg-surface-2 text-text-dim",
      pastille: "bg-text-dim/60",
      libelle: t("sync désactivée"),
      bulle: t("Tes données restent sur cet appareil. Active la synchronisation dans Réglages."),
      anime: false,
    },
    verrouillee: {
      classe: "border-yellow/30 bg-yellow/10 text-yellow",
      pastille: "bg-yellow",
      libelle: t("sync verrouillée"),
      bulle: t("Ton mot de passe est nécessaire pour déchiffrer tes données sur cet appareil."),
      anime: false,
    },
    horsLigne: {
      classe: "border-border bg-surface-2 text-text-dim",
      pastille: "bg-text-dim/60",
      libelle: t("hors ligne"),
      bulle: t("Tes modifications sont conservées et partiront au retour du réseau."),
      anime: false,
    },
    // ⚠️ Un échec RÉSEAU n'est pas rouge. Sur une app offline-first, une
    // coupure est un état normal : la peindre en alerte apprendrait à
    // l'utilisateur à ignorer la couleur rouge, qui ne servirait alors plus à
    // rien le jour où elle compte. La file d'attente est la vraie information.
    echecPassager: {
      classe: "border-border bg-surface-2 text-text-dim",
      pastille: "bg-text-dim/60",
      libelle: sync.enAttente > 0 ? t("{n} en attente", { n: String(sync.enAttente) }) : t("hors ligne"),
      bulle: t("Le serveur n'a pas répondu. Une nouvelle tentative suivra automatiquement."),
      anime: false,
    },
    // Ces deux-là, en revanche, ne guériront PAS toutes seules.
    session: {
      classe: "border-yellow/30 bg-yellow/10 text-yellow",
      pastille: "bg-yellow",
      libelle: t("reconnexion requise"),
      bulle: t("Ta session a expiré. Reconnecte-toi pour que la synchronisation reprenne."),
      anime: false,
    },
    echec: {
      classe: "border-red/30 bg-red/10 text-red",
      pastille: "bg-red",
      libelle: t("sync en échec"),
      bulle: sync.erreur ?? t("La dernière tentative a échoué. Une autre suivra automatiquement."),
      anime: false,
    },
    enCours: {
      classe: "border-blue/30 bg-blue/10 text-blue",
      pastille: "bg-blue",
      libelle: t("synchronisation…"),
      bulle: t("Échange en cours avec le cloud."),
      anime: true,
    },
    enAttente: {
      classe: "border-blue/30 bg-blue/10 text-blue",
      pastille: "bg-blue",
      libelle: t("{n} en attente", { n: String(sync.enAttente) }),
      bulle: t("Modifications pas encore envoyées. Elles partiront au prochain échange."),
      anime: true,
    },
    aJour: {
      classe: "border-green/30 bg-green/10 text-green",
      pastille: "bg-green",
      libelle: t("synchronisé"),
      bulle: sync.dernierSucces
        ? t("Dernier échange {when}.", { when: formatWhen(sync.dernierSucces) })
        : t("Tout est à jour."),
      anime: false,
    },
  } as const;

  function choisir(): keyof typeof etats {
    if (sync.statut === "inactive") return "inactive";
    if (sync.statut === "verrouillee") return "verrouillee";
    if (sync.activite === "horsLigne") return "horsLigne";
    if (sync.activite === "enCours") return "enCours";
    if (sync.activite === "echec") {
      // Trois échecs très différents se cachaient derrière un seul « en échec » :
      // un Wi-Fi qui tombe, une session périmée, et un backend qui n'a jamais
      // existé. Le premier ne mérite aucune alerte, les deux autres appellent
      // une action — et se taire dessus revient à laisser croire que ça marche.
      if (sync.raison === "session") return "session";
      if (sync.raison === "configuration") return "echec";
      return "echecPassager";
    }
    // L'attente prime sur « à jour » : c'est l'information utile quand une
    // saisie n'est pas encore partie.
    return sync.enAttente > 0 ? "enAttente" : "aJour";
  }

  const choix = choisir();
  const vue = etats[choix];
  // Cliquable seulement quand il y a quelque chose à faire — sinon la pastille
  // reste un simple témoin, et le clic n'ouvre pas un écran sans objet. Un
  // échec passager n'est PAS actionnable : ouvrir les réglages n'y changerait
  // rien, et le proposer suggérerait le contraire.
  const actionnable =
    sync.statut !== "active" || choix === "echec" || choix === "session";

  return (
    <button
      type="button"
      onClick={actionnable ? onOuvrirReglages : () => void sync.synchroniserMaintenant()}
      className={`${base} ${vue.classe} w-fit text-left hover:opacity-80`}
      data-tip={vue.bulle}
      data-tip-sub={actionnable ? t("Ouvrir les réglages de synchronisation") : t("Synchroniser maintenant")}
      data-tip-side="right"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${vue.pastille} ${vue.anime ? "animate-pulse-dot" : ""}`}
      />
      <span className="truncate">{vue.libelle}</span>
    </button>
  );
}
