/**
 * Dev-only mock of the MODERN crypto backend (worldstreet-crypto-backend) —
 * part of the dev bypasses (see lib/dev-auth-bypass.ts), and, like them,
 * this lives ONLY on dev/self-custody-preview. Never merge this branch.
 *
 * The real backend rejects the bypass's fake token, which left every modern
 * wallet surface in its error/empty state. This module answers the proxy
 * (app/api/crypto/[...path]/route.ts) in-process with realistic, STATEFUL
 * data so the whole self-custody experience is testable on localhost:
 *
 *  - wallet lifecycle: starts with NO wallet → the full setup ceremony runs
 *    (create → prepare accounts → local key gen/encrypt → commit package),
 *    and the committed package (with the browser's real generated addresses)
 *    becomes the source for accounts + balances afterwards.
 *  - transfer intents are SIGNABLE: EVM intents carry complete EIP-1559
 *    fields, Solana intents carry a real serialized VersionedTransaction
 *    with the user as fee payer, TON intents carry the v4-wallet fields the
 *    local signer expects. Submit → poll advances submitted → confirmed.
 *  - sponsorship, spot markets/intents, Hyperliquid markets/account/intents,
 *    bridge deposits, devices and recovery status are all served.
 *
 * WHERE THIS RUNS: in the browser, called directly by the crypto client's
 * injected fetcher (lib/dev-mock-fetch.ts) — no network hop — and also on the
 * server behind the proxy route, for anything that asks server-side. The
 * browser copy is the authoritative one for the demo, and it persists itself
 * to localStorage; see "Durability" below for why that isn't optional.
 *
 * GET /api/crypto/dev/reset clears the wallet, in memory and on disk.
 */

import { Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js"

import { DEV_BYPASS_USER } from "./dev-auth-bypass"

// ── Envelope helpers ────────────────────────────────────────────────────────

const json = (data: unknown, status = 200) => Response.json({ success: true, data }, { status })
const jsonRaw = (body: Record<string, unknown>, status = 200) => Response.json(body, { status })
const jsonError = (code: string, message: string, status: number, details?: Record<string, unknown>) =>
  Response.json({ success: false, error: { code, message, ...(details ? { details } : {}) }, requestId: `mock-${Date.now()}` }, { status })

const nowIso = () => new Date().toISOString()
const inMs = (ms: number) => new Date(Date.now() + ms).toISOString()
const mockTxHash = () => `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}`

// ── Networks (ids match KNOWN_TOKENS / networkMetaFor expectations) ─────────

const NETWORKS = [
  { id: "ethereum-mainnet", family: "evm", name: "Ethereum", environment: "mainnet", chainId: 1, nativeAsset: "ETH", capabilities: { balance: true, transfer: true } },
  { id: "arbitrum-one", family: "evm", name: "Arbitrum One", environment: "mainnet", chainId: 42161, nativeAsset: "ETH", capabilities: { balance: true, transfer: true } },
  { id: "solana-mainnet-beta", family: "solana", name: "Solana", environment: "mainnet", cluster: "mainnet-beta", nativeAsset: "SOL", capabilities: { balance: true, transfer: true } },
  { id: "sui-mainnet", family: "sui", name: "Sui", environment: "mainnet", nativeAsset: "SUI", capabilities: { balance: true, transfer: true } },
  { id: "ton-mainnet", family: "ton", name: "TON", environment: "mainnet", nativeAsset: "TON", capabilities: { balance: true, transfer: true } },
  { id: "tron-mainnet", family: "tron", name: "Tron", environment: "mainnet", nativeAsset: "TRX", capabilities: { balance: true, transfer: true } },
]

const USDC_ETH = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const WETH_ETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
const USDC_ARB = "0xaf88d065e77c8cc2239327c5edb3a432268e5831"
const WETH_ARB = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"
const SOL_MINT = "So11111111111111111111111111111111111111112"
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

// ── Mutable state ───────────────────────────────────────────────────────────

type PackageAccount = {
  accountId: string
  family: string
  algorithm?: string
  keyType?: string
  publicKey?: string
  canonicalAddress?: string
  addresses?: Array<{ networkId: string; address: string; isCanonical?: boolean }>
  [key: string]: unknown
}

type MockIntent = Record<string, unknown> & { id: string; status: string }

type MockState = {
  wallet: Record<string, unknown> | null
  pkg: (Record<string, unknown> & { accounts: PackageAccount[] }) | null
  prepared: Map<string, Record<string, unknown>>
  intents: Map<string, { intent: MockIntent; polls: number }>
  byIdempotency: Map<string, string>
  sponsorOps: Map<string, { op: Record<string, unknown>; reads: number }>
  hlIntents: Map<string, Record<string, unknown>>
  transactions: Array<Record<string, unknown>>
  /** family:identifier → base-units delta applied by confirmed sends */
  balanceDeltas: Map<string, bigint>
  counter: number
}

// Hung off globalThis rather than held as a module constant, so the wallet
// survives the module being evaluated more than once in one process — which
// happens across route bundles in a deployed build and on every hot reload.
const globalStore = globalThis as typeof globalThis & { __wsMockCryptoState?: MockState }

const state: MockState = (globalStore.__wsMockCryptoState ??= {
  wallet: null,
  pkg: null,
  prepared: new Map(),
  intents: new Map(),
  byIdempotency: new Map(),
  sponsorOps: new Map(),
  hlIntents: new Map(),
  transactions: [],
  balanceDeltas: new Map(),
  counter: 0,
})

/* ── Durability ────────────────────────────────────────────────────────────
   In-process state is enough for a dev server, which is one long-lived
   process. It is NOT enough anywhere the mock is answering from a serverless
   function: setup alone makes nine round trips (get wallet → create → get
   package → authorize → list networks → prepare ×5), and the instance holding
   the wallet can be recycled in the gap while the browser generates keys and
   runs a 600k-iteration derivation. The next call then answers "create the
   wallet first" and the ceremony dies half-built.

   So the browser copy of this module persists itself. Only the durable half is
   written — the transient maps (prepared accounts, in-flight intents) belong
   to a single flow and are worthless after a reload. `bigint` has no JSON
   representation, hence the string round trip. No-ops on the server, where
   `localStorage` doesn't exist. */

const PERSIST_KEY = "worldstreet:dev-mock-crypto:v1"

const canPersist = () => {
  try {
    return typeof localStorage !== "undefined"
  } catch {
    // Storage access throws outright in some embedded contexts.
    return false
  }
}

export function persistMockCryptoState() {
  if (!canPersist()) return
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      wallet: state.wallet,
      pkg: state.pkg,
      transactions: state.transactions,
      balanceDeltas: Array.from(state.balanceDeltas, ([key, value]) => [key, value.toString()]),
      counter: state.counter,
    }))
  } catch {
    // A full quota must never take the demo down with it.
  }
}

function clearPersistedMockCryptoState() {
  if (!canPersist()) return
  try {
    localStorage.removeItem(PERSIST_KEY)
  } catch {}
}

/** Back to "no wallet yet", in memory and on disk — the state the demo starts
 *  from, so the setup ceremony can be run again. */
export function resetMockCryptoState() {
  state.wallet = null; state.pkg = null; state.prepared.clear(); state.intents.clear()
  state.byIdempotency.clear(); state.sponsorOps.clear(); state.hlIntents.clear()
  state.transactions = []; state.balanceDeltas.clear()
  clearPersistedMockCryptoState()
}

function hydrateMockCryptoState() {
  // A wallet already in memory wins: this runs at import, and re-importing
  // must never roll live state back to whatever was last written.
  if (!canPersist() || state.wallet) return
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as {
      wallet?: MockState["wallet"]
      pkg?: MockState["pkg"]
      transactions?: MockState["transactions"]
      balanceDeltas?: Array<[string, string]>
      counter?: number
    }
    state.wallet = saved.wallet ?? null
    state.pkg = saved.pkg ?? null
    state.transactions = saved.transactions ?? []
    state.balanceDeltas = new Map((saved.balanceDeltas ?? []).map(([key, value]) => [key, BigInt(value)]))
    state.counter = saved.counter ?? 0
  } catch {
    // Corrupt or half-written state is not worth failing over — start fresh.
    clearPersistedMockCryptoState()
  }
}

hydrateMockCryptoState()

const nextId = (prefix: string) => `${prefix}-${++state.counter}-${Date.now().toString(36)}`

const sponsorKeypair = Keypair.generate()

function walletDetails() {
  if (!state.wallet) return null
  const accounts = (state.pkg?.accounts ?? []).map((account) => ({
    id: account.accountId,
    walletId: String(state.wallet?.id),
    chainFamily: account.family,
    keyAlgorithm: account.algorithm ?? "unknown",
    keyType: account.keyType ?? "private-key",
    state: "active",
    publicKey: account.publicKey,
    canonicalAddress: account.canonicalAddress,
    addresses: (account.addresses ?? []).map((address, index) => ({
      id: `${account.accountId}-addr-${index}`,
      networkId: address.networkId,
      address: address.address,
      isCanonical: address.isCanonical ?? true,
    })),
  }))
  return { ...state.wallet, accounts }
}

function accountFor(networkId: string): { account: PackageAccount; address: string } | null {
  const family = NETWORKS.find((n) => n.id === networkId)?.family
  if (!family || !state.pkg) return null
  const account = state.pkg.accounts.find((a) => a.family === family)
  if (!account) return null
  const address = account.addresses?.find((a) => a.networkId === networkId)?.address ?? account.canonicalAddress
  return address ? { account, address } : null
}

// ── Balances ────────────────────────────────────────────────────────────────

const SEED_BALANCES: Record<string, Array<{ kind: "native" | "token"; identifier: string; amountBaseUnits: string; decimals: number; symbol: string; name: string }>> = {
  "ethereum-mainnet": [
    { kind: "native", identifier: "ETH", amountBaseUnits: "421500000000000000", decimals: 18, symbol: "ETH", name: "Ethereum" },
    { kind: "token", identifier: USDC_ETH, amountBaseUnits: "1250500000", decimals: 6, symbol: "USDC", name: "USD Coin" },
  ],
  "arbitrum-one": [
    { kind: "native", identifier: "ETH", amountBaseUnits: "120000000000000000", decimals: 18, symbol: "ETH", name: "Ethereum" },
    { kind: "token", identifier: USDC_ARB, amountBaseUnits: "500250000", decimals: 6, symbol: "USDC", name: "USD Coin" },
  ],
  "solana-mainnet-beta": [
    { kind: "native", identifier: "SOL", amountBaseUnits: "12500000000", decimals: 9, symbol: "SOL", name: "Solana" },
    { kind: "token", identifier: USDC_MINT, amountBaseUnits: "300000000", decimals: 6, symbol: "USDC", name: "USD Coin" },
  ],
  "sui-mainnet": [
    { kind: "native", identifier: "SUI", amountBaseUnits: "1000000000000", decimals: 9, symbol: "SUI", name: "Sui" },
  ],
  "ton-mainnet": [
    { kind: "native", identifier: "TON", amountBaseUnits: "250000000000", decimals: 9, symbol: "TON", name: "Toncoin" },
  ],
  "tron-mainnet": [
    { kind: "native", identifier: "TRX", amountBaseUnits: "4000000000", decimals: 6, symbol: "TRX", name: "Tron" },
    { kind: "token", identifier: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", amountBaseUnits: "750000000", decimals: 6, symbol: "USDT", name: "Tether USD" },
  ],
}

function balanceSnapshot() {
  const results = NETWORKS.map((network) => {
    const resolved = accountFor(network.id)
    if (!resolved) return null
    const balances = (SEED_BALANCES[network.id] ?? []).map((seed) => {
      const delta = state.balanceDeltas.get(`${network.id}:${seed.identifier}`) ?? BigInt(0)
      const amount = BigInt(seed.amountBaseUnits) + delta
      return {
        asset: { kind: seed.kind, identifier: seed.identifier },
        amountBaseUnits: (amount < BigInt(0) ? BigInt(0) : amount).toString(),
        decimals: seed.decimals,
        symbol: seed.symbol,
        name: seed.name,
      }
    })
    return {
      accountId: String(resolved.account.accountId),
      networkId: network.id,
      networkName: network.name,
      family: network.family,
      address: resolved.address,
      status: "ready" as const,
      balances,
    }
  }).filter(Boolean)
  return { generatedAt: nowIso(), cachedUntil: inMs(5 * 60_000), results }
}

// ── Signable unsigned transactions per family ───────────────────────────────

function evmTransferPayload(networkId: string, from: string, to: string, asset: { kind: string; identifier: string }, amount: string) {
  const chainId = NETWORKS.find((n) => n.id === networkId)?.chainId ?? 1
  const isToken = asset.kind === "token"
  const calldata = isToken
    ? `0xa9059cbb${to.replace(/^0x/, "").toLowerCase().padStart(64, "0")}${BigInt(amount).toString(16).padStart(64, "0")}`
    : undefined
  return {
    family: "evm",
    networkId,
    from,
    to: isToken ? asset.identifier : to,
    payload: {
      chainId,
      to: isToken ? asset.identifier : to,
      value: isToken ? "0" : amount,
      ...(calldata ? { data: calldata } : {}),
      nonce: 7,
      gas: isToken ? "65000" : "21000",
      type: "eip1559",
      maxFeePerGas: "25000000000",
      maxPriorityFeePerGas: "1500000000",
    },
  }
}

const MOCK_BLOCKHASH = "GfVcyD5xEHzHedFPMrHUV8HZaTz1CjKzXYYPMKVjF8kB"

function solanaSerializedTx(fromBase58: string, options?: { sponsored?: boolean }) {
  const user = new PublicKey(fromBase58)
  const payer = options?.sponsored ? sponsorKeypair.publicKey : user
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: MOCK_BLOCKHASH,
    instructions: [SystemProgram.transfer({ fromPubkey: user, toPubkey: payer, lamports: 1000 })],
  }).compileToV0Message()
  const transaction = new VersionedTransaction(message)
  return Buffer.from(transaction.serialize()).toString("base64")
}

function unsignedTransactionFor(networkId: string, from: string, to: string, asset: { kind: string; identifier: string }, amount: string) {
  const family = NETWORKS.find((n) => n.id === networkId)?.family
  if (family === "evm") return evmTransferPayload(networkId, from, to, asset, amount)
  if (family === "solana") {
    return { family: "solana", networkId, from, to, payload: { serializedTransaction: solanaSerializedTx(from) } }
  }
  if (family === "ton") {
    return {
      family: "ton", networkId, from, to,
      payload: { walletId: 698983191, seqno: 1, timeout: Math.floor(Date.now() / 1000) + 300, recipient: to, amountNano: amount, sendMode: 3 },
    }
  }
  if (family === "sui") {
    return { family: "sui", networkId, from, to, payload: { transactionBytes: Buffer.from(crypto.getRandomValues(new Uint8Array(128))).toString("base64") } }
  }
  // tron — shape is provider-specific; enough to render review, may not sign
  return { family: "tron", networkId, from, to, payload: { transaction: { raw_data_hex: "0a02", txID: mockTxHash().slice(2) } } }
}

// ── Intent lifecycle ────────────────────────────────────────────────────────

function createTransferIntent(body: Record<string, unknown>) {
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined
  if (idempotencyKey && state.byIdempotency.has(idempotencyKey)) {
    const existingId = state.byIdempotency.get(idempotencyKey) as string
    const entry = state.intents.get(existingId)
    if (entry) return jsonRaw({ success: true, data: entry.intent, existing: true })
  }

  const networkId = String(body.networkId ?? "")
  const resolved = accountFor(networkId)
  if (!resolved) return jsonError("WALLET_NOT_FOUND", "No account for this network", 404)
  const asset = (body.asset ?? { kind: "native", identifier: "ETH" }) as { kind: string; identifier: string }
  const to = String(body.to ?? "")
  const amount = String(body.amount ?? "0")

  const intent: MockIntent = {
    id: nextId("mock-int"),
    status: "created",
    chainFamily: NETWORKS.find((n) => n.id === networkId)?.family,
    networkId,
    accountId: String(resolved.account.accountId),
    walletId: String(state.wallet?.id),
    normalizedSummary: {
      action: "transfer",
      chainFamily: NETWORKS.find((n) => n.id === networkId)?.family,
      networkId,
      from: resolved.address,
      to,
      asset,
      amount,
    },
    unsignedTransaction: unsignedTransactionFor(networkId, resolved.address, to, asset, amount),
    expiresAt: inMs(5 * 60_000),
    createdAt: nowIso(),
  }
  state.intents.set(intent.id, { intent, polls: 0 })
  if (idempotencyKey) state.byIdempotency.set(idempotencyKey, intent.id)
  return jsonRaw({ success: true, data: intent, existing: false })
}

function applyBalanceDelta(intent: MockIntent) {
  const summary = intent.normalizedSummary as { networkId?: string; asset?: { identifier?: string }; amount?: string } | undefined
  if (!summary?.networkId || !summary.asset?.identifier || !summary.amount) return
  try {
    const key = `${summary.networkId}:${summary.asset.identifier}`
    const previous = state.balanceDeltas.get(key) ?? BigInt(0)
    state.balanceDeltas.set(key, previous - BigInt(summary.amount))
  } catch { /* non-numeric amount — skip */ }
}

function submitIntent(intentId: string) {
  const entry = state.intents.get(intentId)
  if (!entry) return jsonError("WALLET_NOT_FOUND", "Unknown intent", 404)
  entry.intent.status = "submitted"
  entry.intent.txHash = mockTxHash()
  entry.intent.submittedAt = nowIso()
  entry.polls = 0
  const summary = entry.intent.normalizedSummary as Record<string, unknown> | undefined
  const record = {
    id: nextId("mock-tx"),
    status: "submitted",
    txHash: entry.intent.txHash,
    chainFamily: entry.intent.chainFamily,
    networkId: entry.intent.networkId,
    fromAddress: summary?.from,
    toAddress: summary?.to,
    assetSummary: summary?.asset,
    createdAt: nowIso(),
    submittedAt: nowIso(),
    intentId,
  }
  state.transactions.unshift(record)
  return json(record)
}

function getIntent(intentId: string) {
  const entry = state.intents.get(intentId)
  if (!entry) return jsonError("WALLET_NOT_FOUND", "Unknown intent", 404)
  if (entry.intent.status === "submitted") {
    entry.polls += 1
    if (entry.polls >= 2) {
      entry.intent.status = "confirmed"
      entry.intent.confirmedAt = nowIso()
      applyBalanceDelta(entry.intent)
      const record = state.transactions.find((t) => t.intentId === intentId)
      if (record) {
        record.status = "confirmed"
        record.confirmedAt = entry.intent.confirmedAt
      }
    }
  }
  return json(entry.intent)
}

// ── Spot & Hyperliquid ──────────────────────────────────────────────────────

// Convention (lib/crypto-backend/spot-order.ts): the token SPENT is the quote,
// the token RECEIVED is the base. sellToken/inputMint = USDC, buyToken/outputMint
// = the coin. Reversed rows chart the stablecoin and fail the pair gate.
const SPOT_MARKETS = [
  { id: "weth-usdc-ethereum", symbol: "WETH", quote: "USDC", networkId: "ethereum-mainnet", venue: "0x", chartSymbol: "ETHUSDT", chartSupported: true, price: 4486.2, icon: null, sellToken: USDC_ETH, buyToken: WETH_ETH },
  { id: "weth-usdc-arbitrum", symbol: "WETH", quote: "USDC", networkId: "arbitrum-one", venue: "0x", chartSymbol: "ETHUSDT", chartSupported: true, price: 4486.2, icon: null, sellToken: USDC_ARB, buyToken: WETH_ARB },
  { id: "sol-usdc-solana", symbol: "SOL", quote: "USDC", networkId: "solana-mainnet-beta", venue: "jupiter", chartSymbol: "SOLUSDT", chartSupported: true, price: 216.4, icon: null, inputMint: USDC_MINT, outputMint: SOL_MINT },
]

const HL_FUTURES = [
  { symbol: "BTC", price: 118245, maxLeverage: 40, szDecimals: 5, coinName: "Bitcoin" },
  { symbol: "ETH", price: 4486.2, maxLeverage: 25, szDecimals: 4, coinName: "Ethereum" },
  { symbol: "SOL", price: 216.4, maxLeverage: 20, szDecimals: 2, coinName: "Solana" },
  { symbol: "HYPE", price: 44.2, maxLeverage: 10, szDecimals: 2, coinName: "Hyperliquid" },
]

function hyperliquidAccount() {
  const evm = state.pkg?.accounts.find((a) => a.family === "evm")
  return {
    ready: true,
    address: evm?.canonicalAddress ?? "0x0000000000000000000000000000000000000000",
    balances: { perpsWithdrawableUsdc: 1842.6, perpsAccountValueUsdc: 4163.85, spotUsdc: 2691.42, spotUsdcHold: 0, spotTokens: [] },
    positions: [
      {
        symbol: "ETH", side: "long", absSize: 0.5, entryPrice: 4300, markPrice: 4486.2,
        notionalUsd: 2243.1, unrealizedPnl: 93.1, returnOnEquity: 0.2165,
        liquidationPrice: 3390.5, marginUsed: 430.2, leverage: { type: "cross", value: 5 },
      },
    ],
    openOrders: [],
  }
}

function createHyperliquidIntent(body: Record<string, unknown>) {
  const evm = state.pkg?.accounts.find((a) => a.family === "evm")
  const intentType = String(body.intentType ?? "order")
  const price = HL_FUTURES.find((m) => m.symbol === (body as { symbol?: string }).symbol)?.price
  const intent = {
    id: nextId("mock-hl"),
    walletId: String(state.wallet?.id),
    accountId: String(evm?.accountId ?? ""),
    address: evm?.canonicalAddress ?? "",
    intentType,
    request: body,
    steps: [{ kind: intentType, action: { type: intentType, ...body }, signingMode: "l1", nonce: Date.now() }],
    status: "created",
    expiresAt: inMs(2 * 60_000),
    summary: {
      estimatedFeeUsd: 1.12,
      ...(price ? { liquidationPrice: Number((price * 0.82).toFixed(2)) } : {}),
    },
  }
  state.hlIntents.set(intent.id, intent)
  return json(intent)
}

// ── Sponsorship ─────────────────────────────────────────────────────────────

function sponsorshipQuote(body: Record<string, unknown>) {
  const networkId = String(body.networkId ?? "ethereum-mainnet")
  const family = NETWORKS.find((n) => n.id === networkId)?.family ?? "evm"
  const resolved = accountFor(networkId)
  const op = {
    id: nextId("mock-sponsor"),
    walletId: String(state.wallet?.id),
    accountId: String(resolved?.account.accountId ?? ""),
    networkId,
    chainFamily: family,
    operation: String(body.operation ?? "native-transfer"),
    status: "quoted",
    estimatedCostUsd: 0.02,
    quote: { sponsor: { address: family === "solana" ? sponsorKeypair.publicKey.toBase58() : "0x00000000000000000000000000000000000000fe", estimatedCostUsd: "0.02" } },
    expiresAt: inMs(5 * 60_000),
  }
  state.sponsorOps.set(op.id, { op, reads: 0 })
  return json(op)
}

function sponsorshipPrepare(operationId: string) {
  const entry = state.sponsorOps.get(operationId)
  if (!entry) return jsonError("SPONSORSHIP_UNAVAILABLE", "Unknown sponsorship operation", 404)
  const op = entry.op as Record<string, unknown> & { chainFamily: string; networkId: string }
  const resolved = accountFor(op.networkId)
  if (op.chainFamily === "solana" && resolved) {
    op.signingPayload = {
      kind: "solana-transaction",
      serializedTransaction: solanaSerializedTx(resolved.address, { sponsored: true }),
      userAddress: resolved.address,
      sponsorAddress: sponsorKeypair.publicKey.toBase58(),
    }
  } else if (resolved) {
    op.signingPayload = {
      kind: "evm-prepared-calls",
      signerAddress: resolved.address,
      preparedCalls: {
        type: "user-operation-v070",
        data: { userOperation: { sender: resolved.address } },
        chainId: `0x${(NETWORKS.find((n) => n.id === op.networkId)?.chainId ?? 1).toString(16)}`,
        signatureRequest: {
          type: "personal_sign",
          data: { raw: mockTxHash() },
        },
      },
    }
  }
  op.status = "prepared"
  return json(op)
}

function sponsorshipSubmit(operationId: string) {
  const entry = state.sponsorOps.get(operationId)
  if (!entry) return jsonError("SPONSORSHIP_UNAVAILABLE", "Unknown sponsorship operation", 404)
  entry.op.status = "submitted"
  entry.op.txHash = mockTxHash()
  entry.reads = 0
  return json({ operation: entry.op, txHash: entry.op.txHash, providerStatus: "submitted" })
}

function sponsorshipStatus(operationId: string) {
  const entry = state.sponsorOps.get(operationId)
  if (!entry) return jsonError("SPONSORSHIP_UNAVAILABLE", "Unknown sponsorship operation", 404)
  if (entry.op.status === "submitted") {
    entry.reads += 1
    if (entry.reads >= 2) {
      entry.op.status = "confirmed"
      entry.op.providerStatus = "confirmed"
    }
  }
  return json(entry.op)
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function devMockCryptoApiResponse(req: Request, path: string): Promise<Response | null> {
  const method = req.method.toUpperCase()
  const readBody = async (): Promise<Record<string, unknown>> => {
    try { return (await req.json()) as Record<string, unknown> } catch { return {} }
  }

  // Health probes use the raw (non-enveloped) shape.
  if (method === "GET" && (path === "health" || path === "ready")) {
    return jsonRaw({ success: true, service: "worldstreet-crypto-backend (dev mock)", status: "ok" })
  }

  if (method === "GET" && path === "dev/reset") {
    resetMockCryptoState()
    return jsonRaw({ success: true, data: { reset: true } })
  }

  if (path === "auth/me") return json({ userId: DEV_BYPASS_USER.userId, walletId: state.wallet?.id ?? null })

  // Wallet lifecycle
  if (method === "GET" && path === "wallets/me") {
    const details = walletDetails()
    if (!details) return jsonError("WALLET_NOT_FOUND", "No wallet exists for this user yet", 404)
    return json(details)
  }
  if (method === "POST" && path === "wallets") {
    state.wallet ??= {
      id: nextId("mock-wallet"), userId: DEV_BYPASS_USER.userId, status: "active", version: 0,
      securityVersion: 1, provisioningMode: "self-custodial", createdAt: nowIso(), updatedAt: nowIso(),
    }
    return json(state.wallet)
  }
  if (method === "POST" && path === "wallets/me/authorize") {
    return json({ walletAuthorizationToken: `mock-authz-${Date.now()}`, expiresIn: 300, authorizationMethod: "clerk-session" })
  }
  if (method === "POST" && path === "wallets/me/authorize/recovery/start") {
    const envelope = (state.pkg?.envelopes as Array<Record<string, unknown>> | undefined)?.find((e) => e.purpose === "recovery")
    return json({ authorizationId: nextId("mock-recovery-authz"), challenge: mockTxHash(), recoveryPublicKey: envelope?.recoveryPublicKey ?? "" })
  }
  if (method === "POST" && path === "wallets/me/authorize/recovery") {
    return json({ walletAuthorizationToken: `mock-authz-${Date.now()}`, expiresIn: 300, authorizationMethod: "recovery-secret" })
  }
  if (method === "POST" && path === "wallets/me/accounts/prepare") {
    if (!state.wallet) return jsonError("WALLET_NOT_FOUND", "Create the wallet first", 404)
    const body = await readBody()
    const account = {
      id: nextId("mock-account"), walletId: String(state.wallet.id), chainFamily: String(body.chainFamily ?? "evm"),
      keyAlgorithm: String(body.keyAlgorithm ?? "secp256k1"), keyType: String(body.keyType ?? "private-key"), state: "prepared",
    }
    state.prepared.set(account.id, account)
    return json(account)
  }
  if (method === "GET" && path === "wallets/me/package") {
    if (!state.pkg) return jsonError("WALLET_NOT_FOUND", "No wallet package has been committed yet", 404)
    return json(state.pkg)
  }
  if (method === "POST" && (path === "wallets/me/package" || path === "wallets/me/rotate")) {
    if (!state.wallet) return jsonError("WALLET_NOT_FOUND", "Create the wallet first", 404)
    const body = await readBody()
    const version = Number(body.version ?? 1)
    state.pkg = {
      ...body,
      id: nextId("mock-pkg"),
      walletId: String(state.wallet.id),
      version,
      baseVersion: Number(body.baseVersion ?? version - 1),
      securityVersion: Number(body.securityVersion ?? 1),
      format: String(body.format ?? "worldstreet-wallet-package"),
      status: "active",
      accounts: (body.accounts ?? []) as PackageAccount[],
      envelopes: body.envelopes ?? [],
    }
    state.wallet = { ...state.wallet, version, updatedAt: nowIso() }
    return json(state.pkg)
  }

  // Networks & balances
  if (method === "GET" && path === "networks") return json(NETWORKS)
  if (method === "GET" && path.startsWith("wallets/me/balances")) {
    if (!state.pkg) return jsonError("WALLET_NOT_FOUND", "No wallet exists for this user yet", 404)
    return json(balanceSnapshot())
  }

  // Transactions & intents
  if (method === "GET" && path === "transactions") return json(state.transactions)
  if (method === "POST" && path === "transactions/intents") return createTransferIntent(await readBody())
  {
    const match = path.match(/^transactions\/intents\/([^/]+)(?:\/(simulate|submit))?$/)
    if (match) {
      const [, intentId, action] = match
      if (!action && method === "GET") return getIntent(decodeURIComponent(intentId))
      if (action === "simulate" && method === "POST") {
        const entry = state.intents.get(decodeURIComponent(intentId))
        if (!entry) return jsonError("WALLET_NOT_FOUND", "Unknown intent", 404)
        entry.intent.status = "simulated"
        return json({ validation: { ok: true, errors: [], warnings: [] }, simulation: { ok: true, gasEstimate: "21000" } })
      }
      if (action === "submit" && method === "POST") return submitIntent(decodeURIComponent(intentId))
    }
  }
  {
    const match = path.match(/^transactions\/([^/]+)$/)
    if (match && method === "GET" && !path.startsWith("transactions/intents")) {
      const record = state.transactions.find((t) => t.id === decodeURIComponent(match[1]))
      return record ? json(record) : jsonError("WALLET_NOT_FOUND", "Unknown transaction", 404)
    }
  }

  // Sponsorship
  if (method === "GET" && path === "sponsorship/config") {
    return json({
      enabled: true, provider: "alchemy (dev mock)",
      allowedNetworks: ["ethereum-mainnet", "arbitrum-one", "solana-mainnet-beta"],
      allowedOperations: ["native-transfer", "token-transfer"],
      maxGasUsd: 5, dailyUserLimitUsd: 25, supportedFamilies: ["evm", "solana"],
    })
  }
  if (method === "POST" && path === "sponsorship/quote") return sponsorshipQuote(await readBody())
  {
    const match = path.match(/^sponsorship\/operations\/([^/]+)(?:\/(prepare|submit))?$/)
    if (match) {
      const [, operationId, action] = match
      if (action === "prepare" && method === "POST") return sponsorshipPrepare(decodeURIComponent(operationId))
      if (action === "submit" && method === "POST") return sponsorshipSubmit(decodeURIComponent(operationId))
      if (!action && method === "GET") return sponsorshipStatus(decodeURIComponent(operationId))
    }
  }

  // Trading
  if (method === "GET" && path === "trading/spot/markets") return json({ markets: SPOT_MARKETS })
  if (method === "POST" && (path === "trading/spot/evm/intents" || path === "trading/spot/solana/intents")) {
    const body = await readBody()
    const networkId = String(body.networkId ?? (path.includes("solana") ? "solana-mainnet-beta" : "ethereum-mainnet"))
    const resolved = accountFor(networkId)
    if (!resolved) return jsonError("WALLET_NOT_FOUND", "No account for this network", 404)
    const family = NETWORKS.find((n) => n.id === networkId)?.family
    const intent: MockIntent = {
      id: nextId("mock-spot"),
      status: "created",
      chainFamily: family,
      networkId,
      accountId: String(resolved.account.accountId),
      walletId: String(state.wallet?.id),
      normalizedSummary: { action: "swap", chainFamily: family, networkId, from: resolved.address, ...body },
      unsignedTransaction: family === "solana"
        ? { family: "solana", networkId, from: resolved.address, to: resolved.address, payload: { serializedTransaction: solanaSerializedTx(resolved.address) } }
        : {
            family: "evm", networkId, from: resolved.address, to: "0x00000000000000000000000000000000000000ef",
            payload: {
              chainId: NETWORKS.find((n) => n.id === networkId)?.chainId ?? 1,
              to: "0x00000000000000000000000000000000000000ef",
              value: "0", data: `0x12aa3caf${"00".repeat(96)}`, nonce: 8, gas: "220000",
              type: "eip1559", maxFeePerGas: "25000000000", maxPriorityFeePerGas: "1500000000",
            },
          },
      expiresAt: inMs(5 * 60_000),
      createdAt: nowIso(),
    }
    state.intents.set(intent.id, { intent, polls: 0 })
    return json(intent)
  }
  if (method === "GET" && path === "trading/hyperliquid/markets") {
    return json({ venue: "Hyperliquid", environment: "mainnet", futures: HL_FUTURES, spot: [], spotVenue: "worldstreet-spot-router", minOrderUsd: 10 })
  }
  if (method === "GET" && path === "trading/hyperliquid/account") {
    if (!state.pkg) return jsonError("WALLET_NOT_FOUND", "No wallet exists for this user yet", 404)
    return json(hyperliquidAccount())
  }
  if (method === "POST" && path === "trading/hyperliquid/intents") return createHyperliquidIntent(await readBody())
  {
    const match = path.match(/^trading\/hyperliquid\/intents\/([^/]+)\/submit$/)
    if (match && method === "POST") {
      const intent = state.hlIntents.get(decodeURIComponent(match[1]))
      if (!intent) return jsonError("WALLET_NOT_FOUND", "Unknown intent", 404)
      intent.status = "submitted"
      return json({ intentId: intent.id, status: "submitted", results: [{ status: "ok" }] })
    }
  }
  if (method === "POST" && path === "trading/hyperliquid/deposit/intents") {
    const body = await readBody()
    const resolved = accountFor("arbitrum-one")
    if (!resolved) return jsonError("WALLET_NOT_FOUND", "No account for this network", 404)
    const amount = Number(body.amount ?? 0)
    const baseUnits = BigInt(Math.round(amount * 1_000_000)).toString()
    const response = createTransferIntent({
      accountId: resolved.account.accountId,
      networkId: "arbitrum-one",
      asset: { kind: "token", identifier: USDC_ARB },
      to: "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7",
      amount: baseUnits,
      idempotencyKey: typeof body.idempotencyKey === "string" ? `${body.idempotencyKey}:bridge` : undefined,
    })
    const payload = (await response.json()) as { data: MockIntent }
    return json({ networkId: "arbitrum-one", amount, intents: [payload.data] })
  }

  // Devices & recovery
  if (method === "GET" && path === "devices") {
    return json([{ id: "mock-device-1", label: "This device — Chrome on Windows", platform: "Windows", status: "active", lastSeenAt: nowIso(), createdAt: nowIso() }])
  }
  if (method === "POST" && path.match(/^devices\/[^/]+\/revoke$/)) {
    return json({ deviceId: path.split("/")[1], status: "revoked" })
  }
  if (method === "GET" && path === "recovery/status") return json({ configured: true, configuredAt: nowIso() })
  if (method === "POST" && path === "recovery/start") {
    return json({ recoveryId: nextId("mock-recovery"), challenge: mockTxHash(), walletVersion: Number(state.wallet?.version ?? 1), securityVersion: Number(state.wallet?.securityVersion ?? 1) })
  }
  if (method === "POST" && path === "recovery/complete") {
    return json({ packageVersion: Number(state.pkg?.version ?? 1), status: "completed" })
  }

  // Unmocked paths fall through to real forwarding and fail loudly.
  return null
}
