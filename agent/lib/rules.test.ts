import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRules, type BasketLine } from "./rules.ts";

const line = (over: Partial<BasketLine> = {}): BasketLine => ({
  variant_id: 1,
  title: "Halloween garland",
  price_gbp: 2,
  qty: 1,
  in_stock: true,
  tags: [],
  ...over,
});

test("£38 basket: passes, warns about free-shipping distance", () => {
  const r = checkRules({
    order_date: "2026-10-10",
    lines: [line({ price_gbp: 19, qty: 2 })],
  });
  assert.equal(r.passes, true);
  assert.equal(r.subtotal_gbp, 38);
  assert.equal(r.free_shipping, false);
  assert.equal(r.gbp_to_free_shipping, 2);
  assert.ok(r.warnings.some((w) => w.includes("£2.00 below the £40")));
});

test("£120 basket: passes with import-duties warning, free shipping", () => {
  const r = checkRules({
    order_date: "2026-10-10",
    lines: [line({ price_gbp: 12, qty: 10 })],
  });
  assert.equal(r.passes, true);
  assert.equal(r.free_shipping, true);
  assert.ok(r.warnings.some((w) => w.includes("£115")));
});

test("ordering on 25 October: hard fail with store locator", () => {
  const r = checkRules({ order_date: "2026-10-25", lines: [line()] });
  assert.equal(r.passes, false);
  assert.ok(r.hard_fails.some((f) => f.includes("store-locator")));
});

test("make-up kit for a 2-year-old: hard fail", () => {
  const r = checkRules({
    order_date: "2026-10-10",
    shopper_ages: [2, 35],
    lines: [line({ title: "Halloween make-up kit" })],
  });
  assert.equal(r.passes, false);
  assert.ok(r.hard_fails.some((f) => f.includes("not suitable for a child under 3")));
});

test("unknown age mark for under-3: passes but says unknown", () => {
  const r = checkRules({
    order_date: "2026-10-10",
    shopper_ages: [2],
    lines: [line({ title: "Paper garland" })],
  });
  assert.equal(r.passes, true);
  assert.ok(r.warnings.some((w) => w.includes("unknown")));
});

test("out-of-stock line: hard fail naming the item", () => {
  const r = checkRules({
    order_date: "2026-10-10",
    lines: [line({ in_stock: false, title: "Skeleton garland" })],
  });
  assert.equal(r.passes, false);
  assert.ok(r.hard_fails.some((f) => f.includes("Skeleton garland")));
});

test("budget too small: hard fail on budget", () => {
  const r = checkRules({
    order_date: "2026-10-10",
    budget_gbp: 1,
    lines: [line({ price_gbp: 2 })],
  });
  assert.equal(r.passes, false);
  assert.ok(r.hard_fails.some((f) => f.includes("exceeds the budget")));
});

test("exact cutoff day 22 Oct still allowed", () => {
  const r = checkRules({ order_date: "2026-10-22", lines: [line()] });
  assert.equal(r.passes, true);
});
