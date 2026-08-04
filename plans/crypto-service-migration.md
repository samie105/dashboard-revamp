# Plan: the dashboard becomes a pure client of worldstreet-crypto

> **Target**: the dashboard owns no crypto backend. Every crypto call goes to
> `worldstreet-crypto`, exactly as the mobile app does — including market data,
> which mobile reads straight from Hyperliquid's public API rather than
> proxying it.
>
> Rewritten after the phased draft ran into its own assumptions. Superseded
> reasoning is called out where it would otherwise mislead.

> **Status — 2026-08-04. Live plan; Phases 1–4 have landed, Phase 5 has not.**
> Verified against the tree, not against this document:
>
> | Phase | State | Evidence in code |
> |---|---|---|
> | 1 — mechanical cutovers | done | `FORWARDED` in [app/api/[...path]/route.ts](../app/api/%5B...path%5D/route.ts); no local route survives except `api/vivid/*` |
> | 2 — spotv2 | done | ledger engine gone from `models/`; [lib/trade-adapter.ts](../lib/trade-adapter.ts) maps the old signatures onto `/api/trade/*` |
> | 3 — Buy / Sell replace the NGN ramp | done | [components/buy-sell/buy-sell-client.tsx](../components/buy-sell/buy-sell-client.tsx); zero `flutterwave` references left in the app |
> | 4 — market data direct | done for the trade page | [lib/hl-public.ts](../lib/hl-public.ts) serves the book + candles client-side. The dashboard, portfolio, markets and swap screens still read [lib/actions.ts](../lib/actions.ts) (CoinGecko + Hyperliquid server actions) — that half is what's left. |
> | 5 — flatten and clean up | **not started** | proxy still in place; `@gmx-io/sdk`, `viem`, `tronweb`, the Solana and Sui SDKs all still in `package.json`; secrets in `.env.example` still unrotated |
>
> Two items below are load-bearing and still open: **rotating the credentials
> committed to `.env.example`** (they are in git history — deleting the lines
> is not a fix), and the five questions under [Open decisions](#open-decisions).

## The model we're copying

`worldstreet-app` has **no backend of its own**:

- Trading, wallets, balances, buy/sell → `crypto-api.worldstreetgold.com`
- Order book and candles → `https://api.hyperliquid.xyz/info`, direct from the
  client, unauthenticated (`src/features/crypto/api/hlPublic.ts`)
- One typed client (`src/features/crypto/api/index.ts`) over both

The dashboard can reach the same shape for everything crypto. It cannot reach
zero routes overall — see [Not crypto](#not-crypto-needs-a-home).

## Architectural decisions

- **No crypto logic in the dashboard.** No Privy signing, no chain RPC, no
  Mongoose models for crypto collections. Those move to (or already exist in)
  the service.
- **No data migration.** The service uses the same MongoDB (`user-account`) and
  the same collections.
- **Market data is public and goes direct.** No service work, no proxying, no
  auth. Mirror `hlPublic.ts`.
- **Transport: proxy now, direct later.** `app/api/[...path]/route.ts` forwards
  allowlisted paths and swaps the Clerk cookie for a bearer token. It exists so
  cutover is reversible per endpoint — delete a local route, add its path to
  `FORWARDED`, restore the file to roll back. It is a **transition mechanism**
  and gets deleted once nothing needs it (see Phase 5).
- **Typed client mirrors mobile.** `lib/crypto-api.ts`, types lifted from
  mobile so both clients share one contract.
- **spotv2 does not survive.** Spot becomes real Hyperliquid execution.
- **The NGN ramp does not survive.** Buy/sell run off the Dollar Account.
- **Unified trading wallet** — the user's Ethereum Privy wallet *is* the
  trading wallet, as on the service and mobile.

## Done

| Change | Where |
|---|---|
| Tron sell end-to-end (`/api/sell` accepts tron, confirmation poller, TRX pre-flight) | `worldstreet-crypto` `d969e5f` |
| Buy-time TRX top-up on Tron disbursements | `worldstreet-admin` `61526ff` |
| `Withdrawal.chain` / `TreasuryWallet.network` accept tron | both repos |
| Mobile `SellNetwork` widened, Tron listed first | `worldstreet-app` `fb6a807` |
| Proxy + typed client | this repo `ebfac76` |
| 21 routes cut over; token-send bug fixed | this repo `f546f0f` |
| Pending-deposit banner no longer calls a failed deposit "pending" | this repo `650b559` |

**The token-send bug is worth remembering as a pattern.** `send-modal` branched
on `contractAddress && chain === "solana"`, so every non-Solana token fell
through to a *native* send with its contract address dropped — "send 100 USDT"
on Tron broadcast 100 TRX. It was found by verifying contracts before deleting
routes, not by testing. Verify each contract before its route goes.

---

## Route inventory

49 routes remain. Every one has a destination.

### A. Delete — the service already replaces them (26)

| Dashboard | Service | Notes |
|---|---|---|
| `deposit/*` (9) | `POST /api/buy` + polling | Payment leg changes: Dollar Account, not NGN checkout |
| `withdraw/*` (3) | `POST /api/sell` | No bank leg; credits USD |
| `spot/*` (7) | `/api/trading-wallet/{fund,withdraw,deposit,transfer}` | |
| `hyperliquid/{order,cancel-order}` | `/api/trade/{spot,futures,cancel,close}` | |
| `hyperliquid/{balance,positions,open-orders}` | `GET /api/trade/account` | One call returns all three |
| `privy/setup-trading-wallet` | `POST /api/trading-wallet/setup` | |
| `privy/migrate-privy-type` | — | One-off migration; just delete |
| `spotv2/*` (7) | — | Deleted outright, see Phase 2 |

### B. Direct to Hyperliquid, no backend (2)

`orderbook`, `hyperliquid/candles` → mirror `hlPublic.ts`.

This also dissolves most of `lib/actions.ts` (~1,970 lines, 32 exports):

| Exports | Destination |
|---|---|
| `getOrderBook`, `getChartData`, `getSpotKlines`, `getFuturesKlines` | direct to HL |
| `getSpotMarkets`, `getFuturesMarkets` | `GET /api/trade/markets` |
| `getPrices` | `GET /api/prices` |
| `getUserBalances`, `getTradeHistory`, `executeTrade` | `/api/trade/*` |
| `getQuote` | `/api/swap` |
| `getForexRates`, `getForexKlines` | likely dead — forex hidden in `99bcfea`. **Confirm.** |

### C. Orphans — drop or build (9)

**Nothing to point at. Mobile does not have these.**

| Route | Question |
|---|---|
| `hyperliquid/fills`, `order-history` | Does the trading UI keep a fill history? If yes, the service needs endpoints. |
| `hyperliquid/slippage-estimate` | Keep, or accept market orders without an estimate? |
| `gmx/*` (4) | Is GMX still a product line? No service equivalent, no mobile screen. |
| `p2p/rates` | FX rates. `worldstreet-wallet` already has `lib/fx-actions.ts` — likely belongs there. |
| `trades` | Check whether `transactions/unified` already covers it. |

### D. Not crypto — needs a home (10)

**These cannot go to the crypto service.** They are why the dashboard can't
reach zero routes.

| Group | Notes |
|---|---|
| `vivid/*` (5) + `lib/vivid-functions.ts` | `worldstreet-wallet` has `/v1/wallet/:userId/vivid`, so there's a plausible home. The conversation store is dashboard-only. Note `vivid-functions.ts` calls `/api/swap/history` and `/api/profile`, **neither of which has ever existed**. |
| `community` (server actions) | Ably + Cloudflare RealtimeKit. Not crypto. Stays. |
| `profile` (`lib/profile-actions.ts`) | `DashboardProfile` CRUD. The service has the model but no route. |

---

## Phase 1 — Finish the mechanical cutovers

Everything in group A whose replacement needs no new UI. For each: verify the
contract, delete the local route, add its path to `FORWARDED`.

Start with `hyperliquid/{order,cancel-order,balance,positions,open-orders}` →
`/api/trade/*`, since `/api/trade/account` collapses three calls into one.

**⚠ Do the trading-wallet audit first.** The dashboard provisions a trading
wallet *distinct* from `wallets.ethereum`; the service treats them as one:

```
UserWallet.find({ "tradingWallet.initialized": true,
                  $expr: { $ne: ["$tradingWallet.address", "$wallets.ethereum.address"] } })
```

Anyone in that set may hold Hyperliquid balances at an address the new model
never reads. Sweep before cutting over.

---

## Phase 2 — spotv2

**⚠ Blocked on settling user funds.** The dashboard shows `Spot: $37.67` for at
least one account, and that figure comes from nowhere but `SpotV2Ledger` +
spotv2 positions ([user-card.tsx:122](../components/dashboard/user-card.tsx:122)).
Deleting the routes doesn't delete the collections, but it removes every path a
user could withdraw through.

```bash
mongosh "$MONGODB_URI" --eval 'db.spotv2ledgers.find({$or:[{available:{$gt:0}},{locked:{$gt:0}}]}).count()'
mongosh "$MONGODB_URI" --eval 'db.spotv2positions.countDocuments({quantity:{$gt:0}})'
```

**The earlier draft called this a pure deletion. That was wrong.**
`lib/spotv2/ledger-actions` is the data source behind the Spot figure on **six
surfaces**: `navbar-actions` (wallet popover), `dashboard/user-card`,
`assets-client`, `portfolio-client`, `dashboard/bento-grid`, and
`wallet/spot-funding-swap`. Deleting it blanks all of them.

Under the new target that resolves itself: those six read from
`GET /api/trade/account` instead, so **Phase 1 must land first**. Then spotv2 is
genuinely a pure deletion.

**Delete:** `app/spotv2/`, `app/api/spotv2/`, `components/spotv2/`,
`lib/spotv2/`, `hooks/useSpotV2{Deposit,Withdraw}.ts`, and the 7 `SpotV2*`
models.

**Also:** `/spotv2` nav entries in `app-sidebar`, `mobile-bottom-nav`,
`top-nav`, `trade-selector`, `vivid/ConversationSidebar`, `layout-shell`
(full-bleed list), `vivid-provider` (mic-hidden list), `markets-client`,
`vivid-functions` (navigation prompt); `hooks/useMarketDataSSE.ts` (polls
`/api/spotv2/stream`); and `"/api/spotv2/cron(.*)"` in
[middleware.ts](../middleware.ts) plus whatever scheduler hits it.

**Visible effect:** Spot switches from the CFD ledger to real Hyperliquid
holdings. Different numbers, not a silent refactor.

---

## Phase 3 — Buy / Sell replace the NGN ramp

**Build first, delete last.** The original draft had this backwards.

1. **Build** Buy and Sell against `/api/buy` and `/api/sell`, alongside the
   existing ramp. Mobile's `BuyScreen.tsx` / `SellScreen.tsx` are the reference
   — match their state machines.

2. **Verify against exit criteria, not a duration.** Calendar time exercises
   the happy path repeatedly and the failure branches never, and the failure
   branches are where the money bugs live.
   - A completed buy on each of solana, ethereum, tron
   - A **deliberately failed** delivery — confirm the USD hold is released and
     the liquidity reservation cancelled
   - A completed sell on each enabled network
   - A sell interrupted after confirmation, parked at `tx_verified` — confirm
     `GET /api/sell/:reference` retries the credit
   - A duplicate request on buy and on sell — no double-charge, no double-credit

3. **Close the front door.** Hide the NGN entry points so no new Flutterwave
   records are created; keep every route and the webhook alive. **This is the
   cutover moment, and it's reversible.**

4. **Drain to zero in-flight.** Two states are obligations: a deposit at
   `payment_confirmed` means the user **paid and is owed USDT**; a withdrawal at
   `usdt_sent`/`tx_verified` means they **sent USDT and are owed NGN**.

   ```bash
   mongosh "$MONGODB_URI" --eval 'db.deposits.countDocuments({status:{$nin:["completed","payment_failed","delivery_failed","cancelled"]}})'
   ```

   Same for `withdrawals` against `["completed","failed","cancelled"]`. **That
   count answers "how long do both run".**

5. **Delete** `app/api/deposit/`, `app/api/withdraw/`, `lib/flutterwave/`,
   `lib/deposit/`, and the Flutterwave env vars. This also removes a
   pre-existing bug: `components/withdraw/withdraw-client.tsx:177` defaulted
   the chain selector to `tron` while `app/api/withdraw/initiate/route.ts:32`
   rejected it with a 400. *(Both files are gone as of this phase — the paths
   are left unlinked as a record of what was deleted.)*

**Communicate:** no bank details on withdraw; no NGN/GHS selector; no
Flutterwave redirect; no manual tx-hash paste. Old NGN records stay in the
shared collections, so history must render both shapes.

### ⚠ Tron prerequisites (Tron is the primary buy network)

Code is shipped; the flow is blocked on operations:

- **A `TreasuryWallet` row with `network: "tron"`** must exist in
  `user-account.treasurywallets`. This is a **different collection** from the
  admin backend's `wallets` registry — the admin UI's wallet screen shows
  `wallets`. Without the row, `/api/sell/info` reports tron disabled and
  `POST /api/sell` returns 409.
- **The Tron disburse wallet needs a TRX float.** `withdrawal-tron-wallet` is
  empty. It now needs TRX for its own transfer fees, each gas gift, and the fee
  on each gift — two transactions per Tron buy. Alert on that balance.
- **Verify `TRON_GAS_TOPUP_AMOUNT_TRX` / `_THRESHOLD_TRX`** against live network
  parameters before enabling. Defaults (30/15) are estimates.

**Why the top-up exists:** Privy cannot sponsor Tron. `sponsor?: boolean` is on
`EthereumSendTransactionRpcInput` and `SolanaSignAndSendTransactionRpcInput`
only; Tron is a `CurveSigningChainType` — Privy signs raw and we broadcast.
Tron has no fee-payer field at all, so the sender always pays. The long-term
answer is **energy delegation** (stake TRX, delegate energy to user wallets) —
that is Tron's actual equivalent of sponsorship, and it stops burning TRX per
transfer. The top-up is the bridge to it.

---

## Phase 4 — Market data goes direct

Mirror `hlPublic.ts`: order book and candles straight from
`https://api.hyperliquid.xyz/info`, no auth, no backend.

Delete `app/api/orderbook`, `app/api/hyperliquid/candles`, and the market-data
half of `lib/actions.ts`. Repoint `components/spot/chart-area.tsx` (1,877
lines), `components/futures/futures-chart.tsx` (1,801) and
`hooks/useMarketDataSSE.ts`.

Decide group C's orphans here — the trading UI's fill history and slippage
estimate either get service endpoints or get dropped.

---

## Phase 5 — Flatten and clean up

- **Go direct.** Set `CORS_ALLOWED_ORIGINS` on the service, switch
  `lib/crypto-api.ts` to `getToken()` + absolute URLs, delete
  `app/api/[...path]/route.ts`. The proxy has done its job by then.
- Drop dependencies the dashboard no longer needs: `@nktkas/hyperliquid`,
  `@solana/web3.js`, `@solana/spl-token`, `@mysten/sui`, `@mysten/sui.js`,
  `tronweb`, `viem`, `@privy-io/node`, `@gmx-io/sdk`.
- Delete crypto models the dashboard no longer writes.
- Remove server-side secrets from the dashboard env: Privy app secrets, admin
  backend key, wallet service token.
- **Rotate the secrets committed in [.env.example](../.env.example)** —
  `NEW_PRIVY_APP_SECRET` and `PRIV_KEY_ADMIN` are real values in git history.
  Rotation is the only fix; deleting the file does nothing.
- ~~Update PROJECT.md~~ — done differently. It was too far gone to update
  (documented `/spot` as the spot page, predated gmx/community/vivid/spotv2,
  claimed Tron withdrawals work), so it moved to
  [docs/archive/](../docs/archive/README.md) and the current architecture now
  lives in [README.md](../README.md).

---

## Open decisions

1. **The nine orphans** (group C) — drop or build? Fills/order-history and
   slippage-estimate gate Phase 4; GMX gates nothing but bloats the repo.
2. **vivid, community, profile** (group D) — do they move to the wallet
   service, get their own, or does the dashboard keep a small backend? This
   decides whether "no Next.js API routes" is literally achievable.
3. **How do web users fund a Dollar Account?** Buy is unusable without a funded
   USD balance, and that path lives in the wallet service. If mobile hasn't
   solved it, this is bigger than the Buy screen.
4. **Testing posture.** The crypto service has no test script and zero test
   files; `worldstreet-wallet` has vitest and ~15. This migration moves money
   logic into the less-tested repo. Recommendation: smoke tests scoped to the
   money paths, copying the wallet service's pattern, before Phase 3 lands.
5. **Forex** — dead or dormant?

## Sequencing

Phase 1 unblocks Phase 2 (the six Spot surfaces need `/api/trade/account`
before spotv2 can go). Phase 3 is independent and gated on Tron ops. Phase 4 is
independent. Phase 5 is last by definition.
