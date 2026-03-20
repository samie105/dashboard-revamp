# WorldStreet Dashboard — Project Guide

A full-stack crypto trading dashboard built with Next.js, Clerk authentication, Privy multi-chain wallets, and Hyperliquid for spot/futures trading. Users can deposit and withdraw USDT via a fiat P2P ramp (NGN ↔ USDT), trade on Hyperliquid's orderbook, and manage multi-chain wallets.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Authentication](#authentication)
4. [Wallet System](#wallet-system)
5. [Dashboard](#dashboard)
6. [Assets Page](#assets-page)
7. [Spot Trading](#spot-trading)
8. [Deposit Flow (NGN → USDT)](#deposit-flow-ngn--usdt)
9. [Withdraw Flow (USDT → NGN)](#withdraw-flow-usdt--ngn)
10. [Spot Funding (On-chain → Hyperliquid)](#spot-funding-on-chain--hyperliquid)
11. [Futures Trading](#futures-trading)
12. [Bridge & Swap](#bridge--swap)
13. [P2P Trading](#p2p-trading)
14. [Navigation & Layout](#navigation--layout)
15. [API Routes Reference](#api-routes-reference)
16. [Database Models](#database-models)
17. [Blockchain Integrations](#blockchain-integrations)
18. [Hyperliquid Integration](#hyperliquid-integration)
19. [Theme System](#theme-system)
20. [Environment Variables](#environment-variables)

---

## Tech Stack

| Category | Library / Service |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, @base-ui/react, @hugeicons/react |
| Auth | Clerk (`@clerk/nextjs`) |
| Wallets | Privy (`@privy-io/node`) |
| Solana | `@solana/web3.js`, `@solana/spl-token` |
| Ethereum | `viem` |
| Tron | `tronweb` |
| Sui | `@mysten/sui` |
| Exchange | `@nktkas/hyperliquid` |
| Database | MongoDB via `mongoose` |
| State | React Context + Zustand |
| Charts | `lightweight-charts`, `recharts` |
| Animation | `gsap` |
| Payments | GlobalPay |
| Market Data | CoinGecko API |
| PDF Export | `jspdf` + `jspdf-autotable` |

---

## Project Structure

```
worldstreet-dashboard-revamp/
├── app/
│   ├── api/                  # All API route handlers
│   │   ├── deposit/          # P2P deposit (NGN → USDT)
│   │   ├── withdraw/         # P2P withdraw (USDT → NGN)
│   │   ├── spot/             # Spot trading & funding
│   │   ├── wallet/           # On-chain balance queries
│   │   ├── p2p/              # Exchange rates
│   │   ├── hyperliquid/      # Spot account queries
│   │   ├── trades/           # Trade history
│   │   ├── profile/          # User profile CRUD
│   │   └── webhooks/         # Payment gateway callbacks
│   ├── dashboard/            # Dashboard page
│   ├── assets/               # Portfolio / assets page
│   ├── spot/                 # Spot trading (full-bleed)
│   ├── futures/              # Futures trading (full-bleed)
│   ├── deposit/              # P2P deposit page
│   ├── withdraw/             # P2P withdraw page
│   ├── bridge/               # Cross-chain bridge
│   ├── swap/                 # Token swap
│   ├── p2p/                  # Peer-to-peer trading
│   ├── forex/                # Forex trading
│   ├── binary/               # Binary options
│   ├── copy-trading/         # Copy trading
│   ├── transactions/         # Transaction history
│   ├── portfolio/            # Portfolio page
│   ├── login/                # Login page (Clerk)
│   └── register/             # Register page (Clerk)
├── components/
│   ├── assets/               # Assets page components
│   ├── dashboard/            # Dashboard cards & widgets
│   ├── deposit/              # Deposit form client
│   ├── withdraw/             # Withdraw form client
│   ├── spot/                 # Spot trading panels
│   ├── futures/              # Futures trading panels
│   ├── wallet/               # Spot funding, history, swap
│   ├── trading/              # Shared trading components
│   ├── bridge/               # Bridge form client
│   ├── swap/                 # Swap form client
│   ├── p2p/                  # P2P form client
│   ├── copy-trading/         # Copy trading client
│   ├── ui/                   # shadcn base components
│   ├── auth-gate.tsx          # Route-level auth guard
│   ├── auth-provider.tsx      # Auth React Context
│   ├── wallet-provider.tsx    # Multi-chain wallet Context
│   ├── profile-provider.tsx   # User profile Context
│   ├── layout-shell.tsx       # Main layout wrapper
│   ├── navbar.tsx             # Top navigation bar
│   ├── app-sidebar.tsx        # Desktop sidebar
│   ├── mobile-bottom-nav.tsx  # Mobile bottom bar
│   └── theme-provider.tsx     # Dark/light theme wrapper
├── lib/
│   ├── mongodb.ts             # Mongoose connection
│   ├── auth.ts                # Server-side auth helper
│   ├── wallet-actions.ts      # Privy wallet generation
│   ├── profile-actions.ts     # Profile server actions
│   ├── actions.ts             # Market data (CoinGecko)
│   ├── hyperliquid/           # HL SDK wrappers
│   └── privy/                 # Privy SDK init + auth
├── models/                    # Mongoose schemas
├── hooks/                     # Custom React hooks
└── types/                     # TypeScript definitions
```

---

## Authentication

**Provider**: Clerk (`@clerk/nextjs`)

**How it works**:
1. Users sign up / log in via Clerk's hosted UI at `/login` and `/register`.
2. Clerk issues a JWT session stored in secure cookies.
3. `middleware.ts` runs on every API request and page load, validating the Clerk token and protecting all `/api/*` routes.

**Key files**:

| File | Purpose |
|---|---|
| `middleware.ts` | Validates Clerk JWT, blocks unauthenticated API calls |
| `components/auth-gate.tsx` | Client-side guard — redirects to `/login` if not signed in |
| `components/auth-provider.tsx` | React Context exposing `useAuth()` — `user`, `isSignedIn`, `signOut()` |
| `components/profile-provider.tsx` | Loads user profile from MongoDB; exposes `useProfile()` |
| `lib/auth.ts` | `getAuthUser()` server action used in all API route handlers |

**Public routes**: `/login`, `/register`

**Webhook routes (bypass auth)**: `/api/webhooks/*`, `/api/deposit/webhook`

---

## Wallet System

**Provider**: Privy (`@privy-io/node`) — server-side multi-chain wallet generation and signing

**Supported chains**: Ethereum, Solana, Tron, Sui, Ton + a dedicated Hyperliquid Trading Wallet

**Flow**:
1. On first sign-in, if no wallet record exists, `lib/wallet-actions.ts → pregenerateWallet(email)` calls Privy to create all chain wallets.
2. Wallet addresses are stored in MongoDB `UserWallet` collection.
3. `components/wallet-provider.tsx` fetches the wallet record and exposes `addresses`, `wallets`, and `walletsGenerated` via `useWallet()`.
4. If wallets are not yet ready, `components/wallet-setup-loader.tsx` shows a generation progress modal (`components/wallet-generation-modal.tsx`).

**`useWallet()` context shape**:
```typescript
{
  walletsGenerated: boolean
  addresses: {
    ethereum: string
    solana: string
    tron: string
    sui: string
    ton: string
    trading: string   // Hyperliquid trading wallet
  }
  wallets: PrivyWallets   // includes walletId, publicKey per chain
}
```

**Signing**: All on-chain transactions (send USDT, spot deposit) are signed server-side by calling Privy's RPC endpoint with the user's `walletId`. This means private keys **never leave Privy's infrastructure**.

---

## Dashboard

**Page**: `app/dashboard/page.tsx`

**Main component**: `components/dashboard/user-card.tsx` + `components/dashboard/bento-grid.tsx`

### Wallet Card

The wallet card has four views switchable by tabs:

| View | What it shows |
|---|---|
| **Total** | Combined on-chain + Spot + Futures balance in USD |
| **Main** | On-chain USDT balances (Tron, Solana, Ethereum) + wallet address pills |
| **Spot** | Hyperliquid Spot USDC balance + open token holdings |
| **Futures** | Hyperliquid Perps account value + unrealized P&L |

**Balance sources**:
- On-chain: `useWalletBalances()` hook → calls `/api/wallet/balances` → queries each chain's RPC
- Spot/Futures: `useHyperliquidBalance()` hook → queries Hyperliquid clearinghouse state

**Address display**: Three address pills (Tron first, then Solana, Ethereum) are shown in the "Main" view, each with individual copy-to-clipboard.

### Bento Grid

Market price cards for BTC, ETH, SOL with mini-charts. Data comes from `lib/actions.ts → getPrices()` (CoinGecko).

---

## Assets Page

**Page**: `app/assets/page.tsx` → `components/assets/assets-client.tsx`

**Features**:
- Lists all supported tokens with on-chain balances
- Chain filter tabs (All, Tron, Solana, Ethereum, Arbitrum, Sui, Ton) — Tron is default
- Real-time balance fetching via `useWalletBalances()` hook
- Send modal (`components/assets/send-modal.tsx`) for on-chain transfers
- Link to deposit/withdraw
- Spot balance panel sidebar showing Hyperliquid holdings

**Token list order**: TRX (Tron), USDT (TRC-20), SOL, USDT (SPL), ETH, USDT (ERC-20)

**Balance fetching**:
```
useWalletBalances() 
  → GET /api/wallet/balances 
  → parallel RPC calls to Tron/Solana/Ethereum
  → returns [{ chain, symbol, balance, usdValue }]
```

---

## Spot Trading

**Page**: `app/spot/page.tsx` → `components/spot/spot-client.tsx`

The spot page uses a **full-bleed layout** (no sidebar, no navbar) to maximize screen space for the trading interface.

### Layout

```
┌──────────── Spot Trading UI ────────────┐
│  Market Selector  |  Price  |  24h %   │
├──────────────┬──────────────────────────┤
│              │                          │
│  Order Book  │    Candlestick Chart     │
│  (bids/asks) │   (lightweight-charts)   │
│              │                          │
├──────────────┼──────────────────────────┤
│  Order Panel │  Open Orders / History   │
│  (buy/sell)  │                          │
└──────────────┴──────────────────────────┘
```

### Components

| Component | Purpose |
|---|---|
| `components/spot/market-select.tsx` | Token pair picker with search |
| `components/spot/hyperliquid-chart.tsx` | Candlestick chart with indicators |
| `components/spot/animated-order-book.tsx` | Live bids/asks order book |
| `components/spot/order-panel.tsx` | Market/limit buy & sell form |
| `components/spot/open-orders-panel.tsx` | Active orders management |
| `components/spot/recent-trades.tsx` | Last executed trades list |

### Data Flow

```
WebSocket (Hyperliquid) ──→ l2Book subscription ──→ Order Book UI
                       ──→ trades subscription ──→ Recent Trades UI

HTTP (CoinGecko/HL) ──→ Candlestick OHLCV ──→ Chart

Order Placement:
User fills form ──→ POST /api/spot/order (or direct HL SDK)
  ──→ ExchangeClient.order() via Privy-signed wallet
  ──→ Confirmation shown + SpotTrade stored in MongoDB
```

### Order Types
- **Market** — instant fill at current price
- **Limit** — fills at specified price or better

### Trading Wallet
Spot orders are placed from the user's dedicated **Hyperliquid trading wallet** (not their on-chain wallet). Funds must first be moved there via the [Spot Funding](#spot-funding-on-chain--hyperliquid) flow.

---

## Deposit Flow (NGN → USDT)

**Page**: `app/deposit/page.tsx` → `components/deposit/deposit-client.tsx`

This is the **P2P fiat ramp** — users pay NGN via bank transfer and receive USDT on-chain.

### Chain support
Tron (TRC-20) · Solana (SPL) · Ethereum (ERC-20) — Tron is pre-selected by default.

### Status progression
```
pending → awaiting_verification → verifying 
       → payment_confirmed → sending_usdt → completed
                                           → payment_failed / delivery_failed
```

### Step-by-step flow

1. **User selects network** — dropdown select (Tron pre-selected)
2. **Enters USDT amount** — 1 to 5,000
3. **Exchange rate fetched** — `GET /api/p2p/rates` → CoinGecko + 5% platform fee
4. **Clicks "Buy USDT"** → `POST /api/deposit/initiate`
   - Creates a `Deposit` record in MongoDB (`status: "pending"`)
   - Creates a GlobalPay checkout session
   - Returns `checkoutUrl` + `merchantTransactionReference`
5. **Redirected to GlobalPay** — user pays NGN via bank transfer on GlobalPay's hosted page
6. **Verification** — `POST /api/deposit/verify` polls GlobalPay for payment status
   - On bank transfer confirmed → `status: "payment_confirmed"`
7. **USDT delivery** — `POST /api/deposit/webhook` (GlobalPay webhook)
   - Calls `sendUsdtTron()` / `sendUsdtSolana()` / `sendUsdtEthereum()` from `app/api/spot/deposit/send-usdt/route.ts`
   - Uses Privy to sign and broadcast the USDT transfer from treasury wallet to user's address
   - `status: "completed"`, `txHash` saved

### Exchange rate caching
`/api/p2p/rates` queries CoinGecko, caches for 2 minutes, applies markup:
- **Buy rate** (user pays NGN for USDT): market rate × 1.05
- **Sell rate** (user sells USDT for NGN): market rate × 0.95

### Pending deposit resume
On page load, if an unfinished deposit is found, a non-blocking amber banner appears with a "Resume" button. The form remains accessible.

---

## Withdraw Flow (USDT → NGN)

**Page**: `app/withdraw/page.tsx` → `components/withdraw/withdraw-client.tsx`

This is the **P2P fiat off-ramp** — users send USDT to a treasury address and receive NGN in their bank account.

### Chain support
Tron (TRC-20) · Solana (SPL) · Ethereum (ERC-20) — Tron is pre-selected by default.

### Status progression
```
pending → usdt_sent → tx_verified → processing → ngn_sent → completed
                                                          → failed
```

### Step-by-step flow

1. **User selects chain** — button group (Tron first)
2. **Enters USDT amount to sell** — 1 to 5,000
3. **Selects bank account** — from saved banks or add new inline
4. **Clicks "Withdraw USDT"** → `POST /api/withdraw/initiate`
   - Creates `Withdrawal` record (`status: "pending"`)
   - Returns `treasuryWalletAddress` (chain-specific) + `withdrawalId`
5. **User sends USDT** to the displayed treasury address using their own wallet
6. **User pastes tx hash** → `POST /api/withdraw/confirm`
   - Server verifies the tx on-chain (confirms USDT arrived at treasury)
   - `status: "usdt_sent"` → polls → `status: "tx_verified"`
7. **Admin processes payout** — NGN sent to user's bank
   - `status: "processing"` → `"ngn_sent"` → `"completed"`

### Bank management
Up to 3 bank accounts saved in `DashboardProfile.savedBankDetails`. One can be set as default. Banks are added inline in the withdraw form.

### Explorer links (on completion)
- Tron: `tronscan.org/#/transaction/{txHash}`
- Solana: `solscan.io/tx/{txHash}`
- Ethereum: `etherscan.io/tx/{txHash}`

---

## Spot Funding (On-chain → Hyperliquid)

**Component**: `components/wallet/spot-funding-swap.tsx`

This flow moves USDT from a user's on-chain wallet (Tron/Solana/Ethereum) into their Hyperliquid Spot account for trading.

### Status progression
```
initiated → sending_usdt → awaiting_deposit → deposit_detected 
         → disbursing → disbursed → bridging → transferring → completed
```

### Flow

1. **User selects chain & enters amount** in the Transfer widget
2. **POST `/api/spot/deposit/initiate`**
   - Creates `SpotDeposit` record
   - Returns treasury address on the selected chain
3. **POST `/api/spot/deposit/send-usdt`**
   - Server-side: Privy signs and broadcasts USDT transfer from user's wallet to treasury
   - `sendUsdtTron()` / `sendUsdtSolana()` / `sendUsdtEthereum()`
4. **Admin converts and deposits**
   - Treasury converts to USDC, sends to user's trading wallet on Arbitrum
   - Deposits to Hyperliquid Perps via `bridge.ts`
5. **POST `/api/spot/deposit/complete`**
   - Calls `usdClassTransfer(amount, toPerp: false)` — moves USDC from Perps → Spot
   - `status: "completed"`, funds ready for spot trading

### Spot Withdraw (Spot → On-chain)
**Route**: `POST /api/spot/withdraw`
1. Checks USDC balance in Spot
2. `usdClassTransfer(amount, toPerp: true)` — Spot → Perps
3. `withdraw3(destination, amount)` — Hyperliquid Perps → Arbitrum address
4. User receives USDC on Arbitrum

### Transfer History
`components/wallet/funding-history.tsx` shows recent spot deposits fetched from `GET /api/spot/deposit/history`.

---

## Futures Trading

**Page**: `app/futures/page.tsx` → `components/futures/futures-client.tsx`

Full-bleed perpetual contracts trading interface using Hyperliquid. Same technology as spot but trades perp contracts with leverage.

**Features**:
- Open positions with leverage, liquidation price, unrealized P&L
- Same chart and order book components as spot
- Account value from `clearinghouseState()` query

---

## Bridge & Swap

### Bridge
**Page**: `app/bridge/page.tsx` → `components/bridge/bridge-client.tsx`

Cross-chain transfers supporting Tron, Solana, Ethereum, Sui, Ton. Uses `lib/hyperliquid/bridge.ts` for Hyperliquid-native bridging.

### Swap
**Page**: `app/swap/page.tsx`

Token-to-token conversion. Core layout in place.

---

## P2P Trading

**Page**: `app/p2p/page.tsx` → `components/p2p/p2p-client.tsx`

Peer-to-peer order board. Uses the same exchange rates from `/api/p2p/rates`. Feature under active development.

---

## Navigation & Layout

### Layout hierarchy
```
app/layout.tsx
  ClerkProvider
  ThemeProvider
  ProfileProvider (MongoDB user prefs)
  AuthProvider (Clerk context)
  AuthGate (redirects unauthenticated users)
  WalletProvider (Privy multi-chain)
  HlWsWrapper (Hyperliquid WebSocket connection)
  VividVoiceProvider
  TradeSelectorProvider
  LayoutShell
    ├── Navbar (top bar)          components/navbar.tsx
    ├── AppSidebar (desktop)      components/app-sidebar.tsx
    ├── <main> content area
    └── MobileBottomNav (mobile)  components/mobile-bottom-nav.tsx
```

### Full-bleed routes
`/spot`, `/futures`, `/forex`, `/binary`, `/vivid` — these routes hide the sidebar and navbar so the trading UI fills the full screen.

### Sidebar groups

| Group | Links |
|---|---|
| Overview | Dashboard, Portfolio, Assets, Transactions |
| Trading | Markets, Spot, Futures, Forex, Binary, Swap, Bridge, Copy Trading, P2P |
| Account | Profile, Security |
| Resources | Docs, Community |

---

## API Routes Reference

### Deposit (`/api/deposit/`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/deposit/initiate` | Create deposit, get GlobalPay checkout URL |
| `POST` | `/api/deposit/verify` | Poll GlobalPay for payment confirmation |
| `POST` | `/api/deposit/webhook` | GlobalPay callback — deliver USDT on-chain |
| `GET` | `/api/deposit/history` | User's deposit history |
| `GET` | `/api/deposit/pending` | Fetch latest pending deposit |
| `GET` | `/api/deposit/status/:id` | Single deposit status |
| `PATCH` | `/api/deposit/status/:id` | Cancel a deposit |

### Withdraw (`/api/withdraw/`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/withdraw/initiate` | Create withdrawal, get treasury address |
| `POST` | `/api/withdraw/confirm` | Submit tx hash for verification |
| `GET` | `/api/withdraw/status/:id` | Withdrawal status |
| `PATCH` | `/api/withdraw/status/:id` | Cancel withdrawal |

### Spot Funding (`/api/spot/`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/spot/deposit/initiate` | Create spot deposit record |
| `POST` | `/api/spot/deposit/send-usdt` | Server sends USDT from user wallet to treasury |
| `POST` | `/api/spot/deposit/complete` | Move funds from Perps → Spot on Hyperliquid |
| `POST` | `/api/spot/deposit/cancel` | Cancel spot deposit |
| `GET` | `/api/spot/deposit/status/:id` | Deposit status |
| `GET` | `/api/spot/deposit/history` | User's spot deposit history |
| `POST` | `/api/spot/withdraw` | Withdraw USDC from Spot → on-chain |

### Other

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/p2p/rates` | Exchange rates (NGN/USD/GBP ↔ USDT via CoinGecko) |
| `GET` | `/api/wallet/balances` | On-chain balances for all chains |
| `GET` | `/api/hyperliquid/spot-balances` | Spot account balances from Hyperliquid |
| `GET` | `/api/trades` | User trade history |
| `GET/PATCH` | `/api/profile` | User profile read/update |

---

## Database Models

All models live in `models/` and connect to MongoDB database `user-account`.

| Model | Collection | Purpose |
|---|---|---|
| `UserWallet` | `userwallets` | Multi-chain wallet addresses (Privy) per user |
| `DashboardProfile` | `dashboardprofiles` | User preferences, saved banks, watchlist, theme |
| `Deposit` | `deposits` | P2P deposit records (NGN → USDT) |
| `Withdrawal` | `withdrawals` | P2P withdrawal records (USDT → NGN) |
| `SpotDeposit` | `spotdeposits` | On-chain → Hyperliquid Spot funding records |
| `SpotTrade` | `spottrades` | Executed spot trade records |
| `P2POrder` | `p2porders` | Peer-to-peer order book entries |
| `TreasuryWallet` | `treasurywallets` | Treasury addresses per chain |
| `WalletTransfer` | `wallettransfers` | On-chain transfer history |
| `SwapTransaction` | `swaptransactions` | Swap execution records |
| `Conversation` | `conversations` | Vivid voice chat sessions |
| `ChatMessage` | `chatmessages` | Individual Vivid voice messages |

### Key schema fields

**UserWallet**
```typescript
{
  clerkUserId: string
  email: string
  privyUserId: string
  wallets: {
    ethereum: { walletId, address, publicKey }
    solana:   { walletId, address, publicKey }
    tron:     { walletId, address, publicKey }
    sui:      { walletId, address, publicKey }
    ton:      { walletId, address, publicKey }
  }
  tradingWallet: { walletId, address, chainType }
}
```

**DashboardProfile**
```typescript
{
  clerkUserId: string
  email: string
  displayName: string
  savedBankDetails: BankDetail[]   // max 3
  onboardingCompleted: string[]    // keys of completed onboarding flows
  theme: "light" | "dark" | "system"
  watchlist: string[]
}
```

**Deposit**
```typescript
{
  userId: string
  usdtAmount: number
  fiatAmount: number
  fiatCurrency: "NGN"
  network: "tron" | "solana" | "ethereum"
  merchantTransactionReference: string
  globalPayTransactionReference?: string
  checkoutUrl: string
  txHash?: string
  status: "pending" | "payment_confirmed" | "sending_usdt" | "completed" | "payment_failed" | ...
}
```

**Withdrawal**
```typescript
{
  userId: string
  usdtAmount: number
  fiatAmount: number
  chain: "tron" | "solana" | "ethereum"
  treasuryWalletAddress: string
  userWalletAddress: string
  bankDetails: { bankName, accountNumber, accountName }
  txHash?: string
  txVerified: boolean
  payoutReference?: string
  status: "pending" | "usdt_sent" | "tx_verified" | "processing" | "ngn_sent" | "completed" | "failed"
}
```

---

## Blockchain Integrations

### Tron (TRC-20)
- **Library**: `tronweb` v6.2.2
- **USDT contract**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- **Decimals**: 6
- **Usage**: `sendUsdtTron()` in `app/api/spot/deposit/send-usdt/route.ts`
- **Signing**: TronWeb instance + Privy wallet via `signTronTransaction()` → `tronWeb.trx.ecRecover()` for address recovery
- **Explorer**: `tronscan.org`

### Solana (SPL)
- **Library**: `@solana/web3.js` + `@solana/spl-token`
- **USDT mint**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **Decimals**: 6
- **Usage**: `sendUsdtSolana()` — creates associated token account if needed, then `createTransferInstruction()`
- **Signing**: Privy Solana wallet
- **Explorer**: `solscan.io`

### Ethereum (ERC-20)
- **Library**: `viem` v2
- **USDT contract**: `0xdAC17F958D2ee523a2206206994597C13D831ec7` (Mainnet)
- **Decimals**: 6
- **Usage**: `sendUsdtEthereum()` — `encodeFunctionData()` for ERC-20 `transfer()`, sent via Privy `eth_sendTransaction`
- **Explorer**: `etherscan.io`

### Sui + Ton
- Wallets generated via Privy
- Placeholder for future features

---

## Hyperliquid Integration

**SDK**: `@nktkas/hyperliquid` v0.32.1

**Files**:

| File | Purpose |
|---|---|
| `lib/hyperliquid/client.ts` | `InfoClient` (read) + `ExchangeClient` (write) setup |
| `lib/hyperliquid/usdTransfer.ts` | `usdClassTransfer(amount, toPerp)` — move USDC between Spot and Perps |
| `lib/hyperliquid/withdraw.ts` | `withdraw3(destination, amount)` — withdraw to Arbitrum |
| `lib/hyperliquid/bridge.ts` | Deposit bridge from Arbitrum to Hyperliquid |
| `lib/hyperliquid/simple.ts` | Simplified query helpers |
| `components/hl-ws-wrapper.tsx` | Persistent WebSocket connection for real-time data |

**Key queries**:

```typescript
// Market data
InfoClient.getAllMidPrices()        // all current prices
InfoClient.meta()                   // market metadata (szDecimals, maxLeverage)
InfoClient.l2Book(coin)             // live order book
InfoClient.getTrades(coin)          // recent trades feed

// Account queries
InfoClient.spotClearinghouseState(userAddress)   // spot balances
InfoClient.clearinghouseState(userAddress)        // futures positions
```

**Order placement**: `ExchangeClient.order()` — uses the trading wallet (separate from on-chain wallets), signed via Privy.

**WebSocket**: `hl-ws-wrapper.tsx` maintains a persistent connection and resubscribes to `l2Book` and `trades` channels. Falls back to HTTP polling on disconnect.

---

## Theme System

**Library**: `next-themes`

**Implementation**:
- `components/theme-provider.tsx` wraps the app and sets the `class` attribute on `<html>`
- Default: `"system"` (respects OS dark/light preference)
- Persisted to `localStorage`
- CSS variables defined in `app/globals.css` for both modes
- User theme preference also stored in `DashboardProfile.theme`

**Keyboard shortcut**: Press `d` (when not in an input) to toggle dark/light mode.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Privy Wallets
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# GlobalPay (fiat payments)
NEXT_PUBLIC_GLOBALPAY_API_KEY=...

# Node environment
NODE_ENV=development
```

---

## Architecture Overview

```
┌────────────── Browser ──────────────────────────────────────────┐
│  React Components (Next.js App Router)                          │
│  ├── Auth (Clerk)                                               │
│  ├── Wallet Context (Privy addresses)                           │
│  ├── Profile Context (MongoDB prefs)                            │
│  ├── Spot/Futures UI (Hyperliquid WebSocket)                    │
│  └── Deposit/Withdraw forms (P2P)                               │
└──────────────────────────────────────────────────────────────────┘
                        │ HTTPS + Clerk JWT
┌────────────── Next.js API Routes ───────────────────────────────┐
│  /api/deposit/*   → GlobalPay payment gateway                   │
│  /api/withdraw/*  → On-chain tx verification                    │
│  /api/spot/*      → Treasury bridge + Hyperliquid funding       │
│  /api/p2p/rates   → CoinGecko exchange rates                    │
│  /api/wallet/*    → On-chain balance queries                    │
└──────────────────────────────────────────────────────────────────┘
                        │
┌────────────── External Services ────────────────────────────────┐
│  Clerk           — User authentication & JWT sessions           │
│  Privy           — Multi-chain wallet generation & signing      │
│  MongoDB         — User data, deposits, trades, profiles        │
│  Hyperliquid     — Spot/futures exchange (orders + WebSocket)   │
│  GlobalPay       — Fiat bank transfer processing (NGN)          │
│  Solana RPC      — SPL token balance & transfer queries         │
│  Ethereum RPC    — ERC-20 balance & transfer queries            │
│  Tron RPC        — TRC-20 balance & transfer queries            │
│  CoinGecko       — Market prices & exchange rates               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.local.example .env.local
# Fill in all required env vars above

# Run development server
pnpm dev

# Build for production
pnpm build
pnpm start
```

Open [http://localhost:3000](http://localhost:3000).
