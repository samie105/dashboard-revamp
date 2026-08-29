/**
 * Dev-only mock data — part of the dev bypasses (see lib/dev-auth-bypass.ts).
 *
 * The external services (worldstreet-crypto, worldstreet-wallet, Privy) reject
 * the bypass's fake token, which left every screen in its empty state. This
 * module fills that gap: realistic balances, positions, transactions and
 * order flows so the frontend redesign can be evaluated against live-looking
 * data on localhost.
 *
 * Consumed from three seams, all gated on DEV_AUTH_BYPASS:
 *   - app/api/[...path]/route.ts  (the crypto/wallet proxy → devMockApiResponse)
 *   - lib/wallet-actions.ts       (Privy wallet provisioning)
 *   - lib/profile-actions.ts      (MongoDB dashboard profile)
 *
 * REMOVAL (when the frontend redesign ships): delete this file and every
 * DEV_AUTH_BYPASS branch — `grep -r DEV_AUTH_BYPASS` finds all of them.
 * Like the flag itself, this is double-gated and inert in production builds.
 */

import { DEV_BYPASS_USER } from "./dev-auth-bypass"
import type {
  AgentStatus,
  Buy,
  BuyAvailability,
  Coin,
  CustomToken,
  Fund,
  FundAvailability,
  HlAccount,
  HlMarkets,
  PricesResponse,
  SellInfo,
  Sell,
  TokenBalance,
  TradingWalletStatus,
  TradingWithdraw,
  TradingWithdrawInfo,
  TransactionsPage,
  UnifiedTransaction,
  WalletInfo,
} from "./crypto-api"

// ── Helpers ─────────────────────────────────────────────────────────────────

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const daysAgo = (d: number) => hoursAgo(d * 24)

let txCounter = 0
const mockTxHash = () =>
  `0xde5b${(++txCounter).toString(16).padStart(4, "0")}${"ab12cd34ef56".repeat(4)}`.slice(0, 66)

const json = (data: unknown, status = 200) =>
  Response.json(data, { status })

// ── Wallet addresses (obviously fake, valid formats) ────────────────────────

export const DEV_MOCK_ADDRESSES = {
  ethereum: "0xD0e5bA5c04d8f3A1e9c2b6D5f4a3b2C1d0E9f8a7",
  solana: "DevBypAss1111111111111111111111111111111111",
  sui: `0x${"d0e5".repeat(16)}`,
  ton: "UQDevBypassMockTonWalletAddr0000000000000000gg",
  tron: "TDevBypassMockTronWa11etAddr3ss999",
} as const

/** Shaped for lib/actions.ts getUserBalances (legacy trading backend). */
export const DEV_MOCK_USER_BALANCES = [
  { asset: "ETH", chain: "ethereum", available: 1.2847, locked: 0 },
  { asset: "SOL", chain: "solana", available: 42.5, locked: 0 },
  { asset: "SUI", chain: "sui", available: 1_250, locked: 0 },
  { asset: "TON", chain: "ton", available: 380.5, locked: 0 },
  { asset: "TRX", chain: "tron", available: 5_400, locked: 0 },
]

/** Shaped for lib/wallet-actions.ts (WalletResult.wallets). */
export const DEV_MOCK_WALLETS = Object.fromEntries(
  Object.entries(DEV_MOCK_ADDRESSES).map(([chain, address]) => [
    chain,
    { walletId: `dev-wallet-${chain}`, address, publicKey: null },
  ]),
)

export const DEV_MOCK_TRADING_WALLET = {
  walletId: "dev-wallet-trading",
  address: "0xA11ceD0e5bA5c04d8f3A1e9c2b6D5f4a3b2C1d0E",
  chainType: "ethereum",
}

const walletInfo: WalletInfo = {
  privyUserId: "did:privy:dev-bypass",
  email: DEV_BYPASS_USER.email,
  privy_type: 2,
  wallets: Object.fromEntries(
    Object.entries(DEV_MOCK_ADDRESSES).map(([chain, address]) => [
      chain,
      { walletId: `dev-wallet-${chain}`, address, publicKey: null },
    ]),
  ),
}

// ── Prices ──────────────────────────────────────────────────────────────────

const cg = (path: string) => `https://coin-images.coingecko.com/coins/images/${path}`

const COINS: Coin[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 118_245, change24h: 2.14, marketCap: 2_340_000_000_000, volume24h: 48_200_000_000, image: cg("1/small/bitcoin.png") },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 4_486.2, change24h: 3.62, marketCap: 540_000_000_000, volume24h: 22_400_000_000, image: cg("279/small/ethereum.png") },
  { id: "solana", symbol: "SOL", name: "Solana", price: 216.4, change24h: -1.85, marketCap: 101_000_000_000, volume24h: 5_600_000_000, image: cg("4128/small/solana.png") },
  { id: "sui", symbol: "SUI", name: "Sui", price: 3.42, change24h: 4.91, marketCap: 11_000_000_000, volume24h: 980_000_000, image: cg("26375/small/sui-ocean-square.png") },
  { id: "the-open-network", symbol: "TON", name: "Toncoin", price: 5.86, change24h: 0.74, marketCap: 14_600_000_000, volume24h: 310_000_000, image: cg("17980/small/ton_symbol.png") },
  { id: "tron", symbol: "TRX", name: "Tron", price: 0.1618, change24h: -0.42, marketCap: 14_000_000_000, volume24h: 620_000_000, image: cg("1094/small/tron-logo.png") },
  { id: "tether", symbol: "USDT", name: "Tether", price: 1, change24h: 0.01, marketCap: 168_000_000_000, volume24h: 92_000_000_000, image: cg("325/small/Tether.png") },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin", price: 1, change24h: -0.01, marketCap: 64_000_000_000, volume24h: 11_000_000_000, image: cg("6319/small/usdc.png") },
  { id: "ripple", symbol: "XRP", name: "XRP", price: 3.12, change24h: 1.28, marketCap: 178_000_000_000, volume24h: 6_400_000_000, image: cg("44/small/xrp-symbol-white-128.png") },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.2385, change24h: -3.17, marketCap: 35_800_000_000, volume24h: 2_100_000_000, image: cg("5/small/dogecoin.png") },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 24.6, change24h: 5.43, marketCap: 16_100_000_000, volume24h: 890_000_000, image: cg("877/small/chainlink-new-logo.png") },
  { id: "hyperliquid", symbol: "HYPE", name: "Hyperliquid", price: 44.2, change24h: 6.08, marketCap: 14_800_000_000, volume24h: 410_000_000, image: cg("50882/small/hyperliquid.jpg") },
]

const PRICE_MAP: Record<string, number> = Object.fromEntries(
  COINS.map((c) => [c.symbol, c.price]),
)

const pricesResponse = (): PricesResponse => ({
  prices: PRICE_MAP,
  coins: COINS,
  fetchedAt: Date.now(),
})

// ── On-chain balances ───────────────────────────────────────────────────────

const BALANCES: TokenBalance[] = [
  { symbol: "ETH", name: "Ethereum", chain: "ethereum", balance: 1.2847, isNative: true },
  { symbol: "SOL", name: "Solana", chain: "solana", balance: 42.5, isNative: true },
  { symbol: "SUI", name: "Sui", chain: "sui", balance: 1_250, isNative: true },
  { symbol: "TON", name: "Toncoin", chain: "ton", balance: 380.5, isNative: true },
  { symbol: "TRX", name: "Tron", chain: "tron", balance: 5_400, isNative: true },
  { symbol: "USDT", name: "Tether", chain: "tron", balance: 2_500, contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", isNative: false },
  { symbol: "USDC", name: "USD Coin", chain: "ethereum", balance: 1_803.5, contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", isNative: false },
]

// ── Hyperliquid trading account ─────────────────────────────────────────────

const hlAccount: HlAccount = {
  ready: true,
  address: DEV_MOCK_TRADING_WALLET.address,
  balances: {
    perpsWithdrawableUsdc: 1_842.6,
    perpsAccountValueUsdc: 4_163.85,
    spotUsdc: 2_691.42,
    spotUsdcHold: 120,
    spotTokens: [
      { symbol: "SOL", total: 12.5, hold: 0, available: 12.5 },
      { symbol: "HYPE", total: 85, hold: 10, available: 75 },
    ],
  },
  positions: [
    {
      symbol: "BTC", size: 0.05, absSize: 0.05, side: "long",
      entryPrice: 112_410, markPrice: 118_245, notionalUsd: 5_912.25,
      unrealizedPnl: 291.75, returnOnEquity: 0.519, liquidationPrice: 101_170,
      marginUsed: 562.05, leverage: { type: "isolated", value: 10 },
    },
    {
      symbol: "ETH", size: -1.2, absSize: 1.2, side: "short",
      entryPrice: 4_621.4, markPrice: 4_486.2, notionalUsd: 5_383.44,
      unrealizedPnl: 162.24, returnOnEquity: 0.146, liquidationPrice: 5_542,
      marginUsed: 1_108.9, leverage: { type: "cross", value: 5 },
    },
    {
      symbol: "SOL", size: 25, absSize: 25, side: "long",
      entryPrice: 231.8, markPrice: 216.4, notionalUsd: 5_410,
      unrealizedPnl: -385, returnOnEquity: -0.199, liquidationPrice: 158.2,
      marginUsed: 1_931.7, leverage: { type: "isolated", value: 3 },
    },
  ],
  openOrders: [
    {
      oid: 84_512, market: "futures", symbol: "BTC", side: "buy",
      limitPrice: 110_000, size: 0.02, origSize: 0.02, isTrigger: false,
      triggerPrice: null, orderType: "Limit", reduceOnly: false,
      timestamp: Date.now() - 2 * 3_600_000, known: true,
    },
    {
      oid: 84_520, market: "spot", symbol: "HYPE", side: "sell",
      limitPrice: 48.5, size: 25, origSize: 25, isTrigger: false,
      triggerPrice: null, orderType: "Limit", reduceOnly: false,
      timestamp: Date.now() - 26 * 3_600_000, known: true,
    },
    {
      oid: 84_531, market: "futures", symbol: "ETH", side: "sell",
      limitPrice: 0, size: 1.2, origSize: 1.2, isTrigger: true,
      triggerPrice: 4_300, orderType: "Stop Market", reduceOnly: true,
      timestamp: Date.now() - 40 * 60_000, known: true,
    },
  ],
}

const hlMarkets: HlMarkets = {
  spot: [
    { symbol: "HYPE", coinName: "Hyperliquid", price: 44.2 },
    { symbol: "SOL", coinName: "Solana", price: 216.4 },
    { symbol: "PURR", coinName: "Purr", price: 0.184 },
    { symbol: "UBTC", coinName: "Unit Bitcoin", price: 118_200 },
  ],
  futures: [
    { symbol: "BTC", price: 118_245, maxLeverage: 40 },
    { symbol: "ETH", price: 4_486.2, maxLeverage: 25 },
    { symbol: "SOL", price: 216.4, maxLeverage: 20 },
    { symbol: "XRP", price: 3.12, maxLeverage: 20 },
    { symbol: "DOGE", price: 0.2385, maxLeverage: 10 },
    { symbol: "HYPE", price: 44.2, maxLeverage: 5 },
  ],
  minOrderUsd: 10,
}

// ── Transactions ────────────────────────────────────────────────────────────

const TRANSACTIONS: UnifiedTransaction[] = [
  { id: "dev-tx-01", type: "deposit", amount: 0.35, token: "ETH", chain: "ethereum", status: "completed", fiatAmount: 1_570.2, fiatCurrency: "USD", fromAddress: "0x91B5cF2a44E1c6d9807bC3f1a4e5D6c7B8a90112", toAddress: DEV_MOCK_ADDRESSES.ethereum, txHash: mockTxHash(), direction: "incoming", createdAt: hoursAgo(1.2), completedAt: hoursAgo(1.1) },
  { id: "dev-tx-02", type: "swap", subType: "spot", amount: 500, token: "USDT", fromToken: "USDT", toToken: "TRX", toAmount: 3_090.5, fromChain: "tron", toChain: "tron", chain: "tron", status: "pending", side: "buy", createdAt: hoursAgo(3), fiatAmount: 500, fiatCurrency: "USD" },
  { id: "dev-tx-03", type: "withdrawal", amount: 8.2, token: "SOL", chain: "solana", status: "completed", fiatAmount: 1_774.5, fiatCurrency: "USD", fromAddress: DEV_MOCK_ADDRESSES.solana, toAddress: "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT", txHash: mockTxHash(), direction: "outgoing", createdAt: hoursAgo(9), completedAt: hoursAgo(8.8) },
  { id: "dev-tx-04", type: "p2p", amount: 250, token: "USDT", chain: "tron", status: "completed", side: "buy", fiatAmount: 250, fiatCurrency: "USD", createdAt: daysAgo(1.4), completedAt: daysAgo(1.39) },
  { id: "dev-tx-05", type: "transfer", subType: "send", amount: 120, token: "TON", chain: "ton", status: "completed", fromAddress: DEV_MOCK_ADDRESSES.ton, toAddress: "UQAnotherTonWalletAddr00000000000000000000000abc", txHash: mockTxHash(), direction: "outgoing", createdAt: daysAgo(2.1), completedAt: daysAgo(2.1) },
  { id: "dev-tx-06", type: "swap", amount: 0.012, token: "BTC", fromToken: "BTC", toToken: "USDC", toAmount: 1_398.5, fromChain: "ethereum", toChain: "arbitrum", status: "completed", side: "sell", fiatAmount: 1_398.5, fiatCurrency: "USD", txHash: mockTxHash(), createdAt: daysAgo(3.2), completedAt: daysAgo(3.2) },
  { id: "dev-tx-07", type: "deposit", amount: 1_000, token: "USDC", chain: "ethereum", status: "completed", fiatAmount: 1_000, fiatCurrency: "USD", toAddress: DEV_MOCK_ADDRESSES.ethereum, txHash: mockTxHash(), direction: "incoming", createdAt: daysAgo(4.5), completedAt: daysAgo(4.5) },
  { id: "dev-tx-08", type: "withdrawal", amount: 400, token: "USDT", chain: "solana", status: "failed", toAddress: "3nQfLouXhh1EnzDgvpdRw7VWmSAsPfnhKcnVn6xYZBBM", direction: "outgoing", createdAt: daysAgo(5.8) },
  { id: "dev-tx-09", type: "transfer", subType: "receive", amount: 900, token: "TRX", chain: "tron", status: "completed", fromAddress: "TXYZanotherTronAddr55555555555555555", toAddress: DEV_MOCK_ADDRESSES.tron, txHash: mockTxHash(), direction: "incoming", createdAt: daysAgo(7), completedAt: daysAgo(7) },
  { id: "dev-tx-10", type: "p2p", amount: 1_200, token: "USDT", chain: "solana", status: "completed", side: "buy", fiatAmount: 1_200, fiatCurrency: "USD", createdAt: daysAgo(12), completedAt: daysAgo(12) },
  { id: "dev-tx-11", type: "swap", amount: 15, token: "SOL", fromToken: "SOL", toToken: "USDT", toAmount: 3_477, fromChain: "solana", toChain: "solana", status: "completed", side: "buy", fiatAmount: 3_477, fiatCurrency: "USD", txHash: mockTxHash(), createdAt: daysAgo(15), completedAt: daysAgo(15) },
  { id: "dev-tx-12", type: "deposit", amount: 620, token: "SUI", chain: "sui", status: "completed", fiatAmount: 2_120.4, fiatCurrency: "USD", toAddress: DEV_MOCK_ADDRESSES.sui, txHash: mockTxHash(), direction: "incoming", createdAt: daysAgo(19), completedAt: daysAgo(19) },
  { id: "dev-tx-13", type: "withdrawal", amount: 0.55, token: "ETH", chain: "ethereum", status: "cancelled", toAddress: "0x91B5cF2a44E1c6d9807bC3f1a4e5D6c7B8a90112", direction: "outgoing", createdAt: daysAgo(24) },
  { id: "dev-tx-14", type: "p2p", amount: 300, token: "USDT", chain: "tron", status: "completed", side: "sell", fiatAmount: 300, fiatCurrency: "USD", createdAt: daysAgo(28), completedAt: daysAgo(28) },
]

/** Filters + the stats block the tiles read (shape: types/transactions.ts). */
const transactionsPage = (search: URLSearchParams): TransactionsPage & { stats: unknown } => {
  const type = search.get("type")
  const status = search.get("status")
  const q = search.get("search")?.toLowerCase()
  const transactions = TRANSACTIONS.filter(
    (t) =>
      (!type || t.type === type) &&
      (!status || t.status === status) &&
      (!q || t.token.toLowerCase().includes(q) || t.txHash?.toLowerCase().includes(q)),
  )
  const usdtVolume = (kind: string) =>
    TRANSACTIONS.filter((t) => t.type === kind && t.status === "completed").reduce(
      (sum, t) => sum + (t.fiatAmount ?? (t.token === "USDT" ? t.amount : 0)),
      0,
    )
  const count = (kind: string) => TRANSACTIONS.filter((t) => t.type === kind).length
  return {
    success: true,
    transactions,
    pagination: { hasMore: false, total: transactions.length },
    stats: {
      totalDeposits: count("deposit"),
      totalWithdrawals: count("withdrawal"),
      totalTrades: count("p2p"),
      totalSwaps: count("swap"),
      totalTransfers: count("transfer"),
      depositVolume: usdtVolume("deposit"),
      withdrawalVolume: usdtVolume("withdrawal"),
      netVolume: TRANSACTIONS.filter((t) => t.status === "completed").reduce(
        (sum, t) => sum + (t.fiatAmount ?? 0),
        0,
      ),
    },
  }
}

// ── Buy / Sell (Dollar Account) ─────────────────────────────────────────────

const buyAvailability: BuyAvailability = {
  feePercent: 1.5,
  minUsdt: 10,
  maxUsdt: 25_000,
  chains: {
    tron: { enabled: true, available: 84_500 },
    solana: { enabled: true, available: 42_000 },
    ethereum: { enabled: true, available: 18_750 },
  },
}

const sellInfo: SellInfo = {
  feePercent: 1.5,
  minUsdt: 10,
  maxUsdt: 25_000,
  networks: { tron: { enabled: true }, solana: { enabled: true }, ethereum: { enabled: true } },
}

let buyCounter = 2
const BUYS: Buy[] = [
  { reference: "DEV-BUY-002", status: "sending_usdt", usdtAmount: 250, usdCharged: 253.75, network: "tron", walletAddress: DEV_MOCK_ADDRESSES.tron, txHash: null, deliveryError: null, createdAt: hoursAgo(0.2), completedAt: null },
  { reference: "DEV-BUY-001", status: "completed", usdtAmount: 500, usdCharged: 507.5, network: "tron", walletAddress: DEV_MOCK_ADDRESSES.tron, txHash: mockTxHash(), deliveryError: null, createdAt: daysAgo(3), completedAt: daysAgo(3) },
]

let sellCounter = 1
const SELLS: Sell[] = [
  { reference: "DEV-SELL-001", status: "completed", usdtAmount: 300, usdProceeds: 295.5, network: "solana", fromAddress: DEV_MOCK_ADDRESSES.solana, treasuryAddress: "TreasuryDevAddr111111111111111111111111111", txHash: mockTxHash(), txVerified: true, credited: true, error: null, createdAt: daysAgo(6), completedAt: daysAgo(6) },
]

// ── Trading wallet: status / fund / withdraw ────────────────────────────────

const tradingWalletStatus: TradingWalletStatus = {
  initialized: true,
  tradingWallet: { walletId: DEV_MOCK_TRADING_WALLET.walletId, address: DEV_MOCK_TRADING_WALLET.address },
  balances: {
    arbitrumUsdc: 125.42,
    hyperliquid: { perpsWithdrawableUsdc: 1_842.6, perpsAccountValueUsdc: 4_163.85, spotUsdc: 2_691.42 },
  },
  minDepositUsdc: 5,
}

const fundAvailability: FundAvailability = {
  success: true, enabled: true, available: 92_400, feePercent: 1, minUsdc: 10, maxUsdc: 10_000,
}

let fundCounter = 1
const FUNDS: Fund[] = [
  { reference: "DEV-FUND-001", status: "completed", message: null, amountUsdc: 500, usdCharged: 505, destination: "spot", partial: false, treasuryTxHash: mockTxHash(), bridgeTxHash: mockTxHash(), bridgeLastError: null, createdAt: daysAgo(9), completedAt: daysAgo(9) },
]

const tradingWithdrawInfo: TradingWithdrawInfo = {
  success: true, enabled: true, feePercent: 1, hlFeeUsdc: 1, minUsdc: 11, maxUsdc: 50_000, expectedSeconds: 300,
}

let withdrawCounter = 1
const WITHDRAWALS: TradingWithdraw[] = [
  { reference: "DEV-WD-001", status: "completed", message: null, amountUsdc: 250, hlFeeUsdc: 1, creditUsd: 246.5, source: "perps", credited: true, arrivalTxHash: mockTxHash(), expectedSeconds: 300, submittedAt: daysAgo(5), createdAt: daysAgo(5), completedAt: daysAgo(5) },
]

// ── Auto-trade agent (stateful so the toggle works) ─────────────────────────

let agentEnabled = false

const agentStatus = (): AgentStatus => ({
  agentEnabled,
  agentSignerGranted: agentEnabled,
  agentEnabledAt: agentEnabled ? hoursAgo(0) : null,
  agentConfig: {
    maxSpotOrderUsdc: 100,
    maxFuturesPositionUsdc: 250,
    maxFuturesLeverage: 3,
    spotEnabled: true,
    futuresEnabled: false,
  },
  tradingWalletReady: true,
})

// ── Custom tokens (stateful so add/remove works) ────────────────────────────

let customTokens: CustomToken[] = [
  {
    id: "dev-token-pepe",
    chain: "ethereum",
    contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    symbol: "PEPE",
    name: "Pepe",
    decimals: 18,
    image: cg("29850/small/pepe-token.jpeg"),
    createdAt: daysAgo(20),
  },
]

// ── Dollar Account ──────────────────────────────────────────────────────────

const dollarBalances = {
  ok: true,
  userId: DEV_BYPASS_USER.userId,
  balances: {
    USD: { availableMinor: 125_075, lockedMinor: 0, available: 1_250.75, locked: 0 },
    NGN: { availableMinor: 85_000_000, lockedMinor: 0, available: 850_000, locked: 0 },
  },
}

// ── Swap quote (computed from the mock price map so numbers add up) ─────────

function swapQuote(search: URLSearchParams) {
  const fromToken = search.get("fromToken") ?? "USDT"
  const toToken = search.get("toToken") ?? "ETH"
  const amount = parseFloat(search.get("amount") ?? "0") || 0
  const fromPrice = PRICE_MAP[fromToken] ?? 1
  const toPrice = PRICE_MAP[toToken] ?? 1
  const toAmountFloat = (amount * fromPrice) / toPrice
  const DECIMALS = 6
  const toUnits = Math.round(toAmountFloat * 10 ** DECIMALS)
  return {
    success: true,
    quote: {
      toAmount: String(toUnits),
      toAmountMin: String(Math.round(toUnits * 0.995)),
      toAmountUSD: (toAmountFloat * toPrice).toFixed(2),
      fromAmountUSD: (amount * fromPrice).toFixed(2),
      priceImpact: 0.12,
      gasCostUSD: "0.42",
      tool: "LI.FI (dev mock)",
      executionData: { to: DEV_MOCK_ADDRESSES.ethereum, data: "0x", value: "0", chainId: 1 },
      fromToken: { chainId: 1, address: "0x0", symbol: fromToken, decimals: DECIMALS },
      toToken: { chainId: 1, address: "0x0", symbol: toToken, decimals: DECIMALS },
    },
  }
}

// ── The proxy hook ──────────────────────────────────────────────────────────

/**
 * Serve a mock response for a proxied /api/* call, or null when the path has
 * no mock (the caller falls through to its normal — failing — behavior, so
 * the gap is visible rather than silent).
 */
/* ── Staged progress, on a clock ───────────────────────────────────────────
   The mock used to answer every initiate with `status: "completed"`, which
   made the four money flows untestable exactly where they are most delicate:
   the staged status screen only exists between "accepted" and "settled", and
   the mock skipped that interval entirely.

   Each flow now advances through its real statuses against elapsed time, so
   the checklist, the rail fills, the live counters, the reference chip, the
   monotonic guard and the poll backoff can all be watched happening.

   Add `?dev_flow=<ms>` to the initiate call, or set DEV_FLOW_SPEED, to make a
   whole run take longer than the default ~18 seconds. */
const FLOW_STARTED = new Map<string, number>()

/** Fractions of the run at which each status takes over. */
function stagedStatus<T extends string>(
  reference: string,
  steps: readonly { at: number; status: T }[],
  /* ~45s by default. The first version ran an entire deposit in 18 seconds,
     which is faster than any of these flows settles in production and meant
     no stage ever stayed live long enough to exercise the parts of the UI
     that only appear during a wait — the per-stage elapsed counter, the
     backed-off poll cadence, the "taking longer than usual" copy. */
  totalMs = 45_000,
): T {
  const started = FLOW_STARTED.get(reference)
  // Nothing recorded (a reference from the seeded history) — it's finished.
  if (started === undefined) return steps[steps.length - 1].status
  const p = (Date.now() - started) / totalMs
  let current = steps[0].status
  for (const step of steps) if (p >= step.at) current = step.status
  return current
}

function beginFlow(reference: string) {
  FLOW_STARTED.set(reference, Date.now())
}

/* Failure is the half of every money flow that never gets looked at, because
   the happy path is the one that's easy to trigger. So: any amount ending in
   .99 fails at the end of its run. It's a deliberate, memorable sentinel —
   "99 is a bad number" — that makes the failure screen one keystroke away
   instead of something you can only see in production. */
const FLOW_FAILED = new Set<string>()

function markFailIfSentinel(reference: string, amount: number) {
  if (Math.abs(Math.round(amount * 100) % 100) === 99) FLOW_FAILED.add(reference)
}

/** The terminal status for a flow the sentinel condemned. */
function failedAs<T extends string>(reference: string, status: T, failStatus: T): T {
  return FLOW_FAILED.has(reference) && status === "completed" ? failStatus : status
}

const BUY_STEPS = [
  { at: 0, status: "pending" },
  { at: 0.22, status: "payment_confirmed" },
  { at: 0.5, status: "sending_usdt" },
  { at: 1, status: "completed" },
] as const

const SELL_STEPS = [
  { at: 0, status: "pending" },
  { at: 0.25, status: "usdt_sent" },
  { at: 0.55, status: "tx_verified" },
  { at: 1, status: "completed" },
] as const

const FUND_STEPS = [
  { at: 0, status: "pending" },
  { at: 0.18, status: "usd_held" },
  { at: 0.36, status: "disbursing" },
  { at: 0.54, status: "usdc_arrived" },
  { at: 0.72, status: "bridging" },
  { at: 0.86, status: "transferring" },
  { at: 1, status: "completed" },
] as const

const TW_STEPS = [
  { at: 0, status: "pending" },
  { at: 0.4, status: "hl_withdrawing" },
  { at: 1, status: "completed" },
] as const

export async function devMockApiResponse(req: Request, path: string): Promise<Response | null> {
  const method = req.method
  const search = new URL(req.url).searchParams
  const body = async () => {
    try {
      return (await req.json()) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  // ── Market data & balances ──
  if (method === "GET" && path === "prices") return json(pricesResponse())
  if (method === "GET" && path === "wallet/balances") return json({ balances: BALANCES })
  if (method === "GET" && path === "dollar/balances") return json(dollarBalances)

  // ── Wallet lifecycle ──
  if (method === "GET" && path === "privy/get-wallet-by-clerk") return json(walletInfo)
  if (method === "POST" && path === "privy/pregenerate-wallet") return json(walletInfo)

  // ── Sends (all four transports answer with a fake hash) ──
  if (method === "POST" && path.startsWith("privy/wallet/")) {
    return json({ transactionHash: mockTxHash(), explorerUrl: "https://etherscan.io/tx/0xdev" })
  }
  if (method === "POST" && path === "wallet-transfers") return json({ success: true })

  // ── Custom tokens ──
  if (method === "GET" && path === "tokens/custom") return json({ success: true, tokens: customTokens })
  if (method === "POST" && path === "tokens/custom") {
    const b = await body()
    const token: CustomToken = {
      id: `dev-token-${customTokens.length + 1}`,
      chain: (b.chain as CustomToken["chain"]) ?? "ethereum",
      contractAddress: String(b.contractAddress ?? "0x0"),
      symbol: "MOCK",
      name: "Mock Token",
      decimals: 18,
      image: "",
      createdAt: new Date().toISOString(),
    }
    customTokens = [...customTokens, token]
    return json({ success: true, token, alreadyAdded: false })
  }
  if (method === "DELETE" && path.startsWith("tokens/custom/")) {
    const id = decodeURIComponent(path.slice("tokens/custom/".length))
    customTokens = customTokens.filter((t) => t.id !== id)
    return json({ success: true, tokens: customTokens })
  }
  if (method === "GET" && path === "tokens/metadata") {
    return json({
      success: true,
      token: {
        chain: search.get("chain") ?? "ethereum",
        contractAddress: search.get("address") ?? "0x0",
        symbol: "MOCK",
        name: "Mock Token",
        decimals: 18,
        image: "",
      },
    })
  }

  // ── Transactions ──
  if (method === "GET" && path === "transactions/unified") return json(transactionsPage(search))

  // ── Hyperliquid trading ──
  if (method === "GET" && path === "trade/markets") return json(hlMarkets)
  if (method === "GET" && path === "trade/account") return json(hlAccount)
  if (method === "POST" && (path === "trade/spot" || path === "trade/futures")) {
    const b = await body()
    const symbol = String(b.symbol ?? "BTC")
    const price = PRICE_MAP[symbol] ?? hlMarkets.futures.find((m) => m.symbol === symbol)?.price ?? 100
    const size = typeof b.size === "number" ? b.size : (Number(b.amountUsd) || 100) / price
    return json({
      success: true,
      symbol,
      side: (b.side as "buy" | "sell") ?? "buy",
      size,
      executionPrice: price,
      filledSize: size,
      avgFillPrice: price,
      filledNotionalUsd: size * price,
      resting: b.orderType === "limit",
    })
  }
  if (method === "POST" && path === "trade/close") {
    const b = await body()
    const symbol = String(b.symbol ?? "BTC")
    const pos = hlAccount.positions.find((p) => p.symbol === symbol)
    return json({
      success: true,
      symbol,
      closedSize: typeof b.size === "number" ? b.size : pos?.absSize ?? 0,
      executionPrice: pos?.markPrice ?? PRICE_MAP[symbol] ?? 0,
    })
  }
  if (method === "POST" && path === "trade/cancel") return json({ success: true })

  // ── Trading wallet: status / fund / withdraw ──
  if (method === "GET" && path === "trading-wallet/status") return json(tradingWalletStatus)
  if (method === "POST" && path === "trading-wallet/setup") {
    return json({ success: true, alreadyInitialized: true, tradingWallet: tradingWalletStatus.tradingWallet })
  }
  if (method === "GET" && path === "trading-wallet/fund/availability") return json(fundAvailability)
  if (method === "GET" && path === "trading-wallet/fund") {
    return json({ success: true, active: null, funds: FUNDS })
  }
  if (method === "POST" && path === "trading-wallet/fund") {
    const b = await body()
    const amount = Number(b.amount) || 0
    const fund: Fund = {
      reference: `DEV-FUND-${String(++fundCounter).padStart(3, "0")}`,
      status: "pending",
      message: null,
      amountUsdc: amount,
      usdCharged: amount * 1.01,
      destination: (b.destination as Fund["destination"]) ?? "spot",
      partial: false,
      treasuryTxHash: mockTxHash(),
      bridgeTxHash: mockTxHash(),
      bridgeLastError: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    FUNDS.unshift(fund)
    beginFlow(fund.reference)
    markFailIfSentinel(fund.reference, amount)
    return json({ success: true, fund })
  }
  if (method === "GET" && path.startsWith("trading-wallet/fund/")) {
    const ref = decodeURIComponent(path.slice("trading-wallet/fund/".length))
    const found = FUNDS.find((f) => f.reference === ref) ?? FUNDS[0]
    // Bridging is the slow one in production, so give it the longest run.
    const status = failedAs(found.reference, stagedStatus(found.reference, FUND_STEPS, 70_000), "failed")
    const fund = {
      ...found,
      status,
      message: status === "failed" ? "The bridge did not confirm within the window." : found.message,
      completedAt: status === "completed" ? found.completedAt : null,
    }
    return json({ success: true, fund })
  }
  if (method === "GET" && path === "trading-wallet/withdraw/info") return json(tradingWithdrawInfo)
  if (method === "GET" && path === "trading-wallet/withdraw") {
    return json({ success: true, active: null, withdrawals: WITHDRAWALS })
  }
  if (method === "POST" && path === "trading-wallet/withdraw") {
    const b = await body()
    const amount = Number(b.amount) || 0
    const withdraw: TradingWithdraw = {
      reference: `DEV-WD-${String(++withdrawCounter).padStart(3, "0")}`,
      status: "pending",
      message: null,
      amountUsdc: amount,
      hlFeeUsdc: 1,
      creditUsd: (amount - 1) * 0.99,
      source: (b.source as TradingWithdraw["source"]) ?? "spot",
      credited: true,
      arrivalTxHash: mockTxHash(),
      expectedSeconds: 300,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    WITHDRAWALS.unshift(withdraw)
    beginFlow(withdraw.reference)
    markFailIfSentinel(withdraw.reference, amount)
    return json({ success: true, withdraw })
  }
  if (method === "GET" && path.startsWith("trading-wallet/withdraw/")) {
    const ref = decodeURIComponent(path.slice("trading-wallet/withdraw/".length))
    const found = WITHDRAWALS.find((w) => w.reference === ref) ?? WITHDRAWALS[0]
    const status = failedAs(found.reference, stagedStatus(found.reference, TW_STEPS, 30_000), "failed")
    const withdraw = {
      ...found,
      status,
      message: status === "failed" ? "Hyperliquid rejected the withdrawal." : found.message,
      completedAt: status === "completed" ? found.completedAt : null,
    }
    return json({ success: true, withdraw })
  }

  // ── Auto-trade agent ──
  if (method === "GET" && path === "agent/status") return json(agentStatus())
  if (method === "POST" && path === "agent/enable") {
    agentEnabled = true
    return json({ success: true, agentEnabled: true, agentSignerGranted: true })
  }
  if (method === "POST" && path === "agent/disable") {
    agentEnabled = false
    return json({ success: true, agentEnabled: false })
  }


  // ── Buy / Sell ──
  if (method === "GET" && path === "buy/availability") return json(buyAvailability)
  if (method === "GET" && path === "buy") return json({ success: true, buys: BUYS })
  if (method === "POST" && path === "buy") {
    const b = await body()
    const usdtAmount = Number(b.usdtAmount) || 0
    const buy: Buy = {
      reference: `DEV-BUY-${String(++buyCounter).padStart(3, "0")}`,
      status: "pending",
      usdtAmount,
      usdCharged: usdtAmount * 1.015,
      network: (b.network as Buy["network"]) ?? "tron",
      walletAddress: DEV_MOCK_ADDRESSES.tron,
      txHash: mockTxHash(),
      deliveryError: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    BUYS.unshift(buy)
    beginFlow(buy.reference)
    markFailIfSentinel(buy.reference, usdtAmount)
    return json({ success: true, buy })
  }
  if (method === "GET" && path.startsWith("buy/")) {
    const ref = decodeURIComponent(path.slice("buy/".length))
    const found = BUYS.find((x) => x.reference === ref) ?? BUYS[0]
    const status = failedAs(found.reference, stagedStatus(found.reference, BUY_STEPS), "delivery_failed")
    const buy = {
      ...found,
      status,
      deliveryError:
        status === "delivery_failed"
          ? "The USDT transfer was rejected by the network after three attempts."
          : found.deliveryError,
      completedAt: status === "completed" ? found.completedAt : null,
    }
    return json({ success: true, buy })
  }
  if (method === "GET" && path === "sell/info") return json(sellInfo)
  if (method === "GET" && path === "sell") return json({ success: true, sells: SELLS })
  if (method === "POST" && path === "sell") {
    const b = await body()
    const usdtAmount = Number(b.usdtAmount) || 0
    const sell: Sell = {
      reference: `DEV-SELL-${String(++sellCounter).padStart(3, "0")}`,
      status: "pending",
      usdtAmount,
      usdProceeds: usdtAmount * 0.985,
      network: (b.network as Sell["network"]) ?? "tron",
      fromAddress: DEV_MOCK_ADDRESSES.tron,
      treasuryAddress: "TreasuryDevAddr111111111111111111111111111",
      txHash: mockTxHash(),
      txVerified: true,
      credited: true,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    SELLS.unshift(sell)
    beginFlow(sell.reference)
    markFailIfSentinel(sell.reference, usdtAmount)
    return json({ success: true, sell })
  }
  if (method === "GET" && path.startsWith("sell/")) {
    const ref = decodeURIComponent(path.slice("sell/".length))
    const found = SELLS.find((x) => x.reference === ref) ?? SELLS[0]
    const status = failedAs(found.reference, stagedStatus(found.reference, SELL_STEPS), "failed")
    const sell = {
      ...found,
      status,
      error: status === "failed" ? "The on-chain transfer could not be verified." : found.error,
      completedAt: status === "completed" ? found.completedAt : null,
    }
    return json({ success: true, sell })
  }

  // ── Swap ──
  if (method === "GET" && path === "swap") return json(swapQuote(search))
  if (method === "POST" && path === "swap") {
    return json({ success: true, txHash: mockTxHash(), status: "completed" })
  }
  if (method === "GET" && path === "swap/history") {
    return json({
      swaps: [
        { fromToken: "USDT", toToken: "ETH", fromAmount: 500, toAmount: 0.1114, status: "completed", createdAt: daysAgo(3.2) },
        { fromToken: "SOL", toToken: "USDC", fromAmount: 5, toAmount: 1_080.2, status: "completed", createdAt: daysAgo(11) },
      ],
    })
  }

  return null
}

// ── Dashboard profile (for lib/profile-actions.ts) ──────────────────────────

const mockProfile = {
  _id: "dev-profile-000000000001",
  authUserId: DEV_BYPASS_USER.userId,
  email: DEV_BYPASS_USER.email,
  displayName: `${DEV_BYPASS_USER.firstName} ${DEV_BYPASS_USER.lastName}`,
  avatarUrl: "",
  bio: "Local development profile (dev bypass).",
  preferredCurrency: "USD",
  watchlist: ["BTC", "ETH", "SOL"],
  defaultChartInterval: "1D",
  notifications: {
    priceAlerts: true,
    tradeConfirmations: true,
    marketNews: false,
    email: true,
    push: false,
  },
  theme: "system" as const,
  dashboardLayout: "vertical" as const,
  savedBankDetails: [
    { bankName: "GTBank", accountNumber: "0123456789", accountName: "Dev User", isDefault: true },
  ],
  // Pre-completed so onboarding overlays don't sit on top of every redesigned
  // screen; clear an entry here to work on an onboarding flow itself.
  onboardingCompleted: ["dashboard", "assets", "portfolio"],
  createdAt: daysAgo(45),
  updatedAt: daysAgo(0),
}

export function getDevMockProfile() {
  return { ...mockProfile }
}

export function updateDevMockProfile(updates: Record<string, unknown>) {
  Object.assign(mockProfile, updates, { updatedAt: new Date().toISOString() })
  return { ...mockProfile }
}

export function addDevMockOnboarding(key: string) {
  if (!mockProfile.onboardingCompleted.includes(key)) {
    mockProfile.onboardingCompleted.push(key)
  }
}
