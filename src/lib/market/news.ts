// News — flux RSS parsés avec DOMParser (dispo dans le webview). Keyless.
import { getText } from "./http";
import type { NewsItem } from "./types";

interface Feed {
  source: string;
  url: string;
}

// 2-3 flux à fort signal macro/crypto pour la phase 1.
const FEEDS: Feed[] = [
  // ForexLive a été renommé InvestingLive mi-2026 (l'ancien domaine redirige).
  { source: "InvestingLive", url: "https://investinglive.com/feed/news" },
  { source: "FXStreet", url: "https://www.fxstreet.com/rss/news" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
];

// Mots-clés → devises/actifs, pour taguer chaque titre.
const TAG_RULES: { re: RegExp; tag: string }[] = [
  { re: /\b(dollar|dxy|fed|fomc|powell|cpi|nfp|payroll|ism|treasury|yield)\b/i, tag: "USD" },
  { re: /\b(euro|eur\/usd|ecb|bce|lagarde|german|eurozone)\b/i, tag: "EUR" },
  { re: /\b(pound|gbp|boe|bailey|uk\b|britain)\b/i, tag: "GBP" },
  { re: /\b(gold|xau|bullion)\b/i, tag: "XAU/USD" },
  { re: /\b(nasdaq|nas100|nvidia|apple|microsoft|tech stocks|equities)\b/i, tag: "NAS100" },
  { re: /\b(bitcoin|btc|crypto|ethereum|eth)\b/i, tag: "BTC/USD" },
];

function tagInstruments(title: string): string[] {
  const tags = TAG_RULES.filter((r) => r.re.test(title)).map((r) => r.tag);
  return [...new Set(tags)];
}

function textOf(el: Element | null, tag: string): string {
  return el?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

function parseFeed(xml: string, source: string): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return [];
  // RSS <item> ou Atom <entry>
  const nodes = [
    ...Array.from(doc.getElementsByTagName("item")),
    ...Array.from(doc.getElementsByTagName("entry")),
  ];
  const items: NewsItem[] = [];
  for (const node of nodes.slice(0, 15)) {
    const title = textOf(node, "title");
    if (!title) continue;
    let link = textOf(node, "link");
    if (!link) link = node.getElementsByTagName("link")[0]?.getAttribute("href") ?? "";
    const pub = textOf(node, "pubDate") || textOf(node, "published") || textOf(node, "updated");
    const parsed = pub ? new Date(pub) : null;
    const published = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
    items.push({
      id: `${source}-${title}`.slice(0, 120),
      source,
      title,
      link,
      published,
      instruments: tagInstruments(title),
    });
  }
  return items;
}

export async function fetchNews(errors: string[]): Promise<NewsItem[]> {
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        return parseFeed(await getText(f.url), f.source);
      } catch (e) {
        errors.push(`news ${f.source}: ${e instanceof Error ? e.message : String(e)}`);
        return [] as NewsItem[];
      }
    }),
  );
  const all = results.flat();
  // Dédoublonnage par titre normalisé (doc §7.4).
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of all) {
    const key = it.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  deduped.sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
  return deduped.slice(0, 30);
}
