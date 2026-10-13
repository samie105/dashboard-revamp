/**
 * View-model helpers for the redesigned swap page (components/swap/redesign).
 * Pure, so the rules the screen states are tested.
 *
 * Every figure here is a field on the routing quote or arithmetic over two of
 * them — the rule components/swap/quote-detail.tsx is built on, applied the
 * same way. A figure the quote doesn't carry comes back null and the screen
 * shows "—"; nothing is estimated.
 */

import type { CoinData } from "@/lib/actions"
import { num } from "@/lib/num"
import {
  BALANCE_NETWORK_ID,
  CHAINS,
  chainMeta,
  fromBaseUnits,
  isRoutable,
  swapAssetForToken,
  tokensForChain,
  type QuoteData,
} from "@/components/swap/swap-model"

/* ── Token picker ────────────────────────────────────────────────────────── */

export type TokenOption = { key: string; chain: string; coin: CoinData }

export const optionKey = (chain: string, symbol: string) => `${chain}:${symbol.toUpperCase()}`

/**
 * One dropdown for chain AND token, as the preview has it: every token each
 * routable chain can be quoted for (the same per-chain whitelist the ticket
 * enforces), in the chain order the old chain button cycled through.
 */
export function tokenOptions(available: CoinData[]): TokenOption[] {
  return CHAINS.filter((c) => isRoutable(c.id)).flatMap((c) =>
    tokensForChain(c.id, available).map((coin) => ({ key: optionKey(c.id, coin.symbol), chain: c.id, coin })),
  )
}

type BalanceLike = { networkId: string; symbol: string; asset: { identifier: string }; amountBaseUnits: string; decimals: number }

/**
 * What the wallet holds of a token on a chain — the ticket's own matching
 * rule (use-swap-ticket.ts `fromCoinBalance`): by contract for a token, by
 * symbol for a native coin, summed across accounts.
 */
export function balanceOf(balances: BalanceLike[], chain: string, symbol: string, format: (base: string, decimals: number) => string): number {
  const networkId = BALANCE_NETWORK_ID[chain]
  if (!networkId) return 0
  const asset = swapAssetForToken(chain, symbol)
  return balances
    .filter(
      (b) =>
        b.networkId === networkId &&
        (asset?.address && asset.address !== "native"
          ? b.asset.identifier.toLowerCase() === asset.address.toLowerCase()
          : b.symbol.toUpperCase() === symbol.toUpperCase()),
    )
    .reduce((sum, b) => sum + Number(format(b.amountBaseUnits, b.decimals)), 0)
}

/* ── Quote figures ───────────────────────────────────────────────────────── */

export type QuoteFigures = {
  /** to per from, from the QUOTE (null before one lands). */
  rate: number | null
  minReceived: number | null
  /** Price impact as a percent, absolute. */
  impact: number | null
  /** Network fee plus protocol fees charged on top, in USD. */
  feesUsd: number | null
  /** Seconds end to end. */
  arrivesSeconds: number | null
}

export function quoteFigures(quote: QuoteData | null, fromAmount: number, toAmount: number): QuoteFigures {
  if (!quote) return { rate: null, minReceived: null, impact: null, feesUsd: null, arrivesSeconds: null }
  const network = num(quote.gasCostUSD)
  // Only fees charged on top — an `included` fee is already inside the output.
  const extra = (quote.feeCosts ?? []).filter((f) => !f.included).reduce((sum, f) => sum + (num(f.amountUSD) ?? 0), 0)
  const fees = network === null && extra === 0 ? null : (network ?? 0) + extra
  return {
    rate: fromAmount > 0 && toAmount > 0 ? toAmount / fromAmount : null,
    minReceived: fromBaseUnits(quote.toAmountMin, quote.toToken.decimals),
    impact: Number.isFinite(quote.priceImpact) ? Math.abs(quote.priceImpact) : null,
    feesUsd: fees,
    arrivesSeconds: quote.executionDuration && quote.executionDuration > 0 ? quote.executionDuration : null,
  }
}

/** "~8s" / "~3 min" — quote-detail.tsx's rule. */
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s`
  return `~${Math.round(seconds / 60)} min`
}

/* ── Route ───────────────────────────────────────────────────────────────── */

export type RouteStep = { kind: "swap" | "bridge"; venue: string; logo?: string; detail: string | null }

/**
 * The legs the quote actually crosses. LI.FI returns one entry for a direct
 * swap and several when it hops; an older backend sends only `tool`, which
 * becomes one step (quote-detail.tsx's fallback). A leg that changes chain is
 * a bridge.
 */
export function routeSteps(quote: QuoteData | null, fromSymbol: string, toSymbol: string): RouteStep[] {
  if (!quote) return []
  const steps = quote.steps?.length ? quote.steps : [{ tool: quote.tool, logoURI: quote.toolLogoURI, type: "swap", fromSymbol, toSymbol }]
  return steps.map((s) => ({
    kind: /cross|bridge/i.test(s.type) ? "bridge" : "swap",
    venue: s.tool,
    logo: s.logoURI,
    detail: s.fromSymbol && s.toSymbol ? `${s.fromSymbol} → ${s.toSymbol}` : null,
  }))
}

/* ── History ─────────────────────────────────────────────────────────────── */

export type SwapBucket = "completed" | "pending" | "failed"

/** The history card's statuses, in the preview's three buckets. */
export function swapBucket(status: string): SwapBucket {
  if (status === "completed") return "completed"
  if (status === "failed" || status === "cancelled" || status === "expired") return "failed"
  return "pending"
}

/** A ledger network id ("arbitrum-one") as the chain's name ("Arbitrum"). */
export function networkLabel(networkId: string | undefined): string | null {
  if (!networkId) return null
  const chain = Object.entries(BALANCE_NETWORK_ID).find(([, id]) => id === networkId)?.[0]
  return chain ? chainMeta(chain).label : networkId
}
