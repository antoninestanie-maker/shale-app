// Tonalités du Human Benchmark (test de mémoire visuelle) : une note par case,
// façon « Simon ». Purement du FEEDBACK de jeu — aucun réglage, aucune
// bibliothèque, aucune persistance : le système d'ambiance sonore de l'app a été
// retiré le 2026-07-23 et ne doit pas revenir par cette porte.
//
// Contraintes WKWebView : un AudioContext ne démarre QUE sur un geste
// utilisateur. `unlockTones()` est donc appelé depuis le clic « Démarrer ».

let ctx: AudioContext | null = null;

type Ctor = typeof AudioContext;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) {
    try {
      ctx = new C();
    } catch {
      return null; // pas d'audio disponible : le test reste jouable en silence
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** À appeler sur un geste utilisateur (clic « Démarrer ») pour armer l'audio. */
export function unlockTones(): void {
  getCtx();
}

/**
 * Gamme pentatonique majeure (do) sur ~2 octaves : 9 notes qui sonnent juste
 * quelles que soient leur ordre — une séquence aléatoire reste musicale.
 */
export const TILE_FREQS = [
  261.63, // do4
  293.66, // ré4
  329.63, // mi4
  392.0, // sol4
  440.0, // la4
  523.25, // do5
  587.33, // ré5
  659.25, // mi5
  783.99, // sol5
];

/**
 * Note courte, enveloppe douce (pas de « clic » de coupure).
 * `when` = décalage en secondes pour enchaîner des notes sans setTimeout.
 */
export function playTone(freq: number, ms = 240, when = 0, peak = 0.16): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const dur = ms / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  // exponentialRamp n'accepte pas 0 : on part/finit sur une valeur infime.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/** Note d'une case (index 0-8), bornée au cas où la grille changerait. */
export function playTile(index: number, ms = 240): void {
  const f = TILE_FREQS[index % TILE_FREQS.length];
  if (f) playTone(f, ms);
}

/** Erreur : deux notes basses descendantes. */
export function playError(): void {
  playTone(174.61, 180, 0, 0.14); // fa2
  playTone(130.81, 320, 0.13, 0.14); // do2
}

/** Niveau réussi : petit arpège ascendant. */
export function playLevelUp(): void {
  playTone(523.25, 110, 0, 0.12);
  playTone(659.25, 110, 0.08, 0.12);
  playTone(783.99, 200, 0.16, 0.12);
}
