# Plan: Dashboard, Portfolio & Assets Fixes

> Source: User-reported issues — UI/UX bugs, stale data sources, missing validations

## Architectural decisions

- **SpotV2 is the canonical spot data source** — All spot balances, positions, markets, and trades come from the SpotV2 ledger system (`SpotV2Ledger`, `SpotV2Position`, `SpotV2Trade`, `SpotV2Order`) and CoinMarketCap-sourced pairs (`fetchSpotV2Pairs`)
- **Hyperliquid remains the futures source** — Futures positions, fills, and balances still come from the Hyperliquid API
- **SpotV2 pair navigation** — All spot market pair links navigate to `/spotv2?pair={symbol}` so clicking a pair anywhere in the app opens the SpotV2 trading page with that pair selected
- **Dollar equivalent pattern** — A `$` toggle button to the LEFT of amount inputs that switches between token amount and USD equivalent. Prices from CoinMarketCap cache (same as SpotV2). For USDT/USDC the conversion is 1:1. Swap/bridge use their own quote engines.
- **Percentage button pattern** — A discrete 4-button row (25% / 50% / 75% / 100%) placed below amount inputs, matching existing quick-amount button style
- **Data fetching** — SpotV2 data accessed via server actions (not new API routes) for dashboard holdings, trades, portfolio, and assets
- **Component adaptation** — `MarketsTable` adapted directly to consume `SpotV2Pair[]` type (no adapter layer)
- **Portfolio total** — Includes available USDC + locked USDC + sum of (position quantity × current price)

---

## Phase 1: Dashboard Markets → SpotV2 Pairs

**User stories**: Dashboard market pairs fetched from old source; clicking trade should open SpotV2 with correct pair

### What to build

Replace the `getSpotMarkets()` call (Hyperliquid + KuCoin source) in the dashboard `MarketsTable` component with `fetchSpotV2Pairs()` (CoinMarketCap source). The Spot tab should display the same pairs available on the SpotV2 trading page. Clicking "Trade" on any pair navigates to `/spotv2?pair={symbol}` with that pair pre-selected. The Futures tab remains unchanged (Hyperliquid source).

### Acceptance criteria

- [ ] Dashboard Spot tab uses `fetchSpotV2Pairs()` as data source
- [ ] Pairs displayed match those on the SpotV2 trading page
- [ ] Clicking "Trade" on a spot pair navigates to `/spotv2?pair={symbol}`
- [ ] Futures tab still works with Hyperliquid data
- [ ] Search and pagination still work

---

## Phase 2: Dashboard Holdings → SpotV2 Positions

**User stories**: My Holdings component shows old Hyperliquid spot data instead of SpotV2

### What to build

Replace `useHyperliquidBalance()` in the `MyPositions` Spot view with SpotV2 ledger data. Show the user's USDC balance from `SpotV2Ledger` and token positions from `SpotV2Position`. Display each position with symbol, quantity, current USD value (from CoinMarketCap price), and unrealized PnL based on `avgEntryPrice`. The Futures tab remains unchanged.

### Acceptance criteria

- [ ] Spot tab shows USDC balance from SpotV2 ledger
- [ ] Spot tab shows token positions from SpotV2Position model
- [ ] Each position shows current value and unrealized PnL
- [ ] Futures tab still works with Hyperliquid positions
- [ ] "View all" link navigates to the assets page

---

## Phase 3: Dashboard Recent Trades → User's SpotV2 Trades

**User stories**: Recent trades component shows external market data; should show user's own trades

### What to build

Replace the `/api/trades` (Hyperliquid/KuCoin market-wide trades) data source in the `RecentTrades` component with the user's own SpotV2 trades from the `SpotV2Trade` model. Show recent buy/sell trades with pair, side, quantity, price, and timestamp. Add a Futures sub-tab that shows the user's Hyperliquid fills (from `useUserFills` or equivalent), so both spot and futures personal trade history are visible. If the user has no trades, show an empty state encouraging them to make their first trade.

### Acceptance criteria

- [ ] Spot trades tab shows user's own SpotV2Trade records
- [ ] Futures trades tab shows user's Hyperliquid fills
- [ ] Each trade shows side (buy/sell), pair, quantity, price, and relative time
- [ ] Empty state shown when user has no trades
- [ ] Pair selector filters trades by token

---

## Phase 4: Dashboard Swap UX Enhancements

**User stories**: Swap component needs MAX button, percentage slider, and dollar equivalent toggle

### What to build

Enhance the swap widget (both compact dashboard mode and full page) with three UX additions: (1) A MAX button that sets the input amount to the user's full balance of the selected token, (2) A horizontal percentage step slider with 25% / 50% / 75% / 100% marks that adjusts the amount relative to the user's balance, (3) A `$` toggle button next to the amount input that switches between displaying the amount in token units vs USD equivalent. When toggled to dollar mode, the user types a dollar amount and the token quantity is auto-calculated from the current price.

### Acceptance criteria

- [ ] MAX button sets amount to full token balance
- [ ] Percentage slider with 25/50/75/100% steps adjusts amount
- [ ] Dollar toggle switches input between token amount and USD equivalent
- [ ] All three features work in both compact (dashboard) and full-page swap modes
- [ ] Slider and dollar toggle update the quote/output in real time

---

## Phase 5: Portfolio Page → SpotV2

**User stories**: Portfolio page still shows Hyperliquid spot balances; rewire to SpotV2

### What to build

Replace the Hyperliquid-sourced spot balance in the portfolio page with SpotV2 ledger data. The "Trading Account" section should show the user's SpotV2 USDC balance (available + locked) and total value of token positions. The Overview tab should break down available USDC, locked-in-orders USDC, and total position value. The Wallets tab should show SpotV2 holdings alongside on-chain wallet balances.

### Acceptance criteria

- [ ] Trading Account total reflects SpotV2 balance (USDC + positions value)
- [ ] Overview tab shows available, locked, and total breakdown from SpotV2
- [ ] Wallets tab shows SpotV2 token positions with current values
- [ ] On-chain wallet balances still display correctly
- [ ] Quick action buttons (Deposit, Withdraw, etc.) still work

---

## Phase 6: Assets Page — Spot Rewiring

**User stories**: Spot Holdings and Spot Markets on Assets page use old Hyperliquid data

### What to build

In the Assets page: (1) Replace `useHyperliquidBalance()` in the Spot Holdings tab with SpotV2 ledger positions and USDC balance. Show each position with token, quantity, available amount, entry price, current value, and PnL. (2) Replace the Spot Markets data source with `fetchSpotV2Pairs()` so the markets match SpotV2. Clicking a pair navigates to `/spotv2?pair={symbol}`.

### Acceptance criteria

- [ ] Spot Holdings tab shows SpotV2 USDC balance and token positions
- [ ] Each holding shows entry price, current value, and PnL from SpotV2 data
- [ ] Spot Markets uses SpotV2 pairs (CoinMarketCap source)
- [ ] Clicking a market pair navigates to `/spotv2?pair={symbol}`
- [ ] Search and filtering still work on both tabs

---

## Phase 7: Assets Page — UX Enhancements (Send, Transfer)

**User stories**: Send modal needs percentage slider + dollar toggle; Transfer component needs the same

### What to build

(1) **Send Crypto modal**: Add a horizontal percentage step slider (25% / 50% / 75% / 100%) that sets the send amount as a percentage of the token balance (accounting for gas buffers on native tokens). Add a `$` toggle to switch between token amount and USD equivalent display. (2) **Transfer to Spot component** (`spot-funding-swap`): Add the same percentage slider and dollar equivalent toggle. The slider sets amount as a percentage of the on-chain USDT balance.

### Acceptance criteria

- [ ] Send modal has percentage step slider (25/50/75/100%)
- [ ] Send modal has `$` toggle for dollar equivalent
- [ ] Percentage slider accounts for gas buffer on native tokens
- [ ] Transfer component has percentage step slider
- [ ] Transfer component has `$` toggle for dollar equivalent
- [ ] Both components update amounts in real time when slider or toggle changes

---

## Phase 8: Send/Bridge Error Handling + Arbitrum Balance

**User stories**: Ethereum send fails with insufficient gas error; bridge missing dollar toggle; Arbitrum balance not reflecting

### What to build

(1) **Ethereum send pre-flight check**: Before calling Privy's `eth_sendTransaction`, estimate gas cost and validate that the user has sufficient native ETH (or Arbitrum ETH) to cover gas + value. Show a clear error message if insufficient, rather than letting the transaction fail at broadcast. (2) **Bridge UX**: Add a `$` toggle on the bridge amount input to switch between token and dollar equivalent display. (3) **Arbitrum balance**: Debug and fix token balances not reflecting for Arbitrum in the bridge — verify RPC endpoint, wallet address resolution, and ERC-20 contract addresses.

### Acceptance criteria

- [ ] Ethereum/Arbitrum send pre-checks gas + value against native balance
- [ ] Clear error message shown before attempting a doomed transaction
- [ ] Bridge input has `$` toggle for dollar equivalent
- [ ] Arbitrum token balances (USDT, USDC, ETH) display correctly in bridge
- [ ] Bridge quotes still work after balance fix
