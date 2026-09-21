/**
 * Copier du texte, sans jamais faire échouer l'action qui le demande.
 *
 * ⚠️ POURQUOI CE N'EST PAS UN APPEL DIRECT À `navigator.clipboard`. L'API
 * moderne n'existe que dans un contexte sûr, et elle REJETTE quand le document
 * n'a pas le focus — ce qui arrive exactement dans notre cas : un menu
 * contextuel dans un portail, fermé juste avant l'action. Une promesse rejetée
 * sans repli donnerait une entrée « Copier » qui ne fait rien, une fois sur
 * trois, sans rien dire.
 *
 * Le repli `execCommand("copy")` est déprécié, et c'est assumé : il fonctionne
 * partout où l'autre échoue, il ne coûte que dix lignes, et le jour où il
 * disparaîtra des moteurs, l'API moderne sera disponible dans tous les cas où
 * on l'appelle ici.
 *
 * Rend VRAI si le texte est parti, FAUX sinon — l'appelant décide quoi dire.
 */
export async function copierTexte(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    /* on tente le repli */
  }
  return copierParZoneCachee(texte);
}

function copierParZoneCachee(texte: string): boolean {
  if (typeof document === "undefined") return false;
  const zone = document.createElement("textarea");
  zone.value = texte;
  // Hors écran plutôt que `display: none` : un élément non rendu n'est pas
  // sélectionnable, donc la copie échouerait sans erreur.
  zone.setAttribute("readonly", "");
  zone.style.position = "fixed";
  zone.style.top = "-9999px";
  zone.style.opacity = "0";
  document.body.append(zone);
  try {
    zone.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    zone.remove();
  }
}
