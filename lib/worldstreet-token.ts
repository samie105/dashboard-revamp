/**
 * Worldstreet's own Solana tokens — public constants and shared types for
 * the read-only dashboard surfaces (balances, WMNA market card, explainer).
 *
 * MNA and WMNA are DIFFERENT assets on different token programs with
 * different venues; nothing here may be mixed across them:
 *   MNA  — Token-2022, bought/redeemed through the Worldstreet controller
 *          program, quoted in USDT. No AMM pool.
 *   WMNA — legacy SPL token, trades freely on a Raydium CPMM pool against
 *          USDC.
 *
 * These are public constants (mints, programs, pool id) — safe to ship to
 * the client. The RPC endpoint is NOT public: reads go through
 * /api/solana/worldstreet, which holds SOLANA_RPC_URL server-side.
 */

export const MNA_MINT = "2bZWGr4MnziqGQ3bVuhkgfYKngx7Nb7bVnKT3ZKZjEt1"
export const WMNA_MINT = "2kMAxxfrFxvLdiguaFM9EzgPNz6ZC2duHfnesUn6ydtt"
export const WMNA_RAYDIUM_POOL = "4UVKRx9ohHPnp4dpq7U6aCezwL3htnk6BrBouBURYyBY"
export const MNA_CONTROLLER_PROGRAM = "7QZLtciaBCeLy5uyooZERzBNbPLNuQ6Ppc4iA2kqEsyR"

export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

export const MNA_DECIMALS = 6
export const WMNA_DECIMALS = 6

/** Loose base58 shape check — enough to refuse the dev bypass's fake
 *  addresses and garbage input before an RPC round-trip. */
export function looksLikeSolanaAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
}

/** What /api/solana/worldstreet returns. Market data is best-effort from
 *  the Raydium API; balances are null when no (valid) owner was given or
 *  the RPC read failed — the card renders what it has. */
export interface WorldstreetTokenSnapshot {
  market: {
    /** USDC per WMNA, from the live pool. */
    price: number
    tvlUsd: number
    /** Pool reserves, UI units. */
    poolWmna: number
    poolUsdc: number
    /** 7-day traded volume in USD (the pool is small; days are often 0). */
    weekVolumeUsd: number
    /** 7-day price range — [min, max]; null when the pool has no trades. */
    weekRange: [number, number] | null
    feeRate: number
  } | null
  balances: {
    mna: number
    wmna: number
  } | null
  fetchedAt: number
}
