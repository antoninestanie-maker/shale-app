import { useRef, useState } from "react";
import { addQuickLink, deleteQuickLink, isTauri } from "../lib/repo";
import type { QuickLink } from "../lib/types";
import { IconExternal, IconTrash, IconX } from "./icons";
import MenuContextuel from "./menu/MenuContextuel";
import { useMenuContextuel } from "./menu/useMenuContextuel";
import { IconCopier } from "./menu/icones";
import { copierTexte } from "../lib/menu/pressePapier";

import { t } from "../lib/i18n";
interface Props {
  links: QuickLink[];
  refresh: () => Promise<void>;
}

async function openLink(url: string) {
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank");
  }
}

export default function QuickLinks({ links, refresh }: Props) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);

  const submit = async () => {
    const l = label.trim();
    let u = url.trim();
    if (!l || !u) return;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    await addQuickLink(l, u);
    setLabel("");
    setUrl("");
    setAdding(false);
    await refresh();
  };

  const handleDelete = async (id: number) => {
    if (deletingId !== id) {
      setDeletingId(id);
      window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    await effacerLien(id);
  };
  /** Le second temps du bouton, seul — ce que fait aussi l'entrée du menu (règle 18). */
  const effacerLien = async (id: number) => {
    window.clearTimeout(deleteTimer.current);
    setDeletingId(null);
    await deleteQuickLink(id);
    await refresh();
  };
  const menu = useMenuContextuel<number>();

  return (
    <div className="panel-col panel-grow">
      <div className="panel-scroll flex flex-wrap content-start gap-2 pr-0.5 pt-1">
        {links.map((link) => (
          <span key={link.id} className="group/link relative" onContextMenu={(e) => menu.ouvrirAuPoint(e, link.id)}>
            <button
              type="button"
              onClick={() => openLink(link.url)}
              className="pill block max-w-[220px] truncate border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-text transition-colors hover:border-blue/50 hover:bg-overlay-2 hover:text-blue"
              data-tip={link.label}
              data-tip-sub={link.url}
            >
              {link.label} ↗
            </button>
            <button
              type="button"
              onClick={() => handleDelete(link.id)}
              className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] transition-opacity ${
                deletingId === link.id
                  ? "bg-red text-white opacity-100"
                  : "bg-surface-2 text-text-dim opacity-0 focus-visible:opacity-100 group-hover/link:opacity-100 [@media(pointer:coarse)]:opacity-100"
              }`}
              aria-label={
                deletingId === link.id
                  ? t("Confirmer la suppression de {label}", { label: link.label })
                  : t("Supprimer {label}", { label: link.label })
              }
              data-tip={deletingId === link.id ? t("Confirmer") : t("Supprimer ce lien")}
            >
              <IconX className="h-3 w-3" />
            </button>
          </span>
        ))}

        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            data-tip={t("Ajouter un lien rapide")}
            data-tip-sub={t("S’ouvre dans le navigateur par défaut, d’un seul clic depuis le tableau de bord.")}
            className="pill border border-dashed border-border px-3.5 py-1.5 text-xs text-text-dim hover:border-text-dim hover:text-text"
          >
            {t("+ lien")}
          </button>
        ) : (
          <form
            className="flex w-full items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("Nom")}
              className="w-28 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL"
              className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <button
              type="submit"
              className="pill bg-surface-2 px-3 py-1.5 text-xs font-medium text-text"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-xs text-text-dim hover:text-text"
            >
              <IconX className="h-3 w-3" />
            </button>
          </form>
        )}
      </div>

      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur le lien")}
        entrees={(() => {
          const l = menu.cible !== null ? links.find((x) => x.id === menu.cible) : undefined;
          if (!l) return [];
          return [
            { id: "ouvrir", libelle: t("Ouvrir"), icone: <IconExternal />, executer: () => openLink(l.url) },
            {
              id: "copier",
              libelle: t("Copier l'adresse"),
              icone: <IconCopier />,
              executer: async () => {
                await copierTexte(l.url);
              },
            },
            // Un raccourci se recrée en dix secondes : le menu, geste délibéré,
            // vaut confirmation (le bouton, lui, garde son second clic).
            { id: "supprimer", libelle: t("Supprimer"), icone: <IconTrash />, danger: true, executer: () => effacerLien(l.id) },
          ];
        })()}
      />
    </div>
  );
}
