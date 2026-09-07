import { isTauri } from "./repo";
import { t } from "./i18n";

/**
 * Enregistrer un fichier sur le disque — le seul chemin de l'app.
 *
 * ⚠️ POURQUOI CE MODULE PLUTÔT QU'UN `<a download>`. La webview d'une app Tauri
 * n'a pas de gestionnaire de téléchargement : un lien `download` y est
 * simplement inerte, sans erreur ni message. Ce qui marche en mode démo
 * navigateur ne marche donc PAS dans l'app installée — exactement le genre
 * d'écart que le § 6.2 quater de `PIEGES.md` décrit, et cette fois dans le sens
 * où c'est la démo qui est trop indulgente.
 *
 * Deux chemins, une seule signature :
 *   • en NATIF, le dialogue système choisit le chemin et le Rust écrit ;
 *   • en DÉMO navigateur, un `<a download>` fait très bien l'affaire.
 */

const MIME: Record<string, string> = {
  png: "image/png",
  svg: "image/svg+xml",
};

const NOM: Record<string, string> = {
  png: "Image PNG",
  svg: "Image SVG",
};

/**
 * Écrit `contenu` dans un fichier choisi par l'utilisateur.
 *
 * `contenu` est soit une data URL (`data:image/png;base64,…`), soit du texte.
 * Rend `false` quand l'utilisateur a fermé le dialogue — ce n'est pas une
 * erreur, et l'appelant ne doit pas annoncer un export qui n'a pas eu lieu.
 */
export async function enregistrerFichier(
  nomDefaut: string,
  contenu: string,
  extension: "png" | "svg",
): Promise<boolean> {
  const type = MIME[extension] ?? "application/octet-stream";

  if (!isTauri) {
    const url = contenu.startsWith("data:")
      ? contenu
      : URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomDefaut;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (!contenu.startsWith("data:")) setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const dest = await save({
    defaultPath: nomDefaut,
    filters: [{ name: t(NOM[extension] ?? "Fichier"), extensions: [extension] }],
  });
  if (!dest) return false;

  // ⚠️ `btoa` échoue sur tout caractère hors latin-1 — donc sur le moindre
  // accent d'un titre français dans un SVG. On encode en UTF-8 d'abord.
  const base64 = contenu.startsWith("data:")
    ? contenu.slice(contenu.indexOf(",") + 1)
    : base64DeTexte(contenu);

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("ecrire_fichier", { chemin: dest, contenuBase64: base64 });
  return true;
}

function base64DeTexte(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let binaire = "";
  // Par tranches : `String.fromCharCode(...tableau)` dépasse la pile d'appels
  // au-delà de quelques dizaines de milliers d'octets, et un SVG de carte les
  // atteint sans peine.
  const TRANCHE = 0x8000;
  for (let i = 0; i < octets.length; i += TRANCHE) {
    binaire += String.fromCharCode(...octets.subarray(i, i + TRANCHE));
  }
  return btoa(binaire);
}
