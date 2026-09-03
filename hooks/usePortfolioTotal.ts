"use client"

/**
 * What the user is worth — computed once, for everyone who shows it.
 *
 * The navbar and the dashboard hero disagreed, and not by a rounding error:
 * the hero read $0.48 while the bar above it read $0.00. They were adding up
 * different things from different sources — the hero summed the wallet, the
 * trading account and the cash account; the bar showed the Dollar Account
 * alone, in a pill the same size and weight as the hero's number. Two figures
 * that both look like "your balance" and disagree teach the user to trust
 * neither.
 *
 * So the arithmetic lives here and every surface reads it. Correlation stops
 * being something to remember and becomes something the code cannot get wrong.
 *
 * WHAT THE TOTAL IS, per the 2026-09-03 product review: **Holdings + Spot +
 * Futures**. Three things, all of them crypto.
 *
 * WHAT IT IS NOT is cash. The Dollar Account is a different product with its
 * own dashboard, and a crypto total that quietly includes dollars is precisely
 * what had people arriving here expecting to deposit naira into a wallet. It
 * is returned alongside, never inside — the surfaces put it on its own line.
 *
 * SPOT IS IN THE SUM, and this is the correction worth knowing about. The
 * first version of this hook added wallet + futures + cash and left spot out
 * entirely, while the dashboard hero kept its own arithmetic that included it.
 * So the two figures this file exists to reconcile still disagreed — now by
 * exactly the spot balance, the largest component in most accounts — and the
 * portfolio page inherited the version that was missing it.
 *
 * The parts are exposed alongside the total because the surfaces differ in how
 * much they show — a pill has room for one number, a hero can break it down —
 * but they must never differ in what those numbers MEAN.
 */

import * as React from "react"

import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useTradeAccount } from "@/hooks/useTradeAccount"
import { useCashBalance } from "@/hooks/useCashBalance"
import { useAuth } from "@/components/auth-provider"
import { NETWORKS } from "@/lib/networks"
import { FUTURES_CLOSED } from "@/lib/venues"
import { cryptoTotal } from "@/lib/dashboard-cards"
import { getSpotBalances, getSpotPositions, getTokenPrices } from "@/lib/trade-adapter"
import type { LedgerBalance, PositionInfo } from "@/lib/trade-adapter"

/** A stablecoin with no feed entry is worth a dollar; anything else is worth
 *  nothing until we have a price, rather than being guessed at. */
function valueOf(symbol: string, balance: number, prices: Record<string, number>): number {
  const price =
    prices[symbol] ?? prices[symbol.toUpperCase()] ?? prices[symbol.toLowerCase()] ?? 0
  if (price > 0) return balance * price
  return symbol === "USDT" || symbol === "USDC" ? balance : 0
}

export type PortfolioTotal = {
  /** Holdings + Spot + Futures, in USD. Cash is NOT in here. */
  total: number
  /** The wallet's own coins, priced. "Holdings" on every surface. */
  onChain: number
  /** What has been moved onto the spot market to trade with. */
  spot: number
  /** The perps account. Contributes 0 to `total` while the venue is shut. */
  futures: number
  /** Whether futures counts at all right now — mirrors `FUTURES_CLOSED`. */
  futuresOpen: boolean
  /** The Dollar Account. Deliberately outside `total`. */
  cash: number
  /** Per-chain value, keyed the way `NETWORKS` is. */
  chainTotals: Record<string, number>
  /** True until the wallet's balances have arrived at least once. */
  loading: boolean
  /** Separate settle flags, because the dashboard cards decide what to SHOW
   *  off them: an account that has not answered yet is not the same as one
   *  that answered and is empty. */
  onChainSettled: boolean
  spotSettled: boolean
  futuresSettled: boolean
  cashSettled: boolean
}

/**
 * @param prices Symbol → USD. The caller supplies it because the dashboard
 *   already polls a live feed and the navbar has a slower one; passing it in
 *   keeps this hook from becoming a third poller.
 */
export function usePortfolioTotal(prices: Record<string, number>): PortfolioTotal {
  const { user, isLoaded } = useAuth()
  const { balances: onChainBalances, isLoading } = useWalletBalances()
  const { futuresUsd, isLoading: tradeAccountLoading } = useTradeAccount()
  const { cash, loaded: cashLoaded } = useCashBalance()

  /* Spot sits behind two requests and a price lookup, so it is fetched here
     rather than in each surface. It used to be a useEffect inside the
     dashboard hero, which is exactly why the navbar could not see it. */
  const [spotLedger, setSpotLedger] = React.useState<LedgerBalance[]>([])
  const [spotPositions, setSpotPositions] = React.useState<
    (PositionInfo & { currentPrice: number })[]
  >([])
  const [spotSettled, setSpotSettled] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      /* No user means there is no spot account to ask about — that is an
         ANSWER, not a request still in flight, and saying so is what lets the
         dashboard cards stop waiting. */
      if (isLoaded) setSpotSettled(true)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const [balances, positions] = await Promise.all([getSpotBalances(), getSpotPositions()])
        const tokens = positions.map((p) => p.token)
        const priceMap =
          tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()
        if (cancelled) return
        setSpotLedger(balances)
        setSpotPositions(positions.map((p) => ({ ...p, currentPrice: priceMap.get(p.token) ?? 0 })))
      } catch {
        /* Leave the figures at zero. Settling anyway is deliberate: from here
           a service that is down looks identical to an empty account, and
           pinning the breakdown on skeletons forever is the worse of the two
           lies. */
      } finally {
        if (!cancelled) setSpotSettled(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, isLoaded])

  return React.useMemo(() => {
    /* `useWalletBalances` already follows the active wallet mode, so there is
       nothing to gate on here. The dashboard used to gate this on the LEGACY
       provider's "wallets provisioned" flag, which a modern-wallet user never
       receives — that is what zeroed the hero. */
    const chainTotals: Record<string, number> = Object.fromEntries(
      NETWORKS.map((n) => [n.key, 0]),
    )
    let onChain = 0
    for (const balance of onChainBalances) {
      const value = valueOf(balance.symbol, balance.balance, prices)
      onChain += value
      if (chainTotals[balance.chain] !== undefined) chainTotals[balance.chain] += value
    }

    const spot =
      spotLedger.reduce((sum, b) => sum + b.available + b.locked, 0) +
      spotPositions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0)

    return {
      /* One pure function decides the sum, shared with the dashboard's card
         rules, so "what counts" cannot fork between the arithmetic and the
         thing that draws it. */
      total: cryptoTotal({
        holdings: onChain,
        spot,
        futures: futuresUsd,
        futuresOpen: !FUTURES_CLOSED,
      }),
      onChain,
      spot,
      futures: futuresUsd,
      futuresOpen: !FUTURES_CLOSED,
      cash,
      chainTotals,
      loading: isLoading,
      onChainSettled: !isLoading,
      spotSettled,
      futuresSettled: !tradeAccountLoading,
      cashSettled: cashLoaded,
    }
    /* No wallet-mode dependency: `useWalletBalances` keys its own query by
       mode, so switching wallets already produces a new `onChainBalances`. */
  }, [
    onChainBalances,
    prices,
    futuresUsd,
    cash,
    isLoading,
    spotLedger,
    spotPositions,
    spotSettled,
    tradeAccountLoading,
    cashLoaded,
  ])
}
