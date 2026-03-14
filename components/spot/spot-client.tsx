"use client"

import * as React from "react"
import type { OrderBookLevel, TradeResult } from "@/lib/actions"
import { getOrderBook, getTrades } from "@/lib/actions"
import type { SpotClientProps, MobileTab } from "./spot-types"
import { SpotTopBar } from "./spot-top-bar"
import { MarketSelect } from "./market-select"
import { ChartArea } from "./chart-area"
import { OrderPanel } from "./order-panel"
import { AnimatedOrderBook } from "./animated-order-book"
import { OpenOrdersPanel } from "./open-orders-panel"
import { TokenSearchModal } from "./token-search-modal"

export function SpotClient({
  coins,
  prices,
  initialTrades,
  initialOrderBook,
}: SpotClientProps) {
  const [selectedPair, setSelectedPair] = React.useState("BTC")
  const [watchlist, setWatchlist] = React.useState<Set<string>>(
    new Set(["BTC", "ETH", "SOL"]),
  )
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("chart")
  const [showSearch, setShowSearch] = React.useState(false)

  const [orderBookAsks, setOrderBookAsks] = React.useState<OrderBookLevel[]>(
    initialOrderBook?.asks ?? [],
  )
  const [orderBookBids, setOrderBookBids] = React.useState<OrderBookLevel[]>(
    initialOrderBook?.bids ?? [],
  )
  const [liveTrades, setLiveTrades] =
    React.useState<Record<string, TradeResult[]>>(initialTrades)

  // URL param handling
  React.useEffect(() => {
    const pair = new URLSearchParams(window.location.search).get("pair")
    if (pair && coins.find((c) => c.symbol === pair)) setSelectedPair(pair)
  }, [coins])

  // Poll orderbook every 1s via server action for near-real-time updates
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const r = await getOrderBook(`${selectedPair}USDT`, 20)
        if (!cancelled && r.success) {
          setOrderBookAsks(r.asks)
          setOrderBookBids(r.bids)
        }
      } catch {
        /* ignore */
      }
    }
    poll()
    const id = window.setInterval(poll, 1_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedPair])

  // Poll trades every 5s via server action
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const r = await getTrades(`${selectedPair}USDT`, 50)
        if (!cancelled && r.success)
          setLiveTrades((p) => ({
            ...p,
            [`${selectedPair}USDT`]: r.data,
          }))
      } catch {
        /* ignore */
      }
    }
    if (!liveTrades[`${selectedPair}USDT`]?.length) poll()
    const id = window.setInterval(poll, 5_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedPair])

  const selectedCoin =
    coins.find((c) => c.symbol === selectedPair) || coins[0]
  const currentPrice = prices[selectedPair] ?? selectedCoin?.price ?? 0

  function handlePairSelect(symbol: string) {
    setSelectedPair(symbol)
    const url = new URL(window.location.href)
    url.searchParams.set("pair", symbol)
    window.history.replaceState({}, "", url.toString())
  }

  function toggleWatch(s: string) {
    setWatchlist((prev) => {
      const n = new Set(prev)
      n.has(s) ? n.delete(s) : n.add(s)
      return n
    })
  }

  if (!selectedCoin) return null

  const mobileTabs: { id: MobileTab; label: string }[] = [
    { id: "chart", label: "Chart" },
    { id: "book", label: "Book" },
    { id: "market", label: "Markets" },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── TOP BAR ── */}
      <SpotTopBar
        coin={selectedCoin}
        onOpenSearch={() => setShowSearch(true)}
      />

      {/* ═══ DESKTOP: 3-column main + standalone bottom orders ═══ */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden p-1 gap-1">
        {/* MAIN ROW */}
        <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr_280px] gap-1 overflow-hidden">
          {/* LEFT — Market/Pair List */}
          <div className="overflow-hidden">
            <MarketSelect
              coins={coins}
              selected={selectedPair}
              onSelect={handlePairSelect}
              watchlist={watchlist}
              onToggleWatch={toggleWatch}
            />
          </div>

          {/* CENTER — Chart + Buy/Sell stacked */}
          <div className="flex flex-col gap-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChartArea
                symbol={selectedPair}
                price={currentPrice}
                change24h={selectedCoin.change24h}
              />
            </div>
            <div className="shrink-0 overflow-hidden">
              <div className="grid grid-cols-2 gap-1">
                <OrderPanel
                  side="buy"
                  symbol={selectedPair}
                  price={currentPrice}
                />
                <OrderPanel
                  side="sell"
                  symbol={selectedPair}
                  price={currentPrice}
                />
              </div>
            </div>
          </div>

          {/* RIGHT — Order Book */}
          <div className="overflow-hidden">
            <AnimatedOrderBook
              currentPrice={currentPrice}
              asks={orderBookAsks}
              bids={orderBookBids}
            />
          </div>
        </div>

        {/* BOTTOM ROW — Open Orders (standalone) */}
        <div className="shrink-0 min-h-[120px] max-h-[30vh]">
          <OpenOrdersPanel />
        </div>
      </div>

      {/* ═══ MOBILE layout ═══ */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto slim-scroll px-2 pt-2 pb-4 lg:hidden">
        <div className="flex items-center gap-1 rounded-xl bg-accent/30 p-0.5 shrink-0">
          {mobileTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                mobileTab === tab.id
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[360px]">
          {mobileTab === "chart" && (
            <ChartArea
              symbol={selectedPair}
              price={currentPrice}
              change24h={selectedCoin.change24h}
            />
          )}
          {mobileTab === "book" && (
            <AnimatedOrderBook
              currentPrice={currentPrice}
              asks={orderBookAsks}
              bids={orderBookBids}
            />
          )}
          {mobileTab === "market" && (
            <MarketSelect
              coins={coins}
              selected={selectedPair}
              onSelect={handlePairSelect}
              watchlist={watchlist}
              onToggleWatch={toggleWatch}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 shrink-0">
          <OrderPanel
            side="buy"
            symbol={selectedPair}
            price={currentPrice}
          />
          <OrderPanel
            side="sell"
            symbol={selectedPair}
            price={currentPrice}
          />
        </div>

        <OpenOrdersPanel />
      </div>

      {/* Search modal */}
      <TokenSearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        coins={coins}
        onSelect={handlePairSelect}
      />
    </div>
  )
}
