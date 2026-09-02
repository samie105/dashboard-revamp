"use client"

/**
 * What the user is worth — computed once, for everyone who shows it.
 *
 * The navbar and the dashboard hero disagreed, and not by a rounding error:
 * the hero read $0.48 while the bar above it read $0.00. They were adding up
 * different things from different sources — the hero summed the on-chain
 * wallet, the trading account and the cash account; the bar showed the Dollar
 * Account alone, in a pill the same size and weight as the hero's number.
 * Two figures that both look like "your balance" and disagree teach the user
 * to trust neither.
 *
 * So the arithmetic lives here and every surface reads it. Correlation stops
 * being something to remember and becomes something the code cannot get wrong.
 *
 * The parts are exposed alongside the total because the surfaces differ in how
 * much they show — a pill has room for one number, a hero can break it down —
 * but they must never differ in what those numbers MEAN.
 */

import * as React from "react"

import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useTradeAccount } from "@/hooks/useTradeAccount"
import { useCashBalance } from "@/hooks/useCashBalance"
import { NETWORKS } from "@/lib/networks"

/** A stablecoin with no feed entry is worth a dollar; anything else is worth
 *  nothing until we have a price, rather than being guessed at. */
function valueOf(symbol: string, balance: number, prices: Record<string, number>): number {
  const price =
    prices[symbol] ?? prices[symbol.toUpperCase()] ?? prices[symbol.toLowerCase()] ?? 0
  if (price > 0) return balance * price
  return symbol === "USDT" || symbol === "USDC" ? balance : 0
}

export type PortfolioTotal = {
  /** Everything, in USD. */
  total: number
  /** The self-custodial wallet, priced. */
  onChain: number
  /** The trading account's perps value. */
  futures: number
  /** The Dollar Account. */
  cash: number
  /** Per-chain value, keyed the way `NETWORKS` is. */
  chainTotals: Record<string, number>
  /** True until the wallet's balances have arrived at least once. */
  loading: boolean
}

/**
 * @param prices Symbol → USD. The caller supplies it because the dashboard
 *   already polls a live feed and the navbar has a slower one; passing it in
 *   keeps this hook from becoming a third poller.
 */
export function usePortfolioTotal(prices: Record<string, number>): PortfolioTotal {
  const { balances: onChainBalances, isLoading } = useWalletBalances()
  const { futuresUsd } = useTradeAccount()
  const { cash } = useCashBalance()

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

    return {
      total: onChain + futuresUsd + cash,
      onChain,
      futures: futuresUsd,
      cash,
      chainTotals,
      loading: isLoading,
    }
    /* No wallet-mode dependency: `useWalletBalances` keys its own query by
       mode, so switching wallets already produces a new `onChainBalances`. */
  }, [onChainBalances, prices, futuresUsd, cash, isLoading])
}
