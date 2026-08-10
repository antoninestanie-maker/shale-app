import { useCallback, useEffect, useState } from "react";

import { t } from "../lib/i18n";
import { isTauri } from "../lib/repo";
import { creer, dossier, lister, programmerRestauration, taille, type Sauvegarde } from "../lib/sauvegardes";
import { openExternal } from "../lib/auth/external";

/**
 * Sauvegardes locales : les voir, en créer une, en restaurer une.
 *
 * ⚠️ La restauration est la seule action de l'app qui remplace la base entière.
 * Elle demande donc une confirmation explicite — et surtout elle ne s'applique
 * PAS tout de suite : la base est ouverte, l'écraser sous une connexion vivante
 * corromprait son journal. Le Rust la met en place au démarrage suivant. Il faut
 * donc le DIRE, sinon l'utilisateur croit que rien ne s'est passé et recommence.
 */
export default function Sauvegardes() {
  const [liste, setListe] = useState<Sauvegarde[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [aRestaurer, setARestaurer] = useState<Sauvegarde | null>(null);
  const [aRedemarrer, setARedemarrer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async () => setListe(await lister()), []);
  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  if (!isTauri) return null;

  const agir = async (action: () => Promise<void>) => {
    setOccupe(true);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  const boutonSecondaire =
    "pill border border-border bg-surface-2 px-4 py-2 text-sm text-text transition-colors hover:border-blue/50 disabled:opacity-40";

  return (
    <section className="card p-5">
      <h2 className="hud-label">{t("sauvegardes locales")}</h2>

      <p className="mt-3 text-sm leading-relaxed text-text-dim">
        {t(
          "Une copie datée de toute ta base est faite à chaque premier lancement de la journée. Elle se relit sans mot de passe et sans réseau — c'est ce qui te protège d'une suppression accidentelle, que la synchronisation, elle, recopie fidèlement partout.",
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={occupe}
          onClick={() => agir(async () => {
            await creer("manuelle");
            await rafraichir();
          })}
          className={boutonSecondaire}
        >
          {occupe ? t("sauvegarde…") : t("Sauvegarder maintenant")}
        </button>
        <button
          type="button"
          onClick={() =>
            void dossier().then((d) => {
              if (d) openExternal(`file://${d}`);
            })
          }
          className={boutonSecondaire}
          data-tip={t("Copie ce dossier ailleurs : sur ce disque, une panne matérielle emporterait tout.")}
        >
          {t("Ouvrir le dossier")}
        </button>
      </div>

      {aRedemarrer && (
        <p className="mt-3 rounded-[10px] border border-blue/30 bg-blue/10 px-3 py-2 text-xs leading-relaxed text-blue">
          {t(
            "Restauration prête. Elle sera appliquée au prochain démarrage de Shale — quitte et relance l'app. L'état actuel sera mis de côté au passage, rien n'est définitif.",
          )}
        </p>
      )}

      {liste.length === 0 ? (
        <p className="mt-4 text-xs text-text-dim">{t("aucune sauvegarde pour l'instant")}</p>
      ) : (
        <ul className="panel-scroll mt-4 space-y-1">
          {liste.map((s) => (
            <li
              key={s.nom}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] px-2 py-2 transition-colors hover:bg-overlay"
            >
              <span className="min-w-0 basis-[13rem]">
                <span className="block truncate text-sm text-text">{s.quand}</span>
                <span className="block text-xs text-text-dim">
                  {s.motif} · {taille(s.octets)}
                </span>
              </span>
              <button
                type="button"
                disabled={occupe}
                onClick={() => setARestaurer(s)}
                className="pill shrink-0 border border-border bg-surface-2 px-3 py-1.5 text-xs text-text transition-colors hover:border-blue/50"
              >
                {t("Restaurer")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aRestaurer && (
        <div className="mt-4 rounded-[12px] border border-yellow/30 bg-yellow/10 p-4">
          <p className="text-sm text-yellow">
            {t("Remplacer toute la base par la copie du {quand} ?", { quand: aRestaurer.quand })}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-yellow">
            {t(
              "Tout ce qui a été saisi depuis sera perdu — sauf que l'état actuel est lui aussi mis de côté avant l'échange, et pourra être restauré à son tour.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={occupe}
              onClick={() =>
                agir(async () => {
                  await programmerRestauration(aRestaurer.nom);
                  setARestaurer(null);
                  setARedemarrer(true);
                })
              }
              className="pill bg-blue px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {t("Oui, restaurer")}
            </button>
            <button
              type="button"
              onClick={() => setARestaurer(null)}
              className={boutonSecondaire}
            >
              {t("Annuler")}
            </button>
          </div>
        </div>
      )}

      {erreur && (
        <p className="mt-3 rounded-[10px] border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
          {erreur}
        </p>
      )}
    </section>
  );
}
