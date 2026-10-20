import { getDbBrute } from "../db";
import { isTauri } from "../repo";
import { remettreEnOrdre, type BaseLocale } from "./local";
import { TABLES_SYNC } from "./scope";

/**
 * La base remise en ordre au lancement, dans la fenêtre PRINCIPALE seulement
 * (`main.tsx`) : drapeau `applying` oublié, base restaurée à republier. Le
 * pourquoi est sur `remettreEnOrdre` (`local.ts`).
 *
 * ⚠️ Hors d'`AuthGate`, comme la sauvegarde quotidienne : un drapeau resté levé
 * fait perdre les écritures à la file d'envoi même SANS compte connecté — elles
 * ne partiraient pas à la connexion suivante.
 */
export async function remettreLaBaseEnOrdre(): Promise<void> {
  if (!isTauri) return;
  try {
    const db = (await getDbBrute()) as unknown as BaseLocale;
    const { restauree } = await remettreEnOrdre(db, TABLES_SYNC);
    if (restauree) console.info("synchronisation : base restaurée, toutes les lignes remises en file");
  } catch (e) {
    console.error("remise en ordre de la base au démarrage", e);
  }
}
