"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { SpotV2ClientProps, SpotV2Pair } from "./spotv2-types"
import { PairSidebar } from "./pair-sidebar"
import { TradingViewChart } from "./tradingview-chart"
import { SpotV2OrderBook } from "./order-book"
import { SpotV2RecentTrades } from "./recent-trades"
import { SpotV2OrderForm } from "./order-form"
import { SpotV2BottomPanel } from "./bottom-panel"
import { SpotV2DepositModal } from "./spotv2-deposit-modal"
import { SpotV2WithdrawModal } from "./spotv2-withdraw-modal"
import { useMarketDataSSE } from "@/hooks/useMarketDataSSE"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import {
  getSpotV2Balance,
  getSpotV2Positions,
  type LedgerBalance,
  type PositionInfo,
} from "@/lib/spotv2/ledger-actions"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Wallet01Icon,
  Download04Icon,
  Upload04Icon,
  BookOpen01Icon,
  Clock01Icon,
  ChartCandleIcon,
} from "@hugeicons/core-free-icons"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"



// ── Top Bar ──────────────────────────────────────────────────────────────

function SpotV2TopBar({
  pair,
  onOpenMarkets,
  usdcBalance,
  balanceLoading,
  balanceError,
  onOpenDeposit,
  onOpenWithdraw,
}: {
  pair: SpotV2Pair | undefined
  onOpenMarkets: () => void
  usdcBalance: number
  balanceLoading: boolean
  balanceError: boolean
  onOpenDeposit: () => void
  onOpenWithdraw: () => void
}) {
  const [mobileInfoOpen, setMobileInfoOpen] = React.useState(false)

  if (!pair) return null

  const showBalance = !balanceLoading

  return (
    <>
      <div className="flex items-center justify-between border-b border-border/10 px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Mobile-only: opens the pair sheet */}
          <button
            onClick={onOpenMarkets}
            className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/50 lg:hidden"
          >
            {pair.image && (
              <img src={pair.image} alt={pair.name} className="h-5 w-5 rounded-full" />
            )}
            <span className="text-sm font-bold">{pair.displaySymbol}</span>
            <svg className="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Desktop: static pair info (sidebar already visible) */}
          <div className="hidden items-center gap-2 lg:flex">
            {pair.image && (
              <img src={pair.image} alt={pair.name} className="h-5 w-5 rounded-full" />
            )}
            <span className="text-sm font-bold">{pair.displaySymbol}</span>
          </div>

          <span className="text-sm font-semibold tabular-nums">
            ${pair.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
          </span>

          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              pair.change24h >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {pair.change24h >= 0 ? "+" : ""}{pair.change24h.toFixed(2)}%
          </span>

          <span className="hidden text-xs text-muted-foreground/60 sm:inline">
            MCap: ${(pair.marketCap / 1e9).toFixed(1)}B
          </span>
          <span className="hidden text-xs text-muted-foreground/60 md:inline">
            Vol: ${(pair.volume24h / 1e6).toFixed(1)}M
          </span>
        </div>

        {/* Right: balance + deposit/withdraw */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Desktop balance */}
          {showBalance && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
              <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-muted-foreground leading-none">Spot Balance</span>
                <span className={cn("text-xs font-bold tabular-nums", balanceError ? "text-red-400" : "text-foreground")}>
                  {balanceError ? "Error" : `$${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>
          )}
          {/* Desktop deposit */}
          <button
            onClick={onOpenDeposit}
            className="hidden lg:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/10"
          >
            <HugeiconsIcon icon={Download04Icon} className="h-3 w-3" />
            Deposit
          </button>
          {/* Desktop withdraw */}
          <button
            onClick={onOpenWithdraw}
            className="hidden lg:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-orange-500 transition-colors hover:bg-orange-500/10"
          >
            <HugeiconsIcon icon={Upload04Icon} className="h-3 w-3" />
            Withdraw
          </button>

          {/* Mobile: balance chip + DPT | WTH */}
          <div className="lg:hidden flex items-center gap-1.5">
            <button
              onClick={() => setMobileInfoOpen(true)}
              className="flex flex-col items-end rounded-lg px-2 py-1 transition-colors hover:bg-accent active:scale-95"
            >
              <span className="text-[9px] text-muted-foreground leading-none">Balance</span>
              <span className={cn("text-xs font-bold tabular-nums", balanceError ? "text-red-400" : "text-foreground")}>
                {balanceLoading
                  ? "···"
                  : balanceError
                  ? "Error"
                  : `$${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </button>
            <div className="flex items-stretch divide-x divide-border/40 rounded-lg border border-border/40 overflow-hidden text-[11px] font-bold">
              <button
                onClick={onOpenDeposit}
                className="px-2.5 py-1.5 text-emerald-500 transition-colors hover:bg-emerald-500/10 active:scale-95"
              >
                DPT
              </button>
              <button
                onClick={onOpenWithdraw}
                className="px-2.5 py-1.5 text-orange-500 transition-colors hover:bg-orange-500/10 active:scale-95"
              >
                WTH
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile balance sheet */}
      <Sheet open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[50vh] rounded-t-3xl border-t border-border/15 bg-background/98 backdrop-blur-2xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-foreground/10" />
          </div>
          <SheetHeader className="px-4 pb-2 pt-0">
            <SheetTitle className="text-sm">Spot Balance</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="rounded-xl bg-accent/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Spot Balance</span>
              </div>
              <p className="text-xl font-bold tabular-nums">
                ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { onOpenDeposit(); setMobileInfoOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-emerald-500 bg-emerald-500/10 transition-colors hover:bg-emerald-500/20"
              >
                <HugeiconsIcon icon={Download04Icon} className="h-4 w-4" />
                Deposit
              </button>
              <button
                onClick={() => { onOpenWithdraw(); setMobileInfoOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-orange-500 bg-orange-500/10 transition-colors hover:bg-orange-500/20"
              >
                <HugeiconsIcon icon={Upload04Icon} className="h-4 w-4" />
                Withdraw
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// ── Main Client ──────────────────────────────────────────────────────────

export function SpotV2Client({ initialPairs }: SpotV2ClientProps) {
  const [pairs, setPairs] = React.useState<SpotV2Pair[]>(initialPairs)
  const [selectedSymbol, setSelectedSymbol] = React.useState(
    () => initialPairs[0]?.symbol ?? "BTC",
  )
  const [mobileMarketsOpen, setMobileMarketsOpen] = React.useState(false)
  const [mobileBookOpen, setMobileBookOpen] = React.useState(false)
  const [mobileOrdersOpen, setMobileOrdersOpen] = React.useState(false)
  const [mobileBookTab, setMobileBookTab] = React.useState<"book" | "trades">("book")

  // Lifted balance state
  const { isSignedIn } = useAuth()
  const { walletsGenerated } = useWallet()
  const [ledgerBalances, setLedgerBalances] = React.useState<LedgerBalance[]>([])
  const [positions, setPositions] = React.useState<PositionInfo[]>([])
  const [balanceLoading, setBalanceLoading] = React.useState(false)
  const [balanceError, setBalanceError] = React.useState(false)

  // Lifted deposit/withdraw modal state
  const [depositOpen, setDepositOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)

  const selectedPair = React.useMemo(
    () => pairs.find((p: SpotV2Pair) => p.symbol === selectedSymbol),
    [pairs, selectedSymbol],
  )

  // Market data via SSE proxy (order book + recent trades)
  const { bids, asks, trades, connected, unavailable } =
    useMarketDataSSE(selectedSymbol)

  // ── Fetch ledger balance ─────────────────────────────────────────────
  const fetchBalances = React.useCallback(async () => {
    if (!isSignedIn) return
    setBalanceLoading(true)
    try {
      const [bal, pos] = await Promise.all([
        getSpotV2Balance(),
        getSpotV2Positions(),
      ])
      setLedgerBalances(bal)
      setPositions(pos)
      setBalanceError(false)
    } catch {
      setBalanceError(true)
    } finally {
      setBalanceLoading(false)
    }
  }, [isSignedIn])

  React.useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  const usdcBalance = React.useMemo(() => {
    const entry = ledgerBalances.find((b) => b.token === "USDC")
    return entry?.available ?? 0
  }, [ledgerBalances])

  // Refresh prices every 60 seconds
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/spotv2/pairs")
        const data = await res.json()
        if (data.success && Array.isArray(data.pairs)) {
          setPairs(data.pairs)
        }
      } catch {
        // Silently use stale data
      }
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  const handleSelectPair = React.useCallback((symbol: string) => {
    setSelectedSymbol(symbol)
    setMobileMarketsOpen(false)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      <SpotV2TopBar
        pair={selectedPair}
        onOpenMarkets={() => setMobileMarketsOpen(true)}
        usdcBalance={usdcBalance}
        balanceLoading={balanceLoading}
        balanceError={balanceError}
        onOpenDeposit={() => setDepositOpen(true)}
        onOpenWithdraw={() => setWithdrawOpen(true)}
      />

      {/* ── Desktop: flex-based CEX layout ────────────────────────────── */}
      <div className="hidden flex-1 min-h-0 overflow-hidden lg:flex">
        {/* Left: Pair sidebar — fixed 220px */}
        <div className="shrink-0 w-[220px] overflow-hidden">
          <PairSidebar
            pairs={pairs}
            selectedPair={selectedSymbol}
            onSelect={handleSelectPair}
          />
        </div>

        {/* Center column — fills remaining space */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Chart — takes 60% of center */}
          <div className="flex-3 min-h-0 overflow-hidden">
            {selectedPair ? (
              <TradingViewChart symbol={selectedPair.symbol} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
                Select a pair
              </div>
            )}
          </div>
          {/* Recent trades — 20% */}
          <div className="flex-1 min-h-0 border-t border-border/10 overflow-hidden">
            <SpotV2RecentTrades
              trades={trades}
              connected={connected}
              unavailable={unavailable}
            />
          </div>
          {/* Bottom panel — 20% */}
          <div className="flex-1 min-h-0 border-t border-border/10 overflow-hidden">
            <SpotV2BottomPanel pairs={pairs} />
          </div>
        </div>

        {/* Right column — fixed 280px, Order Book + Buy/Sell */}
        <div className="shrink-0 w-[280px] xl:w-[320px] flex flex-col overflow-hidden border-l border-border/10">
          {/* Order book — top half */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <SpotV2OrderBook
              bids={bids}
              asks={asks}
              connected={connected}
              unavailable={unavailable}
            />
          </div>
          {/* Buy/Sell form — bottom half */}
          <div className="flex-1 min-h-0 border-t border-border/10 overflow-hidden">
            <SpotV2OrderForm
              pair={selectedPair}
              ledgerBalances={ledgerBalances}
              positions={positions}
              balanceLoading={balanceLoading}
              onBalanceRefresh={fetchBalances}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile: SpotV1-style responsive layout ───────────────────── */}
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
        </div>

        {/* Scrollable content: chart + order form */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-20">
          {/* Chart — viewport-relative height */}
          <div className="h-[55vh] min-h-[300px]">
            {selectedPair ? (
              <TradingViewChart symbol={selectedPair.symbol} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
                Select a pair
              </div>
            )}
          </div>

          {/* Inline Buy/Sell order form */}
          <div className="bg-card">
            <SpotV2OrderForm
              pair={selectedPair}
              ledgerBalances={ledgerBalances}
              positions={positions}
              balanceLoading={balanceLoading}
              onBalanceRefresh={fetchBalances}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile Sheets ─────────────────────────────────────────────── */}

      {/* Order Book / Recent Trades sheet */}
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
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
                mobileBookTab === "book"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <HugeiconsIcon icon={BookOpen01Icon} className="h-3.5 w-3.5" />
              Order Book
            </button>
            <button
              onClick={() => setMobileBookTab("trades")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
                mobileBookTab === "trades"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5" />
              Trades
            </button>
          </div>
          <div className="h-[55vh] overflow-hidden">
            {mobileBookTab === "book" ? (
              <SpotV2OrderBook
                bids={bids}
                asks={asks}
                connected={connected}
                unavailable={unavailable}
              />
            ) : (
              <SpotV2RecentTrades
                trades={trades}
                connected={connected}
                unavailable={unavailable}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Orders / Positions sheet */}
      <Sheet open={mobileOrdersOpen} onOpenChange={setMobileOrdersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[65vh] rounded-t-3xl border-t border-border/15 bg-background/98 backdrop-blur-2xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-foreground/10" />
          </div>
          <SheetHeader className="px-4 pb-2 pt-0">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={Clock01Icon} className="h-4 w-4 text-primary" />
              Positions & Orders
            </SheetTitle>
          </SheetHeader>
          <div className="h-[55vh] overflow-hidden">
            <SpotV2BottomPanel pairs={pairs} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Mobile markets sheet ──────────────────────────────────────── */}
      <Sheet open={mobileMarketsOpen} onOpenChange={setMobileMarketsOpen}>
        <SheetContent
          side="left"
          className="flex flex-col h-full w-[min(88vw,360px)] max-w-[88vw] border-r border-border/15 bg-background/98 backdrop-blur-2xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          <SheetHeader className="px-4 pt-4 pb-2 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={ChartCandleIcon} className="h-4 w-4 text-primary" />
              Markets
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PairSidebar
              pairs={pairs}
              selectedPair={selectedSymbol}
              onSelect={handleSelectPair}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Deposit / Withdraw modals */}
      <SpotV2DepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        onDepositComplete={fetchBalances}
      />
      <SpotV2WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        usdcBalance={usdcBalance}
        onWithdrawComplete={fetchBalances}
      />
    </div>
  )
}
