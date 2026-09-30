// « Ce qui sera envoyé » — un repli consultable AVANT l'appel, pour les
// fonctions qui envoient beaucoup (extraction de fichier, réécriture, revue).
// Le contenu est le payload exact (`lib/ia/apercu.ts`).
import { t } from "../../lib/i18n";
import { apercuDe } from "../../lib/ia/apercu";

export function ApercuEnvoi({ payload }: { payload: unknown }) {
  return (
    <details className="rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm">
      <summary className="cursor-pointer select-none text-text-dim hover:text-text">{t("Ce qui sera envoyé")}</summary>
      <p className="mt-2 text-xs leading-relaxed text-text-dim">
        {t("Exactement ce contenu part vers Shale, puis vers Google, le temps de la réponse. Shale n'en garde rien.")}
      </p>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 font-mono text-[11.5px] leading-relaxed text-text">
        {apercuDe(payload)}
      </pre>
    </details>
  );
}
