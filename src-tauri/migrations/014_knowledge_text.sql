-- Savoir : unification autour d'une seule unité de création, la NOTE.
-- Le corps d'une note contient désormais texte, liens, images et croquis
-- (data URL). Deux conséquences :
--   1. le corps peut peser plusieurs centaines de ko → la liste des fiches ne
--      doit plus le charger. On matérialise donc son TEXTE BRUT dans une
--      colonne dédiée, seule chargée pour la recherche et les extraits ;
--   2. les colonnes `kind`, `url`, `media` et `data` deviennent historiques :
--      elles sont conservées (aucune perte de données) et les fiches créées
--      avant l'unification sont converties en notes au premier chargement.
ALTER TABLE knowledge_entries ADD COLUMN text TEXT NOT NULL DEFAULT '';
