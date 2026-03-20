# PRD: Spot Trading v2 — Multi-Chain DEX Trading

> **Version:** 3.0 | **Last Updated:** March 20, 2026

---

## Problem Statement

The existing spot trading system on WorldStreet is limited to pairs available on Hyperliquid, which covers a small subset of the crypto market. Users who want to trade major tokens like SOL, BNB, AVAX, DOGE, or any of the top 100 coins by market cap cannot do so within the platform. This forces them to leave WorldStreet and use external exchanges, fragmenting their portfolio tracking and trading experience.

Additionally, the current system has no PnL tracking — users have no visibility into their realized gains/losses, win rate, or return on investment across trades.

## Solution

Add a new parallel spot trading system ("Spot v2") at `/spotv2` that enables users to trade **85+ of the top 100 tokens by market cap** through a CEX-like interface. The system uses **Li.Fi SDK** as a unified cross-chain DEX aggregator, routing trades across Ethereum, BSC, Solana, Avalanche, Arbitrum, Polygon, and Base to reach every tradeable token with the best available price.

Users fund their trading from existing wallets (ETH, SOL, TRON) via in-app transfers. Li.Fi handles all bridging and swapping in a single operation — no manual chain switching or bridge UX required. Privy wallets sign all transactions server-side, so the experience is seamless with no popups or wallet approvals.

All trades are recorded server-side with full PnL computation (realized, unrealized, win rate, ROI) persisted in MongoDB.

The existing Hyperliquid spot system at `/spot` continues operating unchanged.

## User Stories

### Account & Wallet

1. As a user, I want my existing Privy EVM wallet to work across all supported trading chains (Ethereum, BSC, Avalanche, Polygon, Arbitrum, Base), so that I don't need to manage multiple wallets.
2. As a user, I want my existing Privy Solana wallet to be usable for Solana-native trades, so that I can trade SOL ecosystem tokens.
3. As a user, I want to see my available USDC balance across all chains in one view, so that I know how much I can trade with.
4. As a user, I want to access Spot v2 from `/spotv2` in the navigation, so that I can find the new trading interface.
5. As a user, I want the existing `/spot` (Hyperliquid) to remain available and unchanged, so that my current trading workflow isn't disrupted.

### Funding

6. As a user, I want to transfer USDC from my Ethereum wallet to fund trades, so that I can start trading.
7. As a user, I want to transfer USDC from my Solana wallet to fund trades, so that I can use my Solana holdings.
8. As a user, I want to transfer USDT from my Tron wallet to fund trades, so that I can use my Tron holdings.
9. As a user, I want to see which chain my funds are currently on, so that I understand if a trade will be same-chain (fast) or cross-chain (slower).
10. As a user, I want the system to automatically bridge my funds to the correct chain when I execute a trade, so that I don't have to manually bridge tokens.
11. As a user, I want to see a clear progress indicator when a cross-chain trade is in progress (bridging → swapping), so that I know the trade is working and not stuck.
12. As a user, I want an estimated execution time shown before I confirm a trade (e.g. "~10s" for same-chain, "~2 min" for cross-chain), so that I can set expectations.

### Pair Selection & Market Data

13. As a user, I want to see a list of 85+ top tokens ranked by market cap, so that I can trade the most popular cryptocurrencies.
14. As a user, I want to search and filter the token list by name or symbol, so that I can quickly find the pair I want.
15. As a user, I want to see each token's current price, 24h change, and market cap in the pair list, so that I can make informed selections.
16. As a user, I want token pairs displayed as `TOKEN/USDC` (e.g. `ETH/USDC`, `SOL/USDC`), so that the interface looks like a standard exchange.
17. As a user, I want to see which chain a token trades on (e.g. "SOL/USDC · Solana"), so that I understand the execution path.
18. As a user, I want the pair list to update prices periodically (at least every 60 seconds), so that I see reasonably current data.
19. As a user, I want to see a DEXScreener chart for the selected pair, so that I can analyze price action with candlesticks and indicators.

### Order Book & Recent Trades

20. As a user, I want to see a live order book with bid/ask price ladder updating in real-time, so that the interface looks and feels like a CEX.
21. As a user, I want to see recent trades (time, price, amount, buy/sell colored) for the selected pair, so that I can gauge market activity.
22. As a user, I want the order book and recent trades to update instantly when I switch pairs, so that they reflect the current market.

### Trading

23. As a user, I want to place a market buy order for any supported token using USDC, so that I can enter a position at current market price.
24. As a user, I want to place a market sell order for any token I hold, receiving USDC, so that I can exit a position.
25. As a user, I want to enter my order size in either the token amount or the USDC value, so that I can think in whichever unit I prefer.
26. As a user, I want quick-fill buttons (25%, 50%, 75%, 100% of balance), so that I can size orders quickly.
27. As a user, I want to see the estimated output amount and price impact before confirming, so that I understand what I'm getting.
28. As a user, I want to see estimated fees (gas + DEX) before confirming, so that there are no surprises.
29. As a user, I want a confirmation dialog showing all trade details (amount, price, fees, estimated time) before execution, so that I can review before committing.
30. As a user, I want to see a real-time status update while the trade executes (submitted → bridging → swapping → completed), so that I know what's happening.
31. As a user, I want to see a success/failure notification when the trade completes, so that I have immediate feedback.
32. As a user, I want failed trades to show a clear error message explaining what went wrong, so that I can retry or adjust.

### Portfolio & PnL

33. As a user, I want to see all my current token holdings (positions) with quantity, average buy price, and current value, so that I can track my portfolio.
34. As a user, I want to see my total realized PnL (profit/loss from closed trades), so that I know my actual gains.
35. As a user, I want to see my total unrealized PnL (paper profit/loss on open positions), so that I know my current exposure.
36. As a user, I want to see my combined PnL (realized + unrealized), so that I have one number for overall performance.
37. As a user, I want to see my win rate (winning trades / total trades), so that I can assess my trading skill.
38. As a user, I want to see my ROI (total PnL / total invested), so that I understand my return.
39. As a user, I want to see per-position PnL (unrealized gain/loss on each holding), so that I can decide which positions to close.
40. As a user, I want my PnL data to persist across sessions and devices, so that I never lose my trading history.
41. As a user, I want to see a trade history table showing all past trades (date, pair, side, amount, price, PnL), so that I have a complete audit trail.

### Withdrawals

42. As a user, I want to withdraw tokens from Spot v2 back to my main wallets, so that I can move profits out.
43. As a user, I want to choose which main wallet (ETH, SOL, TRON) to withdraw to, so that I control where funds go.
44. As a user, I want the withdrawal to handle bridging automatically (e.g. sell token → USDC → bridge to chosen wallet chain), so that it's seamless.

### Edge Cases & Error Handling

45. As a user, I want to be prevented from placing an order that exceeds my available balance, so that trades don't fail due to insufficient funds.
46. As a user, I want to see a warning if slippage for a trade is estimated above 1%, so that I can decide whether to proceed.
47. As a user, I want stale quotes (older than 30 seconds) to be automatically refreshed before execution, so that I don't trade on outdated prices.
48. As a user, I want to be able to retry a failed trade with one click, so that transient errors don't require re-entering everything.
49. As a user, I want in-progress cross-chain trades to show their bridge status, so that I know if the bridge is still pending.

## Implementation Decisions

### Architecture

- **Parallel system** — Spot v2 at `/spotv2` runs alongside existing Hyperliquid spot at `/spot`. No shared state between them.
- **Trade engine** — Li.Fi SDK as the single integration for all swaps (same-chain and cross-chain). Li.Fi aggregates 1inch, Jupiter, Paraswap, and others under the hood, selecting the best route.
- **Supported chains for trading** — Ethereum, BSC, Solana, Avalanche, Arbitrum, Polygon, Base. This covers 85+ of top 100 tokens.
- **Order types** — Market orders only for v1. Limit orders deferred to a future version.
- **Fees** — No platform markup for v1. Users pay only underlying gas + DEX fees.

### Wallets

- **EVM wallet** — Reuse the existing Privy Ethereum wallet. Same address works on all EVM chains (ETH, BSC, AVAX, Polygon, ARB, Base) since Privy signs server-side.
- **Solana wallet** — Reuse the existing Privy Solana wallet for Solana-native trades.
- **No new wallet creation** — No dedicated "Spot v2 wallet." The user's existing wallets are sufficient.
- **Funding sources** — In-app transfers from ETH, SOL, and TRON wallets. Li.Fi handles any necessary bridging as part of the trade execution.

### Data

- **Pair registry** — Coingecko API (top 100 by market cap), cached server-side with 1-hour TTL. Each token mapped to its best chain (deepest liquidity) and contract address.
- **Price data** — Coingecko for list/overview prices. Li.Fi getQuote for real-time execution prices.
- **Charts** — DEXScreener embed for candlestick charts per pair.
- **Order book** — Live bid/ask data from Binance WebSocket (`@depth20@100ms` stream). Covers all top 100 pairs. Mapped from Binance symbol format (e.g. `ETHUSDT`) to display format (`ETH/USDC`). Falls back to Li.Fi simulated depth (quotes at ±1%, ±2%, ±5%, ±10% offsets) for any pair Binance doesn't list.
- **Recent trades feed** — Binance WebSocket (`@trade` stream) for real-time trade ticks per pair.

### PnL & Trade History

- **Server-side storage** — All trades stored in MongoDB (new `SpotV2Trade` model). PnL computed on demand from trade history, not maintained as a running tally.
- **Realized PnL** — Calculated using average cost basis: `(sell_price - avg_buy_price) × quantity - fees`.
- **Unrealized PnL** — Computed on read: `Σ (current_price - avg_buy_price) × position_size` for all open positions.
- **Positions** — Derived from trade history. A position is open if net quantity > 0 for a token.

### Modules

| Module | Purpose |
|--------|---------|
| **Pair Registry** | Coingecko top 100 → mapped to best chain + token address per pair. Cached with 1h TTL. |
| **Li.Fi Trade Engine** | Wrapper around Li.Fi SDK — get quotes, execute swaps, track transaction status. Single interface for same-chain and cross-chain trades. |
| **Wallet Manager** | Extends existing wallet system to surface balances across all EVM chains + Solana. In-app funding transfers from ETH/SOL/TRON wallets. |
| **PnL Service** | Server-side computation from SpotV2Trade documents. Computes realized, unrealized, win rate, ROI on demand. |
| **Order Book Provider** | Binance WebSocket integration for live bid/ask ladder and recent trades feed. Symbol mapping between Binance format and display format. Li.Fi quote-based fallback for unlisted pairs. |
| **SpotV2 UI** | `/spotv2` page — CEX-like layout (see Layout section below). Pair sidebar, DEXScreener chart, live order book, recent trades, market order form, positions, trade history, PnL dashboard. |

### Layout

The `/spotv2` page uses a CEX-style three-column layout:

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

- **Left column** — Searchable pair list with price, 24h change, chain badge
- **Center top** — DEXScreener TradingView chart with candlesticks and indicators
- **Center middle** — Recent trades feed (time, price, amount, buy/sell colored)
- **Center bottom** — Tabbed panel: Positions | Trade History | PnL Dashboard
- **Right top** — Live order book (bid/ask ladder from Binance WebSocket)
- **Right bottom** — Order form: market order, amount input, quick-fill %, confirmation

### Testing

Tests should be written for:

- **PnL Service** — correctness of realized/unrealized calculations, average cost basis with multiple buys/sells, edge cases (full close, partial close, zero positions)
- **Pair Registry** — mapping logic, cache invalidation, filtering non-tradeable tokens
- **Li.Fi Trade Engine** — quote fetching, error handling for failed/expired quotes, status tracking state machine