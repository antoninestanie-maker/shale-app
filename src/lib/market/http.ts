// Couche réseau. Dans l'app native, on passe par tauri-plugin-http (contourne
// le CORS du webview). En dev navigateur, on retombe sur fetch() standard —
// utile pour tester la tuyauterie, mais Yahoo/RSS seront bloqués par le CORS,
// d'où le fallback démo dans payload.ts.
import { isTauri } from "../repo";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

async function rawFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers = { "User-Agent": UA, ...(opts.headers ?? {}) };
  if (isTauri) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, { ...opts, headers });
  }
  return fetch(url, { ...opts, headers });
}

export async function getJson<T>(url: string): Promise<T> {
  const r = await rawFetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return (await r.json()) as T;
}

export async function getText(url: string): Promise<string> {
  const r = await rawFetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return r.text();
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`HTTP ${status} — ${body.slice(0, 240)}`);
    this.name = "HttpError";
  }
}

export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const r = await rawFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new HttpError(r.status, detail);
  }
  return (await r.json()) as T;
}
