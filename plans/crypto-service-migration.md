# Plan: Migrate the dashboard backend to worldstreet-crypto

> Target: the dashboard stops owning crypto backend logic and becomes a client of
> `worldstreet-crypto`, matching the mobile app's contract 1:1.
>
> Revised after review. Superseded assumptions are called out where they'd
> otherwise mislead.

## Architectural decisions

Settled. These apply across all phases.

- **One backend.** `worldstreet-crypto` (Hono + `@clerk/backend` + Mongoose, Node 22)
  owns crypto domain logic. The dashboard keeps UI plus thin forwarding routes.
- **No data migration.** The service already uses the same MongoDB (`user-account`)
  and the same collections. `UserWallet` is equivalent on both sides. This moves
  *which process writes* the collections, not the data.
- **spotv2 does not survive.** The ledger-CFD engine is deleted, not ported. Spot
  trading becomes real Hyperliquid execution via `POST /api/trade/spot`.
- **The NGN ramp is going away.** Buying becomes `POST /api/buy` (Dollar Account),
  selling `POST /api/sell`. The fiat leg lives in `worldstreet-wallet`.
- **Unified trading wallet.** The user's Ethereum Privy wallet *is* the trading
  wallet, matching the service and mobile. See Phase 4 for the balance sweep.
- **Transport: proxy first, with an allowlist.** One catch-all Next.js route
  forwards to the service, exchanging the Clerk cookie for a bearer token. It
  forwards only allowlisted prefixes and 404s otherwise.
- **Market data goes direct to Hyperliquid, not through the service.** Mobile
  already does this in `src/features/crypto/api/hlPublic.ts` — order book and
  candles are public, unauthenticated data. Mirror that file.
- **Typed client mirrors mobile.** Response types copied from mobile's
  `src/features/crypto/api/index.ts` so both clients share one contract.

## Already done

Shipped while planning — these are no longer future work.

| Change | Where |
|---|---|
| Tron sell (`/api/sell` accepts tron, `waitForTronConfirmation`, TRX pre-flight) | `worldstreet-crypto` `d969e5f` |
| `Withdrawal.chain` + `TreasuryWallet.network` widened to accept tron | `worldstreet-crypto` `d969e5f` |
| Buy-time TRX top-up on Tron disbursements | `worldstreet-admin` `61526ff` |
| `Withdrawal.chain` widened dashboard-side | this repo |
| `SellNetwork` widened + Tron listed first | `worldstreet-app` |

## Scale

| Area | Lines | Fate |
|---|---|---|
| spotv2 (routes, page, components, lib, 7 models, 2 hooks) | ~6,000 | delete |
| NGN ramp (deposit + withdraw + flutterwave + lib/deposit) | ~3,500 | delete |
| spot v1 + lib/hyperliquid | ~9,000 | mostly delete |

---

## Phase 0 — Foundations

No behaviour change; everything after is reversible per-endpoint.

1. **Env.** `CRYPTO_API_URL`, server-only — the proxy runs server-side, so this
   must *not* be `NEXT_PUBLIC_`.
2. **Catch-all proxy** at `app/api/[...path]/route.ts`. In the App Router a
   specific route wins over a catch-all, so deleting a local route file *is* the
   cutover and restoring it is the rollback. **Verify that precedence holds**
   before relying on it.

   ```ts
   import { auth } from "@clerk/nextjs/server"

   const CRYPTO_API = process.env.CRYPTO_API_URL!

   // Explicit allowlist. Without it every 404 silently proxies, and a webhook
   // whose route was deleted gets a 401 (no Clerk session) instead of a 404 —
   // which reads to the caller as retriable rather than gone.
   const FORWARDED = ["wallet/", "transactions/", "wallet-transfers", "swap", "privy/", "tokens/"]

   async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
     const { path } = await ctx.params
     const target = path.join("/")
     if (!FORWARDED.some((p) => target.startsWith(p))) return new Response(null, { status: 404 })

     const { getToken } = await auth()
     const token = await getToken()
     if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 })

     const { search } = new URL(req.url)
     const res = await fetch(`${CRYPTO_API}/api/${target}${search}`, {
       method: req.method,
       headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
       body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
     })
     // Pass the upstream content-type through rather than forcing JSON, so a
     // streaming endpoint isn't silently broken later.
     return new Response(res.body, {
       status: res.status,
       headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
     })
   }

   export { forward as GET, forward as POST, forward as PATCH, forward as DELETE }
   ```

3. **Typed client** at `lib/crypto-api.ts`, types lifted from mobile. Base path
   stays `/api/*` so it works through the proxy unchanged.
4. **Middleware.** Keep proxied paths protected in [middleware.ts](../middleware.ts) —
   the proxy needs a live Clerk session to mint a token.

**Exit:** proxy deployed, nothing routed through it yet.

---

## Phase 1 — Cut over the already-compatible endpoints

Verified as near-verbatim ports with matching shapes (`wallet/balances`,
`transactions/unified`, and `swap` were diffed line-for-line; the service's
balances response is a superset — it adds custom tokens and dedupes). Delete the
local route, let the catch-all take it, verify, move on. No UI changes.

| Delete | Service endpoint |
|---|---|
| `app/api/wallet/balances/` | `GET /api/wallet/balances` |
| `app/api/transactions/unified/` | `GET /api/transactions/unified` |
| `app/api/wallet-transfers/` | `GET/POST /api/wallet-transfers` |
| `app/api/swap/` | `GET/POST /api/swap` |
| `app/api/privy/{get-wallet,get-wallet-by-clerk,onboarding,pregenerate-wallet,link-clerk,refresh-wallet,add-wallet-signer}/` | same paths |
| `app/api/privy/wallet/send/`, `wallet/solana/send-token/` | same paths |

Also fixes a live bug for free: [assets-client.tsx:185](../components/assets/assets-client.tsx:185)
already calls `/api/tokens/metadata` and `/api/tokens/custom`, which have **no
local route** — they exist only on the service. Custom-token add is broken on web
today; adding `tokens/` to the allowlist repairs it.

**Exit:** ~15 endpoints served by the crypto service, UI untouched.

---

## Phase 2 — Delete spotv2

Pure deletion, ~6,000 lines. Do it before the trading rewrite.

**Delete:** `app/spotv2/`, `app/api/spotv2/`, `components/spotv2/`, `lib/spotv2/`,
`hooks/useSpotV2{Deposit,Withdraw}.ts`, and models `SpotV2Deposit`,
`SpotV2Ledger`, `SpotV2LedgerTx`, `SpotV2Order`, `SpotV2Position`, `SpotV2Trade`,
`SpotV2Withdrawal`.

**Referencing files needing edits** — spotv2 reaches further than the route table
suggests: `app-sidebar.tsx`, `mobile-bottom-nav.tsx`, `top-nav.tsx`,
`navbar-actions.tsx`, `layout-shell.tsx` (full-bleed route list),
`trade-selector.tsx`, `assets-client.tsx`, `dashboard/bento-grid.tsx`,
`dashboard/user-card.tsx`, `portfolio/portfolio-client.tsx`,
`trading/markets-client.tsx`, `wallet/spot-funding-swap.tsx`,
`hooks/useMarketDataSSE.ts`, `vivid-provider.tsx`,
`vivid/ConversationSidebar.tsx`, `lib/vivid-functions.ts`.

**Also:** remove `"/api/spotv2/cron(.*)"` from `isWebhookRoute` in
[middleware.ts](../middleware.ts), and any external scheduler hitting
`/api/spotv2/cron/fill-orders`.

**⚠ Blocker — check before deleting:** are there live `SpotV2Ledger` balances or
open `SpotV2Order`s in production? If users hold ledger balances, that is money
owed and needs settling. This is a schema drop only if the answer is zero.

`useMarketDataSSE.ts` consumes `/api/spotv2/stream`; its replacement is the
direct-to-Hyperliquid path in Phase 4.

---

## Phase 3 — Replace the NGN ramp with the Dollar Account

**Ordering matters — build first, delete last.** The original draft had this
backwards. For a money path you keep the old one standing until the new one is
proven.

1. **Build** Buy and Sell against the service, alongside the existing ramp.
   Mobile's `BuyScreen.tsx` / `SellScreen.tsx` are the reference implementations —
   match their state machines rather than inventing new ones.

   | New UI | Endpoint |
   |---|---|
   | Availability, fee, limits | `GET /api/buy/availability` |
   | Place / poll / history | `POST /api/buy`, `GET /api/buy/:reference`, `GET /api/buy` |
   | Sell info | `GET /api/sell/info` |
   | Place / poll / history | `POST /api/sell`, `GET /api/sell/:reference`, `GET /api/sell` |

2. **Verify against exit criteria**, not a fixed duration. Calendar time
   exercises the happy path repeatedly and the failure branches never — and the
   failure branches are where the money bugs are.
   - A completed buy on each of solana, ethereum, tron
   - A **deliberately failed** delivery — confirm the USD hold is released and
     the liquidity reservation cancelled
   - A completed sell on each enabled network
   - A sell interrupted after confirmation, parked at `tx_verified` — confirm
     `GET /api/sell/:reference` retries the credit
   - A duplicate/retried request on buy and on sell — confirm no double-charge
     and no double-credit

3. **Close the front door.** Hide the NGN entry points so no new Flutterwave
   records are created. Keep every route and the webhook alive. **This is the
   real cutover moment, and it's reversible** — unhide and you're back.

4. **Drain to zero in-flight.** Non-terminal deposits: `pending`,
   `awaiting_verification`, `verifying`, `payment_confirmed`, `sending_usdt`.
   Non-terminal withdrawals: `pending`, `usdt_sent`, `tx_verified`, `processing`,
   `ngn_sent`. Two are obligations: a deposit at `payment_confirmed` means the
   user **paid and is owed USDT**; a withdrawal at `usdt_sent`/`tx_verified`
   means they **sent USDT and are owed NGN**.

   ```bash
   mongosh "$MONGODB_URI" --eval 'db.deposits.countDocuments({status:{$nin:["completed","payment_failed","delivery_failed","cancelled"]}})'
   ```

   Same against `withdrawals` with `["completed","failed","cancelled"]`. **That
   count is the answer to "how long do both run".**

5. **Delete** `app/api/deposit/` (9 routes), `app/api/withdraw/` (3 routes),
   `lib/flutterwave/`, `lib/deposit/`, and the Flutterwave env vars. Also fix
   [withdraw-client.tsx:177](../components/withdraw/withdraw-client.tsx:177),
   which defaults the chain selector to `tron` while
   [initiate/route.ts:32](../app/api/withdraw/initiate/route.ts:32) rejects it
   with a 400 — a pre-existing bug that disappears with the flow.

**Behavioural changes to communicate:** no bank details on withdraw (the wallet
service owns bank payouts now — check whether it reads
`DashboardProfile.savedBankDetails` before removing that); no NGN/GHS selector;
no Flutterwave redirect; no manual tx-hash paste. Old NGN records stay in the
shared collections, so history must render both shapes.

**Touched beyond deposit/withdraw:** `dashboard/pending-deposit.tsx`,
`dashboard/dashboard-onboarding.tsx`, `dashboard/balance-section.tsx`,
`dashboard/user-card.tsx`, `mobile-bottom-nav.tsx:297-298`,
`transactions/transactions-client.tsx`, `lib/transaction-actions.ts`,
`hooks/use-unified-transactions.ts`, `app/page.tsx`.

### ⚠ Prerequisites for Tron (the primary buy network)

Tron sell code is shipped, but the flow is blocked on operations, not code:

- **A `TreasuryWallet` row with `network: "tron"` must exist in the
  `treasurywallets` collection.** Note this is a **different collection** from
  the admin backend's `wallets` registry — the admin client's wallet screen
  shows `wallets`, not `treasurywallets`. Confirm both point at the same
  database too. Without the row, `/api/sell/info` reports tron disabled and
  `POST /api/sell` returns 409.
- **The Tron disburse wallet needs a TRX float.** `withdrawal-tron-wallet` is
  empty. It now needs TRX for its own transfer fees, each gas gift, and the fee
  on each gift — two transactions per Tron buy. Alert on that balance.
- **Verify `TRON_GAS_TOPUP_AMOUNT_TRX` / `_THRESHOLD_TRX`** against live network
  parameters. The defaults (30/15) are estimates; TRON governance has changed the
  energy price before.

---

## Phase 4 — Trading: unify the wallet, adopt `/api/trade/*`

**⚠ Answer this first.** The dashboard provisions a trading wallet *distinct*
from `wallets.ethereum`; the service treats them as one. Query production:

```
UserWallet.find({ "tradingWallet.initialized": true,
                  $expr: { $ne: ["$tradingWallet.address", "$wallets.ethereum.address"] } })
```

Anyone in that set may hold Hyperliquid balances at an address the new model
never reads. Sweep them before cutover. **Do not ship Phase 4 until this set is
known and handled.**

**Delete:** `app/api/hyperliquid/` (9 routes), `app/api/spot/` (7 routes),
`app/api/privy/setup-trading-wallet/`, `lib/hyperliquid/`,
`hooks/useSpot{Deposit,Withdraw}.ts`, `components/spot/spot-client.old.tsx`.

**Repoint:**

| Old | New |
|---|---|
| `POST /api/hyperliquid/order` | `POST /api/trade/spot` \| `/api/trade/futures` |
| `POST /api/hyperliquid/cancel-order` | `POST /api/trade/cancel` |
| `GET /api/hyperliquid/{balance,positions,open-orders}` | `GET /api/trade/account` |
| (close position) | `POST /api/trade/close` |
| `POST /api/privy/setup-trading-wallet` | `POST /api/trading-wallet/setup` |
| `app/api/spot/deposit/*` | `POST /api/trading-wallet/{fund,deposit,transfer}` |
| `POST /api/spot/withdraw` | `POST /api/trading-wallet/withdraw` |

### Market data — mirror mobile, don't port

`lib/actions.ts` is ~1,970 lines and 32 exports, and it decomposes cleanly:

| Exports | Destination |
|---|---|
| `getOrderBook`, `getChartData`, `getSpotKlines`, `getFuturesKlines` | direct to `https://api.hyperliquid.xyz/info`, mirroring mobile's `hlPublic.ts` |
| `getSpotMarkets`, `getFuturesMarkets` | `GET /api/trade/markets` |
| `getPrices` | `GET /api/prices` |
| `getUserBalances`, `getTradeHistory`, `executeTrade` | `/api/trade/*` |
| `getQuote` | `/api/swap` |
| `getForexRates`, `getForexKlines` | likely dead — forex was hidden in `99bcfea`. **Confirm.** |

This also replaces `app/api/orderbook` and the `hyperliquid/{candles,fills,order-history}`
routes with no service-side work. `slippage-estimate` needs a decision.

---

## Phase 5 — The leftovers

Each needs a call: port, keep local, or drop.

| Item | Notes |
|---|---|
| `app/api/gmx/*` (4 routes) | Still a product line? No service equivalent, no mobile screen. **Open.** |
| `app/api/p2p/rates` | FX rates. `worldstreet-wallet` has `lib/fx-actions.ts` — likely belongs there. **Open.** |
| `app/api/trades` | Check whether `transactions/unified` already covers it. |
| `app/api/vivid/*` + `lib/vivid-functions.ts` | Wallet service has `/v1/wallet/:userId/vivid`, but the conversation store is dashboard-only. Note `vivid-functions.ts` references both spotv2 and `/api/profile`. **Open.** |
| `app/community/*` + `lib/community/*` | Ably + RealtimeKit. Not crypto — stays in the dashboard. |
| `lib/profile-actions.ts` | `DashboardProfile` CRUD. Service has the model, no route. **Open.** Note `/api/profile` is referenced by [vivid-functions.ts:223](../lib/vivid-functions.ts:223) but has no route anywhere. |
| `lib/bridge-actions.ts`, `app/bridge/` | Overlaps `/api/swap` (LI.FI). Probably folds in. |
| `lib/wallet-actions.ts`, `lib/ensureUserWallet.ts` | Superseded by `/api/privy/pregenerate-wallet`. |

---

## Phase 6 — Cleanup

- Delete the three dead Privy routes: `privy/transfer` (obsoleted by the unified
  wallet model — it only moved funds between `wallets.ethereum` and
  `tradingWallet`), `privy/wallet/sign` (the service has the capability
  internally, just unexposed), `privy/wallet/ethereum/execute-transaction` (a
  generic calldata escape hatch the service deliberately replaced with narrow,
  allowlisted endpoints). All three have zero callers anywhere in the WorldStreet
  tree.
- Drop now-unused deps: `@nktkas/hyperliquid`, `@solana/web3.js`,
  `@solana/spl-token`, `@mysten/sui`, `@mysten/sui.js`, `tronweb`, `viem`,
  `@privy-io/node`, `@gmx-io/sdk`.
- Delete models the dashboard no longer writes.
- Remove server-side secrets from the dashboard env: Privy app secrets, admin
  backend key, wallet service token — these belong only in the crypto service.
- **Rotate the secrets committed in [.env.example](../.env.example)** —
  `NEW_PRIVY_APP_SECRET` and `PRIV_KEY_ADMIN` are real values in git history.
  Rotating is the only fix; deleting the file does nothing.
- Update [PROJECT.md](../PROJECT.md) — it still documents `/spot` as the spot page,
  predates gmx/community/vivid/spotv2, and claims Tron withdrawals work.
- Optional: flatten the proxy to direct browser→service calls. Needs
  `CORS_ALLOWED_ORIGINS` on the service and `getToken()` + absolute URLs in the
  client. Only worth it if the extra hop shows up in latency.

---

## Open questions

1. **Testing posture.** The crypto service has no test script and zero test
   files; `worldstreet-wallet` has vitest and ~15. This migration moves money
   logic into the less-tested repo. Options: (a) rely on staged rollout,
   (b) smoke tests scoped to the money paths before Phase 3/4, copying the
   wallet service's pattern, (c) full setup first. **Recommendation: (b).**
2. **How do web users fund a Dollar Account?** Buy is unusable without a funded
   USD balance, and that path lives in the wallet service. If mobile hasn't
   solved it either, this is a bigger piece of work than the Buy screen.
3. **Forex** — dead or dormant?
4. **GMX, `p2p/rates`, vivid, profile** — owners per Phase 5.

## Sequencing

Phases 2 and 3 are deletions and can run alongside Phase 1. Phase 4 follows the
trading-wallet audit. Phase 5's answers determine how much of `lib/hyperliquid/`
Phase 4 can delete.
