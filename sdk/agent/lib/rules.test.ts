import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRules, type BasketLine } from "./rules.ts";
import { BrandConfigSchema, type BrandConfig } from "./config.ts";

const ftLike: BrandConfig = BrandConfigSchema.parse({
  name: "test-ft",
  displayName: "Test",
  storefront: { domain: "x.com", basePath: "/en-gb", market: { country: "GB", language: "en-GB", currency: "GBP" } },
  catalog: { scope: "all" },
  rules: {
    freeShippingThreshold: 40,
    dutiesThreshold: 115,
    orderCutoffDate: "2026-10-22",
    ageSensitiveKeywords: ["make-?up", "face paint", "fake blood"],
  },
  persona: { scope: "test", welcome: "hi", examplePrompt: "x" },
  theme: {},
});

const bare: BrandConfig = BrandConfigSchema.parse({
  name: "test-bare",
  displayName: "Bare",
  storefront: { domain: "y.com", market: { country: "US", language: "en-US", currency: "USD" } },
  catalog: { scope: "all" },
  persona: { scope: "test", welcome: "hi", examplePrompt: "x" },
  theme: {},
});

const line = (over: Partial<BasketLine> = {}): BasketLine => ({
  variant_id: 1, title: "Garland", price: 2, qty: 1, in_stock: true, tags: [], ...over,
});

test("£38 basket: passes with free-shipping distance warning", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-10", lines: [line({ price: 19, qty: 2 })] });
  assert.equal(r.passes, true);
  assert.equal(r.subtotal, 38);
  assert.equal(r.free_shipping, false);
  assert.equal(r.to_free_shipping, 2);
  assert.ok(r.warnings.some((w) => w.includes("£2.00")));
});

test("£120 basket: duties warning, free shipping", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-10", lines: [line({ price: 12, qty: 10 })] });
  assert.equal(r.passes, true);
  assert.equal(r.free_shipping, true);
  assert.ok(r.warnings.some((w) => w.includes("£115")));
});

test("past cutoff: hard fail", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-25", lines: [line()] });
  assert.equal(r.passes, false);
});

test("cutoff day itself still allowed", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-22", lines: [line()] });
  assert.equal(r.passes, true);
});

test("make-up for 2-year-old: hard fail", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-10", shopper_ages: [2], lines: [line({ title: "Halloween make-up kit" })] });
  assert.equal(r.passes, false);
});

test("no age mark for under-3: warn unknown", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-10", shopper_ages: [2], lines: [line({ title: "Paper garland" })] });
  assert.equal(r.passes, true);
  assert.ok(r.warnings.some((w) => w.includes("unknown")));
});

test("out of stock: hard fail", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-10", lines: [line({ in_stock: false })] });
  assert.equal(r.passes, false);
});

test("over budget: hard fail", () => {
  const r = checkRules(ftLike, { order_date: "2026-10-10", budget: 1, lines: [line({ price: 2 })] });
  assert.equal(r.passes, false);
});

test("bare config: no thresholds -> no warnings, free_shipping null", () => {
  const r = checkRules(bare, { order_date: "2099-01-01", lines: [line({ price: 500 })] });
  assert.equal(r.passes, true);
  assert.equal(r.warnings.length, 0);
  assert.equal(r.free_shipping, null);
});

test("bare config: USD formatting in budget fail", () => {
  const r = checkRules(bare, { order_date: "2026-10-10", budget: 1, lines: [line({ price: 2 })] });
  assert.ok(r.hard_fails[0].includes("$2.00"));
});
