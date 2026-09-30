// ─────────────────────────────────────────────────────────────────────────────
// Réglages → IA → les sujets du brief et les heures.
//
// Un à cinq sujets ; pour chacun, jusqu'à cinq sources : des flux du
// catalogue (`lib/ia/catalogueFlux.ts`) ou une adresse ajoutée à la main
// (https seulement — le serveur refait un contrôle bien plus strict, SSRF
// compris). Chaque changement est enregistré aussitôt.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { t } from "../../lib/i18n";
import {
  ecrireHeure,
  ecrireSujets,
  FLUX_PAR_SUJET_MAX,
  lireHeures,
  lireSujets,
  SUJETS_MAX,
  urlFluxValide,
  type SujetBrief,
} from "../../lib/ia/brief";
import { CATALOGUE_FLUX } from "../../lib/ia/catalogueFlux";
import { IconX } from "../icons";

const NOM_PAR_URL = new Map(CATALOGUE_FLUX.flatMap((th) => th.flux.map((f) => [f.url, f.nom] as const)));

function nomDeFlux(url: string): string {
  const connu = NOM_PAR_URL.get(url);
  if (connu) return connu;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Sujet({
  sujet,
  onChange,
  onRetirer,
}: {
  sujet: SujetBrief;
  onChange: (s: SujetBrief) => void;
  onRetirer: () => void;
}) {
  const [url, setUrl] = useState("");
  const plein = sujet.flux.length >= FLUX_PAR_SUJET_MAX;
  const ajouter = (u: string) => {
    const propre = u.trim();
    if (!urlFluxValide(propre) || plein || sujet.flux.includes(propre)) return;
    onChange({ ...sujet, flux: [...sujet.flux, propre] });
  };

  return (
    <div className="rounded-[10px] border border-border p-3">
      <div className="flex items-center gap-2">
        <input
          value={sujet.nom}
          maxLength={60}
          onChange={(e) => onChange({ ...sujet, nom: e.target.value })}
          placeholder={t("Nom du sujet (ex. : IA, ma ville, le rugby)")}
          aria-label={t("Nom du sujet")}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text"
        />
        <button
          type="button"
          onClick={onRetirer}
          aria-label={t("Retirer ce sujet")}
          className="rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {sujet.flux.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {sujet.flux.map((f) => (
            <li key={f} className="flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs text-text" title={f}>
              {nomDeFlux(f)}
              <button
                type="button"
                onClick={() => onChange({ ...sujet, flux: sujet.flux.filter((x) => x !== f) })}
                aria-label={t("Retirer cette source")}
                className="rounded-full p-0.5 text-text-dim hover:text-text"
              >
                <IconX className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!plein && (
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value=""
            onChange={(e) => ajouter(e.target.value)}
            aria-label={t("Ajouter une source du catalogue")}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-text"
          >
            <option value="">{t("Ajouter une source…")}</option>
            {CATALOGUE_FLUX.map((th) => (
              <optgroup key={th.id} label={t(th.libelle)}>
                {th.flux
                  .filter((f) => !sujet.flux.includes(f.url))
                  .map((f) => (
                    <option key={f.url} value={f.url}>
                      {f.nom}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ajouter(url);
              setUrl("");
            }}
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("ou l'adresse d'un flux RSS (https://…)")}
              aria-label={t("Adresse d'un flux RSS")}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text"
            />
            <button
              type="submit"
              disabled={!urlFluxValide(url)}
              className="pill border border-border px-3 text-sm text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function SujetsBrief() {
  const [sujets, setSujets] = useState<SujetBrief[] | null>(null);
  const [heures, setHeures] = useState<{ brief: string; cloture: string } | null>(null);

  useEffect(() => {
    void lireSujets().then(setSujets);
    void lireHeures().then(setHeures);
  }, []);

  if (!sujets || !heures) return null;

  const enregistrer = (s: SujetBrief[]) => {
    setSujets(s);
    // Un sujet sans nom n'est pas enregistré (il le sera dès qu'il en aura un).
    void ecrireSujets(s.filter((x) => x.nom.trim()));
  };

  return (
    <div className="mt-3 border-t border-border px-2 pt-3">
      <p className="text-sm font-medium text-text">{t("Sujets du brief")}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-text-dim">
        {t("Jusqu'à cinq sujets. Pour chacun, des sources du catalogue ou tes propres flux RSS : l'IA en tire trois à cinq points, chacun avec le lien de son article.")}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {sujets.map((s, i) => (
          <Sujet
            key={i}
            sujet={s}
            onChange={(n) => enregistrer(sujets.map((x, j) => (j === i ? n : x)))}
            onRetirer={() => enregistrer(sujets.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      {sujets.length < SUJETS_MAX && (
        <button
          type="button"
          onClick={() => setSujets([...sujets, { nom: "", flux: [] }])}
          className="mt-2 text-sm font-medium text-blue hover:underline"
        >
          {t("Ajouter un sujet")}
        </button>
      )}

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-text">
          {t("Brief à")}
          <input
            type="time"
            value={heures.brief}
            onChange={(e) => {
              setHeures({ ...heures, brief: e.target.value });
              void ecrireHeure("brief", e.target.value);
            }}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          {t("Clôture proposée à")}
          <input
            type="time"
            value={heures.cloture}
            onChange={(e) => {
              setHeures({ ...heures, cloture: e.target.value });
              void ecrireHeure("cloture", e.target.value);
            }}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
          />
        </label>
      </div>
    </div>
  );
}
