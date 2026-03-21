# Plan: Spot Trading v2 — Ledger-Based Spot Trading

> Source PRD: [PRD_SPOTV2_INTEGRATION.MD](../PRD_SPOTV2_INTEGRATION.MD)

## Architectural decisions

Durable decisions that apply across all phases:

- **Route**: `/spotv2` — new page, parallel to existing `/spot` (Hyperliquid). No shared state between them.
- **Trade engine**: Ledger-based (CFD model). Trades are instant database writes — no on-chain swaps per trade. Platform records entry/exit prices and computes PnL from price deltas.
- **Order types**: Market, Limit, Stop-Limit. Limit and stop-limit orders are monitored by a cron job that checks Binance prices every ~10s.
- **Price source**: Binance spot prices via REST (for order fills and cron) + TradingView chart widget (for display). CoinMarketCap for pair registry. No markup (v1).
- **Funding**: Users deposit USDC/USDT from their Privy wallets (Ethereum, Solana, Tron) into a platform treasury wallet. The deposit amount is credited to their `SpotV2Ledger` balance. Withdrawals reverse this — debit ledger, send stablecoins back.
- **Pair data**: CoinMarketCap API (top 100 by market cap), server-side cache with 1h TTL.
- **Order book + recent trades**: Binance via server-side REST polling proxy (KuCoin → Gate.io fallback).
- **Charts**: TradingView Advanced Chart widget (Binance CEX data).
- **Data model**:
  - `SpotV2Ledger` — per-user stablecoin balances (available + locked)
  - `SpotV2Position` — open token positions (quantity, avg entry price)
  - `SpotV2Order` — all orders (market/limit/stop-limit) with status lifecycle
  - `SpotV2Trade` — executed fill records with PnL
- **PnL**: Computed from positions and trades. Average cost basis. Realized on sell, unrealized from live prices.
- **Fees**: No platform fees for now. Can add spread or per-trade fee later.
- **Auth**: Existing Clerk + Privy flow.
- **Partial close**: Supported. Users can sell any portion of an open position.
- **Risk note**: Platform is counterparty. Net user profits = platform cost. Hedging/limits can be added later.

### Layout

```
┌──────────┬───────────────────────────────┬──────────────┐
│          │                               │              │
│  PAIR    │   CHART (TradingView/Binance) │  ORDER BOOK  │
│  LIST    │                               │  (Binance    │
│          │                               │   REST poll) │
│  search  ├───────────────────────────────┤──────────────┤
│  filter  │                               │   BUY/SELL   │
│          │   RECENT TRADES (Binance)     │   PANEL      │
│  BTC/USD │                               │              │
│  ETH/USD │                               │ [Market    ▾]│
│  SOL/USD │                               │ [Limit     ▾]│
│  ...     │                               │ [Stop-Limit▾]│
│          │                               │  Amount ___  │
│          ├───────────────────────────────┤  [25][50]..  │
│          │  POSITIONS │ ORDERS │ HISTORY │  [Buy] [Sell]│
│          │  open positions, open orders, │              │
│          │  trade log, PnL stats         │              │
└──────────┴───────────────────────────────┴──────────────┘
```

### Trade Flow

```
DEPOSIT:
  User's Privy wallet (USDC/USDT on ETH/SOL/TRON)
    → On-chain transfer to platform treasury wallet
    → SpotV2Ledger credited: { userId, token: "USDC", available += amount }

MARKET BUY (e.g., "Buy 0.1 BTC"):
  1. Validate: user has enough USDC in ledger (0.1 × $87,000 = $8,700)
  2. Debit $8,700 USDC from ledger.available
  3. Create SpotV2Order: { type: market, side: BUY, status: FILLED, fillPrice: $87,000 }
  4. Update SpotV2Position: { BTC: quantity += 0.1, avgEntryPrice recalculated }
  5. Create SpotV2Trade fill record
  → Instant. No on-chain transaction.

MARKET SELL (e.g., "Sell 0.05 BTC"):
  1. Validate: user has ≥ 0.05 BTC in SpotV2Position
  2. Compute PnL: (sell_price - avg_entry) × 0.05
  3. Credit USDC to ledger: 0.05 × current_price
  4. Update position: quantity -= 0.05 (close if zero)
  5. Create SpotV2Order + SpotV2Trade with realized PnL
  → Instant.

LIMIT ORDER (e.g., "Buy BTC at $80,000"):
  1. Validate: user has enough USDC
  2. Lock USDC in ledger: available -= $8,000, locked += $8,000
  3. Create SpotV2Order: { type: limit, side: BUY, limitPrice: $80,000, status: OPEN }
  4. Cron job checks Binance price every ~10s
  5. When price ≤ $80,000: fill order, unlock USDC, debit, create position + trade
  → Fills within ~10s of price hitting target.

STOP-LIMIT (e.g., "Stop $85k, Limit sell $84.5k"):
  1. Create SpotV2Order: { type: stop-limit, stopPrice: $85,000, limitPrice: $84,500, status: OPEN }
  2. Cron: when price ≤ $85,000, status → STOP_TRIGGERED, becomes active limit
  3. Cron: when price ≤ $84,500, fill the sell order
  → Two-phase trigger.

WITHDRAW:
  1. User requests withdraw of X USDC
  2. Validate: ledger.available ≥ X
  3. Debit ledger
  4. Platform sends USDC/USDT from treasury to user's Privy wallet on chosen chain
```

---

## Phase 1: Pair Registry + Static Page Shell ✅

### What to build

A functional `/spotv2` page with the three-column CEX layout. The left sidebar shows a searchable, filterable list of 85+ tokens ranked by market cap. Each entry displays the token symbol as `TOKEN/USDC`, current price, 24h percentage change, and market cap. Prices refresh on a 60-second interval. Selecting a pair updates shared state that other panels will consume.

The server-side pair registry fetches from CoinMarketCap API, caches with 1h TTL, and exposes an API route. A hardcoded fallback list of 20 top tokens ensures the page never loads empty.

### Acceptance criteria

- [x] `/spotv2` is accessible from the app navigation
- [x] Page renders the three-column layout with correct proportions
- [x] Pair sidebar lists 85+ tokens from CoinMarketCap top 100 (excluding stablecoins)
- [x] Each pair shows: symbol (`TOKEN/USDC`), price, 24h change %
- [x] Pair list is searchable by token name or symbol
- [x] Prices auto-refresh at least every 60 seconds
- [x] Selecting a pair updates the active pair in shared state
- [x] Pair registry API caches responses with ~1h TTL
- [x] Existing `/spot` page is unaffected

---

## Phase 2: Chart + Order Book + Recent Trades ✅

### What to build

Wire up the center and right-top panels with live data. TradingView Advanced Chart widget (Binance data). Order book and recent trades via server-side REST polling proxy (`/api/spotv2/stream`). The proxy fetches from KuCoin with Gate.io fallback every ~2s.

### Acceptance criteria

- [x] TradingView chart renders for the selected pair
- [x] Order book shows live bid/ask levels
- [x] Recent trades feed shows individual ticks
- [x] Switching pairs re-subscribes all feeds within 1 second
- [x] Pairs not on exchange show "unavailable" gracefully
- [x] Connections clean up properly on unmount and pair switch

---

## Phase 3: Ledger Models + Market Order Execution

### What to build

The core ledger infrastructure and a functional buy/sell order form for market orders.

**Data models**: `SpotV2Ledger` (user stablecoin balances with available/locked), `SpotV2Position` (open token positions with quantity and average entry price), `SpotV2Order` (order records), `SpotV2Trade` (fill records with PnL).

**Order form**: Buy/sell tabs, market order type, amount input with percentage slider, total input (bidirectional), balance display, and execute button. Orders fill instantly at Binance spot price. The form validates balance, shows the current price, and displays success/error feedback.

**Server actions**: `placeSpotV2Order` — validates balance, fetches Binance price, debits/credits ledger, creates/updates position, records order + trade. `getSpotV2Balance` — returns user's ledger balance. `getSpotV2Positions` — returns user's open positions.

No on-chain transaction at trade time. Deposits and withdrawals are separate phases.

### Acceptance criteria

- [ ] `SpotV2Ledger` model: userId, token, available, locked — with compound unique index on (userId, token)
- [ ] `SpotV2Position` model: userId, token, quantity, avgEntryPrice, unrealizedPnl computed at read time
- [ ] `SpotV2Order` model: userId, pair, side, orderType, quantity, limitPrice, stopPrice, status, fillPrice, filledAt, lockedAmount
- [ ] `SpotV2Trade` model: userId, orderId, pair, side, quantity, price, quoteAmount, realizedPnl, fee
- [ ] Buy order: debit USDC from ledger, credit token position, fill at Binance price
- [ ] Sell order: debit token from position, credit USDC to ledger, compute realized PnL
- [ ] Partial sell: sell portion of position, update remaining quantity and avg entry price
- [ ] Quick-fill percentage slider (0–100%) populates amount from available balance
- [ ] Bidirectional amount/total inputs (typing in one updates the other)
- [ ] Balance validation prevents orders exceeding available funds
- [ ] Minimum order value enforced ($10)
- [ ] Success/error feedback messages after execution
- [ ] Price fetched from Binance REST API at execution time

---

## Phase 4: Limit + Stop-Limit Orders + Cron Monitor

### What to build

Extend the order form with limit and stop-limit order types. A Vercel cron job (or API-triggered check) runs every ~10s to scan open orders against current Binance prices and fill any that meet their conditions.

**Limit orders**: User specifies a target price. USDC is locked (not debited) when the order is placed. The cron fills the order when the Binance price reaches the limit.

**Stop-limit orders**: Two prices — a stop trigger and a limit price. When the stop triggers, the order becomes an active limit. The cron then fills it at the limit price.

**Order management**: Users can view and cancel open orders. Cancelling unlocks the reserved funds.

### Acceptance criteria

- [ ] Limit buy: locks USDC, fills when price ≤ limitPrice
- [ ] Limit sell: locks token position quantity, fills when price ≥ limitPrice
- [ ] Stop-limit: stop triggers first, then limit fills
- [ ] Cron endpoint (`/api/spotv2/cron/fill-orders`) checks prices every ~10s
- [ ] Open orders visible in a tab below the chart
- [ ] Cancel order: unlocks funds, sets status to CANCELLED
- [ ] Order expiration: GTC (good till cancelled) — no auto-expiry
- [ ] Multiple concurrent orders supported per user
- [ ] Available balance = total - locked across all open orders
- [ ] Fill latency ≤ ~10s from price reaching target

---

## Phase 5: Deposit + Withdraw (Funding the Ledger)

### What to build

Users can deposit USDC/USDT from their Privy wallets (Ethereum, Solana, Tron) into their SpotV2 ledger balance. The deposit is an on-chain transfer from the user's Privy wallet to a platform treasury wallet, followed by a ledger credit. Withdrawals reverse the flow — debit ledger, send stablecoins from treasury to the user's wallet.

### Acceptance criteria

- [ ] Deposit modal: select source chain (ETH/SOL/TRON), enter amount, confirm
- [ ] On-chain transfer to treasury wallet via Privy server-side signing
- [ ] Ledger credited after on-chain confirmation
- [ ] Deposit history visible in SpotV2 page
- [ ] Withdraw modal: select destination chain, enter amount, confirm
- [ ] Ledger debited, treasury sends USDC/USDT to user's Privy wallet
- [ ] Withdraw fails gracefully if treasury has insufficient balance
- [ ] Both deposit and withdraw require auth

---

## Phase 6: Positions + PnL Dashboard

### What to build

The bottom center tabbed panel with three tabs: Positions, Open Orders, and Trade History.

**Positions tab**: All open token positions — token, quantity, avg entry price, current market value, unrealized PnL.

**Open Orders tab**: All pending limit/stop-limit orders with cancel buttons.

**Trade History tab**: All executed trades — date, pair, side, amount, fill price, realized PnL.

Aggregate PnL stats shown at the top: total PnL, realized, unrealized, win rate.

### Acceptance criteria

- [ ] Positions tab: token, quantity, avg entry, current value, unrealized PnL
- [ ] Unrealized PnL = (current_price - avg_entry) × quantity
- [ ] Open Orders tab: order type, pair, side, price target, quantity, cancel button
- [ ] Trade History tab: date, pair, side, quantity, fill price, realized PnL
- [ ] Realized PnL = (sell_price - avg_entry) × quantity
- [ ] Aggregate stats: total PnL, realized, unrealized, win rate, ROI
- [ ] Win rate = profitable sells / total sells
- [ ] All data server-side (persists across sessions)

---

## Phase 7: Polish + Edge Cases

### What to build

Harden edge cases and quality-of-life features. Ensure existing `/spot` (Hyperliquid) is unaffected. Add retry for failed deposits/withdrawals. Loading and error states across all panels.

### Acceptance criteria

- [ ] `/spot` (Hyperliquid) loads and functions identically
- [ ] No shared state leaks between `/spot` and `/spotv2`
- [ ] Failed deposits/withdrawals have retry options
- [ ] Loading and error states handled gracefully
- [ ] Order form resets properly after execution
- [ ] Concurrent order placement handles race conditions (atomic ledger updates)
