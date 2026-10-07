// Brand onboarding: node scripts/init.ts <domain> [name]
// Probes /.well-known/ucp and /products.json, writes a draft brands/<name>.json.
import { writeFileSync, existsSync } from "node:fs";

const domain = process.argv[2];
if (!domain) { console.error("usage: node scripts/init.ts <domain> [name]"); process.exit(1); }
const name = process.argv[3] ?? domain.replace(/^www\./, "").replace(/\./g, "-");

const UA = { "user-agent": "Mozilla/5.0 (Macintosh) ucp-shopping-agent-init", accept: "application/json" };

async function probe() {
  let ucp: any = null;
  try {
    const r = await fetch(`https://${domain}/.well-known/ucp`, { headers: UA, redirect: "follow" });
    if (r.ok) ucp = (await r.json()).ucp;
  } catch {}
  const mcp = (ucp?.services?.["dev.ucp.shopping"] ?? []).find((s: any) => s.transport === "mcp");
  const handlers = Object.keys(ucp?.payment_handlers ?? {});

  let currency = "USD", country = "US", sampleTitles: string[] = [], vendor = "";
  try {
    const r = await fetch(`https://${domain}/products.json?limit=5`, { headers: UA, redirect: "follow" });
    if (r.ok) {
      const products = (await r.json()).products ?? [];
      sampleTitles = products.map((p: any) => p.title).slice(0, 3);
      vendor = products[0]?.vendor ?? "";
      // currency isn't in products.json; leave a TODO unless obvious from TLD
      if (domain.endsWith(".us") || domain.endsWith(".com")) { currency = "USD"; country = "US"; }
      else if (domain.endsWith(".eu")) { currency = "EUR"; country = "DE"; }
      else if (domain.endsWith(".uk") || domain.includes("en-gb")) { currency = "GBP"; country = "GB"; }
    }
  } catch {}

  const config = {
    name,
    displayName: `${vendor || name} Assistant`,
    storefront: { domain, basePath: "", market: { country, language: `en-${country}`, currency } },
    catalog: { scope: "all" },
    rules: {
      freeShippingThreshold: null,
      dutiesThreshold: null,
      orderCutoffDate: null,
      cutoffMessage: null,
      ageSensitiveKeywords: [],
      notes: ["TODO: confirm market/currency and add the brand's trading rules"],
    },
    persona: {
      tone: "friendly, concise, helpful",
      scope: `You help shoppers find and buy products from ${vendor || domain}.`,
      disclosure: true,
      welcome: `Hi! I'm the ${vendor || name} shopping assistant. What are you looking for?`,
      examplePrompt: sampleTitles[0] ? `Find me something like "${sampleTitles[0]}"` : "What's popular right now?",
    },
    links: { storeLocator: null, help: null },
    theme: { accent: "#111111", bg: "#ffffff", userBubble: "#111111", botBubble: "#f4f1ea", launcher: "🛍️", headerBg: "#ffffff", headerText: "#111111" },
    model: { id: "claude-sonnet-5" },
  };

  const out = `brands/${name}.json`;
  if (existsSync(out)) { console.error(`${out} already exists — refusing to overwrite`); process.exit(1); }
  writeFileSync(out, JSON.stringify(config, null, 2) + "\n");
  console.log(`[init] wrote ${out}`);
  console.log(`[init] UCP: ${mcp ? `MCP ${mcp.version} at ${mcp.endpoint}` : "NOT FOUND (catalog + permalink mode only)"}`);
  console.log(`[init] payment handlers: ${handlers.join(", ") || "n/a"}`);
  console.log(`[init] sample products: ${sampleTitles.join(" | ") || "n/a"}`);
  console.log(`[init] next: review the config, then BRAND=${name} npm run dev`);
}
await probe();
