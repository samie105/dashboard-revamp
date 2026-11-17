/**
 * What we can honestly say about a token from its address.
 *
 * A ledger record names tokens by address (a Solana mint, an EVM contract).
 * Mainstream tokens resolve through the spot registry, but anything the user
 * bought that WorldStreet doesn't list (a new memecoin, say) came back
 * unnamed, unsized and, in a swap, mislabelled as a sale. This module turns
 * an address into what the app's own data knows about it, in order:
 *
 *   1. the chain's native coin, by its sentinel or its wrapped address;
 *   2. the spot registry, as a market's base token (symbol, decimals, icon,
 *      price) or as a market's quote (every quote is a stablecoin);
 *   3. the user's wallet balances, which the backend fills with each held
 *      token's symbol, name, decimals and logo (CryptoBalance,
 *      lib/crypto-backend/types.ts; looked up for Solana through Jupiter's
 *      token API in the backend's SolanaAdapter).
 *
 * Nothing is guessed. A token none of these know keeps `symbol: null` and
 * `decimals: undefined`, and callers show its address and no amount rather
 * than a made-up name or a number scaled by an assumed precision.
 */

import { addressKey, type SpotRegistry } from "@/hooks/useSpotRegistry"
import { nativeTokenFor, wrappedNativeFor } from "@/lib/native-token"
import type { CryptoBalance } from "@/lib/crypto-backend"

export type TokenRole = "stable" | "native" | "token"

export type ResolvedToken = {
  networkId: string
  address: string | null
  /** null when no source can name it. */
  symbol: string | null
  name: string | null
  decimals: number | undefined
  icon: string | null
  role: TokenRole
  /** Traded on WorldStreet's spot markets. */
  listed: boolean
  /** The spot market's price in USD, when listed and priced. */
  price: number | null
}

export type WalletTokenMeta = { symbol: string | null; name: string | null; decimals: number; logo: string | null }
/** `networkId:loweraddress` → what the wallet's balance feed says about a held token. */
export type WalletTokens = Map<string, WalletTokenMeta>

/** Stablecoins by symbol: a dollar each, and the "money" side of a trade. */
export const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDC.E", "USDT0", "PYUSD"])

/** An address-shaped string: base58 (32–44) or 0x-hex. Never a symbol. */
export function looksLikeAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40,64}$/.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
}

/** The backend's placeholder for a token it couldn't name ("Token 7GCihg…"). */
function isPlaceholderSymbol(value: string): boolean {
  return /^Token\s+\S+…$/.test(value)
}

/** A symbol worth showing, or null for an address or a placeholder. */
export function cleanSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null
  const s = value.trim()
  if (!s || looksLikeAddress(s) || isPlaceholderSymbol(s)) return null
  return s
}

export function shortAddress(address: string | null): string {
  if (!address) return "Unknown token"
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address
}

/** What to call it on screen: its symbol, or its shortened address. */
export function tokenLabel(t: Pick<ResolvedToken, "symbol" | "address">): string {
  return t.symbol ?? shortAddress(t.address)
}

/** Wallet balances → lookup map. Native balances are skipped (they have no address). */
export function walletTokensFrom(balances: (CryptoBalance & { networkId?: string })[]): WalletTokens {
  const map: WalletTokens = new Map()
  for (const b of balances) {
    const id = b.asset?.identifier
    if (!b.networkId || !id || b.asset.kind === "native") continue
    map.set(addressKey(b.networkId, id), {
      symbol: cleanSymbol(b.symbol),
      name: typeof b.name === "string" && b.name && !isPlaceholderSymbol(b.name) ? b.name : null,
      decimals: b.decimals,
      logo: b.logo ?? null,
    })
  }
  return map
}

type QuoteInfo = { symbol: string; decimals: number | undefined }
const quoteIndexCache = new WeakMap<SpotRegistry, Map<string, QuoteInfo>>()

/** Every market's quote token, by address. Built once per registry. */
function quoteIndex(registry: SpotRegistry): Map<string, QuoteInfo> {
  let index = quoteIndexCache.get(registry)
  if (!index) {
    index = new Map()
    for (const row of registry.byAddress.values()) {
      if (row.quoteAddress && !index.has(addressKey(row.networkId, row.quoteAddress))) {
        index.set(addressKey(row.networkId, row.quoteAddress), { symbol: row.quote, decimals: row.quoteDecimals })
      }
    }
    quoteIndexCache.set(registry, index)
  }
  return index
}

const roleOf = (symbol: string | null, fallback: TokenRole): TokenRole => (symbol && STABLE_SYMBOLS.has(symbol.toUpperCase()) ? "stable" : fallback)

export function resolveToken(networkId: string, address: string | null, registry: SpotRegistry, wallet?: WalletTokens): ResolvedToken {
  const base: ResolvedToken = { networkId, address, symbol: null, name: null, decimals: undefined, icon: null, role: "token", listed: false, price: null }
  if (!address) return base

  const native = nativeTokenFor(networkId, address) ?? wrappedNativeFor(networkId, address)
  if (native) {
    const market = registry.byAddress.get(addressKey(networkId, native.wrapped))
    return {
      ...base,
      symbol: native.symbol,
      // A sentinel is in native units; the wrapped token keeps the same precision.
      decimals: native.decimals,
      icon: market?.icon ?? null,
      role: "native",
      listed: Boolean(market),
      price: market && market.price > 0 ? market.price : null,
    }
  }

  const market = registry.byAddress.get(addressKey(networkId, address))
  const held = wallet?.get(addressKey(networkId, address))
  if (market) {
    return {
      ...base,
      symbol: market.symbol,
      name: held?.name ?? null,
      decimals: market.baseDecimals ?? held?.decimals,
      icon: market.icon ?? held?.logo ?? null,
      role: roleOf(market.symbol, "token"),
      listed: true,
      price: market.price > 0 ? market.price : null,
    }
  }

  const quote = quoteIndex(registry).get(addressKey(networkId, address))
  if (quote) {
    return { ...base, symbol: quote.symbol, name: held?.name ?? null, decimals: quote.decimals ?? held?.decimals, icon: held?.logo ?? null, role: "stable", listed: true, price: 1 }
  }

  if (held) {
    return { ...base, symbol: held.symbol, name: held.name, decimals: held.decimals, icon: held.logo, role: roleOf(held.symbol, "token") }
  }
  return base
}

/** How "money-like" a token is, for telling a buy from a sale. */
export const MONEY_RANK: Record<TokenRole, number> = { stable: 2, native: 1, token: 0 }
