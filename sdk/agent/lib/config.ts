// BrandConfig — the heart of the SDK. One JSON file per brand under brands/;
// selected at boot with BRAND=<name>. Everything brand-specific lives here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const BrandConfigSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  displayName: z.string(),
  storefront: z.object({
    domain: z.string(),              // e.g. "www.muji.us"
    basePath: z.string().default(""), // e.g. "/en-gb" for market-scoped storefronts
    market: z.object({
      country: z.string().length(2),
      language: z.string(),
      currency: z.string().length(3),
    }),
  }),
  catalog: z.union([
    z.object({ scope: z.literal("all") }),
    z.object({ scope: z.literal("collections"), handles: z.array(z.string()).min(1) }),
  ]),
  rules: z
    .object({
      freeShippingThreshold: z.number().positive().nullable().default(null),
      dutiesThreshold: z.number().positive().nullable().default(null),
      orderCutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
      cutoffMessage: z.string().nullable().default(null),
      ageSensitiveKeywords: z.array(z.string()).default([]),
      notes: z.array(z.string()).default([]),
    })
    .default({ freeShippingThreshold: null, dutiesThreshold: null, orderCutoffDate: null, cutoffMessage: null, ageSensitiveKeywords: [], notes: [] }),
  persona: z.object({
    tone: z.string().default("friendly, concise, helpful"),
    scope: z.string(),               // what the agent is for, in one sentence
    disclosure: z.boolean().default(true),
    welcome: z.string(),             // first message shown in the widget
    examplePrompt: z.string(),       // suggestion shown to the shopper
  }),
  links: z
    .object({
      storeLocator: z.string().url().nullable().default(null),
      help: z.string().url().nullable().default(null),
    })
    .default({ storeLocator: null, help: null }),
  theme: z.object({
    accent: z.string().default("#111111"),
    bg: z.string().default("#ffffff"),
    userBubble: z.string().default("#111111"),
    botBubble: z.string().default("#f4f1ea"),
    launcher: z.string().default("🛍️"),
    headerBg: z.string().default("#ffffff"),
    headerText: z.string().default("#111111"),
  }),
  model: z.object({ id: z.string().default("claude-sonnet-5") }).default({ id: "claude-sonnet-5" }),
});

export type BrandConfig = z.infer<typeof BrandConfigSchema>;

let cached: BrandConfig | null = null;

export function brandName(): string {
  const b = process.env.BRAND;
  if (!b) throw new Error("Set BRAND=<name> (a file under brands/<name>.json)");
  return b;
}

export function loadBrand(): BrandConfig {
  if (cached) return cached;
  const file = join(process.cwd(), "brands", `${brandName()}.json`);
  cached = BrandConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  return cached;
}

export const storeBase = (c: BrandConfig) => `https://${c.storefront.domain}${c.storefront.basePath}`;
export const money = (c: BrandConfig, n: number) =>
  new Intl.NumberFormat(c.storefront.market.language, { style: "currency", currency: c.storefront.market.currency }).format(n);
