"use client"

/**
 * Markets: the preview's page (app/(redesign)/markets-unauth) on real data.
 *
 * The state and every request are the previous page's
 * (components/trading/markets-client.tsx, kept unused): the server's prices
 * and global stats, the spot registry loaded when the Spot tab opens, futures
 * loaded when Futures opens, one batched sparkline request, the registry for
 * Trade routing, and the user's holdings and positions. The ranking, sorting,
 * filtering and paging rules live in lib/markets-view.ts, unchanged.
 */

import * as React from "react"

import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { Panel } from "@/components/dashboard/redesign/ui"
import { ErrorState } from "@/components/error-state"
import { ComingSoon } from "@/components/ui/coming-soon"
import { baseAsset } from "@/components/ui/coin-avatar"
import { useAuth } from "@/components/auth-provider"
import { useHyperliquidPositions } from "@/hooks/useHyperliquidPositions"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { useSparklines } from "@/hooks/useSparklines"
import { useSpotRegistry, type RegistryRow } from "@/hooks/useSpotRegistry"
import { getFuturesMarkets, type CoinData, type FuturesMarket } from "@/lib/actions"
import { loadSpotMarkets } from "@/lib/spot-markets"
import { chainLabel, ALL_CHAINS } from "@/lib/spot-market-search"
import {
  activeOf,
  change7d,
  filterCoins,
  filterFutures,
  futuresActiveOf,
  futuresGainersOf,
  gainersOf,
  losersOf,
  pageOf,
  subtitleFor,
  type MarketTab,
  type SortKey,
} from "@/lib/markets-view"
import { MarketStats, FuturesStats, MarketsHeading, Tape, type GlobalStats } from "@/components/markets/redesign/overview"
import { Movers, coinRow, futuresRow } from "@/components/markets/redesign/movers"
import { MarketTable, type TableTab } from "@/components/markets/redesign/market-table"
import { MyHoldings, MyPositions } from "@/components/markets/redesign/holdings"

/* GATE, unchanged: perpetual futures can be closed with one switch. The tab
   stays pressable and opens the shared "not open yet" panel.
   TO RE-OPEN when closed: set to false. */
const FUTURES_CLOSED: boolean = false

export function MarketsPage({ coins, globalStats, error }: { coins: CoinData[]; globalStats: GlobalStats; error?: string }) {
  const [tableTab, setTableTab] = React.useState<TableTab>("Total")
  /** Favorites is a view of the Total list; the rest of the page reads as Total. */
  const tab: MarketTab = tableTab === "Favorites" ? "Total" : tableTab
  const [search, setSearch] = React.useState("")
  const [sortBy, setSortBy] = React.useState<SortKey>("marketCap")
  const [sortAsc, setSortAsc] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const [chainFilter, setChainFilter] = React.useState<string>(ALL_CHAINS)
  const [page, setPage] = React.useState(0)

  const { user } = useAuth()
  const { positions, loading: positionsLoading } = useHyperliquidPositions()
  const { balances: spotHoldings, loading: spotHoldingsLoading } = useHyperliquidBalance(user?.userId, !!user)
  const registry = useSpotRegistry()

  const tradable = React.useCallback(
    (symbol: string): RegistryRow[] | undefined => (registry.bySymbol.size === 0 ? undefined : (registry.bySymbol.get(symbol.toUpperCase()) ?? [])),
    [registry],
  )

  const priceOf = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const c of coins) if (Number.isFinite(c.price)) map.set(c.symbol.toUpperCase(), c.price)
    return (symbol: string) => map.get(baseAsset(symbol)) ?? map.get(symbol.toUpperCase()) ?? null
  }, [coins])

  // The registry, loaded once the Spot tab opens (unchanged).
  const [spotMarkets, setSpotMarkets] = React.useState<CoinData[]>([])
  const [spotLoading, setSpotLoading] = React.useState(false)
  const hasFetchedSpot = React.useRef(false)
  React.useEffect(() => {
    if (tab !== "Spot" || hasFetchedSpot.current) return
    hasFetchedSpot.current = true
    setSpotLoading(true)
    loadSpotMarkets()
      .then((res) => {
        setSpotMarkets(
          res.markets.map((m) => ({
            id: m.id,
            symbol: m.symbol.toUpperCase(),
            name: chainLabel(m.networkId),
            price: m.price ?? 0,
            change24h: 0,
            marketCap: 0,
            volume24h: 0,
            image: m.icon ?? "",
          })),
        )
      })
      .catch(() => {})
      .finally(() => setSpotLoading(false))
  }, [tab])

  // Futures, loaded once the Futures tab opens (unchanged).
  const [futuresMarkets, setFuturesMarkets] = React.useState<FuturesMarket[]>([])
  const [futuresLoading, setFuturesLoading] = React.useState(false)
  const hasFetchedFutures = React.useRef(false)
  React.useEffect(() => {
    if (FUTURES_CLOSED || tab !== "Futures" || hasFetchedFutures.current) return
    hasFetchedFutures.current = true
    setFuturesLoading(true)
    getFuturesMarkets()
      .then((res) => {
        if (res.success) setFuturesMarkets(res.markets)
      })
      .catch(() => {})
      .finally(() => setFuturesLoading(false))
  }, [tab])

  const isFutures = tab === "Futures"
  const futuresClosed = isFutures && FUTURES_CLOSED
  const source = tab === "Spot" ? spotMarkets : coins

  // One batched sparkline request for everything this view can rank.
  const sparkSymbols = React.useMemo(() => (isFutures ? futuresMarkets.map((m) => m.baseAsset) : source.map((c) => c.symbol)), [isFutures, futuresMarkets, source])
  const spark = useSparklines(sparkSymbols)
  const changeOf = React.useCallback((coin: CoinData) => spark(coin.symbol)?.change24h ?? coin.change24h, [spark])

  /** Whether the 7-day series have answered for anything on screen. Until
   *  then every move reads as 0, which would rank nothing and claim a flat
   *  market; the movers and breadth wait instead. */
  const movesKnown = isFutures || source.some((c) => spark(c.symbol) !== undefined)

  // The movers rank on the 7-day move, the same series their rows draw. A
  // coin without a series has no 7-day move and stays off the lists.
  const weekOf = React.useCallback((coin: CoinData) => change7d(spark(coin.symbol)?.prices) ?? 0, [spark])
  const movers = React.useMemo(() => {
    if (isFutures) return { gainers: futuresGainersOf(futuresMarkets).map(futuresRow), losers: [], active: futuresActiveOf(futuresMarkets).map(futuresRow) }
    const row = (c: CoinData) => {
      const sp = spark(c.symbol)
      return coinRow(c, weekOf(c), sp === undefined ? undefined : (sp?.prices ?? null))
    }
    return { gainers: gainersOf(source, weekOf).map(row), losers: losersOf(source, weekOf).map(row), active: activeOf(source, weekOf).map(row) }
  }, [isFutures, futuresMarkets, source, weekOf, spark])

  const tableCoins = React.useMemo(() => {
    const base = tableTab === "Favorites" ? coins.filter((c) => favorites.has(c.id)) : source
    return filterCoins(base, {
      tab,
      search,
      sortBy,
      sortAsc,
      onChain: chainFilter === ALL_CHAINS ? null : (symbol) => (registry.bySymbol.get(symbol.toUpperCase()) ?? []).some((r) => r.networkId === chainFilter),
    })
  }, [tableTab, coins, favorites, source, tab, search, sortBy, sortAsc, chainFilter, registry])

  const tableFutures = React.useMemo(() => filterFutures(futuresMarkets, { search, sortBy, sortAsc }), [futuresMarkets, search, sortBy, sortAsc])
  const pageInfo = pageOf(isFutures ? tableFutures.length : tableCoins.length, page)

  React.useEffect(() => {
    setPage(0)
  }, [tableTab, search, chainFilter, sortBy, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc((v) => !v)
    else {
      setSortBy(key)
      setSortAsc(false)
    }
  }

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const subtitle = subtitleFor(tab, { coins: coins.length, spot: spotMarkets.length, futures: futuresMarkets.length }, futuresClosed)

  if (error && coins.length === 0) {
    return (
      <DashScope className="ws-icon-mono mx-auto flex w-full max-w-[1720px] flex-col gap-4 md:gap-5">
        <MarketsHeading subtitle="Prices are unavailable right now" />
        <Panel>
          <ErrorState message={error} />
        </Panel>
      </DashScope>
    )
  }

  const table = (
    <MarketTable
      tab={tableTab}
      onTab={setTableTab}
      search={search}
      onSearch={setSearch}
      sortBy={sortBy}
      sortAsc={sortAsc}
      onSort={toggleSort}
      onMobileSort={(k) => {
        setSortBy(k)
        setSortAsc(false)
      }}
      chains={registry.chains}
      chain={chainFilter}
      onChain={setChainFilter}
      favorites={favorites}
      onFavorite={toggleFavorite}
      coins={tableCoins}
      futures={tableFutures}
      total={isFutures ? futuresMarkets.length : tableTab === "Favorites" ? favorites.size : source.length}
      loading={tab === "Spot" ? spotLoading : isFutures ? futuresLoading : false}
      page={pageInfo}
      onPage={setPage}
      spark={spark}
      changeOf={changeOf}
      tradable={tradable}
    />
  )

  return (
    <DashScope className="ws-icon-mono mx-auto flex w-full max-w-[1720px] flex-col gap-4 md:gap-5">
      <Rise>
        <MarketsHeading subtitle={subtitle} />
      </Rise>

      {futuresClosed ? (
        <>
          <Panel>
            <ComingSoon />
          </Panel>
          {table}
        </>
      ) : (
        <>
          {!isFutures && (
            <Rise delay={40}>
              <Tape coins={source} changeOf={changeOf} />
            </Rise>
          )}
          <Rise delay={80}>
            {isFutures ? <FuturesStats markets={futuresMarkets} loading={futuresLoading} /> : <MarketStats coins={source} changeOf={changeOf} globalStats={globalStats} movesKnown={movesKnown} />}
          </Rise>
          <Rise delay={140}>
            <Movers gainers={movers.gainers} losers={movers.losers} active={movers.active} window={isFutures ? "24h" : "7d"} loading={isFutures ? futuresLoading : !movesKnown} />
          </Rise>
          <Rise delay={200}>{table}</Rise>
          <Rise delay={240}>
            {isFutures ? (
              <MyPositions positions={positions} loading={positionsLoading} />
            ) : (
              <MyHoldings holdings={spotHoldings} loading={spotHoldingsLoading} priceOf={priceOf} />
            )}
          </Rise>
        </>
      )}
    </DashScope>
  )
}
