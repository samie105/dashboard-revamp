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

## Buy rollout flag: released by default (2026-09-28)

`NEXT_PUBLIC_FIAT_BUY_FLOW` (`lib/fiat-flags.ts`) picks the Buy that
`BuySellClient` renders:

- unset, empty, or any value other than the explicit rollback value `legacy` →
  the guide flow (OnSwitch onramp plus the Bridge USD rail);
- `legacy` → the legacy Dollar Account → USDT buy.

The guide flow is now the release default for all authenticated users. This is
a build-time variable, so changing it needs a redeploy. Set it to `legacy`
only for an explicit frontend rollback. Regardless of the frontend value,
availability comes from `/fiat/config`, including the backend kill switch and
live provider readiness; an unconfigured live backend remains fail-closed.

## Sell rollout flag: released by default (2026-09-28)

`NEXT_PUBLIC_FIAT_SELL_FLOW` independently controls the new OnSwitch African
offramp UI:

- unset, empty, or any value other than the explicit rollback value `legacy` →
  `components/fiat/sell/FiatSellRouter.tsx`;
- `legacy` → the existing legacy Sell.

This is a build-time frontend rollout flag only. It is not a second kill
switch. The backend `FIAT_RAMP_ENABLED` switch still controls every fiat
read, quote, beneficiary, order, virtual-account, and confirmation operation.
The released Sell flow remains fail-closed until `/fiat/config`, an approved
OnSwitch profile, a provider-verified owned beneficiary, and a wallet signing
intent are all available.

## Decisions: Bridge USD in Buy (2026-09-28, CP6)

- The Buy component is `components/fiat/buy/FiatBuyFlow.tsx` (renamed from
  `OnswitchBuyFlow`, now that it renders both rails) and follows the legacy
  Buy layout.
- Rails come from `/fiat/config`; when both are offered, "Local currency"
  (OnSwitch) is the default tab and "USD" (Bridge) second.
- "Create USD account" consumes the backend-authoritative Bridge capability
  fields `supportedNetworks` and `defaultNetworkId` from `/fiat/config`.
  The frontend never hardcodes a chain or token address. Existing accounts
  from `GET /fiat/bridge/virtual-accounts` are still shown and polled.
- The wallet balance refreshes only when an activity item newly shows
  `providerStatus: "completed"` (guide §13 lines 1177-1178, §10.2 line 874),
  not on any change.
- Changing the amount or a picker clears the current quote: a quote is tied
  to its amount and corridor (guide §9.1), and §3.3 forbids reusing a key for
  a different amount.
- The Bridge verification section is collapsible, open by default only when
  there's no Bridge compliance record (layout only, never a gate).
- Bridge account creation additionally requires an owned wallet address on the
  backend-selected supported network; the browser sends only the network ID
  and literal `USDC` asset symbol.

## Decision: OnSwitch beneficiary requirements (2026-09-28)

The dashboard does not invent bank/mobile-money fields. It reads the safe,
normalized metadata from `GET /fiat/beneficiary-requirements` and renders a
typed form. Raw values stay in React memory until `POST /fiat/beneficiaries`;
the idempotency identity stores only a fingerprint. Only beneficiaries with
both `status: "verified"` and `ownershipStatus: "verified"` can reach a quote
or order.

## Decision: backend compliance authority, lane-specific UX guards (2026-09-28, CP4)

The backend remains the source of truth for customer compliance (guide intro,
lines 10-11). The frontend never authorizes a user, accepts a provider
customer ID, or skips the backend checks.

- The OnSwitch backend requires an owned customer with `status: "approved"`
  before both `POST /fiat/quotes` and `POST /fiat/orders`. The local Buy form
  mirrors that status as a UX guard so the user completes the profile before
  requesting a quote; the backend repeats the check and remains authoritative.
- `GET /fiat/compliance` fields (`status`, `kycStatus`, `tosStatus`,
  `endorsements`) are rendered without exposing provider customer IDs. Pending,
  rejected, suspended, or missing OnSwitch profiles do not unlock local Buy.
- Bridge KYC/virtual-account UI remains non-blocking: whether KYC is needed
  comes from `/fiat/config`, and the backend accepts or refuses the account
  request because there is no per-user approval field in that capability
  response.
- Refusals follow guide §12.1: 403 FORBIDDEN → stop and show compliance or
  ownership guidance; 409 → resolve state; everything else through the
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
- Bridge network decision (2026-09-28): the backend derives
  `supportedNetworks` from enabled WorldStreet wallet networks, the canonical
  USDC registry, and the shared Bridge payment-rail mapping. It returns one
  `defaultNetworkId`, selected from the backend-only `FIAT_RAMP_DEFAULT_NETWORK`
  override when valid, or the first supported network when the override is
  blank. An invalid explicit override returns no safe default, so the create
  CTA stays disabled. The browser sends only the backend network ID and the
  literal asset symbol `USDC`; the UI prefers the default only when that
  network is present in the user's own wallet and otherwise uses the first
  supported network the wallet owns.
- Open question (leave TODOs, don't guess): the exact Bridge beneficiary-create
  payload and ownership evidence for each supported USD external-account type.
  The canonical USDC contract source for withdrawals is resolved server-side
  from the backend's shared asset registry; the browser sends only `USDC`.
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

Built behind the existing rollout flags and backend capability gates (the
backend kill switch remains authoritative):
- OnSwitch offramp (beneficiary → quote → order → wallet signs `cryptoIntent` → `/confirm` → poll).
- Bridge USD withdrawal (lists only pre-existing verified, user-owned Bridge
  beneficiaries; beneficiary creation remains out of scope until its payload
  and ownership evidence are approved).
- Fiat order history/recovery (Transactions → Fiat orders).
Both withdrawal flows have the user sign real crypto transfers to provider
addresses.

## Open questions (sent to the backend team; don't guess the answers)

1. Ownership and review of the proxy allowlist change.
2. Bridge beneficiary request payload and verification method.
3. ANSWERED (2026-09-28): the backend's shared canonical USDC registry is the
   source of the Bridge withdrawal asset. The frontend sends `asset: "USDC"`
   and never copies a contract address into the request.
4. ANSWERED (2026-09-28): `walletId` comes from the existing wallet API/hook;
   Bridge virtual-account network selection comes from `/fiat/config`
   (`supportedNetworks` + `defaultNetworkId`), not a frontend constant.
5. The Bridge KYC return flow: redirect URL? new tab or popup? when to call `/sync`?
6. What happens to Flutterwave, existing fiat balances and in-flight payments.
7. ANSWERED (2026-09-28): the current backend requires an approved owned
   OnSwitch customer before an onramp quote or order. The frontend mirrors the
   status only to prevent a predictable failed request; the backend remains
   the final enforcement point.
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
    capability. `/fiat/config` has global route/network/channel signals
    (`readiness.complianceApproved`, the route's `requiresCustomerKyc`,
    `account.kycRequired`, and `withdrawalChannels`), but not a per-user
    approval field. The frontend keeps the capability panel display-only and
    lets the authenticated backend enforce the final customer gate; confirm
    whether a per-user preflight field should be added later.
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
