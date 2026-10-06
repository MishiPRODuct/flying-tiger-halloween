// Minimal UCP MCP client for Flying Tiger's shopping endpoint.
// Every tools/call must carry meta.ucp-agent.profile (our hosted agent profile).
// Prices in UCP payloads are integers in MINOR units (pence).

const ENDPOINT = "https://ftc-row.myshopify.com/api/ucp/mcp";
const AGENT_PROFILE_URL =
  "https://gist.githack.com/MishiPRODuct/ea2ec206a465e6d91bd6414d3874013e/raw/327d836585c1a101484d4ac8513688faab37924f/ucp.json";

export const GB_CONTEXT = { address_country: "GB", language: "en-GB", currency: "GBP" };

/** Payment methods the store declares in its UCP profile (static, from /.well-known/ucp). */
export const STORE_PAYMENT_OPTIONS = [
  "Google Pay",
  "Card (Visa, Mastercard, Amex, Discover, Diners Club)",
  "Shop Pay",
];

export async function ucpCall(tool: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(ENDPOINT, {
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
      params: {
        name: tool,
        arguments: { meta: { "ucp-agent": { profile: AGENT_PROFILE_URL } }, ...args },
      },
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
  if (inner?.ucp?.status === "error") {
    throw new Error(`UCP ${tool} failed: ${JSON.stringify(inner.messages ?? []).slice(0, 300)}`);
  }
  return inner;
}

const gbp = (minor: number) => `£${(minor / 100).toFixed(2)}`;

/** Normalize a UCP checkout payload into what the agent should relay. */
export function summarizeCheckout(c: any) {
  return {
    checkout_id: c.id,
    status: c.status,
    currency: c.currency,
    line_items: (c.line_items ?? []).map((l: any) => ({
      title: l.item?.title,
      quantity: l.quantity,
      unit_price: gbp(l.item?.price ?? 0),
      line_total: gbp(l.totals?.find((t: any) => t.type === "total")?.amount ?? 0),
    })),
    totals: (c.totals ?? []).map((t: any) => ({ label: t.display_text, amount: gbp(t.amount) })),
    notes: (c.messages ?? [])
      .filter((m: any) => m.severity !== "unrecoverable")
      .map((m: any) => m.content),
    expires_at: c.expires_at,
    payment_options: STORE_PAYMENT_OPTIONS,
    pay_url: c.continue_url,
  };
}
