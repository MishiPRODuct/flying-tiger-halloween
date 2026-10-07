// Store-agnostic UCP client: discovers any store's MCP endpoint from
// /.well-known/ucp, injects our (agent-level, store-independent) hosted
// profile into every call. Prices in UCP payloads are ISO 4217 MINOR units.
import { loadBrand, money, type BrandConfig } from "./config.ts";

const AGENT_PROFILE_URL =
  "https://gist.githack.com/MishiPRODuct/ea2ec206a465e6d91bd6414d3874013e/raw/327d836585c1a101484d4ac8513688faab37924f/ucp.json";
const SPEC = "2026-08-25";

interface Discovery {
  endpoint: string;
  paymentOptions: string[];
}

const HANDLER_NAMES: Record<string, string> = {
  "com.google.pay": "Google Pay",
  "dev.shopify.card": "Card",
  "dev.shopify.shop_pay": "Shop Pay",
  "com.apple.pay": "Apple Pay",
};

let discovered: Discovery | null | undefined; // undefined = not probed, null = no UCP

/** Probe the brand's /.well-known/ucp once; null when the store has no usable MCP UCP. */
export async function discover(): Promise<Discovery | null> {
  if (discovered !== undefined) return discovered;
  const c = loadBrand();
  try {
    const res = await fetch(`https://${c.storefront.domain}/.well-known/ucp`, {
      headers: { accept: "application/json" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = (await res.json()).ucp;
    const entry = (doc?.services?.["dev.ucp.shopping"] ?? []).find(
      (s: any) => s.transport === "mcp" && s.version === SPEC,
    );
    if (!entry?.endpoint) throw new Error(`no MCP transport at spec ${SPEC}`);
    const paymentOptions = Object.keys(doc.payment_handlers ?? {}).map(
      (k) => HANDLER_NAMES[k] ?? k,
    );
    discovered = { endpoint: entry.endpoint, paymentOptions };
  } catch (err) {
    console.warn(`[ucp] discovery failed for ${c.storefront.domain}: ${(err as Error).message}`);
    discovered = null;
  }
  return discovered;
}

export async function ucpCall(tool: string, args: Record<string, unknown>): Promise<any> {
  const d = await discover();
  if (!d) throw new Error("store has no usable UCP endpoint");
  const res = await fetch(d.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: { meta: { "ucp-agent": { profile: AGENT_PROFILE_URL } }, ...args } },
    }),
  });
  if (!res.ok) throw new Error(`UCP HTTP ${res.status}`);
  const rpc = await res.json();
  if (rpc.error) throw new Error(`UCP RPC error: ${JSON.stringify(rpc.error).slice(0, 200)}`);
  const text = rpc.result?.content?.[0]?.text ?? "";
  let inner: any;
  try {
    inner = JSON.parse(text);
  } catch {
    throw new Error(`UCP tool error: ${text.slice(0, 200)}`);
  }
  if (inner?.ucp?.status === "error")
    throw new Error(`UCP ${tool} failed: ${JSON.stringify(inner.messages ?? []).slice(0, 300)}`);
  return inner;
}

export function marketContext(c: BrandConfig) {
  return {
    address_country: c.storefront.market.country,
    language: c.storefront.market.language,
    currency: c.storefront.market.currency,
  };
}

export async function summarizeCheckout(c: BrandConfig, co: any) {
  const minor = (n: number) => money(c, n / 100);
  const d = await discover();
  return {
    checkout_id: co.id,
    status: co.status,
    currency: co.currency,
    line_items: (co.line_items ?? []).map((l: any) => ({
      title: l.item?.title,
      quantity: l.quantity,
      unit_price: minor(l.item?.price ?? 0),
      line_total: minor(l.totals?.find((t: any) => t.type === "total")?.amount ?? 0),
    })),
    totals: (co.totals ?? []).map((t: any) => ({ label: t.display_text, amount: minor(t.amount) })),
    notes: (co.messages ?? []).filter((m: any) => m.severity !== "unrecoverable").map((m: any) => m.content),
    expires_at: co.expires_at,
    payment_options: d?.paymentOptions ?? [],
    pay_url: co.continue_url,
  };
}
