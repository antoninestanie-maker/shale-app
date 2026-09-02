import { useMemo, useState } from "react";
import {
  champsDuType,
  nouvelIdDeChamp,
  valeursDeLObjet,
  valeursOrphelines,
  validerType,
  FIELD_TYPES,
} from "../../lib/objets";
import { createObjectType, deleteObjectType, updateObjectType } from "../../lib/repo";
import type { CustomObject, FieldType, ObjectField, ObjectType } from "../../lib/types";
import { IconPlus, IconTrash, IconX } from "../icons";
import { t } from "../../lib/i18n";

/**
 * Créer ou modifier un TYPE d'objet.
 *
 * ⚠️ UN TYPE LIVRÉ EST MODIFIABLE ET SUPPRIMABLE. `builtin` dit d'où vient le
 * type, il ne le verrouille pas — sinon ce serait la « liste fermée » qu'Antonin
 * a explicitement écartée, avec l'illusion du choix en plus.
 */

/** Libellés FRANÇAIS, traduits à l'affichage (jamais de `t()` en constante). */
const LIBELLE_TYPE: Record<FieldType, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  link: "Lien",
  choice: "Choix",
};

const COULEURS = ["blue", "green", "violet", "yellow", "red"];

interface Props {
  /** `null` = création. */
  type: ObjectType | null;
  /** Les objets de ce type — pour dire ce qu'un retrait de champ va masquer. */
  objets: readonly CustomObject[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function EditeurType({ type, objets, onClose, onSaved }: Props) {
  const [nom, setNom] = useState(type?.name ?? "");
  const [couleur, setCouleur] = useState(type?.color ?? "blue");
  const [champs, setChamps] = useState<ObjectField[]>(() => champsDuType(type?.fields));
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  /**
   * Les identifiants de champ DÉJÀ UTILISÉS par des objets existants, même s'ils
   * ne sont plus déclarés.
   *
   * ⚠️ Sans cela, `nouvelIdDeChamp` pourrait rendre un identifiant libéré par un
   * champ supprimé, et le nouveau champ ressusciterait les valeurs de l'ancien :
   * « Développeur » s'afficherait comme numéro de téléphone, sur toutes les
   * fiches, sans rien signaler.
   */
  const idsConnus = useMemo(
    () => [...new Set(objets.flatMap((o) => Object.keys(valeursDeLObjet(o.field_values))))],
    [objets],
  );

  /** Ce que le retrait de champs va CESSER d'afficher — annoncé, jamais subi. */
  const masquees = useMemo(() => {
    const compte = new Map<string, number>();
    for (const o of objets) {
      for (const id of valeursOrphelines(champs, valeursDeLObjet(o.field_values))) {
        compte.set(id, (compte.get(id) ?? 0) + 1);
      }
    }
    return compte;
  }, [champs, objets]);

  const nomsAnciens = useMemo(
    () => new Map(champsDuType(type?.fields).map((c) => [c.id, c.name])),
    [type?.fields],
  );

  async function enregistrer() {
    const problemes = validerType(nom, champs);
    if (problemes.length) {
      setErreurs(problemes);
      return;
    }
    const input = { name: nom.trim(), icon: type?.icon ?? null, color: couleur, fields: champs };
    if (type) await updateObjectType(type.id, input);
    else await createObjectType(input);
    await onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="card card-solid max-h-[85vh] w-full max-w-lg overflow-y-auto p-6"
        style={{ maxHeight: "calc(85vh * var(--zoom-inv, 1))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl text-text">
          {type ? t("Modifier le type") : t("Nouveau type d'objet")}
        </h2>
        {type?.builtin === 1 && (
          <p className="mt-2 text-xs text-text-dim">
            {t("Type livré avec l'app. Tu peux le modifier et le supprimer comme les autres.")}
          </p>
        )}

        <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-text-dim">
          {t("Nom")}
        </label>
        <input
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder={t("Client, Recette, Lieu…")}
          className="mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
        />

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-text-dim">
          {t("Couleur")}
        </label>
        <div className="mt-1.5 flex gap-2">
          {COULEURS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCouleur(c)}
              aria-label={c}
              className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: `var(--color-${c})`,
                borderColor: couleur === c ? "var(--color-text)" : "transparent",
              }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-dim">
            {t("Champs")}
          </h3>
          <button
            type="button"
            onClick={() =>
              setChamps((c) => [
                ...c,
                { id: nouvelIdDeChamp(c, idsConnus), name: "", type: "text", required: 0 },
              ])
            }
            className="pill cible-tactile-ligne flex items-center gap-1 px-2 py-1 text-xs text-text-dim hover:bg-overlay hover:text-text"
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("Ajouter un champ")}
          </button>
        </div>

        <ul className="mt-2 space-y-2">
          {champs.map((champ, i) => (
            <li key={champ.id} className="rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <input
                  value={champ.name}
                  onChange={(e) =>
                    setChamps((c) => c.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder={t("Nom du champ")}
                  className="min-w-0 flex-1 rounded-md border border-border bg-overlay px-2 py-1.5 text-sm text-text outline-none focus:border-border-strong"
                />
                <select
                  value={champ.type}
                  onChange={(e) =>
                    setChamps((c) =>
                      c.map((x, k) => (k === i ? { ...x, type: e.target.value as FieldType } : x)),
                    )
                  }
                  className="rounded-md border border-border bg-overlay px-2 py-1.5 text-sm text-text outline-none"
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {t(LIBELLE_TYPE[ft])}
                    </option>
                  ))}
                </select>
                <label className="flex shrink-0 items-center gap-1 text-xs text-text-dim">
                  <input
                    type="checkbox"
                    checked={champ.required === 1}
                    onChange={(e) =>
                      setChamps((c) =>
                        c.map((x, k) => (k === i ? { ...x, required: e.target.checked ? 1 : 0 } : x)),
                      )
                    }
                  />
                  {t("obligatoire")}
                </label>
                <button
                  type="button"
                  onClick={() => setChamps((c) => c.filter((_, k) => k !== i))}
                  data-tip={t("Retirer ce champ")}
                  aria-label={t("Retirer ce champ")}
                  className="cible-tactile shrink-0 rounded p-1 text-text-dim hover:text-red"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              {champ.type === "choice" && (
                <input
                  value={(champ.options ?? []).join(", ")}
                  onChange={(e) =>
                    setChamps((c) =>
                      c.map((x, k) =>
                        k === i
                          ? { ...x, options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) }
                          : x,
                      ),
                    )
                  }
                  placeholder={t("Options, séparées par des virgules")}
                  className="mt-2 w-full rounded-md border border-border bg-overlay px-2 py-1.5 text-sm text-text outline-none focus:border-border-strong"
                />
              )}
            </li>
          ))}
        </ul>

        {/* ⭐ Ce qui va cesser d'être affiché, annoncé AVANT de valider.
            Une donnée qui disparaît de l'écran sans que personne ne l'ait
            annoncé est indiscernable d'une donnée perdue. */}
        {masquees.size > 0 && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--color-yellow) 40%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-yellow) 8%, transparent)",
            }}
          >
            <p className="text-text">{t("Ces champs retirés ne seront plus affichés :")}</p>
            <ul className="mt-1 space-y-0.5 text-text-dim">
              {[...masquees].map(([id, n]) => (
                <li key={id}>
                  « {nomsAnciens.get(id) ?? id} » —{" "}
                  {t("{n} fiches le remplissent", { n })}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-dim">
              {t("Rien n'est effacé : les valeurs restent en base et réapparaissent si tu remets le champ.")}
            </p>
          </div>
        )}

        {erreurs.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-sm text-red">
            {erreurs.map((e) => (
              <li key={e}>{t(e)}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-between">
          {type ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirmeSuppression) {
                  setConfirmeSuppression(true);
                  return;
                }
                await deleteObjectType(type.id);
                await onSaved();
                onClose();
              }}
              className="pill flex items-center gap-1.5 px-3 py-2 text-sm text-text-dim hover:text-red"
            >
              <IconTrash className="h-4 w-4" />
              {confirmeSuppression
                ? t("Supprimer le type ET ses {n} fiches ?", { n: objets.length })
                : t("Supprimer")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="pill px-4 py-2 text-sm text-text-dim hover:text-text">
              {t("Annuler")}
            </button>
            <button
              type="button"
              onClick={enregistrer}
              className="pill bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("Enregistrer")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
