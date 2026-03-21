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
            <SheetTitle className="text-sm">SpotV2 Balance</SheetTitle>
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

      {/* ── Mobile: stacked layout ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-1 lg:hidden">
        {/* Chart */}
        <div className="h-[300px] shrink-0">
          {selectedPair ? (
            <TradingViewChart symbol={selectedPair.symbol} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
              Select a pair
            </div>
          )}
        </div>

        {/* Order form */}
        <div className="shrink-0">
          <SpotV2OrderForm
            pair={selectedPair}
            ledgerBalances={ledgerBalances}
            positions={positions}
            balanceLoading={balanceLoading}
            onBalanceRefresh={fetchBalances}
          />
        </div>

        {/* Order book + recent trades side by side */}
        <div className="grid h-[280px] grid-cols-2 gap-1 shrink-0">
          <SpotV2OrderBook
            bids={bids}
            asks={asks}
            connected={connected}
            unavailable={unavailable}
          />
          <SpotV2RecentTrades
            trades={trades}
            connected={connected}
            unavailable={unavailable}
          />
        </div>

        {/* Bottom panel */}
        <div className="h-[200px] shrink-0">
          <SpotV2BottomPanel pairs={pairs} />
        </div>
      </div>

      {/* ── Mobile markets sheet ──────────────────────────────────────── */}
      <Sheet open={mobileMarketsOpen} onOpenChange={setMobileMarketsOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="px-3 pt-3">
            <SheetTitle className="text-sm">Markets</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100dvh-48px)]">
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
