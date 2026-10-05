// ─────────────────────────────────────────────────────────────────────────────
// Le petit catalogue de flux RSS livré avec l'app, par grand thème, pour les
// sujets du brief. L'utilisateur coche ceux qu'il veut, ou ajoute ses URL.
//
// ⚠️ Proposition soumise à Antonin (cahier des charges § 9.3), à l'arrêt de la
// phase C. Chaque adresse a été VÉRIFIÉE le 2026-09-29 : réponse 200, un vrai
// flux (RSS, Atom ou RDF), et le lecteur du serveur (`coeur/flux.ts`) en tire
// des articles. Les Échos a été écarté (403). Deux adresses sont celles APRÈS
// redirection (franceinfo, The Guardian culture) : le serveur suit trois sauts
// au plus, mais autant ne pas en dépendre.
// ─────────────────────────────────────────────────────────────────────────────

export interface FluxCatalogue {
  nom: string;
  url: string;
  langue: "fr" | "en";
}

export interface ThemeCatalogue {
  /** Clé stable ; le libellé passe par `t()` à l'affichage. */
  id: "actualite" | "tech" | "economie" | "science" | "sport" | "culture";
  libelle: string;
  flux: readonly FluxCatalogue[];
}

export const CATALOGUE_FLUX: readonly ThemeCatalogue[] = [
  {
    id: "actualite",
    libelle: "Actualité",
    flux: [
      { nom: "Le Monde — À la une", url: "https://www.lemonde.fr/rss/une.xml", langue: "fr" },
      { nom: "franceinfo", url: "https://www.franceinfo.fr/titres.rss", langue: "fr" },
      { nom: "Le Monde — International", url: "https://www.lemonde.fr/international/rss_full.xml", langue: "fr" },
      { nom: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", langue: "en" },
      { nom: "The Guardian — World", url: "https://www.theguardian.com/world/rss", langue: "en" },
    ],
  },
  {
    id: "tech",
    libelle: "Tech et IA",
    flux: [
      { nom: "Le Monde — Pixels", url: "https://www.lemonde.fr/pixels/rss_full.xml", langue: "fr" },
      { nom: "Numerama", url: "https://www.numerama.com/feed/", langue: "fr" },
      { nom: "The Verge", url: "https://www.theverge.com/rss/index.xml", langue: "en" },
      { nom: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", langue: "en" },
      { nom: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", langue: "en" },
    ],
  },
  {
    id: "economie",
    libelle: "Économie",
    flux: [
      { nom: "Le Monde — Économie", url: "https://www.lemonde.fr/economie/rss_full.xml", langue: "fr" },
      { nom: "BBC — Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", langue: "en" },
    ],
  },
  {
    id: "science",
    libelle: "Sciences",
    flux: [
      { nom: "Le Monde — Sciences", url: "https://www.lemonde.fr/sciences/rss_full.xml", langue: "fr" },
      { nom: "BBC — Science & Environment", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", langue: "en" },
      { nom: "Nature", url: "https://www.nature.com/nature.rss", langue: "en" },
    ],
  },
  {
    id: "sport",
    libelle: "Sport",
    flux: [
      { nom: "L'Équipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/", langue: "fr" },
      { nom: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", langue: "en" },
    ],
  },
  {
    id: "culture",
    libelle: "Culture",
    flux: [
      { nom: "Le Monde — Culture", url: "https://www.lemonde.fr/culture/rss_full.xml", langue: "fr" },
      { nom: "The Guardian — Culture", url: "https://www.theguardian.com/uk/culture/rss", langue: "en" },
    ],
  },
];
