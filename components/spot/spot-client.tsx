"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
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
  const [balanceRefreshKey, setBalanceRefreshKey] = React.useState(0)
  const triggerBalanceRefresh = React.useCallback(() => setBalanceRefreshKey((k) => k + 1), [])
  const [showMarkets, setShowMarkets] = React.useState(false)
  const [mobileOrderOpen, setMobileOrderOpen] = React.useState(false)
  const [rightTab, setRightTab] = React.useState<"book" | "trades">("book")
  const [orderSide, setOrderSide] = React.useState<"buy" | "sell">("buy")
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
          refreshTrigger={balanceRefreshKey}
        />
      </div>

      {/* ═══ DESKTOP LAYOUT ═══ */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden border border-border/40 rounded-xl">
        {/* TOP ROW: Chart + Order Book */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* Chart */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <ChartArea
              symbol={selectedPair}
              price={currentPrice}
              change24h={selectedCoin.change24h}
              onMarketsClick={() => setShowMarkets(true)}
            />
          </div>

          {/* Markets overlay sheet (triggered from chart toolbar) */}
          <Sheet open={showMarkets} onOpenChange={setShowMarkets}>
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

          {/* RIGHT — Order Book (full height) */}
          {collapsed.right ? (
            <button
              onClick={() => toggle("right")}
              className="shrink-0 w-6 flex flex-col items-center justify-center gap-1.5 border-l border-border/40 hover:bg-accent/30 transition-colors group"
              title="Expand order book"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr]">Order Book</span>
            </button>
          ) : (
            <div data-onboarding="spot-orderbook" className="shrink-0 w-[280px] xl:w-[320px] flex flex-col overflow-hidden border-l border-border/40 relative">
              <button
                onClick={() => toggle("right")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 hover:bg-accent/50 transition-colors"
                title="Collapse order book"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <div className="flex items-center gap-1 border-b border-border/40 px-2 py-1.5 shrink-0">
                <button
                  onClick={() => setRightTab("book")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    rightTab === "book" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Book
                </button>
                <button
                  onClick={() => setRightTab("trades")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    rightTab === "trades" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Trades
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
        </div>

        {/* BOTTOM ROW — Open Orders | Buy/Sell */}
        {collapsed.bottom ? (
          <button
            onClick={() => toggle("bottom")}
            className="shrink-0 h-6 flex items-center justify-center gap-1.5 border-t border-border/40 hover:bg-accent/30 transition-colors group"
            title="Expand bottom panels"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
            <span className="text-[9px] text-muted-foreground">Orders · Trade</span>
          </button>
        ) : (
          <div data-onboarding="spot-orders" className="shrink-0 h-[300px] flex border-t border-border/40">
            {/* Open Orders */}
            <div className="flex-1 min-w-0 relative">
              <button
                onClick={() => toggle("bottom")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 hover:bg-accent/50 transition-colors"
                title="Collapse"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <OpenOrdersPanel />
            </div>

            {/* Buy / Sell — tabbed */}
            {collapsed.order ? (
              <button
                onClick={() => toggle("order")}
                className="shrink-0 w-6 flex flex-col items-center justify-center gap-1.5 border-l border-border/40 hover:bg-accent/30 transition-colors group"
                title="Expand order panel"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr]">Buy / Sell</span>
              </button>
            ) : (
              <div data-onboarding="spot-order" className="shrink-0 w-[280px] xl:w-[320px] border-l border-border/40 relative flex flex-col overflow-hidden">
                {/* Tab bar */}
                <div className="flex items-center border-b border-border/40 shrink-0">
                  <button
                    onClick={() => setOrderSide("buy")}
                    className={`flex-1 py-2 text-xs font-bold transition-colors relative ${
                      orderSide === "buy"
                        ? "text-emerald-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Buy
                    {orderSide === "buy" && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setOrderSide("sell")}
                    className={`flex-1 py-2 text-xs font-bold transition-colors relative ${
                      orderSide === "sell"
                        ? "text-red-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sell
                    {orderSide === "sell" && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-red-500" />
                    )}
                  </button>
                  <button
                    onClick={() => toggle("order")}
                    className="px-2 py-1.5 hover:bg-accent/50 transition-colors rounded-md"
                    title="Collapse order panel"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto slim-scroll">
                  <OrderPanel side={orderSide} symbol={selectedPair} price={currentPrice} />
                </div>
              </div>
            )}
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
                {/* Mobile tab bar */}
                <div className="flex border-b border-border/20 mb-3">
                  <button
                    onClick={() => setOrderSide("buy")}
                    className={`flex-1 py-2.5 text-sm font-bold transition-colors relative ${
                      orderSide === "buy"
                        ? "text-emerald-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Buy
                    {orderSide === "buy" && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setOrderSide("sell")}
                    className={`flex-1 py-2.5 text-sm font-bold transition-colors relative ${
                      orderSide === "sell"
                        ? "text-red-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sell
                    {orderSide === "sell" && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-red-500" />
                    )}
                  </button>
                </div>
                <OrderPanel side={orderSide} symbol={selectedPair} price={currentPrice} />
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
        onDepositComplete={triggerBalanceRefresh}
      />
      <SpotWithdrawModal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        onWithdrawComplete={triggerBalanceRefresh}
      />
    </div>
  )
}
