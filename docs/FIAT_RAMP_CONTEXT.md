# Fiat ramp frontend integration: working context

Read this before working on anything fiat-related in this repo.
Source of truth for API contracts: `docs/fiat-frontend-integration-guide.md`
(the WorldStreet "Fiat ↔ Crypto Frontend Integration Guide", 2026-09-26).
Never assume provider behaviour the guide doesn't state; flag gaps instead.

## Decision: Buy and Sell follow the guide (2026-09-27, overrides anything below)

Buy and Sell must follow `docs/fiat-frontend-integration-guide.md`.

- **Buy** → OnSwitch onramp (guide §9.1–9.2) for local currencies; Bridge USD
  virtual account (guide §10.1–10.2) for USD. Which rail is offered comes from
  `/fiat/config` (guide §5).
- **Sell** → OnSwitch offramp (guide §8, §9.2–9.3) for local currencies;
  Bridge USD withdrawal (guide §10.3) for USD.
- Port `BuySellClient` (mounted at `/buy`, `/sell` and in the money modal).
- Keep the old Buy/Sell code behind the rollback flag; don't delete it yet.
- Don't touch the Dollar Account balance display; the guide doesn't mention it.
- If a user has no modern wallet, STOP and ask; the guide doesn't say what to
  show.

This answers CP3 question Q1 (follow the guide); Q2 and Q5 are answered by
guide §5 (rail and asset come from `/fiat/config`). Q3 (what "fund" means) and
Q4 (users without a modern wallet) are still open. See
`docs/FIAT_LEGACY_ROUTE_MAP.md` section 8.

## Buy rollout flag: defaults to legacy (2026-09-28, rollout decision pending)

`NEXT_PUBLIC_FIAT_BUY_FLOW` (`lib/fiat-flags.ts`) picks the Buy that
`BuySellClient` renders:

- unset, or anything other than `onswitch` → the legacy Dollar Account →
  USDT buy (today's behaviour);
- `onswitch` → the guide flow (OnSwitch onramp). Its availability then comes
  from `/fiat/config`, including the backend kill switch.

The default stays `legacy` until the team decides the rollout. It's a
build-time variable, so switching needs a redeploy. Set it to `onswitch`
locally (with `NEXT_PUBLIC_FIAT_MOCKS=true`) to see the new Buy.

## Decisions: Bridge USD in Buy (2026-09-28, CP6)

- The Buy component is `components/fiat/buy/FiatBuyFlow.tsx` (renamed from
  `OnswitchBuyFlow`, now that it renders both rails) and follows the legacy
  Buy layout.
- Rails come from `/fiat/config`; when both are offered, "Local currency"
  (OnSwitch) is the default tab and "USD" (Bridge) second.
- "Create USD account" stays disabled until the backend confirms where the
  `networkId` comes from (open question 4). Existing accounts from
  `GET /fiat/bridge/virtual-accounts` are shown and polled.
- The wallet balance refreshes only when an activity item newly shows
  `providerStatus: "completed"` (guide §13 lines 1177-1178, §10.2 line 874),
  not on any change.
- Changing the amount or a picker clears the current quote: a quote is tied
  to its amount and corridor (guide §9.1), and §3.3 forbids reusing a key for
  a different amount.
- The Bridge verification section is collapsible, open by default only when
  there's no Bridge compliance record (layout only, never a gate).

## Decision: no frontend compliance gate (2026-09-27, CP4)

The backend is the source of truth for customer compliance (guide intro,
line 10-11). The frontend does not decide who is "approved".

- `GET /fiat/compliance` fields (`status`, `kycStatus`, `tosStatus`,
  `endorsements`) are used ONLY to render UI state. No frontend predicate
  such as "all approved" or `endorsements.base` unlocks anything.
- Whether KYC is needed comes from `/fiat/config`: the Bridge route's
  `requiresCustomerKyc` and `account.kycRequired` (guide §5).
- The Bridge virtual-account action is shown when capability gating says the
  Bridge virtual-account route is available (guide §5). The backend accepts
  or refuses the POST.
- Refusals follow guide §12.1: 403 FORBIDDEN → stop, show compliance
  guidance, don't retry; 409 → resolve state; everything else through the
  existing fiat error mapping.

## Decisions confirmed with the team (override anything below)

- We are PORTING the existing buy/sell/fund pages from the legacy flow
  (Flutterwave on the backend) to OnSwitch, and integrating Bridge into the
  existing USD/Dollar Account area. No new pages.
- Flutterwave/legacy will be removed later. For now keep legacy code behind a
  rollback flag until OnSwitch is verified on prod.
- Build locally without Clerk using a local-only mock mode. When live, the
  normal Clerk login and authenticated proxy are still required.
- Network/asset come from `/fiat/config` at runtime. The Bridge virtual
  account is not a fiat balance; funds arrive as USDC in the user's wallet.
- Open questions (leave TODOs, don't guess): Bridge beneficiary create
  payload; source of the canonical USDC contract address for withdrawals;
  whether an OnSwitch customer profile is required before onramp.
- **"Bridge" is an overloaded name in this repo.** The `/bridge` page,
  `components/bridge/`, `components/bridge-unauth/` and the
  `/api/crypto/bridge/intertrain/*` routes are the cross-chain USDC
  Intertrain bridge and have NOTHING to do with the Bridge USD provider
  from guide §10. Never modify those files for the fiat-ramp work, and
  never put Bridge USD (virtual account, KYC, withdrawal) code into that
  page or those routes. Per the 2026-09-27 decision above, Bridge USD
  is the USD rail inside the ported `BuySellClient` (Buy → virtual
  account, Sell → withdrawal). (An earlier version of this note pointed
  at `components/fund/*`; CP3 found `fund-client.tsx` isn't mounted and
  `hyperliquid-funding-client.tsx` is modern-wallet Hyperliquid funding,
  so neither is where Bridge goes.)

## What this work is

- Integrate OnSwitch (African local fiat ⇄ USDC) and Bridge (USD ⇄ USDC) into the dashboard.
- The crypto backend already implements every fiat route. The frontend consumes them.
  It does NOT call OnSwitch or Bridge directly, ever.
- Browser → `/api/crypto/...` (Next.js proxy, `app/api/crypto/[...path]/route.ts`)
  → `https://crypto-backend.worldstreetgold.com/v1/...`. The proxy attaches the Clerk token server-side.
- Value lands as on-chain USDC in the user's existing self-custodial WorldStreet wallet.
  A Bridge virtual account is a deposit instruction, not a fiat balance.
- No hosted checkout and no payment redirects. The only hosted or redirect flow is Bridge KYC.

## Hard rules

- No provider keys anywhere in this repo, in `NEXT_PUBLIC_*`, in bundles, logs or error reports.
- `CRYPTO_API_URL` is server-only (no `NEXT_PUBLIC_` prefix, no `/v1` suffix).
- Use the existing `cryptoBackendClient` (`lib/crypto-backend/client.ts`). Extend it; don't write a parallel client.
- Every mutation sends an `Idempotency-Key` (UUID):
  - one key per logical action;
  - reuse the same key only for an exact retry after a timeout or uncertain response;
  - persist in-flight keys (e.g. sessionStorage) so a refresh mid-request reuses them;
  - `/orders/:id/confirm` uses its own key, separate from order creation.
- HTTP 201 means the record was created, NOT that the payment settled. HTTP 200 on a mutation may be an idempotent replay: render it as the same resource.
- Settlement is known only by polling the owned backend resource. Backoff: 2s, 4s, 8s, 15s, 30s, then 30–60s. Stop at terminal states, refetch on focus and after a wallet tx submit. Virtual account activity: 15–30s.
- Derive corridors, assets, networks and channels from `GET /fiat/config` at runtime. Never hardcode them.
- Branch error handling on `error.status` and `error.code`, never on the message. Keep `requestId` for support.
- Log only status, code and requestId. Never log account numbers, KYC URLs, tokens or payment instructions.
- Render provider-supplied data as plain text (no `dangerouslySetInnerHTML`). Validate that `kycLink.url` is https before opening it with `noopener,noreferrer`.
- Only allow beneficiaries with `status === 'verified' && ownershipStatus === 'verified'`.

## Scope for the current deadline

In scope:
1. Foundations: typed contracts for all fiat routes, client methods, idempotency-key manager, polling hook, capability gating, error mapping.
2. OnSwitch onramp end to end (config → quote with expiry → order → payment instructions → poll).
3. Proxy allowlist additions for compliance, institutions and beneficiaries, plus matching typed client methods.
4. Bridge KYC (kyc-link → hosted flow → sync → compliance) and the USD virtual account screen with activity.

Built but DISABLED (hidden behind capability gating until specified and tested):
- OnSwitch offramp (beneficiary → quote → order → wallet signs `cryptoIntent` → `/confirm` → poll).
- Bridge USD withdrawal (the Bridge beneficiary payload is undocumented).
Both have the user sign real crypto transfers to provider addresses.

## Open questions (sent to the backend team; don't guess the answers)

1. Ownership and review of the proxy allowlist change.
2. Bridge beneficiary request payload and verification method.
3. The source of the canonical Bridge USDC contract address used as `asset` on withdrawals.
4. Where `walletId` comes from (existing wallet API or hook) and how the network is chosen.
5. The Bridge KYC return flow: redirect URL? new tab or popup? when to call `/sync`?
6. What happens to Flutterwave, existing fiat balances and in-flight payments.
7. Whether OnSwitch customer setup or KYC is required before an onramp quote.
8. Fees and amounts to show for a Bridge withdrawal (there is no quote step).
9. Wrong-amount, late or duplicate bank deposits: refund behaviour and UI copy.
10. The formal list of terminal order states. The guide never lists them:
    §11 groups states by UI meaning and §13 (line 1185) polls a Bridge
    offramp "until completed, failed, reversed, or manual review". Until
    confirmed, the frontend treats `completed`, `failed`, `reversed`,
    `refunded`, `refund_failed` as final; pauses automatic polling on
    `manual_review` / `blocked` (focus refetch still works); and keeps
    polling `refund_in_flight` at the slow end of the ladder, because a
    refund in flight can still change. Confirm each, especially
    `manual_review`, `refund_in_flight` and whether `refunded` /
    `refund_failed` can move again.
11. `GET /fiat/orders` pagination and filters; per-user rate limits.
12. `providerDisplay` shape for MOBILE_MONEY channels.
13. Whether the proxy checks `Origin` on mutations (CSRF defence in depth).
14. How to simulate deposits in sandbox for OnSwitch and Bridge.
15. Confirmation that credentials pasted during setup were rotated.
16. Guide §11 says show the backend's safe reason for the `failed`,
    `reversed`, `refund_in_flight`, `refunded` and `refund_failed`
    states but doesn't name the field. `FiatOrder` in
    `lib/crypto-backend/types.ts` carries three candidates:
    `failureReason`, `reviewReason`, `refundReason`. Confirm which
    field carries the reason for each state (and whether more than
    one may be populated at once).
17. Guide §12.1 (409 row) lists `IDEMPOTENT_REQUEST_FAILED` with
    "Reuse the same key for an in-flight retry; use a new key only for a
    new logical action", but doesn't say whether a replay that failed
    counts as in-flight. Until confirmed, the frontend KEEPS the key
    (the safe side: it can never cause a duplicate). Confirm whether the
    UI should instead mint a new key after this code.
18. Guide §12.2 (lines 1093-1094) says to show a safe generic message,
    while the §12.3 sample `userMessage` falls back to `error.message`.
    The frontend shows the generic message for unknown codes so provider
    text can't reach the UI. Confirm that's intended.
19. The guide documents no per-user "can create a Bridge virtual account"
    capability. `/fiat/config` only has global signals
    (`readiness.complianceApproved`, the route's `requiresCustomerKyc`,
    `account.kycRequired`). Is there, or will there be, a per-user field the
    frontend should read instead of letting the POST be refused?
20. Which error code (and HTTP status) does
    `POST /fiat/bridge/virtual-accounts` return for a user whose Bridge
    compliance isn't complete? The guide doesn't say. The frontend currently
    treats 403 FORBIDDEN as "finish verification" and anything else through
    the normal error mapping.
21. Guide §7 says to use `POST /fiat/compliance/customer` "when the
    integration has the required fields" but doesn't list which OnSwitch
    fields are required. The form sends every documented field the user
    filled in and shows the backend's `fieldErrors` (guide §12.2
    INVALID_REQUEST) for anything missing. Confirm the required set.
22. ANSWERED (2026-09-28): no separate `tosUrl` screen. Guide §7 says to
    open `kycLink.url`; that is all the frontend does.
23. Should the dashboard's Deposit button offer Buy? Today it calls
    `openDoor("deposit")` (`components/dashboard/user-card.tsx:498`), whose
    chooser only offers "From your Dollar Account" (Hyperliquid funding) and
    "From crypto" (receive). The ported Buy is reachable at `/buy` and on the
    money modal's Deposit tab, which only Vivid opens (`openFlow("buy")`).
    Product decision pending the team, including the door's label (the
    chooser copy in `components/flows/money-doors.tsx` is the owner's
    wording). Not built. For local testing, open the Buy tab from the
    console: `window.dispatchEvent(new CustomEvent("vivid:open-panel",
    { detail: { panel: "deposit" } }))`.
24. Product wording for the new Buy screens. These are placeholders, not
    from the guide, pending the team:
    - rail tabs: "Local currency" / "USD"
    - Buy subtitle: "Pay from your bank, receive crypto in your Worldstreet
      wallet"; USD header: "Buy with USD" / "Bank transfer to your
      Worldstreet wallet"
    - status stages: "Order created", "Waiting for your bank payment",
      "Payment being processed", "Delivered to your wallet"
    - order headlines ("Send the bank transfer", "Your order is being
      processed", "Your order is being reviewed", "Done — your crypto is in
      your Worldstreet wallet", and the failed / reversed / refund lines)
    - USD account: "Send USD to", "USD you send here arrives as … This is a
      deposit address for your bank transfer, not a balance.", "No deposits
      yet. Bank transfers show here once they've been received.", "Creating a
      USD account isn't available yet"
    - quote note: "A quote shows the price; it doesn't reserve funds."
    - the sandbox banner and the unavailable-state panels