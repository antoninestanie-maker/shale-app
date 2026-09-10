// ─────────────────────────────────────────────────────────────────────────────
// Le dessin du document — et rien d'autre.
//
// ⚠️ CE FICHIER NE DÉCIDE DE RIEN. Ce qui s'imprime est décidé par
// `document.ts`, qui est pur et testé ; ici on ne fait que poser du texte à des
// coordonnées. C'est la seule façon de rendre le CONTENU LÉGAL vérifiable : un
// test ne peut pas lire un PDF, mais il peut lire un `DocumentImprimable`.
//
// ⭐ L'APERÇU À L'ÉCRAN EST CE PDF, PAS UNE SECONDE MISE EN PAGE. Le cahier des
// charges demandait « le même code que le PDF, pas deux mises en page à
// maintenir ». La façon la plus sûre d'y arriver n'est pas de partager un
// composant : c'est de n'avoir qu'un seul rendu, et de l'AFFICHER. On produit
// donc les octets, et l'écran les montre dans un `<iframe>`. Aucune divergence
// n'est exprimable.
//
// ⚠️ POURQUOI pdf-lib, ET POURQUOI C'EST LA SEULE DÉPENDANCE AJOUTÉE.
// L'impression système (`window.print`) ne permet pas d'embarquer le XML
// Factur-X en pièce jointe — or c'est tout l'intérêt du format. Une caisse Rust
// ferait le travail sur le bureau mais n'existerait pas sur iOS. pdf-lib est du
// JS pur (ses quatre dépendances transitives aussi), donc valable sur les trois
// plateformes.
//
// ⚠️⚠️ CE N'EST PAS UN PDF/A-3 CERTIFIÉ. Voir la réserve, en toutes lettres,
// dans `facturx.ts`. Le XML est conforme ; le conteneur ne l'est pas encore.
// ─────────────────────────────────────────────────────────────────────────────
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { Invoice, InvoiceIssuer, InvoiceLine, InvoiceParty } from "../../types";
import { documentImprimable, type DocumentImprimable } from "./document";
import { NOM_FICHIER_FACTURX, PROFIL_BASIC, facturxXml } from "./facturx";

/** A4 en points PostScript. */
const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 48;

/** Gris du corps de texte — le PDF est imprimé, il ne suit aucun thème. */
const ENCRE = rgb(0.1, 0.11, 0.13);
const ENCRE_PALE = rgb(0.45, 0.47, 0.52);
const FILET = rgb(0.82, 0.83, 0.86);

interface Curseur {
  page: PDFPage;
  y: number;
}

/**
 * ⚠️ Les polices STANDARD (Helvetica) sont en WinAnsi, qui ne couvre pas tout.
 * Un caractère hors jeu fait LEVER pdf-lib au moment du dessin — donc l'échec
 * arrive à l'émission, sur un document que l'utilisateur croyait prêt. On
 * remplace plutôt que d'échouer : un tiret cadratin devient un tiret, une
 * espace insécable une espace, et l'inconnu un point d'interrogation.
 *
 * Incorporer une police complète réglerait le fond, mais ajouterait ~300 ko à
 * chaque PDF et une police à embarquer dans le bundle. Hors périmètre.
 */
export function assainir(texte: string): string {
  return texte
    .replace(/[‐-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[   ]/g, " ")
    .replace(/€/g, "EUR")
    .replace(/[^\x20-\xFF]/g, "?");
}

function texte(
  c: Curseur,
  font: PDFFont,
  s: string,
  options: { x?: number; taille?: number; couleur?: typeof ENCRE; alignerDroite?: number } = {},
) {
  const taille = options.taille ?? 9;
  const valeur = assainir(s);
  let x = options.x ?? MARGE;
  if (options.alignerDroite !== undefined)
    x = options.alignerDroite - font.widthOfTextAtSize(valeur, taille);
  c.page.drawText(valeur, { x, y: c.y, size: taille, font, color: options.couleur ?? ENCRE });
}

/** Découpe un texte pour qu'il tienne dans `largeur`. */
function couper(font: PDFFont, s: string, taille: number, largeur: number): string[] {
  const mots = assainir(s).split(/\s+/);
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, taille) > largeur && courante) {
      lignes.push(courante);
      courante = mot;
    } else courante = essai;
  }
  if (courante) lignes.push(courante);
  return lignes.length ? lignes : [""];
}

/**
 * Produit le PDF d'un document, XML Factur-X embarqué quand il y a lieu.
 *
 * Rend les octets — c'est l'appelant qui décide d'en faire un aperçu ou un
 * fichier.
 */
export async function pdfDuDocument(
  facture: Invoice,
  lignes: readonly InvoiceLine[],
  destinataire: InvoiceParty | null,
  emetteur: InvoiceIssuer | null,
  locale = "fr-FR",
): Promise<Uint8Array> {
  const doc = documentImprimable(facture, lignes, destinataire, emetteur, locale);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([LARGEUR, HAUTEUR]);
  const c: Curseur = { page, y: HAUTEUR - MARGE };
  const droite = LARGEUR - MARGE;

  // ── En-tête ───────────────────────────────────────────────────────────────
  texte(c, gras, doc.titre.toUpperCase(), { taille: 20 });
  if (doc.numero) texte(c, gras, doc.numero, { taille: 14, alignerDroite: droite });
  c.y -= 26;

  if (doc.objet) {
    texte(c, regular, doc.objet, { taille: 10, couleur: ENCRE_PALE });
    c.y -= 18;
  }

  // ── Les deux parties, côte à côte ─────────────────────────────────────────
  const hautParties = c.y;
  const colonneDroite = MARGE + 280;

  texte(c, gras, "ÉMETTEUR", { taille: 7, couleur: ENCRE_PALE });
  texte(c, gras, "CLIENT", { taille: 7, couleur: ENCRE_PALE, x: colonneDroite });
  c.y -= 13;

  const gaucheY = ecrireBloc(c, regular, gras, doc.emetteur, MARGE, c.y);
  const droiteY = ecrireBloc(c, regular, gras, doc.destinataire, colonneDroite, hautParties - 13);
  c.y = Math.min(gaucheY, droiteY) - 16;

  // ── Dates ─────────────────────────────────────────────────────────────────
  const dates = [
    doc.dateEmission ? `Date d'émission : ${doc.dateEmission}` : "",
    doc.dateEcheance ? `Échéance : ${doc.dateEcheance}` : "",
  ].filter(Boolean);
  for (const d of dates) {
    texte(c, regular, d, { taille: 9 });
    c.y -= 12;
  }
  c.y -= 8;

  // ── Le tableau des lignes ─────────────────────────────────────────────────
  const colQte = MARGE + 300;
  const colPu = MARGE + 360;
  const colTaux = MARGE + 440;

  page.drawLine({
    start: { x: MARGE, y: c.y + 10 },
    end: { x: droite, y: c.y + 10 },
    thickness: 0.7,
    color: FILET,
  });
  texte(c, gras, "DÉSIGNATION", { taille: 7, couleur: ENCRE_PALE });
  texte(c, gras, "QTÉ", { taille: 7, couleur: ENCRE_PALE, alignerDroite: colQte + 40 });
  texte(c, gras, "PRIX U.", { taille: 7, couleur: ENCRE_PALE, alignerDroite: colPu + 60 });
  if (!doc.franchise)
    texte(c, gras, "TVA", { taille: 7, couleur: ENCRE_PALE, alignerDroite: colTaux + 40 });
  texte(c, gras, "TOTAL HT", { taille: 7, couleur: ENCRE_PALE, alignerDroite: droite });
  c.y -= 6;
  page.drawLine({
    start: { x: MARGE, y: c.y },
    end: { x: droite, y: c.y },
    thickness: 0.7,
    color: FILET,
  });
  c.y -= 14;

  for (const l of doc.lignes) {
    // ⚠️ Saut de page AVANT d'écrire, pas après : une ligne écrite à y négatif
    // disparaît sans erreur, et le total qui suit paraît faux.
    if (c.y < MARGE + 140) {
      page = pdf.addPage([LARGEUR, HAUTEUR]);
      c.page = page;
      c.y = HAUTEUR - MARGE;
    }
    const morceaux = couper(regular, l.description, 9, 290);
    texte(c, regular, morceaux[0], { taille: 9 });
    texte(c, regular, l.quantite, { taille: 9, alignerDroite: colQte + 40 });
    texte(c, regular, l.prixUnitaire, { taille: 9, alignerDroite: colPu + 60 });
    if (!doc.franchise)
      texte(c, regular, l.taux, { taille: 9, alignerDroite: colTaux + 40 });
    texte(c, regular, l.totalHt, { taille: 9, alignerDroite: droite });
    c.y -= 12;
    for (const suite of morceaux.slice(1)) {
      texte(c, regular, suite, { taille: 9, couleur: ENCRE_PALE });
      c.y -= 11;
    }
    c.y -= 3;
  }

  // ── Totaux ────────────────────────────────────────────────────────────────
  c.y -= 6;
  c.page.drawLine({
    start: { x: MARGE + 300, y: c.y + 8 },
    end: { x: droite, y: c.y + 8 },
    thickness: 0.7,
    color: FILET,
  });
  texte(c, regular, "Total HT", { taille: 9, x: MARGE + 300 });
  texte(c, regular, doc.totalHt, { taille: 9, alignerDroite: droite });
  c.y -= 13;

  // ⭐ La ventilation PAR TAUX, pas un total de TVA : c'est ce que la loi exige.
  if (!doc.franchise)
    for (const v of doc.ventilation.filter((x) => x.tauxE4 > 0)) {
      texte(c, regular, `TVA ${(v.tauxE4 / 100).toFixed(2)} %`, {
        taille: 9,
        x: MARGE + 300,
        couleur: ENCRE_PALE,
      });
      texte(c, regular, doc.totalTva, { taille: 9, alignerDroite: droite, couleur: ENCRE_PALE });
      c.y -= 13;
    }

  texte(c, gras, "Total TTC", { taille: 11, x: MARGE + 300 });
  texte(c, gras, doc.totalTtc, { taille: 11, alignerDroite: droite });
  c.y -= 24;

  // ── Règlement et mentions ─────────────────────────────────────────────────
  for (const r of doc.reglement) {
    texte(c, regular, r, { taille: 8, couleur: ENCRE_PALE });
    c.y -= 11;
  }
  if (doc.reglement.length) c.y -= 6;

  for (const m of doc.mentions) {
    for (const morceau of couper(regular, m, 8, droite - MARGE)) {
      if (c.y < MARGE) {
        page = pdf.addPage([LARGEUR, HAUTEUR]);
        c.page = page;
        c.y = HAUTEUR - MARGE;
      }
      texte(c, regular, morceau, { taille: 8, couleur: ENCRE_PALE });
      c.y -= 10;
    }
  }

  // ── Le XML Factur-X, en pièce jointe ──────────────────────────────────────
  const xml = facturxXml(facture, lignes, destinataire, emetteur);
  if (xml) {
    await pdf.attach(new TextEncoder().encode(xml), NOM_FICHIER_FACTURX, {
      mimeType: "text/xml",
      description: `Factur-X ${PROFIL_BASIC}`,
      // `Alternative` est la relation prescrite par la norme : le XML n'est pas
      // un supplément, c'est la même facture sous une autre forme.
      afRelationship: "Alternative" as never,
    });
  }

  pdf.setTitle(assainir(`${doc.titre} ${doc.numero}`.trim()));
  pdf.setProducer("Shale");
  pdf.setCreator("Shale");

  return pdf.save();
}

function ecrireBloc(
  c: Curseur,
  regular: PDFFont,
  gras: PDFFont,
  b: DocumentImprimable["emetteur"],
  x: number,
  yDepart: number,
): number {
  const sauve = c.y;
  c.y = yDepart;
  texte(c, gras, b.nom, { taille: 10, x });
  c.y -= 12;
  for (const l of b.lignes) {
    texte(c, regular, l, { taille: 8, x, couleur: ENCRE_PALE });
    c.y -= 10;
  }
  for (const i of b.identifiants) {
    texte(c, regular, i, { taille: 8, x, couleur: ENCRE_PALE });
    c.y -= 10;
  }
  const fin = c.y;
  c.y = sauve;
  return fin;
}
