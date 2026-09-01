/**
 * Pure helpers behind the send flow. Kept out of the component so the fiddly
 * parts — key derivation, base-unit parsing, the countdown, the USD estimate —
 * are readable on their own and can be reasoned about without React.
 */

import type { CryptoBalanceResult } from "@/hooks/crypto/balance-policy"
import type { CryptoAssetReference, SponsorshipConfig } from "@/lib/crypto-backend"
import { usd } from "@/lib/num"

/* ── Copy Deck ─────────────────────────────────────────────────────────── */

export const FEE_SELF_LABEL = "You pay the network fee"
export const FEE_SPONSORED_LABEL = "Worldstreet pays the network fee"
/** The two-line fee chip can't carry the long sponsored sentence, so the chip
 *  wears the short form and the review row states it in full. */
export const FEE_SPONSORED_CHIP_LABEL = "Worldstreet pays"
export const QUOTE_EXPIRED_MESSAGE =
  "This quote expired before signing. Request a fresh one — nothing was sent."
export const LEAVE_SAFELY_CAPTION =
  "You can safely leave — this transfer continues in the background."

/* ── Assets ────────────────────────────────────────────────────────────── */

/** One stable key per asset on a network — `native` has no contract to key on. */
export function assetKeyOf(asset: CryptoAssetReference): string {
  return `${asset.kind}:${asset.identifier}`
}

/**
 * Base units as a bigint, or 0n when the provider handed back something that
 * isn't a non-negative integer string. Never throws: a malformed row must not
 * take the whole asset picker down with it.
 */
export function baseUnitsOf(amountBaseUnits: string | undefined | null): bigint {
  // BigInt(0) rather than 0n: the app's TS target predates BigInt literals.
  return amountBaseUnits && /^\d+$/.test(amountBaseUnits) ? BigInt(amountBaseUnits) : BigInt(0)
}

/** Rows with something actually spendable on them. */
export function spendableBalances(
  balances: CryptoBalanceResult[],
  accountId: string,
  networkId: string,
): CryptoBalanceResult[] {
  return balances.filter(
    (balance) =>
      balance.accountId === accountId &&
      balance.networkId === networkId &&
      baseUnitsOf(balance.amountBaseUnits) > BigInt(0),
  )
}

/* ── Addresses ─────────────────────────────────────────────────────────── */

export function truncateAddress(value: string, keep = 6): string {
  return value.length <= keep * 2 + 3 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`
}

/**
 * Is the destination this very account's own address?
 *
 * EVM addresses are case-insensitive (EIP-55 is a checksum, not an identity),
 * so those compare folded. Everything else is a case-SENSITIVE encoding —
 * folding a base58 or base64url address before comparing could call two
 * different addresses equal, so those compare exactly.
 */
export function isSelfSend(family: string, from: string | undefined, to: string): boolean {
  const destination = to.trim()
  if (!from || !destination) return false
  return family === "evm"
    ? from.toLowerCase() === destination.toLowerCase()
    : from === destination
}

/* ── The quote clock ───────────────────────────────────────────────────── */

/** `mm:ss`, floored at zero — a negative countdown is just "expired". */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/** Epoch ms for an ISO timestamp, or null when it's missing or unparseable. */
export function epochMsOf(iso: string | undefined | null): number | null {
  if (!iso) return null
  const value = new Date(iso).getTime()
  return Number.isNaN(value) ? null : value
}

/* ── Money ─────────────────────────────────────────────────────────────── */

/**
 * "≈ $101.00" for the typed amount, or null when the answer would be a guess:
 * the price index hasn't landed (`null`), this symbol has no live price, or
 * the amount isn't a number yet. Never NaN — spec §10.
 */
export function usdApproxFor(
  amount: string,
  symbol: string,
  index: Record<string, number> | null,
): string | null {
  if (!index) return null
  const price = index[symbol.toUpperCase()]
  if (price === undefined || !Number.isFinite(price) || price <= 0) return null
  const typed = Number(amount)
  if (!Number.isFinite(typed) || typed <= 0) return null
  return `≈ ${usd(typed * price)}`
}

/* ── Fee sponsorship ───────────────────────────────────────────────────── */

export function sponsorshipOperationOf(assetKind: "native" | "token"): "native-transfer" | "token-transfer" {
  return assetKind === "token" ? "token-transfer" : "native-transfer"
}

/**
 * Spec §11: the fee choice is offered only when the SERVICE says it's
 * available for this exact network and operation — never inferred from a
 * checkbox the client drew itself. An unread config, a disabled programme, or
 * a family the signer can't produce a sponsored payload for (only EVM and
 * Solana, per `useTransactionIntent`) all mean "don't offer it".
 */
export function sponsorshipOffered(input: {
  config: SponsorshipConfig | null | undefined
  networkId: string
  family: string | undefined
  assetKind: "native" | "token"
}): boolean {
  const { config, networkId, family, assetKind } = input
  if (!config?.enabled || !networkId || !family) return false
  if (!config.allowedNetworks?.includes(networkId)) return false
  if (!config.allowedOperations?.includes(sponsorshipOperationOf(assetKind))) return false
  const families = config.supportedFamilies?.length ? config.supportedFamilies : ["evm", "solana"]
  return families.includes(family)
}

/* ── Status ────────────────────────────────────────────────────────────── */

export function statusStateOf(status: string | undefined): "processing" | "success" | "failure" {
  if (status === "confirmed") return "success"
  if (status === "failed" || status === "expired") return "failure"
  return "processing"
}

/** A transaction hash from whichever record carries it, without an `any`. */
export function readTxHash(...sources: unknown[]): string | null {
  for (const source of sources) {
    if (typeof source === "string" && source) return source
    if (source && typeof source === "object") {
      const hash = (source as { txHash?: unknown }).txHash
      if (typeof hash === "string" && hash) return hash
    }
  }
  return null
}
