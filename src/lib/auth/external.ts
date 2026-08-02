import { isTauri } from "../repo";

/** Ouvre une URL dans le navigateur système (jamais dans la webview de l'app). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      /* repli navigateur ci-dessous */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
