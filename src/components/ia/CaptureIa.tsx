// ─────────────────────────────────────────────────────────────────────────────
// La capture par l'IA (#5, #6) — ouverte depuis ⌘K « Capturer avec l'IA… » ou
// le bouton de la vue Tâches.
//
//   « Coller ou déposer » : un e-mail, un texte, un PDF, une image → tâches,
//     rendez-vous, notes, achats (facture d'achat en brouillon) ;
//   « Vide ta tête »      : du vrac → des tâches priorisées et étiquetées.
//
// Tout arrive dans les brouillons (`Propositions`) : rien n'est écrit avant
// « Valider ». L'aperçu de ce qui part est consultable avant l'envoi. Le texte
// du modèle est rendu en nœuds texte, jamais en HTML.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, type DragEvent } from "react";
import { formatNumber, getLang, t, tp } from "../../lib/i18n";
import {
  appliquerElement,
  appliquerTache,
  centimes,
  ecartTotaux,
  etiquettesDe,
  payloadExtraire,
  payloadViderTete,
} from "../../lib/ia/capture";
import type { ElementExtrait, SortieDe } from "../../lib/ia/contrats";
import { ACCEPTE, preparerFichier, type FichierPrepare } from "../../lib/ia/fichierCapture";
import { useEntitlements } from "../../lib/entitlements";
import { useIa } from "../../lib/ia/useIa";
import { todayStr } from "../../lib/logic";
import type { AppData } from "../../lib/types";
import { ApercuEnvoi } from "./ApercuEnvoi";
import { EtatIa, type EtatAppelIa } from "./EtatIa";
import { FenetreIa } from "./FenetreIa";
import { Propositions } from "./Propositions";

type Mode = "document" | "vrac";

const LIBELLE_TYPE: Record<ElementExtrait["type"], string> = {
  tache: "Tâche",
  evenement: "Rendez-vous",
  note: "Note",
  achat: "Achat",
};

function montant(x: number | null, devise: string): string {
  const c = centimes(x);
  return c === null ? "—" : `${formatNumber(c / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;
}

function raisonFichier(r: Exclude<FichierPrepare, { ok: true }>["raison"]): string {
  switch (r) {
    case "type":
      return t("Ce type de fichier n'est pas pris en charge : un PDF, ou une image PNG, JPEG, WebP ou HEIC.");
    case "taille":
      return t("Ce fichier est trop volumineux : 10 Mo pour un PDF, 5 Mo pour une image.");
    case "pages":
      return t("Ce PDF a plus de 20 pages : l'IA n'en lit pas davantage.");
    case "illisible":
      return t("Ce fichier n'a pas pu être lu.");
  }
}

function Element({ e, maj, finance }: { e: ElementExtrait; maj: (n: ElementExtrait) => void; finance: boolean }) {
  const ecart = ecartTotaux(e.achat);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
          {t(LIBELLE_TYPE[e.type])}
        </span>
        {e.confiance !== "haute" && (
          <span className="text-[11px] text-text-dim">{t("à vérifier")}</span>
        )}
      </div>
      <input
        value={e.titre}
        maxLength={200}
        onChange={(ev) => maj({ ...e, titre: ev.target.value })}
        aria-label={t("Titre")}
        className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text"
      />
      {(e.type === "tache" || e.type === "evenement") && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={e.date ?? ""}
            onChange={(ev) => maj({ ...e, date: ev.target.value || null })}
            aria-label={t("Date")}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
          />
          {e.type === "evenement" && (
            <input
              type="time"
              value={e.heure ?? ""}
              onChange={(ev) => maj({ ...e, heure: ev.target.value || null })}
              aria-label={t("Heure")}
              className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
            />
          )}
          {e.etiquette && <span className="text-xs text-text-dim">#{e.etiquette}</span>}
        </div>
      )}
      {e.type === "note" && e.texte && <p className="line-clamp-3 text-xs leading-relaxed text-text-dim">{e.texte}</p>}
      {e.achat && (
        <div className="rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-text">
          <p>
            <span className="font-medium">{e.achat.fournisseur}</span>
            {e.achat.numero ? ` · ${t("n° {n}", { n: e.achat.numero })}` : ""}
            {e.achat.date ? ` · ${e.achat.date}` : ""}
          </p>
          <p className="mt-1 font-mono text-[11.5px] text-text-dim">
            {t("HT {ht} · TVA {tva} · TTC {ttc}", {
              ht: montant(e.achat.ht, e.achat.devise),
              tva: montant(e.achat.tva, e.achat.devise),
              ttc: montant(e.achat.ttc, e.achat.devise),
            })}
          </p>
          {ecart !== null && (
            <p className="mt-1 font-medium text-red">
              {t("HT + TVA ne donne pas le TTC (écart de {e}) : vérifie les montants.", {
                e: montant(Math.abs(ecart) / 100, e.achat.devise),
              })}
            </p>
          )}
          <p className="mt-1 text-text-dim">
            {finance
              ? t("Deviendra une facture d'achat en brouillon, dans Finance → Facturation. Montants à vérifier.")
              : t("Deviendra une note qui garde ces montants, à vérifier.")}
          </p>
        </div>
      )}
    </div>
  );
}

export function CaptureIa({
  data,
  refresh,
  onFermer,
  onOuvrirReglages,
}: {
  data: AppData;
  refresh: () => Promise<void>;
  onFermer: () => void;
  onOuvrirReglages?: () => void;
}) {
  const { run } = useIa();
  // Finance mise de côté : un achat devient une note, pas une facture invisible.
  const finance = useEntitlements().afficheModule("finance");
  const [mode, setMode] = useState<Mode>("document");
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState<Extract<FichierPrepare, { ok: true }> | null>(null);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);
  const [etat, setEtat] = useState<EtatAppelIa>({ etat: "repos" });
  const [elements, setElements] = useState<ElementExtrait[] | null>(null);
  const [taches, setTaches] = useState<SortieDe<"vider_tete">["taches"] | null>(null);
  const entree = useRef<HTMLInputElement>(null);
  const jour = todayStr();
  const etiquettes = etiquettesDe(data);

  const payload =
    mode === "vrac"
      ? payloadViderTete(getLang(), jour, texte, etiquettes)
      : fichier
        ? {
            lang: getLang(),
            jour,
            fichier: { media_type: fichier.media_type, data: fichier.data },
            contexte: texte.slice(0, 2000),
            etiquettes,
          }
        : payloadExtraire(getLang(), jour, texte, etiquettes);

  const pret = mode === "vrac" ? texte.trim().length > 0 : !!fichier || texte.trim().length > 0;

  const choisir = async (f: File | undefined) => {
    if (!f) return;
    setErreurFichier(null);
    const p = await preparerFichier(f);
    if (p.ok) setFichier(p);
    else {
      setFichier(null);
      setErreurFichier(raisonFichier(p.raison));
    }
  };

  const envoyer = async () => {
    if (!pret) return;
    setEtat({ etat: "chargement" });
    if (mode === "vrac") {
      const r = await run("vider_tete", payloadViderTete(getLang(), jour, texte, etiquettes));
      if (r.ok) setTaches(r.data.taches);
      setEtat(r.ok ? { etat: "repos" } : { etat: "erreur", code: r.code, resetsAt: r.resetsAt ?? null });
      return;
    }
    const r = fichier
      ? await run("extraire_fichier", {
          lang: getLang(),
          jour,
          fichier: { media_type: fichier.media_type, data: fichier.data },
          contexte: texte.slice(0, 2000),
          etiquettes,
        })
      : await run("extraire", payloadExtraire(getLang(), jour, texte, etiquettes));
    if (r.ok) setElements(r.data.elements);
    setEtat(r.ok ? { etat: "repos" } : { etat: "erreur", code: r.code, resetsAt: r.resetsAt ?? null });
  };

  const fin = async () => {
    await refresh();
    onFermer();
  };

  const deposer = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    void choisir(ev.dataTransfer.files[0]);
  };

  // ── Les brouillons ──────────────────────────────────────────────────────────
  if (elements)
    return (
      <FenetreIa titre={t("Capture")} onFermer={onFermer} large>
        <Propositions
          items={elements}
          cle={(e, i) => `${i}-${e.type}`}
          vide={t("L'IA n'a rien trouvé à extraire de ce contenu.")}
          onAnnuler={onFermer}
          onValider={async (choisis) => {
            for (const e of choisis) await appliquerElement(e, jour, finance);
            await fin();
          }}
          rendu={(e, maj) => <Element e={e} maj={maj} finance={finance} />}
        />
      </FenetreIa>
    );

  if (taches)
    return (
      <FenetreIa titre={t("Vide ta tête")} onFermer={onFermer} large>
        <Propositions
          items={taches}
          cle={(x, i) => `${i}-${x.titre}`}
          vide={t("L'IA n'a trouvé aucune action dans ce texte.")}
          libelleValider={(n) => tp(n, "Créer {n} tâche", "Créer {n} tâches")}
          onAnnuler={onFermer}
          onValider={async (choisies) => {
            for (const x of choisies) await appliquerTache(x);
            await fin();
          }}
          rendu={(x, maj) => (
            <div className="flex flex-col gap-1.5">
              <input
                value={x.titre}
                maxLength={200}
                onChange={(ev) => maj({ ...x, titre: ev.target.value })}
                aria-label={t("Titre")}
                className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={x.priorite}
                  onChange={(ev) => maj({ ...x, priorite: ev.target.value as typeof x.priorite })}
                  aria-label={t("Priorité")}
                  className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                >
                  <option value="high">{t("Élevée")}</option>
                  <option value="medium">{t("Moyenne")}</option>
                  <option value="low">{t("Faible")}</option>
                </select>
                <input
                  type="date"
                  value={x.date ?? ""}
                  onChange={(ev) => maj({ ...x, date: ev.target.value || null })}
                  aria-label={t("Date")}
                  className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                />
                {x.etiquette && <span className="text-xs text-text-dim">#{x.etiquette}</span>}
              </div>
            </div>
          )}
        />
      </FenetreIa>
    );

  // ── La saisie ───────────────────────────────────────────────────────────────
  return (
    <FenetreIa titre={t("Capturer avec l'IA")} onFermer={onFermer} large>
      <div className="flex flex-col gap-4">
        <div role="tablist" className="flex gap-2">
          {(["document", "vrac"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`pill border px-4 py-1.5 text-sm transition-colors ${
                mode === m ? "border-blue/50 bg-blue/10 text-blue" : "border-border text-text-dim hover:text-text"
              }`}
            >
              {m === "document" ? t("Coller ou déposer") : t("Vide ta tête")}
            </button>
          ))}
        </div>

        {mode === "document" ? (
          <div onDragOver={(e) => e.preventDefault()} onDrop={deposer} className="flex flex-col gap-3">
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={7}
              placeholder={
                fichier
                  ? t("Une précision sur le fichier ? (facultatif)")
                  : t("Colle un e-mail, un message, un compte rendu… ou dépose un PDF ou une image ici.")
              }
              aria-label={t("Texte à analyser")}
              className="w-full rounded-[10px] border border-border bg-surface-2 p-3 text-sm leading-relaxed text-text"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => entree.current?.click()}
                className="pill border border-border bg-surface-2 px-4 py-1.5 text-sm text-text hover:border-blue/50"
              >
                {t("Choisir un fichier…")}
              </button>
              <input
                ref={entree}
                type="file"
                accept={ACCEPTE}
                className="hidden"
                onChange={(e) => void choisir(e.target.files?.[0])}
              />
              {fichier && (
                <span className="text-sm text-text">
                  {fichier.nom}
                  {fichier.pages ? ` · ${tp(fichier.pages, "{n} page", "{n} pages")}` : ""}
                  <button type="button" onClick={() => setFichier(null)} className="ml-2 text-xs text-text-dim hover:text-text">
                    {t("Retirer")}
                  </button>
                </span>
              )}
            </div>
            {erreurFichier && <p className="text-sm text-red">{erreurFichier}</p>}
          </div>
        ) : (
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={9}
            placeholder={t("Tout ce que tu as en tête, en vrac : l'IA en fait des tâches, que tu valides.")}
            aria-label={t("Ce que tu as en tête")}
            className="w-full rounded-[10px] border border-border bg-surface-2 p-3 text-sm leading-relaxed text-text"
          />
        )}

        {pret && <ApercuEnvoi payload={payload} />}
        <EtatIa etat={etat} onReessayer={() => void envoyer()} onOuvrirReglages={onOuvrirReglages} />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void envoyer()}
            disabled={!pret || etat.etat === "chargement"}
            className="pill fill-primary px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {mode === "vrac" ? t("Faire des tâches") : t("Analyser")}
          </button>
          <button
            type="button"
            onClick={onFermer}
            className="pill border border-border bg-surface-2 px-5 py-2 text-sm text-text hover:border-blue/50"
          >
            {t("Annuler")}
          </button>
        </div>
      </div>
    </FenetreIa>
  );
}
