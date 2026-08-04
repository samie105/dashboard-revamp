# Archive — superseded documents

Everything in this folder described the dashboard **before** it became a pure
client of `worldstreet-crypto` (commit `7300099`). None of it describes code
that exists today. It is kept because the reasoning is often still useful — why
a provider was chosen, what a flow was supposed to do — and because the service
that inherited these features may still need it.

**Read nothing here as current.** The code is the source of truth; [the
README](../../README.md) is the map to it.

Checked against the tree on 2026-08-04.

---

## PROJECT.md

The old full-project guide (798 lines). Written when the dashboard owned its
own crypto backend.

**Now wrong about:** the route table (`/spot`, `/futures`, `/spotv2` are all
one `/trade` page today), the entire `app/api/*` reference (only `api/vivid/*`
and the catch-all proxy survive), the NGN↔USDT P2P ramp and its Deposit model
(replaced by `/buy` and `/sell` against the crypto service), and the claim that
Tron withdrawals work.

**Still roughly true:** the Clerk → Privy → MongoDB identity chain, and the
five-chain wallet shape.

## PRD_SPOTV2_INTEGRATION.md · spotv2.md · spotv2-phase2-refactor.md

Spot Trading v2 — a ledger/CFD engine at `/spotv2` with `SpotV2Ledger`,
`SpotV2Position`, `SpotV2Order` and `SpotV2Trade` in MongoDB, priced off
CoinMarketCap and Binance, charted with a TradingView widget.

**What happened:** it shipped, then moved out. The ledger engine now lives in
`worldstreet-crypto`; the dashboard reads it over `/api/trade/*`. No SpotV2
model remains in `models/`, and `/spotv2` is a redirect to `/trade?market=spot`
in [next.config.mjs](../../next.config.mjs). The name survives only as
vestigial types and one adapter — see the header comment in
[lib/trade-adapter.ts](../../lib/trade-adapter.ts), which exists precisely to
keep the old call signatures working against the new service.

The Li.Fi cross-chain routing in the PRD was never built here.

## flutterwave-integration.md · flutterwave-integration-revised.md · flutterwave-e2e-testing.md

Fiat on-ramp via Flutterwave hosted checkout (NGN/GHS → USDT), replacing
GlobalPay. Two plan revisions plus a 666-line E2E test script.

**What happened:** the whole fiat ramp left the dashboard. There is not one
occurrence of `flutterwave` in `app/`, `components/`, `lib/`, `hooks/` or
`models/`. Funding is now a Dollar Account balance read through the proxy from
`worldstreet-wallet`, and buying USDT with it goes to `worldstreet-crypto`.
`FLUTTERWAVE_SECRET_KEY` is still listed in [.env.example](../../.env.example)
and nothing reads it.

The webhook-security section (HMAC verification, re-verify via `GET /charges/{id}`,
idempotency) is the part worth carrying forward to whichever repo owns the ramp.

## gmx-integration-guide.md

A handoff document for adding GMX perps alongside Hyperliquid futures. Its own
header says "Reference document only. No code changes yet." That never changed.

**Now wrong about:** every file path it names (`app/futures/page.tsx`,
`components/futures/`, `app/api/hyperliquid/`) and the external order backend
at `trading.watchup.site`. `@gmx-io/sdk` is still in `package.json` with zero
imports — [plans/crypto-service-migration.md](../../plans/crypto-service-migration.md)
Phase 5 lists it for removal.

## dashboard-assets-fixes.md

A fix list written against the SpotV2-era dashboard. Its premise — "SpotV2 is
the canonical spot data source, accessed via server actions" — no longer holds.

Two of its patterns did survive and are worth recognising in the current UI:
the `$`-toggle for USD-equivalent amount entry, and the 25/50/75/100% chip row
below amount inputs (now in `AmountField`, [components/ui/flow.tsx](../../components/ui/flow.tsx)).

## ui-changes.md

A UI tracker that stopped being updated early — it has two empty "to be
updated" sections, and describes the sidebar as using Lucide icons. The app
uses Hugeicons throughout. The real design system is documented in code:
[app/globals.css](../../app/globals.css) for tokens,
[components/ui/system.tsx](../../components/ui/system.tsx) and
[components/ui/flow.tsx](../../components/ui/flow.tsx) for the primitives and
the house rules they encode.
