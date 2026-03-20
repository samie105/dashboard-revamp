# Plan: Spot Trading v2 — Multi-Chain DEX Trading

> Source PRD: [PRD_SPOTV2_INTEGRATION.MD](../PRD_SPOTV2_INTEGRATION.MD)

## Architectural decisions

Durable decisions that apply across all phases:

- **Route**: `/spotv2` — new page, parallel to existing `/spot` (Hyperliquid). No shared state between them.
- **Trade engine**: Li.Fi SDK — single integration for same-chain and cross-chain swaps. Aggregates 1inch, Jupiter, Paraswap under the hood.
- **Supported trading chains**: Ethereum, BSC, Solana, Avalanche, Arbitrum, Polygon, Base.
- **Order types**: Market orders only (v1). Limit orders deferred.
- **Wallets**: Reuse existing Privy EVM wallet (works on all EVM chains) + Solana wallet. No new wallet creation.
- **Funding sources**: In-app transfers from ETH, SOL, TRON wallets. Li.Fi handles bridging as part of trade execution.
- **Pair data**: Coingecko API (top 100 by market cap), server-side cache with 1h TTL. Each token mapped to best chain + contract address.
- **Order book + recent trades**: Binance WebSocket (`@depth20@100ms`, `@trade` streams). Li.Fi quote-based fallback for unlisted pairs.
- **Charts**: DEXScreener embed per pair.
- **Data model**: `SpotV2Trade` (MongoDB) — records every trade with chain, pair, side, amounts, prices, fees, tx hash, status.
- **PnL**: Server-side, computed on demand from `SpotV2Trade` history. Average cost basis method.
- **Fees**: No platform markup (v1). Users pay underlying gas + DEX fees only.
- **Auth**: Existing Clerk + Privy flow. Privy signs server-side — no wallet popups.

### Layout

```
┌──────────┬───────────────────────────────┬──────────────┐
│          │                               │              │
│  PAIR    │       CHART (DEXScreener)     │  ORDER BOOK  │
│  LIST    │                               │  (Binance    │
│          │                               │   live WS)   │
│  search  ├───────────────────────────────┤──────────────┤
│  filter  │                               │   BUY/SELL   │
│          │   RECENT TRADES (Binance WS)  │   PANEL      │
│  BTC/USD │                               │              │
│  ETH/USD │                               │  [Market ▾]  │
│  SOL/USD │                               │  Amount ___  │
│  ...     │                               │  [25][50]..  │
│          ├───────────────────────────────┤  [Buy] [Sell]│
│          │  POSITIONS │ HISTORY │ PnL    │              │
│          │  open holdings, trade log,    │              │
│          │  realized/unrealized stats    │              │
└──────────┴───────────────────────────────┴──────────────┘
```

---

## Phase 1: Pair Registry + Static Page Shell ✅

**User stories**: #4, #13, #14, #15, #16, #17, #18

### What to build

A functional `/spotv2` page with the three-column CEX layout. The left sidebar shows a searchable, filterable list of 85+ tokens ranked by market cap. Each entry displays the token symbol as `TOKEN/USDC`, current price, 24h percentage change, market cap, and a chain badge indicating where the token trades. Prices refresh on a 60-second interval. Selecting a pair updates shared state that other panels will consume. The center and right panels render as empty placeholders with labels ("Chart", "Order Book", "Order Form", etc.) so the layout is visible and correct.

The server-side pair registry fetches from CoinMarketCap API, maps each token to its best chain and contract address, caches with 1h TTL, and exposes an API route the UI consumes. A hardcoded fallback list of 20 top tokens ensures the page never loads empty.

### Acceptance criteria

- [x] `/spotv2` is accessible from the app navigation
- [x] Page renders the three-column layout with correct proportions
- [x] Pair sidebar lists 85+ tokens from CoinMarketCap top 100 (excluding stablecoins)
- [x] Each pair shows: symbol (`TOKEN/USDC`), price, 24h change %, chain badge
- [x] Pair list is searchable by token name or symbol
- [x] Prices auto-refresh at least every 60 seconds
- [x] Selecting a pair updates the active pair in shared state
- [x] Pair registry API caches responses with ~1h TTL
- [x] Existing `/spot` page is unaffected

---

## Phase 2: Chart + Order Book + Recent Trades ✅

**User stories**: #19, #20, #21, #22

### What to build

Wire up the center and right-top panels with live data for the selected pair. The center panel renders a TradingView Advanced Chart widget (Binance CEX data, dark theme, minimal toolbar). The right-top panel displays a live order book (bid/ask price ladder) sourced from Binance via a server-side SSE proxy. Below the chart, a recent trades feed shows individual trade ticks (time, price, amount, buy/sell color-coded) also via the SSE proxy.

The SSE proxy route (`/api/spotv2/stream`) opens a server-side WebSocket to Binance and forwards depth + trade events to the browser via Server-Sent Events. This avoids browser-origin restrictions that block direct Binance WebSocket connections.

When the user switches pairs in the sidebar, all three data feeds (chart, order book, recent trades) re-subscribe to the new pair. The Binance symbol mapping converts between platform format (`ETH/USDC`) and Binance format (`ETHUSDT`).

### Acceptance criteria

- [x] TradingView chart renders for the selected pair with candlesticks, volume, and timeframe controls
- [x] Order book shows live bid/ask levels updating in real-time via SSE proxy
- [x] Recent trades feed shows individual ticks with time, price, amount, and buy/sell coloring
- [x] Switching pairs re-subscribes the chart, order book, and trades to the new pair within 1 second
- [x] Binance symbol mapping correctly translates between platform and Binance formats
- [x] Pairs not on Binance show "unavailable" gracefully after 3 connection failures
- [x] SSE connections clean up properly on unmount and pair switch (no leaked subscriptions)

---

## Phase 3: Market Order Execution (Single Chain)

**User stories**: #1, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32, #45, #46, #47

### What to build

The buy/sell order form in the right panel becomes functional. Users can place market buy orders (USDC → token) and market sell orders (token → USDC) for any supported pair where they already have funds on the correct chain. The flow is: enter amount (in token or USDC, with quick-fill % buttons) → see quote (estimated output, price impact, fees) → confirm in dialog → execute via Li.Fi → see real-time status → success or error notification.

The system validates balance before allowing order placement, warns on slippage above 1%, and auto-refreshes quotes older than 30 seconds. Every executed trade is recorded in the `SpotV2Trade` MongoDB model with all relevant fields (chain, pair, side, amounts, price, fees, tx hash, status).

This phase only handles same-chain trades — the user must have funds on the same chain where the token is traded. Cross-chain bridging comes in Phase 4.

### Acceptance criteria

- [ ] Buy order form: enter amount in token or USDC, see estimated output, confirm, execute
- [ ] Sell order form: same flow in reverse (token → USDC)
- [ ] Quick-fill buttons (25%, 50%, 75%, 100%) populate the amount field from available balance
- [ ] Pre-trade quote shows: estimated output amount, price impact %, gas + DEX fees
- [ ] Confirmation dialog displays all trade details before execution
- [ ] Real-time status updates during execution (submitted → swapping → completed/failed)
- [ ] Success notification with trade summary on completion
- [ ] Error notification with clear message on failure
- [ ] Balance validation prevents orders exceeding available funds
- [ ] Slippage warning displayed when estimated slippage > 1%
- [ ] Quotes older than 30 seconds auto-refresh before execution
- [ ] Every trade is saved to `SpotV2Trade` in MongoDB with chain, pair, side, amounts, price, fees, tx hash, status
- [ ] Li.Fi SDK executes the swap using the Privy wallet signer (server-side, no popups)

---

## Phase 4: Cross-Chain Trading + Funding

**User stories**: #2, #6, #7, #8, #9, #10, #11, #12, #48

### What to build

Extend the trade engine to handle cross-chain swaps via Li.Fi. When a user wants to buy a token on a different chain than where their funds are, Li.Fi bridges and swaps in a single operation. The UI shows which chain the user's funds are on and the target chain for the trade. Before confirmation, the estimated execution time differentiates same-chain (~10s) from cross-chain (~2 min).

In-app funding transfers are added: users can move USDC from their Ethereum wallet, USDC from Solana, or USDT from Tron into position for trading. The progress indicator tracks cross-chain trades through the bridge lifecycle (submitted → bridging → swapping → completed). The Solana wallet is now active for Solana-native trades.

This phase unlocks the full 85+ pair coverage regardless of which chain the user's funds are on.

### Acceptance criteria

- [ ] Cross-chain market orders execute successfully via Li.Fi (e.g. USDC on Ethereum → SOL on Solana)
- [ ] UI displays which chain the user's funds are on and the target chain
- [ ] Estimated execution time shown before confirmation: "~10s" same-chain, "~2 min" cross-chain
- [ ] Progress indicator tracks: submitted → bridging → swapping → completed
- [ ] In-app funding: transfer USDC from Ethereum wallet to trading position
- [ ] In-app funding: transfer USDC from Solana wallet to trading position
- [ ] In-app funding: transfer USDT from Tron wallet to trading position
- [ ] Bridge status is visible for in-progress cross-chain trades
- [ ] Solana wallet functional for Solana-native pair trades
- [ ] Cross-chain trades recorded in `SpotV2Trade` with bridge details
- [ ] All 85+ pairs are now tradeable regardless of which chain user funds are on

---

## Phase 5: Positions + PnL Dashboard

**User stories**: #3, #33, #34, #35, #36, #37, #38, #39, #40, #41

### What to build

The bottom center tabbed panel becomes functional with three tabs: Positions, Trade History, and PnL Dashboard.

**Positions tab** shows all current token holdings derived from trade history — token, quantity, average buy price, current market value, and unrealized PnL per position.

**Trade History tab** shows a table of all past trades: date, pair, side (buy/sell), amount, execution price, fees, and realized PnL.

**PnL Dashboard tab** shows aggregate metrics: total PnL (realized + unrealized), realized PnL, unrealized PnL, win rate, and ROI.

All PnL computation happens server-side from `SpotV2Trade` documents using average cost basis. The multi-chain balance view shows aggregated USDC across all chains.

### Acceptance criteria

- [ ] Positions tab lists all open holdings with: token, quantity, avg buy price, current value, unrealized PnL
- [ ] Positions are derived from `SpotV2Trade` history (net quantity > 0 = open position)
- [ ] Trade History tab shows all trades with: date, pair, side, amount, price, fees, PnL
- [ ] PnL Dashboard shows: total PnL, realized PnL, unrealized PnL, win rate, ROI
- [ ] Realized PnL uses average cost basis: `(sell_price - avg_buy_price) × quantity - fees`
- [ ] Unrealized PnL computed from current prices: `Σ (current_price - avg_buy_price) × position_size`
- [ ] Win rate = winning trades / total closed trades
- [ ] ROI = total PnL / total invested capital
- [ ] Multi-chain USDC balance aggregated and displayed
- [ ] PnL persists across sessions and devices (server-side, not localStorage)

---

## Phase 6: Withdrawals

**User stories**: #42, #43, #44

### What to build

Users can withdraw from Spot v2 back to their main wallets. The withdraw flow lets the user choose a destination wallet (ETH, SOL, or TRON). If the token/USDC is on a different chain than the destination, Li.Fi handles the bridge automatically. The typical path is: sell token → USDC (if not already USDC) → bridge USDC to the destination chain.

### Acceptance criteria

- [ ] Withdraw modal accessible from the `/spotv2` page
- [ ] User can select destination: Ethereum, Solana, or Tron wallet
- [ ] Withdrawal of USDC on same chain as destination executes directly
- [ ] Withdrawal across chains bridges automatically via Li.Fi
- [ ] Token positions can be sold to USDC and withdrawn in one flow
- [ ] Withdrawal status tracked and displayed to user
- [ ] Completed withdrawals reflected in main wallet balances

---

## Phase 7: Retry + Polish

**User stories**: #5, #47, #48, #49

### What to build

Harden edge cases and add quality-of-life features. Failed trades get a one-click retry button that re-populates the order form with the same parameters and fetches a fresh quote. In-progress cross-chain trades show their bridge status even if the user navigates away and returns. Final verification that the existing `/spot` Hyperliquid system is completely unaffected by all Spot v2 code.

### Acceptance criteria

- [ ] Failed trades show a "Retry" button that re-populates amount/pair and fetches a new quote
- [ ] In-progress cross-chain trades display bridge status on return to page
- [ ] `/spot` (Hyperliquid) loads and functions identically to before Spot v2 was added
- [ ] No shared state leaks between `/spot` and `/spotv2`
- [ ] WebSocket connections are resilient to disconnects (auto-reconnect for Binance feeds)
- [ ] Loading and error states are handled gracefully across all panels
