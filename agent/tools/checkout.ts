import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { getCatalog } from "../lib/catalog";
import { ucpCall, summarizeCheckout, GB_CONTEXT } from "../lib/ucp";

// Native UCP checkout against Flying Tiger's official endpoint: creates a real
// server-side checkout session and returns its authoritative GBP totals, the
// store's accepted payment methods, and the hosted URL where the shopper
// finishes (address, shipping, payment). This store's UCP build escalates
// address/shipping/payment entry to its own page ("extension interaction
// required"), so those steps cannot be completed in-chat; the pay_url is the
// final payment option.
export default defineTool({
  description:
    "Create a native checkout for the agreed basket via Flying Tiger's UCP API. Re-checks live stock, then " +
    "returns the store's own checkout session: line items, authoritative totals, accepted payment options " +
    "(Google Pay, card, Shop Pay), and the pay_url the shopper opens to enter address/shipping and pay. " +
    "Only call after check_rules passes and the shopper has confirmed the basket.",
  approval: once(),
  inputSchema: z.object({
    lines: z
      .array(
        z.object({
          variant_id: z.number().describe("Variant id from halloween_search"),
          qty: z.number().int().positive(),
        }),
      )
      .min(1),
    buyer_email: z
      .string()
      .email()
      .optional()
      .describe("Shopper's email if they volunteered it — prefills the store checkout"),
  }),
  async execute({ lines, buyer_email }) {
    const { items, source } = await getCatalog();
    const byId = new Map(items.map((i) => [i.variant_id, i]));
    const problems: string[] = [];
    for (const { variant_id } of lines) {
      const item = byId.get(variant_id);
      if (!item) problems.push(`Variant ${variant_id} is not in the Halloween catalog.`);
      else if (!item.in_stock) problems.push(`"${item.title}" went out of stock.`);
    }
    if (problems.length > 0) return { ok: false, problems, stock_source: source };

    try {
      const checkout = await ucpCall("create_checkout", {
        checkout: {
          line_items: lines.map((l) => ({
            item: { id: `gid://shopify/ProductVariant/${l.variant_id}` },
            quantity: l.qty,
          })),
          context: GB_CONTEXT,
          ...(buyer_email ? { buyer: { email: buyer_email } } : {}),
        },
      });
      return { ok: true, via: "ucp", ...summarizeCheckout(checkout), stock_source: source };
    } catch (err) {
      // UCP down or rejecting: fall back to the plain Shopify cart permalink.
      const cart = lines.map((l) => `${l.variant_id}:${l.qty}`).join(",");
      return {
        ok: true,
        via: "permalink-fallback",
        note: `UCP checkout unavailable (${(err as Error).message.slice(0, 120)}); using cart permalink instead.`,
        pay_url: `https://flyingtiger.com/en-gb/cart/${cart}`,
        stock_source: source,
      };
    }
  },
});
