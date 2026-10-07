"use client"

/**
 * The real data behind the redesigned dashboard.
 *
 * The preview's components read demo constants; here they read this context
 * instead, so their markup stays the preview's and only the data changes.
 *
 * Nothing new is fetched. This is the previous hero's arithmetic and its 30s
 * price poller (components/dashboard/hero.tsx), plus the one `/insights`
 * request the insights card made:
 *  · `usePortfolioTotal` owns the total, so the navbar pill, /portfolio and
 *    the dashboard agree by construction;
 *  · `useAccountHistory` owns the curves (now also cut per chart range);
 *  · the 24h P&L is the same per-symbol maths over the same balances;
 *  · `settled` is not zero: figures wait until their account has answered.
 */

import * as React from "react"

import { useTradeAccount } from "@/hooks/useTradeAccount"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { usePortfolioTotal } from "@/hooks/usePortfolioTotal"
import { useAccountHistory, type AccountSpec } from "@/hooks/useAccountHistory"
import { fetchPrices } from "@/lib/crypto-api"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { CoinData } from "@/lib/actions"

export function priceOf(prices: Record<string, number>, symbol: string): number {
  return prices[symbol] ?? prices[symbol.toUpperCase()] ?? prices[symbol.toLowerCase()] ?? 0
}

/** 24h P&L: each holding moved by its own 24h change. Unchanged arithmetic. */
function calculateDailyPnL(holdings: Record<string, number>, prices: Record<string, number>, coins: CoinData[]): number {
  let pnl = 0
  for (const [symbol, qty] of Object.entries(holdings)) {
    if (!qty) continue
    const coin = coins.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase())
    if (!coin || !coin.change24h) continue
    const price = priceOf(prices, symbol) || coin.price
    const value = qty * price
    // `value` is POST-move, so the previous value is value / (1 + change).
    pnl += value - value / (1 + coin.change24h / 100)
  }
  return pnl
}

/** The hero's 30s price feed, unchanged: seeded from the server's prices. */
function useLivePrices(initial: Record<string, number>) {
  const [livePrices, setLivePrices] = React.useState<Record<string, number>>(initial)
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetchPrices()
        if (cancelled) return
        const merged: Record<string, number> = { ...res.prices }
        for (const c of res.coins) {
          const key = c.symbol.toUpperCase()
          if (merged[key] === undefined && c.price > 0) merged[key] = c.price
        }
        setLivePrices(merged)
      } catch {
        /* keep last good prices */
      }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
  return livePrices
}

export type InsightsPayload = Awaited<ReturnType<typeof cryptoBackendClient.getInsights>>

/** `/insights`, or null (not deployed or failed: same either way). Unchanged fetch. */
function useInsights(): InsightsPayload | null {
  const [data, setData] = React.useState<InsightsPayload | null>(null)
  React.useEffect(() => {
    if (!isCryptoBackendEnabled) return
    const controller = new AbortController()
    cryptoBackendClient
      .getInsights(6, controller.signal)
      .then((value) => setData(value))
      .catch(() => {
        /* Deliberately silent: a 404 is expected before the route is deployed. */
      })
    return () => controller.abort()
  }, [])
  return data
}

/** One row per coin, in the preview's Holding shape: wallet + spot add up. */
export type HoldingRow = {
  symbol: string
  name: string
  amount: number
  inOrder: number
  price: number
  changePct: number | null
}

export const holdingValue = (h: HoldingRow) => h.amount * h.price

function useModel(coins: CoinData[], prices: Record<string, number>) {
  const livePrices = useLivePrices(prices)
  const { balances: onChainBalances } = useWalletBalances()
  const trade = useTradeAccount()
  const { balances: hlAccountBalances, positions } = trade
  const portfolio = usePortfolioTotal(livePrices)
  const { onChain: onChainTotal, spot: spotBalance, futures: futuresBalance, futuresOpen } = portfolio

  const spotTokens = React.useMemo(() => (hlAccountBalances?.spotTokens ?? []).filter((t) => t.total > 0), [hlAccountBalances])

  const dailyPnL = React.useMemo(() => {
    const main: Record<string, number> = {}
    for (const b of onChainBalances) main[b.symbol] = (main[b.symbol] || 0) + b.balance
    const spot: Record<string, number> = {}
    for (const t of spotTokens) spot[t.symbol] = (spot[t.symbol] || 0) + t.total
    return calculateDailyPnL(main, livePrices, coins) + calculateDailyPnL(spot, livePrices, coins)
  }, [onChainBalances, spotTokens, livePrices, coins])

  // 30-day history: the same specs as before, so curve and figure agree.
  const accountSpecs: AccountSpec[] = React.useMemo(() => {
    const main: Record<string, number> = {}
    for (const b of onChainBalances) main[b.symbol] = (main[b.symbol] || 0) + b.balance
    const spot: Record<string, number> = {}
    for (const t of spotTokens) spot[t.symbol] = (spot[t.symbol] || 0) + t.total
    const futures: Record<string, number> = {}
    for (const p of positions) futures[p.symbol] = (futures[p.symbol] || 0) + p.size
    return [
      { key: "holdings", balance: onChainTotal, holdings: main },
      { key: "spot", balance: spotBalance, holdings: spot },
      { key: "futures", balance: futuresOpen ? futuresBalance : 0, holdings: futuresOpen ? futures : {} },
    ]
  }, [onChainBalances, spotTokens, positions, onChainTotal, spotBalance, futuresBalance, futuresOpen])

  const history = useAccountHistory(accountSpecs)
  /* A zero series is a chart of nothing styled as a chart of something. */
  const hasHistory = Boolean(history.totalSeries && history.totalSeries.length > 1 && history.totalSeries.some((v) => v > 0))

  const holdings: HoldingRow[] = React.useMemo(() => {
    const rows = new Map<string, HoldingRow>()
    const coinOf = (symbol: string) => coins.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase())
    const add = (symbol: string, amount: number, inOrder: number, name?: string) => {
      if (!(amount > 0)) return
      const key = symbol.toUpperCase()
      const coin = coinOf(symbol)
      const row = rows.get(key) ?? {
        symbol,
        name: name || coin?.name || symbol,
        amount: 0,
        inOrder: 0,
        price: priceOf(livePrices, symbol),
        changePct: coin ? coin.change24h : null,
      }
      row.amount += amount
      row.inOrder += inOrder
      rows.set(key, row)
    }
    for (const b of onChainBalances) add(b.symbol, b.balance, 0, b.name)
    for (const t of spotTokens) add(t.symbol, t.total, t.hold)
    return [...rows.values()].sort((a, b) => holdingValue(b) - holdingValue(a))
  }, [onChainBalances, spotTokens, livePrices, coins])

  return {
    livePrices,
    portfolio,
    trade,
    positions,
    dailyPnL,
    history,
    hasHistory,
    holdings,
    /** Holdings are known once both the wallet and the spot account have answered. */
    holdingsSettled: portfolio.onChainSettled && portfolio.spotSettled,
  }
}

type DashboardData = ReturnType<typeof useModel> & {
  coins: CoinData[]
  /** The server's price-feed error, if any. */
  error?: string
  insights: InsightsPayload | null
}

const DashboardDataContext = React.createContext<DashboardData | null>(null)

export function DashboardDataProvider({
  coins,
  prices,
  error,
  children,
}: {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
  children: React.ReactNode
}) {
  const model = useModel(coins, prices)
  const insights = useInsights()
  const value = React.useMemo(() => ({ ...model, coins, error, insights }), [model, coins, error, insights])
  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData(): DashboardData {
  const value = React.useContext(DashboardDataContext)
  if (!value) throw new Error("useDashboardData must be used inside DashboardDataProvider")
  return value
}
