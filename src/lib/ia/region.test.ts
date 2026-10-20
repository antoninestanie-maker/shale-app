// Toute fonction edge appelée par l'app passe par `runAi`, qui fixe la région.
// Ce test balaie les sources : un second appelant, écrit plus tard à côté de
// `runAi`, partirait sans région — et rien d'autre ne le dirait.
import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const estTest = (chemin: string) => /\.(test|testutil)\.tsx?$/.test(chemin);

describe("les fonctions edge et la région d'exécution", () => {
  const fichiers = Object.entries(SOURCES).filter(([chemin]) => !estTest(chemin));

  it("le balayage voit bien les sources", () => {
    expect(fichiers.length).toBeGreaterThan(100);
    expect(SOURCES["/src/lib/ia/runAi.ts"]).toContain("urlRegionale(deps.endpoint)");
  });

  it("une seule adresse de fonction edge dans l'app : celle de `ai`, dans provider.ts", () => {
    const avecAdresse = fichiers.filter(([, code]) => /\/functions\/v1\/|functions\s*\.\s*invoke\(/.test(code)).map(([chemin]) => chemin);
    expect(avecAdresse).toEqual(["/src/lib/llm/provider.ts"]);
  });

  it("le point d'accès de `ai` n'est importé que par useIa, qui le confie à runAi", () => {
    const lecteurs = fichiers
      .filter(([, code]) => /import\s*\{[^}]*\bMANAGED_ENDPOINT\b[^}]*\}/.test(code))
      .map(([chemin]) => chemin);
    expect(lecteurs).toEqual(["/src/lib/ia/useIa.ts"]);
    expect(SOURCES["/src/lib/ia/useIa.ts"]).toMatch(/runAi\(feature, payload, \{[^}]*endpoint: MANAGED_ENDPOINT/s);
  });
});
