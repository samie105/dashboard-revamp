"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  StarIcon,
  Chart01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Clock01Icon,
  ArrowUpRight01Icon,
  Search01Icon,
  Exchange01Icon,
  ChartLineData01Icon,
  Wallet01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData, TradeResult, FuturesMarket } from "@/lib/actions"
import { getFuturesMarkets } from "@/lib/actions"
import { fetchSpotV2Pairs } from "@/lib/spotv2/pairs"
import type { SpotV2Pair } from "@/components/spotv2/spotv2-types"
import { getSpotV2Balance, getSpotV2Positions, getTokenPrices, getSpotV2TradeHistory } from "@/lib/spotv2/ledger-actions"
import type { LedgerBalance, PositionInfo } from "@/lib/spotv2/ledger-actions"
import { ErrorState } from "@/components/error-state"
import { fetchProfile } from "@/lib/profile-actions"
import { SwapClient } from "@/components/swap/swap-client"
import { useHyperliquidPositions } from "@/hooks/useHyperliquidPositions"
import { useAuth } from "@/components/auth-provider"
import { getCoinImage, coinFallback } from "@/lib/coin-images"

const USDT_IMAGE = "https://coin-images.coingecko.com/coins/images/325/small/Tether.png"
const USDC_IMAGE = "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png"

/* ========== Trade Confirm Dialog (mobile) ========== */
type TradeConfirmItem =
  | { type: "spot";    symbol: string; name: string; image: string; price: number; change24h: number }
  | { type: "futures"; symbol: string; name: string; image: string; price: number; change24h: number; leverage: number }

function TradeConfirmDialog({
  item,
  onClose,
}: {
  item: TradeConfirmItem | null
  onClose: () => void
}) {
  const router = useRouter()
  if (!item) return null

  const isFutures = item.type === "futures"
  const isUp = item.change24h >= 0
  const href = isFutures ? `/futures?pair=${item.symbol}` : `/spotv2?pair=${item.symbol}`

  function handleTrade() {
    onClose()
    router.push(href)
  }

  return (
    // backdrop
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:hidden"
      onClick={onClose}
    >
      {/* sheet */}
      <div
        className="w-full rounded-t-2xl bg-card px-6 pt-6 pb-28 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* coin header */}
        <div className="mb-6 flex items-center gap-3">
          {item.image ? (
            <img
              src={item.image}
              alt={item.symbol}
              className={`h-12 w-12 rounded-full object-contain ring-2 ${
                isFutures ? "ring-amber-500/30" : "ring-primary/30"
              }`}
              onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(item.symbol) }}
            />
          ) : (
            <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${
              isFutures ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
            }`}>
              {item.symbol.slice(0, 3)}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-base font-bold">
              {item.symbol}{isFutures ? "-PERP" : "/USDC"}
            </span>
            <span className="text-xs text-muted-foreground">{item.name}</span>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-base font-bold tabular-nums">
              ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: item.price < 1 ? 4 : 2 })}
            </span>
            <span className={`text-xs font-medium tabular-nums ${
              isUp ? "text-emerald-500" : "text-red-500"
            }`}>
              {isUp ? "+" : ""}{item.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* type badge */}
        <div className="mb-5 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            isFutures
              ? "bg-amber-500/10 text-amber-600"
              : "bg-primary/10 text-primary"
          }`}>
            {isFutures ? `Perpetual · up to ${(item as Extract<TradeConfirmItem, {type:"futures"}>).leverage}× leverage` : "Spot Market"}
          </span>
        </div>

        {/* CTAs */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/50 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleTrade}
            className={`flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-colors ${
              isFutures
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            Trade {item.symbol}
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
const MARKET_TABS = ["Spot", "Futures"] as const
type MarketTab = (typeof MARKET_TABS)[number]

function MarketsTable({ coins, error }: { coins: CoinData[]; error?: string }) {
  const [tab, setTab] = React.useState<MarketTab>("Spot")
  const [search, setSearch] = React.useState("")
  const [visibleCount, setVisibleCount] = React.useState(8)
  const [futuresMarkets, setFuturesMarkets] = React.useState<FuturesMarket[]>([])
  const [futuresLoading, setFuturesLoading] = React.useState(false)
  const hasFetchedFutures = React.useRef(false)
  const [spotMarkets, setSpotMarkets] = React.useState<SpotV2Pair[]>([])
  const [spotLoading, setSpotLoading] = React.useState(false)
  const hasFetchedSpot = React.useRef(false)
  const [tradeItem, setTradeItem] = React.useState<TradeConfirmItem | null>(null)

  // Fetch futures lazily when tab is selected
  React.useEffect(() => {
    if (tab !== "Futures" || hasFetchedFutures.current) return
    hasFetchedFutures.current = true
    setFuturesLoading(true)
    getFuturesMarkets()
      .then((res) => {
        if (res.success) setFuturesMarkets(res.markets)
      })
      .catch(() => {})
      .finally(() => setFuturesLoading(false))
  }, [tab])

  // Fetch spot markets lazily when Spot tab is selected
  React.useEffect(() => {
    if (tab !== "Spot" || hasFetchedSpot.current) return
    hasFetchedSpot.current = true
    setSpotLoading(true)
    fetchSpotV2Pairs()
      .then((pairs) => { setSpotMarkets(pairs) })
      .catch(() => {})
      .finally(() => setSpotLoading(false))
  }, [tab])

  const filtered = React.useMemo(() => {
    let list = [...spotMarkets]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    }
    list.sort((a, b) => b.marketCap - a.marketCap)
    return list
  }, [spotMarkets, search])

  // Reset pagination when filters change
  React.useEffect(() => {
    setVisibleCount(8)
  }, [tab, search])

  const displayed = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const filteredFutures = React.useMemo(() => {
    let list = [...futuresMarkets]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) => m.symbol.toLowerCase().includes(q) || m.baseAsset.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => b.openInterest - a.openInterest)
  }, [futuresMarkets, search])

  const displayedFutures = filteredFutures.slice(0, visibleCount)
  const hasMoreFutures = visibleCount < filteredFutures.length

  return (
    <div data-onboarding="dash-markets" className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-card">
      <TradeConfirmDialog item={tradeItem} onClose={() => setTradeItem(null)} />
      {/* Header */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Chart01Icon} className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">Markets</h3>
          </div>
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-36 rounded-lg bg-accent/50 pl-7 pr-2 py-1.5 text-xs outline-none focus:bg-accent"
            />
          </div>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {MARKET_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? t === "Futures"
                    ? "bg-amber-500 text-white"
                    : "bg-primary text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {t === "Futures" ? "Futures" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Table — Futures */}
      {tab === "Futures" ? (
        futuresLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : filteredFutures.length === 0 ? (
          <EmptyState icon={Search01Icon} title="No contracts found" description="Try a different search term" />
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border/30 text-xs text-muted-foreground">
                  <th className="px-3 sm:px-4 py-2 text-left font-medium">Contract</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">Mark Price</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">24h</th>
                  <th className="hidden sm:table-cell px-4 py-2 text-right font-medium">Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayedFutures.map((market) => {
                  const isUp = market.change24h >= 0
                  return (
                    <tr
                      key={market.symbol}
                      className="cursor-pointer transition-colors hover:bg-accent/30 sm:cursor-default"
                      onClick={() => setTradeItem({
                        type: "futures",
                        symbol: market.symbol,
                        name: market.baseAsset,
                        image: market.image || getCoinImage(market.baseAsset) || "",
                        price: market.markPrice,
                        change24h: market.change24h,
                        leverage: market.maxLeverage,
                      })}
                    >
                      <td className="px-3 sm:px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {(market.image || getCoinImage(market.baseAsset)) ? (
                            <img
                              src={market.image || getCoinImage(market.baseAsset)}
                              alt={market.baseAsset}
                              className="h-5 w-5 shrink-0 rounded-full object-contain ring-1 ring-amber-500/20"
                              onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(market.baseAsset) }}
                            />
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-[9px] font-bold text-amber-600 ring-1 ring-amber-500/20">
                              {market.baseAsset.slice(0, 3)}
                            </span>
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium leading-none">{market.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">Perp · {market.maxLeverage}×</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-semibold tabular-nums">
                        ${market.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: market.markPrice < 1 ? 4 : 2 })}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right">
                        <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                          {isUp ? "+" : ""}{market.change24h.toFixed(2)}%
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-right">
                        <a
                          href={`/futures?pair=${market.symbol}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          Trade
                          <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Load More (Futures) */}
            {hasMoreFutures && (
              <div className="flex justify-center p-3">
                <button
                  onClick={() => setVisibleCount((c) => c + 8)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Load More
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        /* Table — Total / Main / Spot */
        (tab === "Spot" && spotLoading) ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error && filtered.length === 0 ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search01Icon}
            title="No results found"
            description="Try a different search term or tab"
          />
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border/30 text-xs text-muted-foreground">
                  <th className="px-3 sm:px-4 py-2 text-left font-medium">Pair</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">24h</th>
                  <th className="hidden sm:table-cell px-4 py-2 text-right font-medium">Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayed.map((coin) => (
                  <tr
                    key={coin.symbol}
                    className="cursor-pointer transition-colors hover:bg-accent/30 sm:cursor-default"
                    onClick={() => setTradeItem({
                      type: "spot",
                      symbol: coin.symbol,
                      name: coin.name,
                      image: coin.image,
                      price: coin.price,
                      change24h: coin.change24h,
                    })}
                  >
                    <td className="px-3 sm:px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center shrink-0">
                          {coin.image ? (
                            <img src={coin.image} alt="" className="h-5 w-5 rounded-full ring-1 ring-card" />
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-card">
                              {coin.symbol.slice(0, 2)}
                            </span>
                          )}
                          <img
                            src={USDC_IMAGE}
                            alt=""
                            className="h-4 w-4 rounded-full ring-1 ring-card -ml-1.5"
                          />
                        </div>
                        <span className="font-medium">{coin.displaySymbol}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-semibold tabular-nums">
                      {coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${
                          coin.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-right">
                      <a
                        href={`/spotv2?pair=${coin.symbol}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Trade
                        <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center p-3">
                <button
                  onClick={() => setVisibleCount((c) => c + 8)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Load More
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

/* ========== Recent Trades ========== */

function RecentTrades({ coins, error }: { coins: CoinData[]; error?: string }) {
  const { user } = useAuth()
  const [tab, setTab] = React.useState<"spot" | "futures">("spot")

  // SpotV2 trades
  type SpotV2TradeItem = { id: string; pair: string; token: string; side: string; quantity: number; price: number; quoteAmount: number; realizedPnl: number; fee: number; createdAt: Date }
  const [spotTrades, setSpotTrades] = React.useState<SpotV2TradeItem[]>([])
  const [spotTradesLoading, setSpotTradesLoading] = React.useState(true)

  // Futures fills
  const [futuresFills, setFuturesFills] = React.useState<Array<{ coin: string; px: string; sz: string; side: "B" | "A"; time: number; closedPnl: string }>>([])
  const [futuresLoading, setFuturesLoading] = React.useState(true)

  // Fetch SpotV2 trades
  React.useEffect(() => {
    if (!user) { setSpotTradesLoading(false); return }
    let cancelled = false
    getSpotV2TradeHistory(10).then((trades) => {
      if (!cancelled) setSpotTrades(trades as SpotV2TradeItem[])
    }).catch(() => {}).finally(() => { if (!cancelled) setSpotTradesLoading(false) })
    return () => { cancelled = true }
  }, [user])

  // Fetch Hyperliquid fills
  React.useEffect(() => {
    if (!user) { setFuturesLoading(false); return }
    let cancelled = false
    fetch("/api/hyperliquid/fills").then(r => r.json()).then((d) => {
      if (!cancelled) setFuturesFills(d.success ? (d.data || []).slice(0, 10) : [])
    }).catch(() => {}).finally(() => { if (!cancelled) setFuturesLoading(false) })
    return () => { cancelled = true }
  }, [user])

  function formatTime(ts: number | Date) {
    const diff = Date.now() - (typeof ts === "number" ? ts : new Date(ts).getTime())
    if (diff < 60_000) return "Just now"
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return `${Math.floor(diff / 86400_000)}d ago`
  }

  const loading = tab === "spot" ? spotTradesLoading : futuresLoading

  return (
    <div data-onboarding="dash-trades" className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Activity01Icon} className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">Recent Trades</h3>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setTab("spot")}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              tab === "spot" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Spot
          </button>
          <button
            onClick={() => setTab("futures")}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              tab === "futures" ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Futures
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tab === "spot" ? (
        spotTrades.length === 0 ? (
          <EmptyState
            icon={Exchange01Icon}
            title="No spot trades yet"
            description="Your SpotV2 trades will appear here"
            cta={{ label: "Start trading", href: "/spotv2" }}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {spotTrades.map((trade) => {
              const isBuy = trade.side === "buy"
              return (
                <div key={trade.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
                  <span className={`text-xs font-bold ${isBuy ? "text-emerald-500" : "text-red-500"}`}>
                    {isBuy ? "B" : "S"}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="flex items-center shrink-0">
                        {getCoinImage(trade.token) ? (
                          <img src={getCoinImage(trade.token)} alt="" className="h-4.5 w-4.5 rounded-full ring-1 ring-card" onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(trade.token) }} />
                        ) : (
                          <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary ring-1 ring-card">
                            {trade.token.slice(0, 2)}
                          </span>
                        )}
                        <img src={USDC_IMAGE} alt="" className="h-3.5 w-3.5 rounded-full ring-1 ring-card -ml-1.5" />
                      </span>
                      {trade.pair}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {trade.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} {trade.token}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      ${trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                      {formatTime(trade.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        futuresFills.length === 0 ? (
          <EmptyState
            icon={Exchange01Icon}
            title="No futures trades yet"
            description="Your futures fills will appear here"
            cta={{ label: "Trade Futures", href: "/futures" }}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {futuresFills.map((fill, i) => {
              const isBuy = fill.side === "B"
              return (
                <div key={`${fill.coin}-${fill.time}-${i}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
                  <span className={`text-xs font-bold ${isBuy ? "text-emerald-500" : "text-red-500"}`}>
                    {isBuy ? "B" : "S"}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{fill.coin}-PERP</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {parseFloat(fill.sz).toLocaleString(undefined, { maximumFractionDigits: 4 })} {fill.coin}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      ${parseFloat(fill.px).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                      {formatTime(fill.time)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

/* ========== Watchlist ========== */
function Watchlist({ coins, error }: { coins: CoinData[]; error?: string }) {
  const [watchlistSymbols, setWatchlistSymbols] = React.useState<string[] | null>(null)

  React.useEffect(() => {
    fetchProfile()
      .then((result) => {
        if (result.success && result.profile) {
          setWatchlistSymbols(result.profile.watchlist ?? [])
        } else {
          setWatchlistSymbols([])
        }
      })
      .catch(() => setWatchlistSymbols([]))
  }, [])

  const items = React.useMemo(() => {
    if (watchlistSymbols === null) return null
    if (watchlistSymbols.length === 0) return []
    return coins.filter((c) => watchlistSymbols.includes(c.symbol)).slice(0, 10)
  }, [coins, watchlistSymbols])

  return (
    <div data-onboarding="dash-watchlist" className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={StarIcon} className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">Watchlist</h3>
        </div>
        <a href="/spotv2" className="text-xs font-medium text-primary hover:underline">
          View all
        </a>
      </div>
      {items === null ? (
        <div className="flex flex-1 flex-col divide-y divide-border/30">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-1.5">
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
              <div className="flex flex-1 flex-col gap-1">
                <div className="h-3 w-14 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-10 rounded bg-muted animate-pulse" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="h-3 w-14 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-10 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={StarIcon}
          title="No favorites yet"
          description="Star assets on the Spot page to build your watchlist"
          cta={{ label: "Browse markets", href: "/spotv2" }}
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/30">
          {items.map((coin) => (
            <div key={coin.symbol} className="flex items-center gap-3 px-3 py-1.5 transition-colors hover:bg-accent/30">
              {coin.image ? (
                <img src={coin.image} alt={coin.symbol} className="h-5 w-5 rounded-full" />
              ) : (
                <span className="text-xs font-bold text-primary">{coin.symbol.slice(0, 2)}</span>
              )}
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{coin.symbol}</span>
                <span className="text-xs text-muted-foreground">{coin.name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">
                  ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {coin.change24h !== 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
                      coin.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    <HugeiconsIcon
                      icon={coin.change24h >= 0 ? ArrowUp01Icon : ArrowDown01Icon}
                      className="h-3 w-3"
                    />
                    {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========== Empty State ========== */
function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: typeof Activity01Icon
  title: string
  description: string
  cta?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <HugeiconsIcon icon={icon} className="h-8 w-8 text-muted-foreground/40" />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <span className="text-xs text-muted-foreground/60">{description}</span>
      </div>
      {cta && (
        <a
          href={cta.href}
          className="mt-1 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          {cta.label}
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

/* ========== My Positions ========== */
function MyPositions() {
  const { user } = useAuth()
  const { positions, loading: posLoading } = useHyperliquidPositions()

  // SpotV2 data
  const [spotBalances, setSpotBalances] = React.useState<LedgerBalance[]>([])
  const [spotPositions, setSpotPositions] = React.useState<(PositionInfo & { currentPrice: number })[]>([])
  const [spotLoading, setSpotLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user) { setSpotLoading(false); return }
    let cancelled = false

    async function load() {
      try {
        const [balances, positions] = await Promise.all([
          getSpotV2Balance(),
          getSpotV2Positions(),
        ])
        // Get current prices for all position tokens
        const tokens = positions.map((p) => p.token)
        const priceMap = tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()

        if (cancelled) return
        setSpotBalances(balances)
        setSpotPositions(
          positions.map((p) => ({
            ...p,
            currentPrice: priceMap.get(p.token) ?? 0,
          })),
        )
      } catch {
        // silently fail — empty state will show
      } finally {
        if (!cancelled) setSpotLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const [view, setView] = React.useState<"positions" | "spot">("positions")

  const loading = view === "positions" ? posLoading : spotLoading

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Wallet01Icon} className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">My Holdings</h3>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setView("positions")}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              view === "positions" ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Futures
          </button>
          <button
            onClick={() => setView("spot")}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              view === "spot" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Spot
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : view === "positions" ? (
        positions.length === 0 ? (
          <EmptyState
            icon={ChartLineData01Icon}
            title="No open positions"
            description="Your futures positions will appear here"
            cta={{ label: "Trade Futures", href: "/futures" }}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {positions.slice(0, 6).map((pos) => {
              const size = parseFloat(pos.szi)
              const isLong = size > 0
              const pnl = parseFloat(pos.unrealizedPnl)
              const roe = parseFloat(pos.returnOnEquity) * 100
              const isProfit = pnl >= 0
              const lev = pos.leverage ? `${pos.leverage.value}×` : ""
              return (
                <div key={pos.coin} className="flex items-center gap-3 px-3 py-1.5 transition-colors hover:bg-accent/30">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${isLong ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                    {isLong ? "L" : "S"}
                  </span>
                  {getCoinImage(pos.coin) ? (
                    <img
                      src={getCoinImage(pos.coin)}
                      alt={pos.coin}
                      className="h-5 w-5 shrink-0 rounded-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(pos.coin) }}
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{pos.coin}-PERP</span>
                    <span className="text-xs text-muted-foreground">{lev} · {Math.abs(size).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-semibold tabular-nums ${isProfit ? "text-emerald-500" : "text-red-500"}`}>
                      {isProfit ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs tabular-nums ${isProfit ? "text-emerald-500/70" : "text-red-500/70"}`}>
                      {isProfit ? "+" : ""}{roe.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )
            })}
            {positions.length > 6 && (
              <a href="/assets" className="flex items-center justify-center py-2 text-xs font-medium text-primary hover:underline">
                View all {positions.length} positions
              </a>
            )}
          </div>
        )
      ) : (
        spotBalances.length === 0 && spotPositions.length === 0 ? (
          <EmptyState
            icon={Chart01Icon}
            title="No spot holdings"
            description="Your spot assets will appear here"
            cta={{ label: "Trade Spot", href: "/spotv2" }}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {/* USDC balance row */}
            {spotBalances.filter((b) => b.available + b.locked > 0).map((b) => (
              <div key={b.token} className="flex items-center gap-3 px-3 py-1.5 transition-colors hover:bg-accent/30">
                <img src={USDC_IMAGE} alt="USDC" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{b.token}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {b.locked > 0 ? `${b.available.toLocaleString(undefined, { maximumFractionDigits: 2 })} avail · ${b.locked.toLocaleString(undefined, { maximumFractionDigits: 2 })} locked` : `${(b.available + b.locked).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold tabular-nums">
                    ${(b.available + b.locked).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
            {/* Token positions */}
            {spotPositions.slice(0, 5).map((p) => {
              const currentValue = p.quantity * p.currentPrice
              const costBasis = p.quantity * p.avgEntryPrice
              const pnl = currentValue - costBasis
              const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0
              const isProfit = pnl >= 0
              return (
                <div key={p.token} className="flex items-center gap-3 px-3 py-1.5 transition-colors hover:bg-accent/30">
                  {getCoinImage(p.token) ? (
                    <img
                      src={getCoinImage(p.token)}
                      alt={p.token}
                      className="h-5 w-5 shrink-0 rounded-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(p.token) }}
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                      {p.token.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{p.token}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{p.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {pnl !== 0 && (
                      <span className={`text-xs font-medium tabular-nums ${isProfit ? "text-emerald-500" : "text-red-500"}`}>
                        {isProfit ? "+" : ""}{pnlPercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {spotPositions.length > 5 && (
              <a href="/assets" className="flex items-center justify-center py-2 text-xs font-medium text-primary hover:underline">
                View all {spotPositions.length} assets
              </a>
            )}
          </div>
        )
      )}
    </div>
  )
}

/* ========== Dashboard Grid ========== */
interface DashboardGridProps {
  coins: CoinData[]
  initialTrades: TradeResult[]
  prices: Record<string, number>
  error?: string
}

export function DashboardGrid({ coins, initialTrades, prices, error }: DashboardGridProps) {
  return (
    <div className="grid w-full gap-4 lg:grid-cols-5">
      {/* Column 1: Markets + Recent Trades stacked */}
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
        <MarketsTable coins={coins} error={error} />
        <RecentTrades coins={coins} error={error} />
      </div>

      {/* Column 2: Swap + My Holdings + Watchlist */}
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <SwapClient coins={coins} prices={prices} error={error} compact />
        <MyPositions />
        <Watchlist coins={coins} error={error} />
      </div>
    </div>
  )
}
