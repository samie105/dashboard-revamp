# GMX Integration Guide — AI-Agent Handoff Document

> **Status:** Reference document only. No code changes yet.  
> **Tech Stack:** Next.js 16 + React 19 + TypeScript, Tailwind v4, shadcn/ui, Clerk auth, Privy embedded wallets, `@nktkas/hyperliquid`, lightweight-charts.  
> **Backend:** External order execution at `https://trading.watchup.site` and local API routes under `app/api/hyperliquid/`.  
> **GMX Dependency:** `@gmx-io/sdk` v1.5.0-alpha-13 (already installed).

---

## 1. Architecture Overview

### 1.1 Current Futures Page (Hyperliquid)
- **File:** `app/futures/page.tsx` (server) → `components/futures/futures-client.tsx` (client)
- **Layout:** 3-column desktop (market list / chart+order form / order book) + bottom positions panel
- **Chart:** `lightweight-charts` with 13 timeframes, 40+ indicators, 13 drawing tools
- **Market data:** Fetched from Hyperliquid API via `lib/actions.ts` (`getFuturesMarkets`, `getOrderBook`, `getFuturesKlines`)
- **Order execution:** POST to external backend `https://trading.watchup.site` (NOT the local `app/api/hyperliquid/order/route.ts`)
- **Positions panel:** Placeholder empty state — not wired to any API

### 1.2 Wallet Flow (Privy + Clerk)
1. User logs in via Clerk (`@clerk/nextjs`).
2. On first login, `ensureUserWallet(clerkUserId)` runs:
   - Finds or creates a Privy user with `custom_auth` = `clerkUserId`.
   - Privy generates embedded wallets across 5 chains (ETH, BTC, SOL, etc.).
   - Stored in MongoDB `UserWallet.tradingWallet` (defaults to ETH address).
3. `WalletProvider` React context exposes:
   - `wallets` — all chain wallets.
   - `tradingWallet` — ETH wallet address used for trading.
   - `hasTradingWallet` — boolean.
4. Server-side signing:
   - `lib/privy/signing.ts` → `signTypedData()` (EIP-712).
   - `lib/privy/ethereum.ts` → `sendEthereumTransaction()` via Privy RPC with Clerk JWT `authorization_context`.

### 1.3 Recommended Hybrid Approach
- **Keep** the existing Hyperliquid futures page as-is.
- **Add** GMX as an alternative execution backend.
- **Reuse** the existing chart, market list, and order book UI.
- **Swap** only the order execution path (and positions data source) based on a toggle or route.

---

## 2. File Structure to Create

```
dashboard-revamp/
├── lib/gmx/
│   ├── sdk.ts          # SDK initialization + shared config
│   ├── actions.ts      # Data fetching (markets, candles, positions)
│   ├── types.ts        # Shared GMX types
│   └── constants.ts    # Chain IDs, contract addresses, token addresses
├── app/api/gmx/
│   ├── markets/route.ts    # GET available GMX markets
│   ├── candles/route.ts    # GET historical OHLCV
│   ├── positions/route.ts  # GET open positions
│   └── order/route.ts      # POST execute order (SDK v2 Express)
└── docs/
    └── gmx-integration-guide.md   # This file
```

---

## 3. Wallet Context for GMX

### 3.1 Which Wallet Do Users Trade From?
- **Privy embedded Ethereum wallet** (address stored in `UserWallet.tradingWallet`).
- Private keys are **server-side only** (held by Privy). No client-side signing.
- Every Privy RPC call requires the Clerk JWT in `authorization_context`.

### 3.2 Reuse Existing Code
- `lib/ensureUserWallet.ts` — resolve/create wallet (already works, no changes).
- `lib/wallet-actions.ts` — `pregenerateWallet()`, `refreshWallet()`, `getTradingWalletStatus()`.
- `lib/privy/signing.ts` — `signTypedData()` for GMX EIP-712 order signatures.
- `lib/privy/ethereum.ts` — `sendEthereumTransaction()` for raw GMX contract calls (if needed).

### 3.3 GMX-Specific Notes
- GMX uses **EIP-712 typed data signing** for orders. Use `signTypedData(walletId, domain, types, value)`.
- GMX v2 supports **Express/Gelato relay** (gasless). If using relay, you do NOT need `sendEthereumTransaction()` — you sign the order and send the signed payload to the relay API.

---

## 4. GMX SDK v2 Setup

### 4.1 Initialize SDK
```typescript
// lib/gmx/sdk.ts
import { GmxSdk } from "@gmx-io/sdk";

const ARBITRUM_CHAIN_ID = 42161;

export const gmxSdk = new GmxSdk({
  chainId: ARBITRUM_CHAIN_ID,
  // Optional: custom RPC if you have one, otherwise SDK uses public endpoints
  // rpcUrl: process.env.ARBITRUM_RPC_URL,
});
```

### 4.2 Chain IDs
| Network      | Chain ID |
|--------------|----------|
| Arbitrum One | 42161    |
| Arbitrum Sepolia (testnet) | 421614 |

---

## 5. Phase 1 — Read-Only Integration (Markets, Candles, Positions)

### 5.1 Fetch Available Markets
```typescript
// lib/gmx/actions.ts
import { gmxSdk } from "./sdk";

export async function getGmxMarkets() {
  const marketsInfo = await gmxSdk.fetchMarketsInfo();
  return marketsInfo.map((m: any) => ({
    symbol: m.marketTokenAddress,        // GMX uses marketTokenAddress as the market identifier
    indexToken: m.indexTokenAddress,     // e.g., ETH, BTC
    longToken: m.longTokenAddress,       // collateral token for longs
    shortToken: m.shortTokenAddress,     // collateral token for shorts
    price: m.indexPrice,                 // current index price
    // ...other fields
  }));
}
```

**Route:** `app/api/gmx/markets/route.ts`
```typescript
import { NextResponse } from "next/server";
import { getGmxMarkets } from "@/lib/gmx/actions";

export async function GET() {
  try {
    const markets = await getGmxMarkets();
    return NextResponse.json(markets);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### 5.2 Fetch Candles / OHLCV
```typescript
// lib/gmx/actions.ts
export async function getGmxCandles(
  marketToken: string,
  interval: string,   // e.g., "1m", "5m", "15m", "1h", "4h", "1d"
  startTimestamp: number,
  endTimestamp: number
) {
  const candles = await gmxSdk.fetchCandles({
    marketTokenAddress: marketToken,
    interval,
    startTimestamp,
    endTimestamp,
  });
  return candles;
}
```

**Route:** `app/api/gmx/candles/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getGmxCandles } from "@/lib/gmx/actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const marketToken = searchParams.get("marketToken");
  const interval = searchParams.get("interval") || "1h";
  const start = Number(searchParams.get("start"));
  const end = Number(searchParams.get("end"));

  if (!marketToken || !start || !end)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const candles = await getGmxCandles(marketToken, interval, start, end);
  return NextResponse.json(candles);
}
```

### 5.3 Fetch Positions
```typescript
// lib/gmx/actions.ts
export async function getGmxPositions(account: string) {
  const positions = await gmxSdk.fetchPositionsInfo({
    account,
  });
  return positions;
}
```

**Route:** `app/api/gmx/positions/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getGmxPositions } from "@/lib/gmx/actions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");
  if (!account) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  const positions = await getGmxPositions(account);
  return NextResponse.json(positions);
}
```

---

## 6. Phase 2 — Trading Integration (Order Execution)

### 6.1 Order Flow
1. User selects market + size + leverage + side (Long/Short).
2. Server route `app/api/gmx/order/route.ts` receives order params.
3. Resolve trading wallet via `ensureUserWallet(clerkUserId)`.
4. Build GMX order object using SDK v2.
5. **Sign** the EIP-712 typed data via `signTypedData()` (`lib/privy/signing.ts`).
6. **Execute** via one of two paths:
   - **Direct on-chain:** Use `sendEthereumTransaction()` to call `ExchangeRouter` contract.
   - **Gasless relay (Express/Gelato):** Send signed order to GMX relay API.

### 6.2 SDK v2 Order Creation
```typescript
// lib/gmx/actions.ts
import { gmxSdk } from "./sdk";

export async function buildGmxOrder(params: {
  marketToken: string;
  isLong: boolean;
  sizeDeltaUsd: bigint;      // in 1e30
  collateralDeltaAmount: bigint;
  account: string;
  // ...slippage, triggerPrice, etc.
}) {
  const order = await gmxSdk.createOrder({
    marketTokenAddress: params.marketToken,
    isLong: params.isLong,
    sizeDeltaUsd: params.sizeDeltaUsd,
    collateralDeltaAmount: params.collateralDeltaAmount,
    account: params.account,
    // triggerPrice, acceptablePrice, etc.
  });
  return order;
}
```

### 6.3 Sign + Submit (Gasless Relay Example)
```typescript
// app/api/gmx/order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ensureUserWallet } from "@/lib/ensureUserWallet";
import { signTypedData } from "@/lib/privy/signing";
import { buildGmxOrder } from "@/lib/gmx/actions";
import { gmxSdk } from "@/lib/gmx/sdk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clerkUserId, marketToken, isLong, sizeDeltaUsd, collateralDeltaAmount } = body;

    // 1. Resolve wallet
    const wallet = await ensureUserWallet(clerkUserId);
    const account = wallet.tradingWallet;

    // 2. Build order
    const order = await buildGmxOrder({ marketToken, isLong, sizeDeltaUsd, collateralDeltaAmount, account });

    // 3. Sign EIP-712 typed data
    const signature = await signTypedData(
      /* walletId */ wallet.privyWalletId,   // or however you map to the Privy wallet ID
      /* domain   */ order.domain,
      /* types    */ order.types,
      /* value    */ order.value
    );

    // 4. Submit via GMX relay (gasless)
    const txHash = await gmxSdk.submitOrder({
      ...order,
      signature,
      // relay-specific options
    });

    return NextResponse.json({ txHash });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

> **⚠️ IMPORTANT:** `signTypedData()` in `lib/privy/signing.ts` is designed for EIP-712. Verify the exact `domain`, `types`, and `value` shape expected by GMX v2 by checking the SDK source or GMX contract docs. If the shape differs, adjust the call or add a wrapper.

### 6.4 Direct On-Chain Alternative
If you skip the relay and submit directly to the `ExchangeRouter` contract:

```typescript
import { sendEthereumTransaction } from "@/lib/privy/ethereum";

const txHash = await sendEthereumTransaction({
  walletId: wallet.privyWalletId,
  authorizationContext: clerkJwtToken,  // from Clerk session
  to: GMX_EXCHANGE_ROUTER_ADDRESS,
  data: encodedCalldata,              // from viem / ethers
  chainId: 42161,
});
```

**GMX Arbitrum ExchangeRouter Address:** `0x1C3fa76e6E1088bBCE750f23a5BFcffa1efEF6A41` (verify on [GMX contracts page](https://gmx.io/docs/api/contracts/addresses)).

---

## 7. Key Differences from Hyperliquid

| Feature                  | Hyperliquid (Current)               | GMX v2 (New)                          |
|--------------------------|--------------------------------------|---------------------------------------|
| **Chain**                | L1 (Hyperliquid chain)               | Arbitrum (L2)                         |
| **Wallet**               | Privy embedded (same)                | Privy embedded ETH wallet (same)      |
| **Order signing**        | Server-side via `@nktkas/hyperliquid`| EIP-712 typed data via `signTypedData()` |
| **Gas**                  | No gas (app-chain)                   | Requires ETH for gas OR use Gelato relay |
| **Markets**              | `coin` string (e.g., "BTC")          | `marketTokenAddress`                  |
| **Positions API**        | `clearinghouseState`                 | `sdk.fetchPositionsInfo()`            |
| **Order types**          | Market, Limit, Stop                  | Market, Limit, Stop-Limit, TP/SL      |
| **Collateral**           | USDC only                            | Long = index token, Short = stable    |
| **Leverage**             | Up to 50x                            | Up to 50x-100x depending on market      |

---

## 8. Wiring into the Existing UI

### 8.1 Minimal UI Changes
- Add a **backend toggle** in `components/futures/futures-client.tsx`:
  - `backend: "hyperliquid" | "gmx"`
- When `backend === "gmx"`:
  - **Markets list:** fetch from `/api/gmx/markets` instead of `getFuturesMarkets()`.
  - **Candles:** fetch from `/api/gmx/candles` instead of `getFuturesKlines()`.
  - **Order form:** POST to `/api/gmx/order` instead of `executeTrade()` (external backend).
  - **Positions panel:** fetch from `/api/gmx/positions` instead of the placeholder.

### 8.2 Reuse These Components (No Changes Needed)
- `components/futures/futures-chart.tsx` — chart is data-source agnostic.
- `components/futures/futures-client.tsx` — layout is data-source agnostic; only swap data fetchers.
- Order form UI (inputs, leverage slider, margin calculator) — all reusable.

---

## 9. Environment Variables Needed

Add these to `.env.local` (or your deployment platform):

```bash
# Existing (already present)
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# Optional: custom Arbitrum RPC for reliability
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Optional: GMX testnet
GMX_TESTNET=true   # if true, use chainId 421614
```

---

## 10. Testing Checklist

### Phase 1 (Read-Only)
- [ ] `GET /api/gmx/markets` returns market list with `marketTokenAddress`, `indexTokenAddress`, `price`.
- [ ] `GET /api/gmx/candles?marketToken=...&interval=1h&start=...&end=...` returns OHLCV array.
- [ ] `GET /api/gmx/positions?account=0x...` returns open positions (empty array if none).
- [ ] UI markets list populates when backend toggle = "gmx".
- [ ] Chart renders GMX candles correctly.

### Phase 2 (Trading)
- [ ] `POST /api/gmx/order` builds, signs, and submits an order.
- [ ] Order appears in `GET /api/gmx/positions` after execution.
- [ ] Positions panel shows GMX positions (size, entry price, PnL, liquidation price).
- [ ] Error handling: insufficient collateral, slippage exceeded, network errors.

---

## 11. GMX vs CEX Futures (Reality Check)

| Feature               | GMX v2  | Binance/Bybit |
|-----------------------|---------|---------------|
| Perpetuals            | ✅ Yes  | ✅ Yes        |
| Quarterly (expiring)  | ❌ No   | ✅ Yes        |
| Inverse / COIN-M      | ❌ No   | ✅ Yes        |
| Options               | ❌ No   | ✅ Yes        |
| Spot trading          | ❌ No   | ✅ Yes        |

> **Verdict:** GMX gives you decentralized perpetual futures. It does **NOT** replicate a full CEX futures suite. If you need quarterly expiring futures or inverse contracts, you must integrate a CEX API (Binance, Bybit, OKX).

---

## 12. Reference Links

- **GMX Docs:** https://gmx.io/docs
- **GMX SDK v2 README:** https://gmx.io/docs/sdk/v2/readme
- **GMX SDK v2 Examples:** https://gmx.io/docs/sdk/v2/examples
- **GMX Contract Addresses:** https://gmx.io/docs/api/contracts/addresses
- **GMX Fees:** https://gmx.io/docs/trading/fees
- **GMX AI Agents:** https://gmx.io/docs/ai-agents/overview

---

## 13. Contact & Context

- **Repo:** `https://github.com/samie105/dashboard-revamp`
- **Clerk Auth:** JWT required for every Privy call.
- **Privy Wallets:** Server-side only. No client-side private keys.
- **External backend fallback:** `https://trading.watchup.site` (currently used for Hyperliquid orders).
- **Telegram alerts:** `Boyizzz` (used to send research reports).

---

*End of document.*
