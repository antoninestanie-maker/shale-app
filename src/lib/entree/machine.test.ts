import { describe, expect, it } from "vitest";
import {
  attendUneAnimation,
  modeleInitial,
  reduire,
  type EtatEntree,
  type EvenementEntree,
  type ModeleEntree,
} from "./machine";

/** Rejoue une suite d'événements et rend l'état final. */
function jouer(m: ModeleEntree, ...evenements: EvenementEntree[]): ModeleEntree {
  return evenements.reduce(reduire, m);
}

/** Le `animationend` du temps en cours. */
const fin = (temps: EtatEntree): EvenementEntree => ({ type: "finAnimation", temps });

describe("machine de la transition d'entrée", () => {
  it("déroulé nominal : les trois temps s'enchaînent, dans l'ordre", () => {
    let m = modeleInitial({ reduit: false });
    expect(m.etat).toBe("idle");

    m = reduire(m, { type: "demarrer" });
    expect(m.etat).toBe("poser");

    m = reduire(m, fin("poser"));
    expect(m.etat).toBe("approche");

    m = reduire(m, fin("approche"));
    expect(m.etat).toBe("traversee");

    // L'app a répondu pendant que ça jouait : la fin du dernier temps sort.
    m = reduire(m, { type: "appPrete" });
    m = reduire(m, fin("traversee"));
    expect(m.etat).toBe("done");
  });

  it("l'app prête AVANT l'animation ne raccourcit rien", () => {
    let m = modeleInitial({ reduit: false });
    m = jouer(m, { type: "appPrete" }, { type: "demarrer" });
    // Les trois temps jouent quand même, en entier.
    expect(m.etat).toBe("poser");
    m = reduire(m, fin("poser"));
    expect(m.etat).toBe("approche");
    m = reduire(m, fin("approche"));
    expect(m.etat).toBe("traversee");
    m = reduire(m, fin("traversee"));
    expect(m.etat).toBe("done");
  });

  it("l'app prête APRÈS l'animation : on tient la dernière image, sans rallonger", () => {
    let m = modeleInitial({ reduit: false });
    m = jouer(m, { type: "demarrer" }, fin("poser"), fin("approche"), fin("traversee"));

    // L'animation est finie mais l'app n'a pas répondu : on ne sort pas.
    expect(m.animationFinie).toBe(true);
    expect(m.etat).toBe("traversee");

    m = reduire(m, { type: "appPrete" });
    expect(m.etat).toBe("done");
  });

  it("une tape saute à l'état final, depuis n'importe quel temps", () => {
    for (const avant of [
      [] as EvenementEntree[],
      [fin("poser")],
      [fin("poser"), fin("approche")],
    ]) {
      const m = jouer(
        modeleInitial({ reduit: false }),
        { type: "demarrer" },
        ...avant,
        { type: "interrompre" },
      );
      expect(m.etat).toBe("done");
    }
  });

  it("une tape avant le démarrage ne condamne pas la transition", () => {
    // Sinon un clic malheureux sur le bouton « Se connecter » ferait sauter
    // l'entrée entière, sans que personne comprenne pourquoi.
    let m = reduire(modeleInitial({ reduit: false }), { type: "interrompre" });
    expect(m.etat).toBe("idle");
    m = reduire(m, { type: "demarrer" });
    expect(m.etat).toBe("poser");
  });

  it("le minuteur de sécurité force l'état final, même app muette", () => {
    const m = jouer(
      modeleInitial({ reduit: false }),
      { type: "demarrer" },
      fin("poser"),
      { type: "expiration" },
    );
    expect(m.etat).toBe("done");
  });

  it("⚠️ prefers-reduced-motion : la machine ATTEINT quand même son état final", () => {
    // C'est le défaut le plus probable de tout ce chantier. La règle globale
    // d'`index.css` écrase `animation-duration` sur `*` ; une machine qui
    // attendrait la fin de `poser` ou d'`approche` — qui ne sont jamais joués
    // ici — resterait bloquée derrière un logo.
    let m = modeleInitial({ reduit: true });
    m = reduire(m, { type: "demarrer" });
    expect(m.etat).toBe("traversee"); // ni poser ni approche

    m = reduire(m, fin("traversee"));
    expect(m.etat).toBe("traversee"); // l'app n'a pas encore répondu
    m = reduire(m, { type: "appPrete" });
    expect(m.etat).toBe("done");
  });

  it("prefers-reduced-motion avec l'app déjà prête : un seul temps, puis fini", () => {
    const m = jouer(
      modeleInitial({ reduit: true, appPrete: true }),
      { type: "demarrer" },
      fin("traversee"),
    );
    expect(m.etat).toBe("done");
  });

  it("un animationend d'un AUTRE temps est ignoré", () => {
    // Le piège des deux jeux de keyframes alternés : un `animationend` en
    // retard, venu du temps précédent, ferait sauter un temps entier.
    let m = jouer(modeleInitial({ reduit: false }), { type: "demarrer" });
    expect(m.etat).toBe("poser");

    m = reduire(m, fin("approche")); // en retard, ou en avance : du bruit
    expect(m.etat).toBe("poser");
    m = reduire(m, fin("traversee"));
    expect(m.etat).toBe("poser");

    m = reduire(m, fin("poser"));
    expect(m.etat).toBe("approche");
  });

  it("« done » est absorbant : plus rien ne la relance", () => {
    const fini = jouer(
      modeleInitial({ reduit: false }),
      { type: "demarrer" },
      { type: "interrompre" },
    );
    for (const e of [
      { type: "demarrer" },
      fin("poser"),
      { type: "appPrete" },
      { type: "expiration" },
    ] as EvenementEntree[]) {
      expect(reduire(fini, e)).toBe(fini);
    }
  });

  it("dit quand elle attend une animation, et quand elle n'attend plus rien", () => {
    const m = modeleInitial({ reduit: false });
    expect(attendUneAnimation(m)).toBe(false);
    expect(attendUneAnimation(reduire(m, { type: "demarrer" }))).toBe(true);
    expect(
      attendUneAnimation(jouer(m, { type: "demarrer" }, { type: "interrompre" })),
    ).toBe(false);
  });

  it("ne mute jamais le modèle qu'on lui donne", () => {
    const m = modeleInitial({ reduit: false });
    const copie = { ...m };
    reduire(m, { type: "demarrer" });
    expect(m).toEqual(copie);
  });
});
