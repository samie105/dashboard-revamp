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

// ── Spot Onboarding Steps ────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="spot-topbar"]',
    title: "Market Info",
    description: "See the current price, 24h change, volume, and market stats for the selected trading pair.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="spot-markets"]',
    title: "Markets List",
    description: "Browse and search all available spot pairs. Click any coin to switch your trading pair.",
    placement: "right",
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
    description: "Buy or sell with market or limit orders. Set your amount and review details before executing.",
    placement: "top",
  },
  {
    target: '[data-onboarding="spot-orders"]',
    title: "Open Orders",
    description: "Track your pending orders and trade history. Cancel or manage orders in real-time.",
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

      {/* ═══ DESKTOP: 3-column main + standalone bottom orders ═══ */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden p-1 gap-1">
        {/* MAIN ROW */}
        <div className="flex-1 min-h-0 flex gap-1 overflow-hidden">
          {/* LEFT — Market/Pair List */}
          {collapsed.left ? (
            <button
              onClick={() => toggle("left")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand markets"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Markets</span>
            </button>
          ) : (
            <div data-onboarding="spot-markets" className="shrink-0 w-[260px] xl:w-[300px] overflow-hidden relative">
              <button
                onClick={() => toggle("left")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse markets"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>
              <MarketSelect
                coins={coins}
                selected={selectedPair}
                onSelect={handlePairSelect}
                watchlist={watchlist}
                onToggleWatch={toggleWatch}
              />
            </div>
          )}

          {/* CENTER — Chart + Buy/Sell stacked */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChartArea
                symbol={selectedPair}
                price={currentPrice}
                change24h={selectedCoin.change24h}
              />
            </div>
            <div data-onboarding="spot-order" className="shrink-0 overflow-hidden">
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

          {/* RIGHT — Order Book / Recent Trades (tab toggle) */}
          {collapsed.right ? (
            <button
              onClick={() => toggle("right")}
              className="shrink-0 w-6 flex flex-col items-center justify-center rounded-xl bg-card border border-border/20 hover:bg-accent/50 transition-colors group"
              title="Expand order book"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] mt-1">Book</span>
            </button>
          ) : (
            <div data-onboarding="spot-orderbook" className="shrink-0 w-[260px] xl:w-[300px] flex flex-col overflow-hidden rounded-xl bg-card relative">
              <button
                onClick={() => toggle("right")}
                className="absolute top-1 right-1 z-10 rounded-md p-0.5 bg-card/80 border border-border/20 hover:bg-accent transition-colors"
                title="Collapse order book"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 text-muted-foreground" />
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
        </div>

        {/* BOTTOM ROW — Open Orders (standalone) */}
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
