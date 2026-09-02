/**
 * The native coin, as routers spell it.
 *
 * A chain's own coin has no contract, so every router invents an address for
 * it. LI.FI uses Solana's System Program id (`1111…1111`) for SOL and the zero
 * address — or the `0xEeee…EEeE` convention — for ETH. Our market registry
 * keys those markets by the WRAPPED token instead, because that is what a pool
 * actually holds.
 *
 * The two spellings never met, so a SOL order arrived carrying an address no
 * market matched and rendered as a raw `1111…1111` with no symbol, no side and
 * no size. This is the translation between them: the sentinel gives us the
 * symbol and precision outright, and the wrapped address is how the registry
 * is asked for the price and the icon.
 */

export type NativeToken = {
  symbol: string
  decimals: number
  /** The wrapped equivalent — how the registry lists this market. */
  wrapped: string
}

const WSOL = "So11111111111111111111111111111111111111112"
const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const WETH_ARBITRUM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"

/** Sentinels are matched lowercased; base58 is compared that way too, since
 *  these particular values are unambiguous either way. */
const NATIVE: Record<string, { sentinels: string[]; token: NativeToken }> = {
  "solana-mainnet-beta": {
    // The System Program id. Also seen as all-ones of other lengths.
    sentinels: ["11111111111111111111111111111111"],
    token: { symbol: "SOL", decimals: 9, wrapped: WSOL },
  },
  "ethereum-mainnet": {
    sentinels: [
      "0x0000000000000000000000000000000000000000",
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    ],
    token: { symbol: "ETH", decimals: 18, wrapped: WETH_MAINNET },
  },
  "arbitrum-one": {
    sentinels: [
      "0x0000000000000000000000000000000000000000",
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    ],
    token: { symbol: "ETH", decimals: 18, wrapped: WETH_ARBITRUM },
  },
}

/**
 * The native coin this address stands for, or `null` if it names a real token.
 */
export function nativeTokenFor(networkId: string, address: string | null): NativeToken | null {
  if (!address) return null
  const entry = NATIVE[networkId]
  if (!entry) return null
  return entry.sentinels.includes(address.toLowerCase()) ? entry.token : null
}
