"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon, ArrowUp01Icon, ArrowDown01Icon, Menu01Icon } from "@hugeicons/core-free-icons"
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
import { RecentTrades } from "./recent-trades"
import { SpotDepositModal } from "./spot-deposit-modal"
import { SpotWithdrawModal } from "./spot-withdraw-modal"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { usePanelLayout } from "@/hooks/usePanelLayout"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

// ── Spot Onboarding Steps ────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="spot-topbar"]',
    title: "Market Info",
    description: "See the current price, 24h change, volume, and market stats for the selected trading pair.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="spot-markets-trigger"]',
    title: "Switch Pairs",
    description: "Tap here to open the markets sheet and browse all available spot pairs. Search by name or symbol to find your pair quickly.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="spot-chart"]',
    title: "Price Chart",
    description: "Interactive candlestick chart with multiple timeframes, chart types, and technical indicators like MA, EMA, Bollinger Bands, and VWAP.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="spot-orderbook"]',
    title: "Order Book & Trades",
    description: "Real-time order book showing bid and ask depth. Switch to Recent Trades to see the latest executed trades.",
    placement: "left",
  },
  {
    target: '[data-onboarding="spot-order"]',
    title: "Place Orders",
    description: "Buy or sell with market or limit orders. The buy and sell panels are stacked to the right of the order book for quick access.",
    placement: "left",
  },
  {
    target: '[data-onboarding="spot-orders"]',
    title: "Open Orders",
    description: "Track your pending orders and trade history. Cancel or manage orders in real-time. This panel is always visible — use the collapse arrow to hide it.",
    placement: "top",
  },
]

export function SpotClient({
  coins,
  prices,
  initialTrades,
  initialOrderBook,
}: SpotClientProps) {
  const { profile } = useProfile()
  const [selectedPair, setSelectedPair] = React.useState("BTC")
  const [watchlist, setWatchlist] = React.useState<Set<string>>(
    new Set(["BTC", "ETH", "SOL"]),
  )
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("chart")
  const [showSearch, setShowSearch] = React.useState(false)
  const [showDeposit, setShowDeposit] = React.useState(false)
  const [showWithdraw, setShowWithdraw] = React.useState(false)
  const [showMarkets, setShowMarkets] = React.useState(false)
  const [mobileOrderOpen, setMobileOrderOpen] = React.useState(false)
  const [rightTab, setRightTab] = React.useState<"book" | "trades">("book")
  const isOnboardingDone = profile?.onboardingCompleted?.includes("spot")
  const { collapsed, toggle } = usePanelLayout()

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
      <div data-onboarding="spot-topbar">
        <SpotTopBar
          coin={selectedCoin}
          onOpenSearch={() => setShowSearch(true)}
          onOpenDeposit={() => setShowDeposit(true)}
          onOpenWithdraw={() => setShowWithdraw(true)}
        />
      </div>

      {/* ═══ DESKTOP LAYOUT ═══ */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden p-1 gap-1">
        {/* MAIN ROW: Chart | OrderBook + Buy/Sell */}
        <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">

          {/* LEFT — Full-height Chart */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Markets sheet trigger row — sits above the chart toolbar */}
            <div className="flex items-center gap-1 px-1 py-0.5 shrink-0">
              <Sheet open={showMarkets} onOpenChange={setShowMarkets}>
                <SheetTrigger
                  data-onboarding="spot-markets-trigger"
                  render={
                    <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors" />
                  }
                >
                  <HugeiconsIcon icon={Menu01Icon} className="h-3.5 w-3.5" />
                  <span>Markets</span>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[320px] sm:max-w-[320px] p-0 bg-background/95 backdrop-blur-xl border-border/20"
                  showCloseButton={false}
                >
                  <SheetHeader className="px-3 pt-3 pb-0">
                    <SheetTitle className="text-sm">Markets</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <MarketSelect
                      coins={coins}
                      selected={selectedPair}
                      onSelect={(s) => { handlePairSelect(s); setShowMarkets(false) }}
                      watchlist={watchlist}
                      onToggleWatch={toggleWatch}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChartArea
                symbol={selectedPair}
                price={currentPrice}
                change24h={selectedCoin.change24h}
              />
            </div>
          </div>

          {/* RIGHT — Order Book + Buy/Sell stacked */}
          <div className="shrink-0 w-[280px] xl:w-[320px] flex flex-col gap-1 overflow-hidden">
            {/* Order Book / Recent Trades */}
            {collapsed.right ? (
              <button
                onClick={() => toggle("right")}
                className="shrink-0 h-6 flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
                title="Expand order book"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                <span className="text-[9px] text-muted-foreground">Order Book</span>
              </button>
            ) : (
              <div data-onboarding="spot-orderbook" className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl bg-card relative">
                <button
                  onClick={() => toggle("right")}
                  className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                  title="Collapse order book"
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3 text-muted-foreground" />
                </button>
                <div className="flex items-center gap-1 border-b border-border/20 px-2 py-1.5 shrink-0">
                  <button
                    onClick={() => setRightTab("book")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      rightTab === "book" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Order Book
                  </button>
                  <button
                    onClick={() => setRightTab("trades")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      rightTab === "trades" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Recent Trades
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {rightTab === "book" ? (
                    <AnimatedOrderBook
                      currentPrice={currentPrice}
                      asks={orderBookAsks}
                      bids={orderBookBids}
                    />
                  ) : (
                    <RecentTrades
                      trades={liveTrades[`${selectedPair}USDT`] ?? []}
                      currentPrice={currentPrice}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Buy / Sell — stacked, border-separated */}
            {collapsed.order ? (
              <button
                onClick={() => toggle("order")}
                className="shrink-0 h-6 flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
                title="Expand order panels"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                <span className="text-[9px] text-muted-foreground">Buy / Sell</span>
              </button>
            ) : (
              <div data-onboarding="spot-order" className="shrink-0 max-h-[45%] overflow-y-auto rounded-xl bg-card relative slim-scroll">
                <button
                  onClick={() => toggle("order")}
                  className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                  title="Collapse order panels"
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3 text-muted-foreground" />
                </button>
                <OrderPanel side="buy" symbol={selectedPair} price={currentPrice} />
                <div className="border-t border-border/20" />
                <OrderPanel side="sell" symbol={selectedPair} price={currentPrice} />
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM ROW — Open Orders (visible by default) */}
        {collapsed.bottom ? (
          <button
            onClick={() => toggle("bottom")}
            className="shrink-0 h-6 flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
            title="Expand orders"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            <span className="text-[9px] text-muted-foreground">Open Orders</span>
          </button>
        ) : (
          <div data-onboarding="spot-orders" className="shrink-0 h-[160px] relative">
            <button
              onClick={() => toggle("bottom")}
              className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
              title="Collapse orders"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
            </button>
            <OpenOrdersPanel />
          </div>
        )}
      </div>

      {/* ═══ MOBILE LAYOUT ═══ */}
      <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
        {/* Tab selector */}
        <div className="flex items-center gap-1 rounded-xl bg-accent/30 p-0.5 mx-2 mt-2 shrink-0">
          {mobileTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
                mobileTab === tab.id
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto slim-scroll px-2 pt-2 pb-2">
          {mobileTab === "chart" && (
            <div className="h-[340px] rounded-xl overflow-hidden">
              <ChartArea
                symbol={selectedPair}
                price={currentPrice}
                change24h={selectedCoin.change24h}
              />
            </div>
          )}
          {mobileTab === "book" && (
            <div className="h-[400px]">
              <AnimatedOrderBook
                currentPrice={currentPrice}
                asks={orderBookAsks}
                bids={orderBookBids}
              />
            </div>
          )}
          {mobileTab === "market" && (
            <div className="h-[400px]">
              <MarketSelect
                coins={coins}
                selected={selectedPair}
                onSelect={handlePairSelect}
                watchlist={watchlist}
                onToggleWatch={toggleWatch}
              />
            </div>
          )}
        </div>

        {/* Sticky trade button → opens bottom sheet */}
        <div className="shrink-0 border-t border-border/10 bg-background/95 backdrop-blur-xl px-3 py-2">
          <Sheet open={mobileOrderOpen} onOpenChange={setMobileOrderOpen}>
            <SheetTrigger
              render={
                <button className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90" />
              }
            >
              Trade {selectedPair}
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85vh] rounded-t-2xl bg-background/95 backdrop-blur-xl border-border/20 p-0"
              showCloseButton={false}
            >
              <div className="flex justify-center py-2">
                <div className="h-1 w-8 rounded-full bg-border/50" />
              </div>
              <div className="overflow-y-auto slim-scroll px-3 pb-4 max-h-[75vh]">
                <div className="grid grid-cols-2 gap-2">
                  <OrderPanel side="buy" symbol={selectedPair} price={currentPrice} />
                  <OrderPanel side="sell" symbol={selectedPair} price={currentPrice} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Search modal */}
      <TokenSearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        coins={coins}
        onSelect={handlePairSelect}
      />

      {/* Onboarding */}
      <OnboardingFlow
        steps={ONBOARDING_STEPS}
        storageKey="spot"
        completed={isOnboardingDone}
        onComplete={() => markOnboardingComplete("spot")}
      />

      {/* Deposit / Withdraw modals */}
      <SpotDepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
      />
      <SpotWithdrawModal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
      />
    </div>
  )
}
