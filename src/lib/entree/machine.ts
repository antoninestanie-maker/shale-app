/**
 * La machine à états de la transition d'entrée.
 *
 * PURE : aucun DOM, aucun timer, aucune horloge. Elle ne fait que répondre
 * « à cet état, cet événement donne cet état-là ». Tout ce qui bouge —
 * `animationend`, le minuteur de sécurité, le signal « l'app est prête » — est
 * INJECTÉ par le composant, comme le moteur de rappels Rust le fait déjà.
 *
 * C'est ce qui permet de tester le cas qui casse en silence : sous
 * `prefers-reduced-motion`, la règle globale d'`index.css` écrase
 * `animation-duration` sur `*`. Une machine qui attendrait un événement qui
 * n'arrive jamais laisserait l'utilisateur derrière un logo, sans un bruit.
 *
 * ⭐ LA RÈGLE QUI GOUVERNE TOUT : la transition HABILLE du travail réel. Elle
 * se termine au PLUS TARD de (fin de l'animation, app prête).
 *   - l'app est prête avant → on ne ralentit rien, l'animation va au bout ;
 *   - l'app est en retard → on ne rallonge pas l'animation, on TIENT sa
 *     dernière image jusqu'à ce que l'app arrive.
 * Jamais de délai inventé pour faire joli.
 */

/**
 * Les quatre temps, plus les deux bords.
 *
 * `poser` — le formulaire s'efface, la marque ne bouge pas.
 * `approche` — la marque grossit, les strates se décollent.
 * `traversee` — l'ouverture s'agrandit au-delà de l'écran, l'app apparaît.
 */
export type EtatEntree = "idle" | "poser" | "approche" | "traversee" | "done";

export type EvenementEntree =
  /** L'authentification a réussi (ou l'ouverture à froid commence). */
  | { type: "demarrer" }
  /**
   * Un `animationend` est arrivé. `temps` dit DE QUEL temps il vient.
   *
   * ⚠️ Ce champ n'est pas décoratif. Les deux jeux de keyframes alternés
   * peuvent laisser filer un `animationend` du temps précédent ; sans ce
   * garde-fou, il ferait sauter un temps entier.
   */
  | { type: "finAnimation"; temps: EtatEntree }
  /** Les données de l'app sont chargées : il y a quelque chose à révéler. */
  | { type: "appPrete" }
  /** Une tape ou un clic : on saute à l'état final. */
  | { type: "interrompre" }
  /** Le filet de sécurité. Un chargement bloqué ne piège jamais personne. */
  | { type: "expiration" };

export interface ModeleEntree {
  readonly etat: EtatEntree;
  /** L'app a signalé qu'elle avait ses données. */
  readonly appPrete: boolean;
  /** Le dernier temps a fini de jouer ; on tient peut-être sa dernière image. */
  readonly animationFinie: boolean;
  /** `prefers-reduced-motion` : un fondu, aucun mouvement. */
  readonly reduit: boolean;
}

export function modeleInitial(options: {
  reduit: boolean;
  appPrete?: boolean;
}): ModeleEntree {
  return {
    etat: "idle",
    appPrete: options.appPrete ?? false,
    animationFinie: false,
    reduit: options.reduit,
  };
}

/** L'état qui suit, quand un temps se termine normalement. */
const SUIVANT: Partial<Record<EtatEntree, EtatEntree>> = {
  poser: "approche",
  approche: "traversee",
};

export function reduire(m: ModeleEntree, e: EvenementEntree): ModeleEntree {
  // `done` est absorbant. Une transition finie ne se rejoue pas toute seule.
  if (m.etat === "done") return m;

  switch (e.type) {
    case "demarrer":
      if (m.etat !== "idle") return m;
      // ⚠️ Sous `prefers-reduced-motion`, on ne joue NI `poser` NI `approche` :
      // ce sont les deux temps qui bougent. On entre directement dans la
      // traversée, qui se réduit alors à un fondu.
      return { ...m, etat: m.reduit ? "traversee" : "poser" };

    case "finAnimation": {
      // Un `animationend` d'un autre temps que celui en cours est du bruit.
      if (e.temps !== m.etat) return m;
      const suivant = SUIVANT[m.etat];
      if (suivant) return { ...m, etat: suivant };
      // Fin du dernier temps : on ne sort que si l'app a répondu.
      return m.appPrete
        ? { ...m, etat: "done", animationFinie: true }
        : { ...m, animationFinie: true };
    }

    case "appPrete":
      // Elle peut arriver AVANT le démarrage (app déjà chargée) : on la retient.
      return m.animationFinie
        ? { ...m, appPrete: true, etat: "done" }
        : { ...m, appPrete: true };

    case "interrompre":
    case "expiration":
      // ⚠️ On ne sort PAS de `idle` par une tape : la transition n'a pas
      // commencé, il n'y a rien à sauter, et `done` empêcherait de la jouer.
      if (m.etat === "idle") return m;
      return { ...m, etat: "done" };
  }
}

/** Le temps en cours porte-t-il une animation dont il faut attendre la fin ? */
export function attendUneAnimation(m: ModeleEntree): boolean {
  return m.etat === "poser" || m.etat === "approche" || m.etat === "traversee";
}
