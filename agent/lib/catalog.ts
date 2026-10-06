// Catalog access: committed snapshot as the base, live Shopify collection JSON
// refresh with a 10-minute cache (the store's items are never reserved, so
// stock must be re-checked at hand-off time).

import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export interface CatalogItem {
  variant_id: number;
  product_id: number;
  sku: string;
  title: string;
  price_gbp: number;
  in_stock: boolean;
  collections: string[];
  product_type: string;
  tags: string[];
  url: string;
  image: string | null;
}

export const COLLECTIONS = [
  "happy-halloween",
  "halloween-decorations",
  "halloween-table-setting",
  "halloween-diy",
  "trick-or-treat",
  "halloween-create-play",
  "halloween-dress-up",
  "halloween-party",
  "gothic-glam",
];

const BASE = "https://flyingtiger.com/en-gb";
const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 flying-tiger-halloween-mvp",
};
const CACHE_TTL_MS = 10 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let snapshot: CatalogItem[] | null = null;
let live: Map<number, CatalogItem> | null = null;
let liveFetchedAt = 0;

export async function loadSnapshot(): Promise<CatalogItem[]> {
  if (snapshot) return snapshot;
  const dir = join(process.cwd(), "data");
  const file = readdirSync(dir)
    .filter((f) => /^halloween-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .at(-1);
  if (!file) throw new Error("No data/halloween-<date>.json snapshot found. Run scripts/snapshot_catalog.ts.");
  snapshot = JSON.parse(await readFile(join(dir, file), "utf8")).items as CatalogItem[];
  return snapshot;
}

/** Live catalog, cached 10 minutes. Falls back to the snapshot on network failure. */
export async function getCatalog(): Promise<{ items: CatalogItem[]; source: "live" | "snapshot" }> {
  const now = Date.now();
  if (live && now - liveFetchedAt < CACHE_TTL_MS) {
    return { items: [...live.values()], source: "live" };
  }
  try {
    const map = new Map<number, CatalogItem>();
    for (const handle of COLLECTIONS) {
      for (let page = 1; page <= 10; page++) {
        const res = await fetch(
          `${BASE}/collections/${handle}/products.json?limit=250&page=${page}`,
          { headers: HEADERS },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status} on ${handle}`);
        const products = (await res.json()).products ?? [];
        for (const p of products) {
          for (const v of p.variants ?? []) {
            const existing = map.get(v.id);
            if (existing) {
              if (!existing.collections.includes(handle)) existing.collections.push(handle);
              continue;
            }
            map.set(v.id, {
              variant_id: v.id,
              product_id: p.id,
              sku: v.sku,
              title: v.title === "Default Title" ? p.title : `${p.title} — ${v.title}`,
              price_gbp: Number(v.price),
              in_stock: Boolean(v.available),
              collections: [handle],
              product_type: p.product_type,
              tags: p.tags ?? [],
              url: `${BASE}/products/${p.handle}`,
              image: p.images?.[0]?.src ?? null,
            });
          }
        }
        if (products.length < 250) break;
        await sleep(1000);
      }
      await sleep(250);
    }
    live = map;
    liveFetchedAt = now;
    return { items: [...map.values()], source: "live" };
  } catch {
    return { items: await loadSnapshot(), source: "snapshot" };
  }
}

export function searchItems(
  items: CatalogItem[],
  query: string,
  opts: { maxPrice?: number; includeOutOfStock?: boolean } = {},
): CatalogItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const scored = items
    .filter((i) => (opts.includeOutOfStock ? true : i.in_stock))
    .filter((i) => opts.maxPrice === undefined || i.price_gbp <= opts.maxPrice)
    .map((i) => {
      const hay = `${i.title} ${i.product_type} ${i.tags.join(" ")} ${i.collections.join(" ")}`.toLowerCase();
      const score = terms.reduce(
        (s, t) => s + (i.title.toLowerCase().includes(t) ? 3 : hay.includes(t) ? 1 : 0),
        0,
      );
      return { i, score };
    })
    .filter((x) => terms.length === 0 || x.score > 0)
    .sort((a, b) => b.score - a.score || a.i.price_gbp - b.i.price_gbp);
  return scored.map((x) => x.i);
}
