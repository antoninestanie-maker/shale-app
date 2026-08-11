/**
 * Décor du mur de connexion : une maquette du châssis de Shale.
 *
 * ⚠️ CE N'EST PAS L'APP. C'est tout l'intérêt du fichier.
 *
 * La tentation était de monter l'app réelle derrière l'écran de connexion et de
 * la flouter. Deux raisons de ne pas le faire, et la première est décisive :
 *
 *   1. **Monter l'app, c'est lire SQLite et rendre de vraies données** avant que
 *      quiconque se soit authentifié. Le mur ne serait plus un mur : les données
 *      seraient déjà en mémoire, dans le DOM, à un `document.querySelector`
 *      d'être lues. On protégerait l'affichage, pas l'accès.
 *   2. `filter: blur()` n'est pas une mesure de sécurité. C'est une propriété
 *      CSS, désactivable depuis l'inspecteur, et la capture d'écran d'un texte
 *      flouté reste parfois lisible. Un flou est un effet visuel, pas un
 *      chiffrement.
 *
 * Ce composant ne rend donc que des formes : des rectangles, aucun texte réel,
 * aucune requête, aucun accès au disque. Visuellement, il donne la même
 * impression de profondeur — sans qu'il y ait rien à voler derrière.
 *
 * Il est `inert` et `aria-hidden` : ni le clavier, ni un lecteur d'écran, ni la
 * souris ne l'atteignent. Sans `inert`, la tabulation depuis le formulaire de
 * connexion se promènerait dans un décor invisible.
 */

/** Barre latérale factice : un en-tête, deux groupes d'entrées. */
function Colonne() {
  return (
    <div className="flex w-[212px] shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-[8px] bg-text/15" />
        <div className="h-3 w-16 rounded bg-text/12" />
      </div>
      {[4, 3, 2].map((n, groupe) => (
        <div key={groupe} className="flex flex-col gap-2.5">
          <div className="h-2 w-12 rounded bg-text/8" />
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-4 w-4 rounded-[5px] bg-text/10" />
              {/* Largeurs inégales : des barres identiques font « chargement »,
                  pas « application ». */}
              <div
                className="h-2.5 rounded bg-text/10"
                style={{ width: `${52 + ((i * 37 + groupe * 19) % 46)}px` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Grille de modules factice. */
function Grille() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 rounded bg-text/12" />
        <div className="flex gap-2">
          <div className="h-7 w-7 rounded-[8px] bg-text/8" />
          <div className="h-7 w-20 rounded-[8px] bg-text/8" />
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4"
          >
            <div className="h-2.5 w-20 rounded bg-text/10" />
            <div className="h-7 w-24 rounded bg-text/14" />
            <div className="mt-auto flex flex-col gap-2">
              <div className="h-2 w-full rounded bg-text/6" />
              <div className="h-2 w-4/5 rounded bg-text/6" />
              <div className="h-2 w-2/3 rounded bg-text/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChassisFactice() {
  return (
    <div
      aria-hidden="true"
      // `inert` retire tout le sous-arbre du parcours clavier et de l'arbre
      // d'accessibilité. React ne le typait pas avant 19 : l'attribut est posé
      // en chaîne, ce que le DOM accepte.
      {...({ inert: "" } as Record<string, string>)}
      className="pointer-events-none absolute inset-0 flex select-none overflow-hidden"
      style={{ filter: "blur(7px) saturate(0.7)", opacity: 0.5 }}
    >
      <Colonne />
      <Grille />
    </div>
  );
}
