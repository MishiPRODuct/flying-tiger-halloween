// Snapshot the nine Flying Tiger GB Halloween collections to data/halloween-<date>.json.
// Source: public Shopify collection JSON on the en-gb storefront (GBP).
// Usage: node scripts/snapshot_catalog.ts [YYYY-MM-DD]

const COLLECTIONS = [
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Item {
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

async function fetchCollection(handle: string): Promise<any[]> {
  const products: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = `${BASE}/collections/${handle}/products.json?limit=250&page=${page}`;
    let res = await fetch(url, { headers: HEADERS });
    for (let attempt = 0; res.status === 429 && attempt < 3; attempt++) {
      await sleep(3000 * (attempt + 1));
      res = await fetch(url, { headers: HEADERS });
    }
    if (!res.ok) {
      console.error(`  ${handle} page ${page}: HTTP ${res.status}`);
      break;
    }
    const batch = (await res.json()).products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
    await sleep(1000);
  }
  return products;
}

const captureDate = process.argv[2] ?? (() => {
  throw new Error("Pass the capture date as YYYY-MM-DD");
})();

const byVariant = new Map<number, Item>();
for (const handle of COLLECTIONS) {
  const products = await fetchCollection(handle);
  console.log(`${handle}: ${products.length} products`);
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const existing = byVariant.get(v.id);
      if (existing) {
        if (!existing.collections.includes(handle)) existing.collections.push(handle);
        continue;
      }
      byVariant.set(v.id, {
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
  await sleep(1000);
}

const snapshot = {
  store: "flyingtiger.com/en-gb (ftc-row.myshopify.com, shop 52671447238)",
  currency: "GBP",
  captured_at: captureDate,
  source: "Shopify public collection products.json (en-gb storefront)",
  rules: {
    delivery_cutoff: "2026-10-22",
    free_shipping_threshold_gbp: 40,
    shipping_below_threshold_gbp: null, // not published; calculated at checkout
    import_duties_threshold_gbp: 115,
    items_not_reserved: true,
    store_locator_url: "https://flyingtiger.com/en-gb/pages/store-locator",
  },
  collections: COLLECTIONS,
  item_count: byVariant.size,
  items: [...byVariant.values()],
};

const out = `data/halloween-${captureDate}.json`;
await (await import("node:fs/promises")).writeFile(out, JSON.stringify(snapshot, null, 1));
console.log(`wrote ${out}: ${snapshot.item_count} variants`);
