"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  BookOpen01Icon,
  ChartCandleIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import type { OrderBookLevel, TradeResult } from "@/lib/actions"
import { getOrderBook, getTrades } from "@/lib/actions"
import type { SpotClientProps } from "./spot-types"
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
import { useOpenOrders } from "@/hooks/useOpenOrders"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { usePanelLayout } from "@/hooks/usePanelLayout"
import { useTradeSelector } from "@/components/trade-selector"
import {
  Sheet,
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
  const { orders: openOrders } = useOpenOrders()
  const [selectedPair, setSelectedPair] = React.useState(() => coins[0]?.symbol ?? "BTC")
  const [watchlist, setWatchlist] = React.useState<Set<string>>(
    new Set(["BTC", "ETH", "SOL"]),
  )

  const [showSearch, setShowSearch] = React.useState(false)
  const [showDeposit, setShowDeposit] = React.useState(false)
  const [showWithdraw, setShowWithdraw] = React.useState(false)
  const [balanceRefreshKey, setBalanceRefreshKey] = React.useState(0)
  const triggerBalanceRefresh = React.useCallback(() => setBalanceRefreshKey((k) => k + 1), [])
  const [showMarkets, setShowMarkets] = React.useState(false)
  const [mobileBookOpen, setMobileBookOpen] = React.useState(false)
  const [mobileMarketsOpen, setMobileMarketsOpen] = React.useState(false)
  const [mobileOrdersOpen, setMobileOrdersOpen] = React.useState(false)
  const [rightTab, setRightTab] = React.useState<"book" | "trades">("book")
  const [mobileBookTab, setMobileBookTab] = React.useState<"book" | "trades">("book")
  const [orderSide, setOrderSide] = React.useState<"buy" | "sell">("buy")
  const isOnboardingDone = profile?.onboardingCompleted?.includes("spot")
  const { collapsed, toggle } = usePanelLayout()
  const { openTradeSelector } = useTradeSelector()

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

  // WebSocket for real-time order book + trades
  React.useEffect(() => {
    let cancelled = false
    const hlCoin = selectedPair.toUpperCase()

    // Fetch initial data
    const fetchInitial = async () => {
      try {
        const [obRes, trRes] = await Promise.all([
          getOrderBook(`${selectedPair}USDT`, 20),
          getTrades(`${selectedPair}USDT`, 50),
        ])
        if (cancelled) return
        if (obRes.success) { setOrderBookAsks(obRes.asks); setOrderBookBids(obRes.bids) }
        if (trRes.success) setLiveTrades((p) => ({ ...p, [`${selectedPair}USDT`]: trRes.data }))
      } catch { /* ignore */ }
    }
    fetchInitial()

    // Open Hyperliquid WebSocket for l2Book + trades
    const ws = new WebSocket("wss://api.hyperliquid.xyz/ws")
    let fallbackId: ReturnType<typeof setInterval> | null = null

    ws.onopen = () => {
      ws.send(JSON.stringify({
        method: "subscribe",
        subscription: { type: "l2Book", coin: hlCoin },
      }))
      ws.send(JSON.stringify({
        method: "subscribe",
        subscription: { type: "trades", coin: hlCoin },
      }))
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (cancelled) return

        if (msg.channel === "l2Book" && msg.data?.levels) {
          const [bidsRaw, asksRaw] = msg.data.levels
          const bids = bidsRaw.slice(0, 20).map((l: { px: string; sz: string; n: number }, i: number, arr: { px: string; sz: string }[]) => {
            const price = parseFloat(l.px)
            const amount = parseFloat(l.sz)
            const total = arr.slice(0, i + 1).reduce((s: number, x: { sz: string }) => s + parseFloat(x.sz), 0)
            return { price, amount, total }
          })
          const asksSlice = asksRaw.slice(0, 20)
          const asks = asksSlice.map((l: { px: string; sz: string; n: number }, i: number, arr: { px: string; sz: string }[]) => {
            const price = parseFloat(l.px)
            const amount = parseFloat(l.sz)
            const total = arr.slice(0, i + 1).reduce((s: number, x: { sz: string }) => s + parseFloat(x.sz), 0)
            return { price, amount, total }
          })
          setOrderBookAsks(asks)
          setOrderBookBids(bids)
        }

        if (msg.channel === "trades" && Array.isArray(msg.data)) {
          const newTrades = msg.data.map((t: { px: string; sz: string; side: string; time: number; tid: number }) => ({
            price: parseFloat(t.px),
            qty: parseFloat(t.sz),
            isBuyerMaker: t.side === "B",
            time: t.time,
          }))
          if (newTrades.length > 0) {
            setLiveTrades((p) => {
              const key = `${selectedPair}USDT`
              const existing = p[key] ?? []
              return { ...p, [key]: [...newTrades, ...existing].slice(0, 50) }
            })
          }
        }
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => {
      if (cancelled) return
      // Fall back to polling if WS disconnects
      fallbackId = setInterval(async () => {
        try {
          const r = await getOrderBook(`${selectedPair}USDT`, 20)
          if (!cancelled && r.success) { setOrderBookAsks(r.asks); setOrderBookBids(r.bids) }
        } catch { /* ignore */ }
      }, 1_000)
    }

    return () => {
      cancelled = true
      ws.close()
      if (fallbackId) clearInterval(fallbackId)
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
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden">
        {/* TOP ROW: Chart + (Order Book + Buy/Sell) */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* LEFT: Chart + Open Orders (below) */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Chart */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ChartArea
                symbol={selectedPair}
                price={currentPrice}
                change24h={selectedCoin.change24h}
                onMarketsClick={() => setShowMarkets(true)}
                openOrders={openOrders}
              />
            </div>

            {/* Open Orders — bottom of chart column */}
            {collapsed.bottom ? (
              <button
                onClick={() => toggle("bottom")}
                className="shrink-0 h-6 flex items-center justify-center gap-1.5 border-t border-border/40 hover:bg-accent/30 transition-colors group"
                title="Expand orders"
              >
                <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                <span className="text-[9px] text-muted-foreground">Orders</span>
              </button>
            ) : (
              <div data-onboarding="spot-orders" className="shrink-0 h-[240px] border-t border-border/40 relative">
                <button
                  onClick={() => toggle("bottom")}
                  className="absolute top-1 right-1 z-10 rounded-md p-0.5 hover:bg-accent/50 transition-colors"
                  title="Collapse"
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                </button>
                <OpenOrdersPanel />
              </div>
            )}
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

          {/* RIGHT COLUMN — Order Book + Buy/Sell stacked */}
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
                title="Collapse"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 text-muted-foreground" />
              </button>

              {/* Order Book / Trades tabs */}
              <div className="flex items-center gap-1 border-b border-border/40 px-2 py-1.5 shrink-0">
                <button
                  onClick={() => setRightTab("book")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    rightTab === "book" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Order Book
                </button>
                <button
                  onClick={() => setRightTab("trades")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    rightTab === "trades" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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

              {/* Buy/Sell — directly below order book */}
              <div data-onboarding="spot-order" className="shrink-0 border-t border-border/40 flex flex-col overflow-hidden">
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
                </div>
                <div className="max-h-[320px] overflow-y-auto slim-scroll">
                  <OrderPanel side={orderSide} symbol={selectedPair} price={currentPrice} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MOBILE LAYOUT ═══ */}
      <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
        {/* Sticky toggle bar */}
        <div className="shrink-0 flex items-center gap-1 border-b border-border/10 bg-background/90 backdrop-blur-lg px-2 py-1.5">
          {([
            { key: "book" as const, icon: BookOpen01Icon, label: "Book" },
            { key: "markets" as const, icon: ChartCandleIcon, label: "Markets" },
            { key: "orders" as const, icon: Clock01Icon, label: "Orders" },
          ]).map((item) => (
            <button
              key={item.key}
              onClick={() => {
                if (item.key === "book") setMobileBookOpen(true)
                else if (item.key === "markets") setMobileMarketsOpen(true)
                else setMobileOrdersOpen(true)
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground bg-accent/30 transition-all active:scale-95 hover:bg-accent/50 hover:text-foreground"
            >
              <HugeiconsIcon icon={item.icon} className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={() => openTradeSelector()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-primary bg-primary/10 transition-all active:scale-95 hover:bg-primary/15"
            >
              <HugeiconsIcon icon={ChartCandleIcon} className="h-3.5 w-3.5" />
              Trading
            </button>
          </div>
        </div>

        {/* Scrollable content: chart + order panel */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Chart */}
          <div className="h-[55vh] min-h-[300px]">
            <ChartArea
              symbol={selectedPair}
              price={currentPrice}
              change24h={selectedCoin.change24h}
              openOrders={openOrders}
            />
          </div>

          {/* Inline Buy/Sell order panel */}
          <div className="bg-card">
            {/* Side toggle */}
            <div className="flex border-b border-border/10">
              <button
                onClick={() => setOrderSide("buy")}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                  orderSide === "buy"
                    ? "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setOrderSide("sell")}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                  orderSide === "sell"
                    ? "bg-red-500/10 text-red-500 dark:bg-red-500/15"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sell
              </button>
            </div>
            <OrderPanel side={orderSide} symbol={selectedPair} price={currentPrice} />
          </div>
        </div>
      </div>

      {/* ── Mobile Sheets ── */}

      {/* Order Book / Trades */}
      <Sheet open={mobileBookOpen} onOpenChange={setMobileBookOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[75vh] rounded-t-3xl border-t border-border/15 bg-background/98 backdrop-blur-2xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-foreground/10" />
          </div>
          {/* Tab bar */}
          <div className="flex items-center gap-1 mx-3 mb-2 rounded-xl bg-accent/20 p-1">
            <button
              onClick={() => setMobileBookTab("book")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                mobileBookTab === "book"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HugeiconsIcon icon={BookOpen01Icon} className="h-3.5 w-3.5" />
              Order Book
            </button>
            <button
              onClick={() => setMobileBookTab("trades")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                mobileBookTab === "trades"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5" />
              Trades
            </button>
          </div>
          <div className="h-[55vh] overflow-hidden">
            {mobileBookTab === "book" ? (
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
        </SheetContent>
      </Sheet>

      {/* Markets */}
      <Sheet open={mobileMarketsOpen} onOpenChange={setMobileMarketsOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] rounded-t-3xl border-t border-border/15 bg-background/98 backdrop-blur-2xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-foreground/10" />
          </div>
          <SheetHeader className="px-4 pt-0 pb-2">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={ChartCandleIcon} className="h-4 w-4 text-primary" />
              Markets
            </SheetTitle>
          </SheetHeader>
          <div className="h-[62vh] overflow-hidden">
            <MarketSelect
              coins={coins}
              selected={selectedPair}
              onSelect={(s) => { handlePairSelect(s); setMobileMarketsOpen(false) }}
              watchlist={watchlist}
              onToggleWatch={toggleWatch}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Open Orders */}
      <Sheet open={mobileOrdersOpen} onOpenChange={setMobileOrdersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[65vh] rounded-t-3xl border-t border-border/15 bg-background/98 backdrop-blur-2xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-foreground/10" />
          </div>
          <div className="h-[55vh] overflow-hidden">
            <OpenOrdersPanel />
          </div>
        </SheetContent>
      </Sheet>

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
