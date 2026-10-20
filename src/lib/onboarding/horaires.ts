import { formatHeure, formatNumber, t } from "../i18n";
import { nomCourtDuJour, ORDRE_SEMAINE, weekdayOf } from "../logic";
import type { OptionsProfil } from "../calendrier/disponibilite";
import { minutesDeHeure, repliDuTravail, type Plage, type ReglagesHoraires } from "./reglages";

/**
 * ⭐ CE QUE LES RÉPONSES DE L'ACCUEIL VALENT POUR LE CALENDRIER — et ce qu'elles
 * disent à l'écran (2026-10-20, audit, constats 6 et 7).
 *
 * ⚠️ LE BRANCHEMENT N'AVAIT JAMAIS ÉTÉ FAIT. `repliDuTravail` existait depuis le
 * 2026-09-10, ses tests aussi, et le commit annonçait « l'accueil remplit le
 * moteur qui existait ». Mais aucun appelant de `profilDisponibilite` ne lui
 * passait d'options : `CalendarView` et `CalendarCard` gardaient le « 9 h –
 * 18 h, lundi à vendredi » codé en dur, et les blocs fixes n'étaient lus par
 * personne. Monique avait déclaré 08:30 – 17:00 et une visio le mardi et le
 * jeudi soir : le calendrier lui proposait toujours 09:00, et sa visio n'était
 * nulle part. L'accueil promettait (« C'est de là que partent les créneaux que
 * le calendrier te proposera ») ce que l'app ne faisait pas.
 *
 * Logique pure : ni base ni DOM. La lecture des réglages vit dans
 * `useHoraires.ts`.
 */

/** Les options du profil de disponibilité. Sans réglages lus : le repli d'origine. */
export function optionsDuProfil(r: ReglagesHoraires | null): OptionsProfil {
  return r ? repliDuTravail(r) : {};
}

/**
 * Les blocs fixes qui tombent CE jour-là, en 'HH:MM' — '24:00' pour une fin de
 * journée.
 *
 * ⚠️ Un bloc qui franchit minuit (22:00 → 06:00) occupe la fin de SES jours et
 * le début du LENDEMAIN de chacun d'eux (convention de `reglages.ts` : la fin
 * peut être antérieure au début).
 */
export function blocsDuJour(r: ReglagesHoraires | null, jour: string): { debut: string; fin: string }[] {
  if (!r) return [];
  const wd = weekdayOf(jour);
  const veille = (wd + 6) % 7;
  const out: { debut: string; fin: string }[] = [];
  for (const b of r.contraints) {
    const d = minutesDeHeure(b.debut);
    const f = minutesDeHeure(b.fin);
    if (d == null || f == null || d === f) continue;
    if (f > d) {
      if (b.jours.includes(wd)) out.push({ debut: b.debut, fin: b.fin });
    } else {
      if (b.jours.includes(wd)) out.push({ debut: b.debut, fin: "24:00" });
      if (b.jours.includes(veille) && f > 0) out.push({ debut: "00:00", fin: b.fin });
    }
  }
  return out;
}

/**
 * « mar., jeu. · 19:00 – 21:00 » : ce qu'un bloc ajouté montre dans sa ligne.
 * Il ne montrait que son nom (constat 7) ; on ne savait plus ce qu'on avait
 * déclaré. Les jours dans l'ordre de l'app (lundi d'abord), noms d'`Intl`.
 */
export function resumePlage(p: Plage): string {
  const jours = ORDRE_SEMAINE.filter((j) => p.jours.includes(j)).map(nomCourtDuJour).join(", ");
  return t("{jours} · {debut} – {fin}", { jours, debut: formatHeure(p.debut), fin: formatHeure(p.fin) });
}

/**
 * Ce qu'il faut DIRE d'une plage, ou `null`.
 *
 * ⚠️ Une fin avant le début n'est PAS une erreur : la plage franchit minuit
 * (équipe de nuit, garde), et `reglages.ts` le prévoit. Mais elle passait sans
 * un mot (constat 6 : « fin 07:00, début 09:00 ») — on écrit donc ce qui sera
 * compris, avec la durée, pour que la faute de frappe se voie. Une plage de
 * durée nulle, elle, ne compte rien : on le dit aussi.
 */
export function remarquePlage(p: Pick<Plage, "debut" | "fin">): string | null {
  const d = minutesDeHeure(p.debut);
  const f = minutesDeHeure(p.fin);
  if (d == null || f == null) return null;
  if (d === f) return t("Début et fin identiques : aucune heure n'est comptée.");
  if (f > d) return null;
  const minutes = 24 * 60 - d + f;
  return t("La fin est avant le début : la plage passe minuit et dure {n} h. C'est voulu ?", {
    n: formatNumber(minutes / 60, { maximumFractionDigits: 1 }),
  });
}
