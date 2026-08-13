/**
 * Ce qui peut mal tourner entre l'app et Supabase, et comment le nommer.
 *
 * ─── POURQUOI UNE COUCHE À PART ────────────────────────────────────────────
 * Le moteur est testé contre un serveur SIMULÉ, qui répond toujours. Le vrai
 * réseau, lui, a quatre façons distinctes d'échouer, et les confondre coûte
 * cher :
 *   • le réseau est coupé            → état NORMAL d'une app offline-first,
 *                                      rien à dire à l'utilisateur ;
 *   • le jeton a expiré (401)        → réessayer avec le MÊME jeton échouera
 *                                      indéfiniment ; il faut le renouveler ;
 *   • le serveur demande d'attendre  → réessayer plus tôt que demandé aggrave
 *     (429, 503 + Retry-After)         la situation au lieu de la résoudre ;
 *   • la requête est refusée (400,   → réessayer ne servira JAMAIS : le schéma
 *     404, 409, RLS 42501)             n'est pas joué, ou l'envoi est malformé.
 *     Une boucle de recul sur ce cas masque un bogue derrière un « hors ligne ».
 *
 * Sans cette distinction, tout finit en « sync en échec » et le planificateur
 * repart toutes les 5 minutes pour rien.
 *
 * ⚠️ `Error.cause` n'existe pas en ES2020 (cible du projet) : une erreur qui
 * porte son origine doit déclarer son propre champ. Cf. `KdfIndisponible`.
 */

/** Au-delà, la requête est considérée perdue. Une requête de sync est petite. */
const TIMEOUT_MS = 20_000;

/** Le plafond de recul du planificateur. Un serveur n'obtient pas davantage. */
const DELAI_MAX_MS = 300_000;

export abstract class ErreurSync extends Error {
  /**
   * Une nouvelle tentative a-t-elle un sens ? Faux = le problème ne guérira
   * pas tout seul, et l'UI doit le dire au lieu de tourner en boucle.
   */
  abstract readonly reessayable: boolean;

  /** Délai réclamé par le serveur. Le planificateur ne descend pas en dessous. */
  readonly delaiSuggereMs: number | null = null;

  /** L'origine, quand il y en a une. Pas `cause` : ES2020 ne l'a pas. */
  origine: unknown = null;
}

/** Réseau coupé, DNS muet, requête expirée. L'état normal d'un train. */
export class ReseauInjoignable extends ErreurSync {
  readonly reessayable = true;
  constructor(origine?: unknown) {
    super("Le serveur n'est pas joignable.");
    this.name = "ReseauInjoignable";
    this.origine = origine ?? null;
  }
}

/**
 * Le jeton d'accès n'est plus valable.
 *
 * ⚠️ Cas RÉEL et non hypothétique : Supabase émet des jetons d'une heure, et
 * `useAuth` ne les renouvelait qu'au DÉMARRAGE de l'app. Une app laissée
 * ouverte une journée synchronisait donc pendant une heure, puis récoltait un
 * 401 toutes les 90 secondes jusqu'au redémarrage — sans que rien ne le dise.
 * D'où le fournisseur de jeton (et non le jeton) passé au transport.
 */
export class SessionExpiree extends ErreurSync {
  readonly reessayable = true;
  constructor(public readonly detail: string) {
    super("La session a expiré. La synchronisation reprendra à la reconnexion.");
    this.name = "SessionExpiree";
  }
}

/** Le serveur demande d'attendre (429), ou souffle (503). */
export class ServeurOccupe extends ErreurSync {
  readonly reessayable = true;
  override readonly delaiSuggereMs: number | null;
  constructor(
    public readonly status: number,
    delaiMs: number | null,
  ) {
    super("Le serveur est momentanément saturé.");
    this.name = "ServeurOccupe";
    this.delaiSuggereMs = delaiMs;
  }
}

/**
 * La requête elle-même est refusée : schéma absent, politique RLS, corps
 * malformé. RÉESSAYER NE SERVIRA JAMAIS — et c'est précisément pourquoi il
 * faut le distinguer : cette erreur-là doit se voir, pas se diluer dans un
 * recul exponentiel silencieux.
 */
export class RequeteRefusee extends ErreurSync {
  readonly reessayable = false;
  constructor(
    public readonly status: number,
    public readonly corps: string,
  ) {
    super(`Requête refusée (${status}) : ${corps.slice(0, 200)}`);
    this.name = "RequeteRefusee";
  }
}

// ─── Lecture de `Retry-After` ────────────────────────────────────────────────

/**
 * L'en-tête accepte DEUX formes : un nombre de secondes, ou une date HTTP.
 * Ne gérer que la première laisse passer la seconde comme `NaN`, qui se
 * propage ensuite en `setTimeout(NaN)` — c'est-à-dire un rappel immédiat, soit
 * exactement l'inverse de ce que le serveur demandait.
 */
export function delaiDepuisRetryAfter(valeur: string | null, maintenantMs: number): number | null {
  if (!valeur) return null;
  const brut = valeur.trim();

  const secondes = Number(brut);
  if (Number.isFinite(secondes)) {
    if (secondes <= 0) return null;
    return Math.min(secondes * 1000, DELAI_MAX_MS);
  }

  const date = Date.parse(brut);
  if (!Number.isNaN(date)) {
    const delta = date - maintenantMs;
    return delta > 0 ? Math.min(delta, DELAI_MAX_MS) : null;
  }
  return null;
}

// ─── La requête ──────────────────────────────────────────────────────────────

/**
 * Un 401 peut aussi vouloir dire « clé API absente ». On ne distingue pas :
 * dans les deux cas la requête telle quelle ne passera pas, et le seul recours
 * automatique — renouveler le jeton — est le bon dans le cas fréquent.
 */
function estExpiration(status: number): boolean {
  return status === 401;
}

export interface OptionsRequete {
  methode?: string;
  entetes?: Record<string, string>;
  corps?: string;
  timeoutMs?: number;
}

/**
 * Une requête HTTP vers Supabase, avec ses échecs nommés.
 *
 * ⚠️ Le timeout n'est pas un luxe : sans lui, une requête partie sur un réseau
 * qui s'évanouit (Wi-Fi d'hôtel, veille du Mac) reste en attente indéfiniment.
 * Le verrou du planificateur étant tenu pendant ce temps, TOUTE synchronisation
 * ultérieure serait absorbée par ce cycle fantôme — l'app cesserait de
 * synchroniser sans jamais signaler d'erreur.
 */
export async function requete(url: string, options: OptionsRequete = {}): Promise<Response> {
  const controleur = new AbortController();
  // `AbortSignal.timeout()` ferait la même chose en une ligne, mais elle date
  // d'ES2022 et la cible du projet est ES2020.
  const minuterie = setTimeout(() => controleur.abort(), options.timeoutMs ?? TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.methode ?? "GET",
      headers: options.entetes,
      body: options.corps,
      signal: controleur.signal,
    });
  } catch (e) {
    // Coupure, DNS, CORS, ou notre propre timeout : indistinguables ici, et
    // sans conséquence — la conduite à tenir est la même dans tous les cas.
    throw new ReseauInjoignable(e);
  } finally {
    clearTimeout(minuterie);
  }

  if (res.ok) return res;

  const corps = await res.text().catch(() => "");

  if (estExpiration(res.status)) throw new SessionExpiree(corps.slice(0, 200));
  if (res.status === 429 || res.status === 503) {
    throw new ServeurOccupe(res.status, delaiDepuisRetryAfter(res.headers.get("Retry-After"), Date.now()));
  }
  // 500, 502, 504 : le serveur a un problème, il n'est pas dit qu'il persiste.
  if (res.status >= 500) throw new ServeurOccupe(res.status, null);

  throw new RequeteRefusee(res.status, corps);
}

/** Le délai à respecter avant la prochaine tentative, si l'erreur en impose un. */
export function delaiImpose(e: unknown): number | null {
  return e instanceof ErreurSync ? e.delaiSuggereMs : null;
}

/** Faux quand insister est inutile — schéma absent, politique qui refuse. */
export function vautLaPeineDeReessayer(e: unknown): boolean {
  return e instanceof ErreurSync ? e.reessayable : true;
}
