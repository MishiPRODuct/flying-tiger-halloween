// Store-agnostic catalog: Shopify public products.json, either store-wide
// or per configured collection handles. 10-min in-memory cache.
import { loadBrand, storeBase } from "./config.ts";

export interface CatalogItem {
  variant_id: number;
  product_id: number;
  sku: string;
  title: string;
  price: number;        // major units in the store currency
  in_stock: boolean;
  collections: string[];
  product_type: string;
  tags: string[];
  url: string;
  image: string | null;
}

const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ucp-shopping-agent",
};
const CACHE_TTL_MS = 10 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let cache: Map<number, CatalogItem> | null = null;
let fetchedAt = 0;

async function fetchPaged(url: string, collection: string | null, map: Map<number, CatalogItem>) {
  for (let page = 1; page <= 20; page++) {
    let res = await fetch(`${url}?limit=250&page=${page}`, { headers: HEADERS });
    for (let attempt = 0; res.status === 429 && attempt < 3; attempt++) {
      await sleep(3000 * (attempt + 1));
      res = await fetch(`${url}?limit=250&page=${page}`, { headers: HEADERS });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    const products = (await res.json()).products ?? [];
    const base = storeBase(loadBrand());
    for (const p of products) {
      for (const v of p.variants ?? []) {
        const existing = map.get(v.id);
        if (existing) {
          if (collection && !existing.collections.includes(collection)) existing.collections.push(collection);
          continue;
        }
        map.set(v.id, {
          variant_id: v.id,
          product_id: p.id,
          sku: v.sku,
          title: v.title === "Default Title" ? p.title : `${p.title} — ${v.title}`,
          price: Number(v.price),
          in_stock: Boolean(v.available),
          collections: collection ? [collection] : [],
          product_type: p.product_type,
          tags: p.tags ?? [],
          url: `${base}/products/${p.handle}`,
          image: p.images?.[0]?.src ?? null,
        });
      }
    }
    if (products.length < 250) break;
    await sleep(800);
  }
}

export async function getCatalog(): Promise<{ items: CatalogItem[]; source: "live" | "stale" | "unavailable" }> {
  const now = Date.now();
  if (cache && now - fetchedAt < CACHE_TTL_MS) return { items: [...cache.values()], source: "live" };
  const c = loadBrand();
  const base = storeBase(c);
  try {
    const map = new Map<number, CatalogItem>();
    if (c.catalog.scope === "collections") {
      for (const handle of c.catalog.handles) {
        await fetchPaged(`${base}/collections/${handle}/products.json`, handle, map);
        await sleep(250);
      }
    } else {
      await fetchPaged(`${base}/products.json`, null, map);
    }
    cache = map;
    fetchedAt = now;
    return { items: [...map.values()], source: "live" };
  } catch (err) {
    console.warn(`[catalog] live fetch failed: ${(err as Error).message}`);
    if (cache) return { items: [...cache.values()], source: "stale" };
    return { items: [], source: "unavailable" };
  }
}

export function searchItems(
  items: CatalogItem[],
  query: string,
  opts: { maxPrice?: number; includeOutOfStock?: boolean } = {},
): CatalogItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  return items
    .filter((i) => (opts.includeOutOfStock ? true : i.in_stock))
    .filter((i) => opts.maxPrice === undefined || i.price <= opts.maxPrice)
    .map((i) => {
      const hay = `${i.title} ${i.product_type} ${i.tags.join(" ")} ${i.collections.join(" ")}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (i.title.toLowerCase().includes(t) ? 3 : hay.includes(t) ? 1 : 0), 0);
      return { i, score };
    })
    .filter((x) => terms.length === 0 || x.score > 0)
    .sort((a, b) => b.score - a.score || a.i.price - b.i.price)
    .map((x) => x.i);
}
