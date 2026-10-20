// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { estTexteBrut, plainText, reparerEchappements, toEditorHtml } from "./richtext";

/** Ce que l'éditeur enregistre : son `innerHTML`, après qu'on a semé `body`. */
function allerRetour(body: string): string {
  const editeur = document.createElement("div");
  editeur.innerHTML = toEditorHtml(body);
  return editeur.innerHTML;
}

describe("toEditorHtml — une note se recharge telle qu'elle a été enregistrée (audit du 2026-10-20, constat 2)", () => {
  it("une note d'une ligne sans mise en forme garde son « & » après dix allers-retours", () => {
    // Ce qu'enregistre l'éditeur pour « Dupont & fils » tapé dans une note neuve.
    let corps = "Dupont &amp; fils";
    for (let i = 0; i < 10; i++) corps = allerRetour(corps);
    expect(corps).toBe("Dupont &amp; fils");
    const vu = document.createElement("div");
    vu.innerHTML = toEditorHtml(corps);
    expect(vu.textContent).toBe("Dupont & fils");
  });

  it("les chevrons et l'espace insécable tapés dans une ligne nue aussi", () => {
    const corps = "a &lt; b&nbsp;et c &gt; d";
    expect(allerRetour(corps)).toBe(corps);
  });

  it("un ancien corps en TEXTE BRUT reste échappé, sauts de ligne compris", () => {
    expect(toEditorHtml("Ligne 1\nR&D < 3 > 2")).toBe("Ligne 1<br>R&amp;D &lt; 3 &gt; 2");
    expect(toEditorHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(toEditorHtml("1 < 2")).toBe("1 &lt; 2");
  });

  it("estTexteBrut : ce que innerHTML ne produit jamais", () => {
    expect(estTexteBrut("Dupont &amp; fils")).toBe(false);
    expect(estTexteBrut("Bonjour")).toBe(false);
    expect(estTexteBrut("&#39;&#x27;")).toBe(false);
    expect(estTexteBrut("Tom & Jerry")).toBe(true);
    expect(estTexteBrut("deux\nlignes")).toBe(true);
    expect(estTexteBrut("a > b")).toBe(true);
  });
});

describe("reparerEchappements — les notes déjà abîmées en base", () => {
  it("ramène « &amp;amp; » à « & », quel que soit le nombre d'allers-retours", () => {
    expect(allerRetour("Dupont &amp;amp; fils")).toBe("Dupont &amp; fils");
    expect(allerRetour("Dupont &amp;amp;amp;amp; fils")).toBe("Dupont &amp; fils");
    expect(allerRetour("a &amp;lt; b")).toBe("a &lt; b");
  });

  it("répare aussi une note abîmée qui a reçu des balises depuis", () => {
    expect(allerRetour("Dupont &amp;amp; fils<div>suite</div>")).toBe("Dupont &amp; fils<div>suite</div>");
  });

  it("ne touche JAMAIS un attribut : une URL et le JSON d'une carte portent leurs propres &amp;", () => {
    const html = '<p><a href="https://x.fr/?a=1&amp;lt=2">lien</a></p><figure data-mindmap="{&quot;t&quot;:&quot;R&amp;amp;D&quot;}"></figure>';
    expect(reparerEchappements(html)).toBe(html);
  });

  it("un corps sain ressort identique (chemin rapide)", () => {
    const html = "<p>Rien &amp; tout</p>";
    expect(reparerEchappements(html)).toBe(html);
  });

  it("la recherche lit le texte réparé", () => {
    expect(plainText("Dupont &amp;amp; fils")).toBe("Dupont & fils");
  });
});
