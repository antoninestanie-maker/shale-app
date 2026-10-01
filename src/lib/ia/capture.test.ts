// Phase D : la capture. Contrôles locaux (montants, TVA, échappement), écriture
// de chaque type sur la démo (repo hors Tauri), préparation des fichiers, et
// les contrôles de sortie du serveur.
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { FONCTIONS } from "../../../../shale-site/supabase/functions/ai/coeur/fonctions.ts";
import { valider as validerServeur } from "../../../../shale-site/supabase/functions/ai/coeur/schema.ts";
import { fetchAll, fetchCalendarEvents, fetchFacturation } from "../repo";
import { appliquerElement, appliquerTache, corpsDeNote, ecartTotaux, tauxTvaE4, texteDAchat } from "./capture";
import type { ElementExtrait } from "./contrats";
import { preparerFichier, typeDe } from "./fichierCapture";

const JOUR = "2026-10-14";

function element(sur: Partial<ElementExtrait>): ElementExtrait {
  return {
    type: "tache",
    titre: "Titre",
    date: null,
    heure: null,
    priorite: null,
    etiquette: null,
    texte: null,
    achat: null,
    confiance: "haute",
    ...sur,
  };
}

const ACHAT = { fournisseur: "Imprimerie Test", numero: "F-12", date: JOUR, echeance: null, ht: 20, tva: 4, ttc: 24, devise: "EUR" as const };

describe("capture — contrôles locaux", () => {
  it("HT + TVA = TTC au centime près, sinon l'écart est signalé ; rien à contrôler s'il manque un montant", () => {
    expect(ecartTotaux(ACHAT)).toBeNull();
    expect(ecartTotaux({ ...ACHAT, ttc: 24.5 })).toBe(-50);
    expect(ecartTotaux({ ...ACHAT, ttc: 24.01 })).toBeNull(); // arrondi d'un centime toléré
    expect(ecartTotaux({ ...ACHAT, tva: null })).toBeNull();
    expect(ecartTotaux(null)).toBeNull();
  });

  it("le taux de TVA se recale sur un taux usuel, sinon il est gardé tel quel", () => {
    expect(tauxTvaE4(2000, 400)).toBe(2000);
    expect(tauxTvaE4(1000, 55)).toBe(550);
    expect(tauxTvaE4(1000, 101)).toBe(1000);
    expect(tauxTvaE4(1000, 123)).toBe(1230);
    expect(tauxTvaE4(1000, null)).toBe(0);
    expect(tauxTvaE4(null, 100)).toBe(0);
  });

  it("le texte d'une note est échappé : rien du modèle n'entre dans le DOM comme balise", () => {
    expect(corpsDeNote('Ligne <img src=x onerror="alert(1)">\n\nDeux & trois')).toBe(
      "<p>Ligne &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p><p>Deux &amp; trois</p>",
    );
    expect(corpsDeNote(null)).toBe("<p><br></p>");
  });
});

describe("capture — écriture de ce qui a été validé (démo)", () => {
  it("une tâche, un rendez-vous, une note", async () => {
    await appliquerElement(element({ type: "tache", titre: "Renvoyer le contrat", date: JOUR, priorite: "high", etiquette: "Admin" }), JOUR);
    await appliquerElement(element({ type: "evenement", titre: "Point agence", date: "2026-10-16", heure: "10:30" }), JOUR);
    await appliquerElement(element({ type: "note", titre: "Codes Wi-Fi", texte: "Réseau <b>invité</b>" }), JOUR);
    const data = await fetchAll("2000-01-01");
    const tache = data.tasks.find((x) => x.label === "Renvoyer le contrat");
    expect(tache).toMatchObject({ priority: "high", tag: "Admin", due_date: JOUR });
    const evts = await fetchCalendarEvents("2026-10-16", "2026-10-16");
    expect(evts.find((e) => e.title === "Point agence")).toMatchObject({ start_at: "10:30" });
    expect(data.notes.find((n) => n.title === "Codes Wi-Fi")?.body).toBe("<p>Réseau &lt;b&gt;invité&lt;/b&gt;</p>");
  });

  it("Finance allumée : un achat devient une facture d'achat EN BROUILLON, totaux recalculés depuis la ligne — pas repris du modèle", async () => {
    // Le modèle annonce un TTC faux (24,50) : le brouillon porte le TTC calculé (24,00).
    await appliquerElement(element({ type: "achat", titre: "Cartes de visite", achat: { ...ACHAT, ttc: 24.5 } }), JOUR, true);
    const fac = await fetchFacturation();
    const f = fac.factures.find((x) => x.objet?.startsWith("Cartes de visite") && x.objet.includes("F-12"));
    expect(f).toMatchObject({ sens: "achat", statut: "brouillon", numero: null, total_ht_cents: 2000, total_tva_cents: 400, total_ttc_cents: 2400 });
    const tiers = fac.tiers.filter((p) => p.nom === "Imprimerie Test");
    expect(tiers).toHaveLength(1);
    // Un second achat chez le même fournisseur le RETROUVE au lieu d'en créer un autre.
    await appliquerElement(element({ type: "achat", titre: "Flyers", achat: { ...ACHAT, fournisseur: "imprimerie test ", numero: null } }), JOUR, true);
    expect((await fetchFacturation()).tiers.filter((p) => p.nom.trim().toLowerCase() === "imprimerie test")).toHaveLength(1);
  });

  it("⭐ Finance mise de côté : un achat devient une NOTE qui garde les montants extraits — aucune facture ne naît dans un module absent", async () => {
    const avant = (await fetchFacturation()).factures.length;
    await appliquerElement(element({ type: "achat", titre: "Reçu taxi <b>", achat: { ...ACHAT, fournisseur: "Taxi G7", numero: null, tva: null } }), JOUR, false);
    expect((await fetchFacturation()).factures).toHaveLength(avant);
    const note = (await fetchAll("2000-01-01")).notes.find((n) => n.title === "Reçu taxi <b>");
    expect(note?.body).toContain("Taxi G7");
    expect(note?.body).toContain("24.00 EUR");
    expect(note?.body).toContain("—"); // la TVA absente reste absente, jamais calculée
    expect(note?.body).not.toContain("<b>");
    expect(texteDAchat(element({ type: "note", texte: "libre" }))).toBe("libre");
  });

  it("vider sa tête : une tâche par proposition validée", async () => {
    await appliquerTache({ titre: "Appeler la banque", priorite: "low", etiquette: null, date: null });
    const data = await fetchAll("2000-01-01");
    expect(data.tasks.find((x) => x.label === "Appeler la banque")).toMatchObject({ priority: "low", due_date: null });
  });
});

describe("capture — préparer un fichier avant l'envoi", () => {
  it("reconnaît PDF, images, HEIC ; refuse le reste", () => {
    expect(typeDe({ name: "a.pdf", type: "" })).toBe("pdf");
    expect(typeDe({ name: "IMG_0001.HEIC", type: "" })).toBe("heic");
    expect(typeDe({ name: "r.jpg", type: "image/jpeg" })).toBe("image");
    expect(typeDe({ name: "x.zip", type: "application/zip" })).toBeNull();
  });

  it("un PDF de 3 pages passe, de 21 pages non ; un faux PDF est illisible", async () => {
    const pdf = async (n: number) => {
      const d = await PDFDocument.create();
      for (let i = 0; i < n; i++) d.addPage();
      return new File([await d.save()], "doc.pdf", { type: "application/pdf" });
    };
    const ok = await preparerFichier(await pdf(3));
    expect(ok).toMatchObject({ ok: true, media_type: "application/pdf", pages: 3 });
    expect(await preparerFichier(await pdf(21))).toEqual({ ok: false, raison: "pages" });
    expect(await preparerFichier(new File(["pas un pdf"], "x.pdf", { type: "application/pdf" }))).toEqual({ ok: false, raison: "illisible" });
    expect(await preparerFichier(new File(["x"], "x.zip", { type: "application/zip" }))).toEqual({ ok: false, raison: "type" });
  });
});

describe("capture — contrôles de sortie du serveur", () => {
  const verifier = FONCTIONS.extraire.verifier!;
  it("une heure mal formée, ou un achat qui ne dit pas son type, sont rejetés (relance)", () => {
    expect(verifier({ elements: [element({ type: "evenement", heure: "25:00" })] }, {} as never, undefined)).toBeTruthy();
    expect(verifier({ elements: [element({ type: "tache", achat: ACHAT })] }, {} as never, undefined)).toBeTruthy();
    expect(verifier({ elements: [element({ type: "achat", achat: null })] }, {} as never, undefined)).toBeTruthy();
    expect(verifier({ elements: [element({ type: "evenement", heure: "09:30" }), element({ type: "achat", achat: ACHAT })] }, {} as never, undefined)).toBeNull();
  });

  it("un montant négatif ou une devise inconnue sont hors schéma", () => {
    const sortie = (achat: object) => ({ elements: [element({ type: "achat", achat: achat as never })] });
    expect(validerServeur(FONCTIONS.extraire.sortie, sortie({ ...ACHAT, ht: -5 }))).not.toEqual([]);
    expect(validerServeur(FONCTIONS.extraire.sortie, sortie({ ...ACHAT, devise: "BTC" }))).not.toEqual([]);
    expect(validerServeur(FONCTIONS.extraire.sortie, sortie(ACHAT))).toEqual([]);
  });
});
