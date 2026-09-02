import { useCallback, useEffect, useMemo, useState } from "react";
import EditeurType from "./EditeurType";
import PanneauLiens from "./PanneauLiens";
import { useLiens } from "./useLiens";
import RichNoteEditor from "../RichNoteEditor";
import {
  champsDuType,
  fusionnerValeurs,
  valeursDeLObjet,
  valeursOrphelines,
  validerObjet,
} from "../../lib/objets";
import {
  createObject,
  deleteObject,
  fetchObjects,
  fetchObjectTypes,
  updateObject,
} from "../../lib/repo";
import { consommerDemande, ouvrirObjet } from "../../lib/naviguer";
import type { CustomObject, LinkKind, ObjectField, ObjectType } from "../../lib/types";
import { IconPlus, IconSliders, IconTrash } from "../icons";
import { t } from "../../lib/i18n";

/**
 * L'onglet « Objets » du Savoir.
 *
 * ⚠️ POURQUOI ICI ET PAS UN 14ᵉ MODULE — décision d'Antonin, 2026-09-02. Un
 * module de plus aurait refait tout le travail du compte de modules (app ET
 * site) pour une fonctionnalité qui est, littéralement, de la base de
 * connaissances : un « Setup de trading » ou une « Ressource » a plus à voir
 * avec une fiche du Savoir qu'avec un module à part.
 */
export default function GalerieObjets() {
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [objets, setObjets] = useState<CustomObject[]>([]);
  const [typeActif, setTypeActif] = useState<number | null>(null);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [editionType, setEditionType] = useState<ObjectType | "nouveau" | null>(null);

  const charger = useCallback(async () => {
    const [ts, os] = await Promise.all([fetchObjectTypes(), fetchObjects()]);
    setTypes(ts);
    setObjets(os);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Ouverture depuis une mention : `App.tsx` réémet l'identifiant local.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      if (id) setOuvert(id);
    };
    window.addEventListener("sb:open-object", onOpen);
    const enAttente = consommerDemande("object");
    if (enAttente) setOuvert(enAttente);
    return () => window.removeEventListener("sb:open-object", onOpen);
  }, []);

  const visibles = useMemo(
    () => (typeActif == null ? objets : objets.filter((o) => o.type_id === typeActif)),
    [objets, typeActif],
  );
  const fiche = objets.find((o) => o.id === ouvert) ?? null;

  if (fiche) {
    return (
      <FicheObjet
        objet={fiche}
        type={types.find((t) => t.id === fiche.type_id) ?? null}
        onFermer={() => setOuvert(null)}
        onChange={charger}
      />
    );
  }

  return (
    <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
      {/* Les types, en pastilles — la galerie dont parlait le cahier des charges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTypeActif(null)}
          className={`pill border px-3 py-1.5 text-xs font-medium ${
            typeActif == null
              ? "border-border-strong bg-overlay-2 text-text"
              : "border-border text-text-dim hover:text-text"
          }`}
        >
          {t("Tous")}
        </button>
        {types.map((type) => (
          <span key={type.id} className="group relative inline-flex">
            <button
              type="button"
              onClick={() => setTypeActif(type.id)}
              data-tip={t(type.name)}
              className="pill cible-tactile-ligne border px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                typeActif === type.id
                  ? {
                      borderColor: `var(--color-${type.color ?? "blue"})`,
                      backgroundColor: `color-mix(in srgb, var(--color-${type.color ?? "blue"}) 16%, transparent)`,
                      color: `var(--color-${type.color ?? "blue"})`,
                    }
                  : { borderColor: "var(--color-border)", color: "var(--color-text-dim)" }
              }
            >
              {t(type.name)}
              <span className="ml-1.5 opacity-60">
                {objets.filter((o) => o.type_id === type.id).length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditionType(type)}
              data-tip={t("Modifier ce type")}
              aria-label={t("Modifier ce type")}
              className="absolute -right-1 -top-1 rounded-full bg-surface-2 p-0.5 text-text-dim opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
            >
              <IconSliders className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setEditionType("nouveau")}
          data-tip={t("Nouveau type d'objet")}
          data-tip-sub={t("Un type décrit les champs de ses fiches.")}
          className="pill cible-tactile-ligne flex items-center gap-1 border border-dashed border-border px-3 py-1.5 text-xs text-text-dim hover:text-text"
        >
          <IconPlus className="h-3.5 w-3.5" />
          {t("Type")}
        </button>
      </div>

      {/* Les fiches */}
      <div className="mt-5 flex items-center justify-between">
        <p className="hud-label">{t("fiches")}</p>
        <button
          type="button"
          disabled={types.length === 0}
          onClick={async () => {
            const type = typeActif ?? types[0]?.id;
            if (!type) return;
            await createObject({ type_id: type, title: t("Sans titre"), body: null, field_values: {} });
            await charger();
          }}
          className="pill cible-tactile-ligne bg-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {t("+ Nouvelle fiche")}
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-4 text-sm text-text-dim">
          {types.length === 0
            ? t("Crée d'abord un type : il décrit les champs de ses fiches.")
            : t("Aucune fiche de ce type pour l'instant.")}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((o) => {
            const type = types.find((x) => x.id === o.type_id);
            const champs = champsDuType(type?.fields);
            const valeurs = valeursDeLObjet(o.field_values);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setOuvert(o.id)}
                  className="card w-full p-3 text-left"
                  style={{ borderLeft: `2px solid var(--color-${type?.color ?? "blue"})` }}
                >
                  <span className="block truncate text-sm text-text">{o.title}</span>
                  <span className="mt-1 block truncate text-xs text-text-dim">
                    {champs
                      .map((c) => valeurs[c.id])
                      .filter((v) => v !== undefined && v !== null && v !== "")
                      .slice(0, 2)
                      .join(" · ") || t(type?.name ?? "")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editionType && (
        <EditeurType
          type={editionType === "nouveau" ? null : editionType}
          objets={
            editionType === "nouveau" ? [] : objets.filter((o) => o.type_id === editionType.id)
          }
          onClose={() => setEditionType(null)}
          onSaved={charger}
        />
      )}
    </div>
  );
}

// ─── La fiche d'un objet ─────────────────────────────────────────────────────

function FicheObjet({
  objet,
  type,
  onFermer,
  onChange,
}: {
  objet: CustomObject;
  type: ObjectType | null;
  onFermer: () => void;
  onChange: () => Promise<void>;
}) {
  const champs = useMemo(() => champsDuType(type?.fields), [type?.fields]);
  const [titre, setTitre] = useState(objet.title);
  const [valeurs, setValeurs] = useState(() => valeursDeLObjet(objet.field_values));
  const [corps, setCorps] = useState(objet.body ?? "");
  const [corpsFrais, setCorpsFrais] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [confirme, setConfirme] = useState(false);
  const { rafraichir, enregistrerMentions } = useLiens("object", objet.id);

  useEffect(() => {
    let annule = false;
    void rafraichir(objet.body ?? "").then((html) => {
      if (!annule) setCorpsFrais(html);
    });
    return () => {
      annule = true;
    };
  }, [objet.id, rafraichir]); // eslint-disable-line react-hooks/exhaustive-deps

  const orphelines = valeursOrphelines(champs, valeurs);

  async function enregistrer(prochainCorps = corps) {
    const problemes = validerObjet(champs, valeurs);
    setErreurs(problemes);
    if (problemes.length) return;
    await updateObject(objet.id, {
      type_id: objet.type_id,
      title: titre.trim() || t("Sans titre"),
      body: prochainCorps,
      // ⭐ FUSION, jamais remplacement : un `JSON.stringify` du formulaire
      // effacerait les valeurs dont le champ a été retiré du type, sans un mot.
      field_values: fusionnerValeurs(valeursDeLObjet(objet.field_values), valeurs),
    });
    await enregistrerMentions(prochainCorps);
    await onChange();
  }

  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            await enregistrer();
            onFermer();
          }}
          className="pill px-3 py-1.5 text-xs text-text-dim hover:bg-overlay hover:text-text"
        >
          {t("← Retour")}
        </button>
        {type && (
          <span
            className="pill px-2.5 py-1 text-xs"
            style={{
              color: `var(--color-${type.color ?? "blue"})`,
              backgroundColor: `color-mix(in srgb, var(--color-${type.color ?? "blue"}) 14%, transparent)`,
            }}
          >
            {t(type.name)}
          </span>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!confirme) {
              setConfirme(true);
              return;
            }
            await deleteObject(objet.id);
            await onChange();
            onFermer();
          }}
          className="ml-auto pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-dim hover:text-red"
        >
          <IconTrash className="h-3.5 w-3.5" />
          {confirme ? t("sûr ?") : t("supprimer")}
        </button>
      </header>

      <input
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        onBlur={() => void enregistrer()}
        className="mt-4 w-full bg-transparent text-2xl text-text outline-none"
        placeholder={t("Sans titre")}
      />

      {champs.length > 0 && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {champs.map((champ) => (
            <div key={champ.id}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-dim">
                {t(champ.name)}
                {champ.required === 1 && <span className="text-red"> *</span>}
              </dt>
              <dd className="mt-1">
                <ChampSaisie
                  champ={champ}
                  valeur={valeurs[champ.id]}
                  onChange={(v) => setValeurs((x) => ({ ...x, [champ.id]: v }))}
                  onBlur={() => void enregistrer()}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* ⭐ Les valeurs dont le champ a été retiré : conservées, et DITES.
          Les taire donnerait l'impression qu'elles ont été perdues. */}
      {orphelines.length > 0 && (
        <p className="mt-3 text-xs text-text-dim">
          {t("{n} valeurs sont conservées pour des champs retirés du type. Elles reviendront si tu remets ces champs.", {
            n: orphelines.length,
          })}
        </p>
      )}

      {erreurs.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-sm text-red">
          {erreurs.map((e) => (
            <li key={e}>{t(e)}</li>
          ))}
        </ul>
      )}

      <RichNoteEditor
        noteId={objet.id}
        initialHtml={corpsFrais ?? objet.body ?? ""}
        source={{ kind: "object", uid: objet.uid }}
        onOuvrirMention={(k: LinkKind, u: string) => void ouvrirObjet(k, u)}
        onChange={(html) => {
          setCorps(html);
          void enregistrer(html);
        }}
        placeholder={t("Ce que tu sais de cette fiche. Tape @ pour citer autre chose.")}
      />

      <PanneauLiens kind="object" uid={objet.uid} onOuvrir={(k, u) => void ouvrirObjet(k, u)} />
    </div>
  );
}

function ChampSaisie({
  champ,
  valeur,
  onChange,
  onBlur,
}: {
  champ: ObjectField;
  valeur: unknown;
  onChange: (v: unknown) => void;
  onBlur: () => void;
}) {
  const classe =
    "w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

  if (champ.type === "choice") {
    return (
      <select
        value={(valeur as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        onBlur={onBlur}
        className={classe}
      >
        <option value="">—</option>
        {(champ.options ?? []).map((o) => (
          <option key={o} value={o}>
            {t(o)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={champ.type === "date" ? "date" : champ.type === "number" ? "number" : "text"}
      value={valeur == null ? "" : String(valeur)}
      onChange={(e) => {
        const brut = e.target.value;
        // ⚠️ Un champ « nombre » doit rendre un NOMBRE : une chaîne passerait la
        // validation en silence et casserait tout calcul ultérieur.
        onChange(
          brut === ""
            ? undefined
            : champ.type === "number"
              ? Number(brut)
              : brut,
        );
      }}
      onBlur={onBlur}
      className={classe}
    />
  );
}
