# Findings — Flying Tiger Halloween agent (verified 2026-10-06)

Answers to the brief's §11 "verify first" list.

## 1. Does the MCP endpoint accept unauthenticated connections?
Yes at the protocol layer: `initialize` and `tools/list` need no credentials, no session header (stateless; `x-shopify-ucp-mcp-api-version: 2026-08-25`). **But every `tools/call` requires `meta.ucp-agent.profile`** — a URL to a publicly hosted agent-profile JSON that Shopify fetches server-side and validates. Cart/checkout/order additionally declare Shop-Accounts OAuth (`accounts.shop.app`) identity linking — not exercised in this MVP (catalog tools only).

### The agent profile recipe (derived empirically from the gate's error messages)
Each error names the next missing field. The minimal accepted profile:
```json
{"ucp": {
  "version": "2026-08-25",
  "name": "...", "description": "...",
  "services": {"dev.ucp.shopping": [{"version": "2026-08-25", "spec": "https://ucp.dev/2026-08-25/specification/overview/"}]},
  "capabilities": {
    "dev.ucp.shopping.catalog.search": [{"version": "2026-08-25"}],
    "dev.ucp.shopping.catalog.lookup": [{"version": "2026-08-25"}],
    "dev.ucp.shopping.cart": [{"version": "2026-08-25"}],
    "dev.ucp.shopping.checkout": [{"version": "2026-08-25"}],
    "dev.ucp.shopping.order": [{"version": "2026-08-25"}]
  },
  "payment_handlers": {}
}}
```
Gotchas, in the order the gate complained: must be reachable over plain HTTP GET → must contain `ucp.version` → must be served with `Content-Type: application/json` (GitHub gist *raw* serves `text/plain` and is rejected; `gist.githack.com/<user>/<id>/raw/<rev>/<file>` serves proper JSON) → must have `services` → must have `payment_handlers` (empty object is accepted; the key is `payment_handlers`, NOT `payment.handlers`). After discovery succeeds, **tool dispatch is filtered by the capabilities the agent declares** — with `services: {}` every call returns "Tool not found".

Ours: public gist `MishiPRODuct/ea2ec206a465e6d91bd6414d3874013e`, revision-pinned githack URL in `agent/connections/flying-tiger.ts`.

## 2. Does catalog search return GBP / GB availability?
Yes. `catalog.context = {"address_country":"GB","language":"en-GB","currency":"GBP"}` is honoured per request: prices come back as `{"amount": 450, "currency": "GBP"}` (**minor units — pence**), URLs are `/en-gb/`, variants carry `availability.available`. No separate market handshake.

## 3. Exact MCP tool names
13, matching the OpenRPC schema 1:1: `search_catalog`, `lookup_catalog`, `get_product`, `create_cart`, `get_cart`, `update_cart`, `cancel_cart`, `create_checkout`, `get_checkout`, `update_checkout`, `complete_checkout`, `cancel_checkout`, `get_order`. All require `meta`. No Shopify vendor extras exposed.

## 4. Does `products.json` work on `/en-gb/collections/<handle>`?
Yes — primary MVP catalog source. GBP prices, `available` flags, tags, variant ids. **Node's default fetch UA gets HTTP 429 instantly; a browser-style User-Agent works.** Keep the 1s inter-request delay. Snapshot of 2026-10-06: 315 unique variants, 286 in stock, £0.50–£15.

## 5. Which permalink form opens a GBP cart?
`https://flyingtiger.com/en-gb/cart/<variant_id>:<qty>,...` (Shopify cart permalink on the en-gb storefront). The UCP `/buy` permalink needs the (OAuth-gated) UCP checkout flow, so not used. _Phone confirmation of the GBP cart pending the device test._

## 6. Does `localDev()` accept LAN requests?
`localDev()` is gated on the process env (`EVE_DEV=1`), not on request origin — so yes for any interface the server listens on. **But `eve dev` binds `127.0.0.1` only by default** (the docs' "all interfaces" claim did not hold on 0.71.2/macOS). For the phone test run: `npm exec -- eve dev -- --host 0.0.0.0` and open `http://<laptop-ip>:2000`.

## 7. Approval stream event
`input.requested` with `data.requests[]`, each `{kind: "tool-approval", requestId, action: {callId, ...}}`; answer with `POST /eve/v1/session/<id> {"inputResponses":[{"requestId":"...","optionId":"approve"}]}` (a plain message `"approve"`/`"reject"` also resolves it). The chat page logs every raw event to the browser console (`[eve]` prefix) — copy the exact shape from there on first real run.

## 8. eve evals for snapshot cases
Not investigated (eval harness descoped from this MVP). `eve eval` exists in the scaffold scripts; revisit when building the judge.

## 9. Vercel plan for deploy
Not applicable — this MVP is local-only. No cron is used anywhere.

## 10. Can `home.ts` serve a static file?
eve configures Nitro with `publicAssets: []` (no static dir). `fs.readFile(web/index.html)` per request works under `eve dev` (hot-editable) but would NOT be traced into a production bundle — inline the HTML as a string if this ever deploys.

## Other facts
- eve pinned at **0.71.2**; Node 25.3 (eve needs ≥24). `eve dev` port **2000**.
- Model: `anthropic("claude-sonnet-5")` via `eve/models/anthropic`, reads `ANTHROPIC_API_KEY` from `.env` — one line to switch models later in `agent/agent.ts`.
- Free shipping ≥ £40 and the £115 import-duty note are confirmed on the live GB site. The sub-£40 shipping fee is **not published** — the agent says "calculated at checkout".
- No rate-limit headers on the MCP endpoint; `products.json` 429s on non-browser UAs (see #4).
