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
`https://flyingtiger.com/en-gb/cart/<variant_id>:<qty>,...` (Shopify cart permalink on the en-gb storefront). Verified live 2026-10-06: the permalink 302s straight to the store's checkout page and `cart.js` reports `currency: GBP` with the right lines and totals. The UCP `/buy` permalink needs the (OAuth-gated) UCP checkout flow, so not used.

## 6. Does `localDev()` accept LAN requests?
`localDev()` is gated on the process env (`EVE_DEV=1`), not on request origin — so yes for any interface the server listens on. **But `eve dev` binds `127.0.0.1` only by default** (the docs' "all interfaces" claim did not hold on 0.71.2/macOS). For the phone test run: `npm exec -- eve dev -- --host 0.0.0.0` and open `http://<laptop-ip>:2000`.

## 7. Approval stream event
Verified live 2026-10-06. `input.requested` with `data.requests[]`; each request is `{kind: "tool-approval", requestId: "aitxt-…", prompt, display: "confirmation", allowFreeform: false, options: [{id: "approve", label: "Approve"}, {id: "cancel", label: "Cancel"}], action: {kind: "tool-call", callId, toolName, input}}`. Answer with `POST /eve/v1/session/<id> {"inputResponses":[{"requestId":"…","optionId":"approve"|"cancel"}]}` — note the decline option id is **cancel**, not "reject". The chat page's buttons send exactly these.

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

## Model credential quirk (verified 2026-10-06)
The provided key is **user-scoped** (`sk-ant-usr-…`): every API call must include an `anthropic-workspace-id` header or Anthropic returns 400. `GET /v1/organizations/workspaces` works with the bare key and lists the workspaces; only **"cursor dev"** (`wrkspc_01N5xsJ8ExFrbYdqAkERPrbh`) accepts this key. eve's built-in `anthropic()` helper cannot add headers, so `agent/agent.ts` uses `createAnthropic({apiKey, headers})` from `@ai-sdk/anthropic` directly, with the workspace id in `.env` as `ANTHROPIC_WORKSPACE_ID`.

## End-to-end verification (2026-10-06, live agent on claude-sonnet-5)
- "Trick or treat bags for 8 kids under £25" → disclosure, `halloween_search`, 8× £3 Hocus Pocus buckets (£24), `check_rules` pass with free-shipping-gap warning, no basket padding.
- "Yes, send it to checkout" → `hand_off_checkout` raised the approval gate; after approve: live stock re-check, checkout link `https://flyingtiger.com/en-gb/cart/58424157045084:8`, no-payment + not-reserved messaging.
- "Ordering on 25 October, party stuff for 10" → cutoff refusal, `store_locator` link, no delivery basket built.
- Homepage + chat overlay verified by screenshot at phone width (Club-app mock non-clickable, spinning pumpkin button opens chat; `#chat` deep-link).

## How native can UCP checkout go? (probed live 2026-10-06)
With the hosted agent profile — and **no Shop-account OAuth** — these all work:
- `create_cart` → cart GID, authoritative GBP line/total amounts (minor units), item images, 30-day expiry, and a `continue_url` that opens the same cart session on the store.
- `create_checkout` (needs `line_items`, not `cart_id`; destination uses flat fields `address_country`/`postal_code`) → checkout GID + totals, but with postcode-only it returns `status: "requires_escalation"` with recoverable errors: `delivery_address_required` (full address), `buyer_identity_contact_method_required` (email), `extension_interaction_required`. **No shipping rate is returned until a full address + contact is supplied.**
- `cancel_cart` / `cancel_checkout` work (tests cleaned up).
Fully native payment would require: collecting full address + email in chat (brief §5 rule 7 forbids beyond postcode) and attaching a Google Pay token via `update_checkout` → `complete_checkout`. The declared Google Pay handler is bound to `merchant_origin: flyingtiger.com`, so a token minted from our own page/origin wouldn't be valid anyway. Conclusion: basket + checkout creation can be UCP-native; **payment is structurally a hand-off** for this MVP. Optional upgrade: have `hand_off_checkout` create the UCP cart and return its `continue_url` instead of the `/en-gb/cart/<id>:<qty>` permalink (same destination, but session-synced and expiry-aware).
