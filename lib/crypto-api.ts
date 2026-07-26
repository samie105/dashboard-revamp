/**
 * Typed client for the worldstreet-crypto service.
 *
 * Types mirror the mobile app's src/features/crypto/api/index.ts 1:1 so both
 * clients share one contract — when the service changes, both move together.
 *
 * Paths stay same-origin `/api/*`. They resolve to whichever side owns the
 * endpoint today: a local Next.js route if one still exists, otherwise the
 * catch-all proxy in app/api/[...path]/route.ts. Callers don't need to know
 * which, and a cutover doesn't touch this file.
 */

// ── Errors ──────────────────────────────────────────────────────────────────

/** Carries the HTTP status so callers can branch (404 = no wallet, 409 = etc). */
export class CryptoApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "CryptoApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    })
  } catch {
    throw new CryptoApiError(0, "Couldn't reach the server. Check your connection and try again.")
  }

  if (res.status === 204) return null as T

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    // The service answers with { error } on most routes and { message } on the
    // ones lifted from the dashboard — accept either.
    throw new CryptoApiError(res.status, data?.error ?? data?.message ?? "Something went wrong")
  }
  return data as T
}

const get = <T,>(path: string) => request<T>(path)
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

// ── Market data ─────────────────────────────────────────────────────────────

export type Coin = {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  image: string
}

export type PricesResponse = {
  /** Symbol → USD price (includes USDT/USDC pegged at 1). */
  prices: Record<string, number>
  coins: Coin[]
  fetchedAt: number
  error?: string
}

// ── Wallets & balances ──────────────────────────────────────────────────────

export type Chain = "ethereum" | "solana" | "sui" | "ton" | "tron"

export type ChainWallet = { walletId: string; address: string; publicKey?: string | null }

export type WalletInfo = {
  privyUserId: string
  email: string
  wallets: Partial<Record<Chain, ChainWallet>>
  /** Which Privy app the user's wallets live in (0 = old, 1 = second, 2 = third). */
  privy_type: 0 | 1 | 2
}

export type TokenBalance = {
  symbol: string
  name: string
  chain: string
  balance: number
  contractAddress?: string
  isNative: boolean
}

// ── Custom tokens ───────────────────────────────────────────────────────────

export type CustomTokenChain = "ethereum" | "solana" | "tron"

export type TokenMetadata = {
  chain: CustomTokenChain
  contractAddress: string
  symbol: string
  name: string
  decimals: number
  image: string
}

/** A saved token. Note `id`, not `_id` — the service serializes it. */
export type CustomToken = TokenMetadata & { id: string; createdAt: string }

// ── Buy / sell (Dollar Account) ─────────────────────────────────────────────

export type BuyNetwork = "solana" | "ethereum" | "tron"
export type SellNetwork = "solana" | "ethereum" | "tron"

export type BuyAvailability = {
  feePercent: number
  minUsdt: number
  maxUsdt: number
  chains: Partial<Record<BuyNetwork, { enabled: boolean; available: number; reason?: string }>>
}

export type Buy = {
  reference: string
  status:
    | "pending"
    | "payment_confirmed"
    | "sending_usdt"
    | "completed"
    | "delivery_failed"
    | "cancelled"
  usdtAmount: number
  usdCharged: number
  network: BuyNetwork
  walletAddress: string
  txHash: string | null
  deliveryError: string | null
  createdAt: string
  completedAt: string | null
}

export type SellInfo = {
  feePercent: number
  minUsdt: number
  maxUsdt: number
  networks: Partial<Record<SellNetwork, { enabled: boolean }>>
}

export type Sell = {
  reference: string
  status: "pending" | "usdt_sent" | "tx_verified" | "completed" | "failed"
  usdtAmount: number
  usdProceeds: number
  network: SellNetwork
  fromAddress: string
  treasuryAddress: string
  txHash: string | null
  txVerified: boolean
  credited: boolean
  error: string | null
  createdAt: string
  completedAt: string | null
}

// ── Transactions ────────────────────────────────────────────────────────────

export type UnifiedTransaction = {
  id: string
  type: "p2p" | "deposit" | "withdrawal" | "swap" | "transfer" | string
  subType?: string
  amount: number
  token: string
  chain?: string
  status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "expired"
  fiatAmount?: number
  fiatCurrency?: string
  fromAddress?: string
  toAddress?: string
  txHash?: string
  side?: string
  direction?: string
  createdAt: string
  completedAt?: string
}

export type TransactionsPage = {
  success: boolean
  transactions: UnifiedTransaction[]
  pagination: { hasMore: boolean; nextCursor?: string; total: number }
}

// ── Sends ───────────────────────────────────────────────────────────────────

/** Chains the generic native send accepts. Note: no arbitrum. */
export type SendChain = "ethereum" | "solana" | "sui" | "ton" | "tron"

/** Chains ERC-20 transfers can run on — both use the ethereum Privy wallet. */
export type EvmTokenChain = "ethereum" | "arbitrum"

/**
 * Each chain names its hash differently (transactionHash / signature / txid /
 * hash / digest). Callers want one field, so normalise here rather than making
 * every call site guess.
 */
export type SendResult = { txHash: string; explorerUrl?: string }

type RawSend = {
  transactionHash?: string
  signature?: string
  txid?: string
  hash?: string
  digest?: string
  explorerUrl?: string
}

function normalizeSend(raw: RawSend): SendResult {
  const txHash = raw.transactionHash ?? raw.signature ?? raw.txid ?? raw.hash ?? raw.digest ?? ""
  return { txHash, explorerUrl: raw.explorerUrl }
}

/** Native coin (ETH, SOL, SUI, TON, TRX). */
export async function sendNative(input: {
  chain: SendChain
  to: string
  amount: string
}): Promise<SendResult> {
  return normalizeSend(await post<RawSend>("/api/privy/wallet/send", input))
}

/** SPL token on Solana. */
export async function sendSplToken(input: {
  to: string
  amount: number
  mint: string
}): Promise<SendResult> {
  return normalizeSend(await post<RawSend>("/api/privy/wallet/solana/send-token", input))
}

/** ERC-20 on Ethereum mainnet or Arbitrum. Decimals are read on chain. */
export async function sendErc20Token(input: {
  to: string
  amount: number
  tokenAddress: string
  chain?: EvmTokenChain
}): Promise<SendResult> {
  return normalizeSend(await post<RawSend>("/api/privy/wallet/ethereum/send-token", input))
}

/** TRC-20 on Tron. */
export async function sendTrc20Token(input: {
  to: string
  amount: number
  contractAddress: string
}): Promise<SendResult> {
  return normalizeSend(await post<RawSend>("/api/privy/wallet/tron/send-token", input))
}

/**
 * Send an asset, picking the right transport from its shape.
 *
 * This exists because getting it wrong is expensive: an asset with a contract
 * address routed to a NATIVE send silently moves the native coin instead of
 * the token — the amount is taken at face value, so "send 100 USDT" becomes
 * "send 100 TRX". Centralising the branch keeps that decision in one place
 * rather than at every call site.
 */
export async function sendAsset(input: {
  chain: string
  to: string
  amount: number
  /** Present for tokens, absent for native coins. */
  contractAddress?: string
}): Promise<SendResult> {
  const { chain, to, amount, contractAddress } = input

  if (contractAddress) {
    if (chain === "solana") return sendSplToken({ to, amount, mint: contractAddress })
    if (chain === "tron") return sendTrc20Token({ to, amount, contractAddress })
    if (chain === "ethereum" || chain === "arbitrum") {
      return sendErc20Token({ to, amount, tokenAddress: contractAddress, chain })
    }
    throw new CryptoApiError(400, `Sending tokens on ${chain} isn't supported yet.`)
  }

  // Native. The generic send has no arbitrum — mapping it to ethereum would
  // broadcast on mainnet instead, so refuse rather than send on the wrong chain.
  if (chain === "arbitrum") {
    throw new CryptoApiError(400, "Sending native ETH on Arbitrum isn't supported yet.")
  }
  return sendNative({ chain: chain as SendChain, to, amount: amount.toString() })
}

// ── Wallet transfer history ─────────────────────────────────────────────────

export type WalletTransferInput = {
  type: "send" | "receive"
  direction: "outgoing" | "incoming"
  chain: string
  token: string
  amount: number
  fromAddress?: string
  toAddress?: string
  txHash: string
  status?: string
  memo?: string
}

/** Record a transfer in history. Idempotent on txHash. */
export function recordWalletTransfer(input: WalletTransferInput): Promise<unknown> {
  return post("/api/wallet-transfers", input)
}

// ── Endpoints ───────────────────────────────────────────────────────────────
//
// Only the endpoints already live behind the proxy are exported as callable
// functions. The rest arrive as their phases land — the types above are ahead
// of the functions on purpose, so screens can be written against the final
// contract before the routes move.

/** On-chain metadata for a token the user pasted a contract address for. */
export async function fetchTokenMetadata(input: {
  address: string
  chain: CustomTokenChain
}): Promise<TokenMetadata> {
  const q = new URLSearchParams({ address: input.address, chain: input.chain })
  const res = await get<{ success: boolean; token: TokenMetadata }>(`/api/tokens/metadata?${q}`)
  return res.token
}

/** The caller's registered custom tokens. */
export async function fetchCustomTokens(): Promise<CustomToken[]> {
  const res = await get<{ success: boolean; tokens: CustomToken[] }>("/api/tokens/custom")
  return res.tokens
}

/**
 * Register a custom token so it shows up in the caller's balances.
 *
 * Only chain + contractAddress are sent: the service re-reads symbol, name and
 * decimals from the chain and ignores anything else in the body, so a tampered
 * decimals value can't be pinned onto later balances and transfers. Adding the
 * same token twice is a no-op, not an error.
 */
export async function addCustomToken(input: {
  chain: CustomTokenChain
  contractAddress: string
}): Promise<{ token: CustomToken; alreadyAdded: boolean }> {
  const res = await post<{ success: boolean; token: CustomToken; alreadyAdded?: boolean }>(
    "/api/tokens/custom",
    input,
  )
  return { token: res.token, alreadyAdded: Boolean(res.alreadyAdded) }
}

/** Remove a registered custom token. Returns the caller's remaining tokens. */
export async function removeCustomToken(id: string): Promise<CustomToken[]> {
  const res = await request<{ success: boolean; tokens: CustomToken[] }>(
    `/api/tokens/custom/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  )
  return res.tokens
}
