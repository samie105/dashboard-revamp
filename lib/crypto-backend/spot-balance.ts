import type { CryptoBalance } from "./types"
import type { HlSpotMarket } from "@/lib/crypto-api"
import { nativeTokenFor } from "@/lib/native-token"

const WRAPPED_NATIVE: Record<string, string> = {
  "solana-mainnet-beta": "So11111111111111111111111111111111111111112",
}

function nativeAliasFor(networkId: string, identifier: string | null) {
  if (!identifier) return null
  return nativeTokenFor(networkId, identifier) ??
    (WRAPPED_NATIVE[networkId]?.toLowerCase() === identifier.toLowerCase()
      ? nativeTokenFor(networkId, "11111111111111111111111111111111")
      : null)
}

export function spotAssetAddress(market: HlSpotMarket, side: "buy" | "sell"): string | null {
  const address = side === "buy"
    ? (market.sellToken ?? market.inputMint)
    : (market.buyToken ?? market.outputMint)
  return typeof address === "string" && address !== "native" ? address : null
}

/** Only real token identifiers go to the exact balance endpoint. Native
 * balance is always returned by the backend adapter itself. */
export function spotBalanceAssets(market: HlSpotMarket): string[] {
  const networkId = market.networkId ?? ""
  return [...new Set([
    market.sellToken ?? market.inputMint,
    market.buyToken ?? market.outputMint,
  ].filter((address): address is string =>
    typeof address === "string" &&
    address !== "native" &&
    !nativeAliasFor(networkId, address),
  ))]
}

/** Match the registry's router identifier to the wallet's canonical balance.
 * SOL/ETH may be represented by a sentinel or wrapped token in a route while
 * the balance adapter correctly reports the native coin. */
export function spotBalanceRows(
  balances: readonly (CryptoBalance & { networkId: string })[],
  networkId: string,
  symbol: string,
  identifier: string | null,
) {
  const alias = nativeAliasFor(networkId, identifier)
  const candidates = balances.filter((balance) => {
    if (balance.networkId !== networkId) return false
    if (alias) {
      return balance.asset.kind === "native" && balance.symbol.toUpperCase() === alias.symbol.toUpperCase() ||
        balance.asset.kind === "token" && balance.asset.identifier.toLowerCase() === alias.wrapped.toLowerCase()
    }
    return identifier
      ? balance.asset.identifier.toLowerCase() === identifier.toLowerCase()
      : balance.symbol.toUpperCase() === symbol.toUpperCase()
  })
  // Native and wrapped balances are different on-chain accounts, but they
  // represent the same spot asset. A Jupiter fill can credit wSOL while the
  // wallet already holds native SOL; dropping either row makes the displayed
  // balance wrong. Keep both rows so callers can sum them without losing the
  // original token identifier needed for routing.
  return candidates
}
