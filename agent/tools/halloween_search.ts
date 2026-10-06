import { defineTool } from "eve/tools";
import { z } from "zod";
import { getCatalog, searchItems } from "../lib/catalog";

export default defineTool({
  description:
    "Search the Flying Tiger GB Halloween collections (live data, 10-min cache; snapshot fallback). " +
    "Returns GBP prices and live stock flags. Only items returned by this tool may be quoted to the shopper.",
  inputSchema: z.object({
    query: z.string().min(1).describe("What the shopper wants, e.g. 'trick or treat bags'"),
    max_price: z.number().positive().optional().describe("Max price per item in GBP"),
    include_out_of_stock: z.boolean().optional().default(false),
    limit: z.number().int().min(1).max(30).optional().default(12),
  }),
  async execute({ query, max_price, include_out_of_stock, limit }) {
    const { items, source } = await getCatalog();
    const results = searchItems(items, query, {
      maxPrice: max_price,
      includeOutOfStock: include_out_of_stock,
    }).slice(0, limit);
    return {
      source,
      count: results.length,
      results: results.map((i) => ({
        variant_id: i.variant_id,
        title: i.title,
        price_gbp: i.price_gbp,
        in_stock: i.in_stock,
        collections: i.collections,
        url: i.url,
        image: i.image ? `${i.image.split("?")[0]}?width=360` : null,
      })),
    };
  },
});
