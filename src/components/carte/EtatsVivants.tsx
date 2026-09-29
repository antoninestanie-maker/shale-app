import type { Agencement } from "../../lib/carte";
import type { EtatVivant } from "../../lib/carteEtat";
import { formatDate, formatNumber, t } from "../../lib/i18n";
import { CaseACocher, useCochesOptimistes } from "../CaseACocher";
import { IconFlame } from "../icons";

/**
 * ⭐ L'ÉTAT VIVANT DES NŒUDS TYPÉS, POSÉ PAR-DESSUS LE SVG — dans l'éditeur SEULEMENT.
 *
 * Chantier du 2026-09-29. La coche d'une tâche, son échéance (rouge si elle
 * est passée), la série d'une habitude, le pourcentage d'une étape : tout cela
 * vient des DONNÉES, relues à chaque affichage (`lib/carteEtat.ts`). Rien n'est
 * dessiné dans la chaîne SVG — c'est elle qui part dans la note et dans
 * l'export, et une image figée qui porterait une coche mentirait dès la
 * première tâche décochée ailleurs. D'où cette couche à part, en HTML, posée
 * dans le même conteneur transformé que le SVG : elle suit le zoom et le
 * panoramique sans un calcul de plus, comme le champ d'édition.
 *
 * ⚠️ `pointer-events-none` partout SAUF la case : une pastille ne doit jamais
 * voler le glisser d'un nœud. La case, elle, arrête son `pointerdown` — sinon
 * cocher démarrerait aussi un déplacement.
 */

/** 'YYYY-MM-DD' → « 20 sept. ». À MIDI heure locale, jamais `new Date(iso)` (PIEGES § 4.3 bis). */
function dateCourte(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  return formatDate(new Date(a, m - 1, j, 12), { day: "numeric", month: "short" });
}

const PASTILLE =
  "pointer-events-none absolute flex h-4 items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 text-[10px] font-semibold leading-none";

export default function EtatsVivants(props: {
  agencement: Agencement;
  etats: ReadonlyMap<string, EtatVivant>;
  /** Cocher / décocher une tâche — le même `basculerTache` que partout. Absent : lecture seule. */
  onCocher?: (etat: EtatVivant, fait: boolean) => Promise<unknown>;
}) {
  const { agencement, etats, onCocher } = props;
  const { etat: etatCoche, basculer } = useCochesOptimistes();

  return (
    <>
      {[...etats].map(([id, e]) => {
        const b = agencement.boites.get(id);
        if (!b) return null;
        const pastilles: { cle: string; contenu: React.ReactNode; alerte?: boolean; reussi?: boolean }[] = [];
        if (e.echeance && !(e.type === "tache" && e.fait) && !e.acheve) {
          pastilles.push({ cle: "echeance", contenu: dateCourte(e.echeance), alerte: e.enRetard });
        }
        if (e.type === "habitude") {
          pastilles.push({
            cle: "serie",
            reussi: (e.serie ?? 0) > 0,
            contenu: (
              <>
                <IconFlame className="h-2.5 w-2.5" /> {t("{n} j", { n: e.serie ?? 0 })}
              </>
            ),
          });
        }
        if (e.pct != null && e.type !== "tache" && e.type !== "habitude") {
          pastilles.push({
            cle: "pct",
            reussi: e.acheve,
            contenu: formatNumber(e.pct / 100, { style: "percent", maximumFractionDigits: 0 }),
          });
        }
        const faite = e.type === "tache" && !e.recurrente && e.tache ? etatCoche(`t${e.tache.id}`, !!e.fait) : false;
        return (
          <div key={id}>
            {/* La case d'une tâche ponctuelle, SUR l'icône de type. */}
            {e.type === "tache" && !e.recurrente && e.tache && onCocher && (
              <div
                className="absolute flex items-center justify-center"
                style={{ left: b.x + 6, top: b.y + b.h / 2 - 9, width: 18, height: 18 }}
                onPointerDown={(ev) => ev.stopPropagation()}
                onDoubleClick={(ev) => ev.stopPropagation()}
              >
                <CaseACocher
                  taille="sm"
                  cochee={faite}
                  libelle={e.tache.label}
                  tip={faite ? t("Marquer à faire") : t("Marquer faite")}
                  onBascule={() => void basculer(`t${e.tache!.id}`, faite, (fait) => onCocher(e, fait))}
                />
              </div>
            )}
            {/* Le pourcentage d'une étape : une jauge fine au pied de la boîte. */}
            {e.pct != null && e.type !== "tache" && e.type !== "habitude" && (
              <div
                className="pointer-events-none absolute overflow-hidden rounded-full bg-overlay-2"
                style={{ left: b.x + 9, top: b.y + b.h - 5, width: b.w - 18, height: 2 }}
              >
                <div
                  className={e.acheve ? "h-full bg-success" : "h-full bg-[image:var(--gradient-brand)]"}
                  style={{ width: `${Math.max(0, Math.min(100, e.pct))}%` }}
                />
              </div>
            )}
            {/* Les pastilles, accrochées au coin haut-droit, en file. */}
            {pastilles.length > 0 && (
              <div
                className="pointer-events-none absolute flex gap-1"
                style={{ left: b.x + b.w - 6, top: b.y, transform: "translate(-100%, -50%)" }}
              >
                {pastilles.map((p) => (
                  <span
                    key={p.cle}
                    className={`${PASTILLE} static ${
                      p.alerte
                        ? "border-red/40 bg-surface text-red"
                        : p.reussi
                          ? "border-success/40 bg-surface text-success"
                          : "border-border bg-surface text-text-dim"
                    }`}
                  >
                    {p.contenu}
                  </span>
                ))}
              </div>
            )}
            {faite && (
              // Une tâche faite : son titre se barre, comme dans la feuille de route.
              <div
                className="pointer-events-none absolute bg-text-dim/70"
                style={{ left: b.x + 28, top: b.y + b.h / 2, width: b.w - 40, height: 1 }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
