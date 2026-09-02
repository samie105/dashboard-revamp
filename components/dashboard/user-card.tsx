"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  Exchange01Icon,
  CoinsSwapIcon,
  EyeIcon,
  ChartLineData01Icon,
  ArrowUpRight01Icon,
  ArrowDownLeft01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { Balance, ChangeText, DeltaChip, Eyebrow } from "@/components/ui/system"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { NETWORKS, NETWORK_ICON } from "@/lib/networks"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { ErrorState } from "@/components/error-state"
import type { CoinData } from "@/lib/actions"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useWalletMode } from "@/components/wallet-mode-provider"
import { ModernReceiveModal } from "@/components/crypto/ModernReceiveModal"
import { useTradeAccount } from "@/hooks/useTradeAccount"
import { useAccountHistory, type AccountSpec } from "@/hooks/useAccountHistory"
import { getSpotBalances, getSpotPositions, getTokenPrices } from "@/lib/trade-adapter"
import type { LedgerBalance, PositionInfo } from "@/lib/trade-adapter"
import { fetchPrices } from "@/lib/crypto-api"
import { useCashBalance } from "@/hooks/useCashBalance"
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"

function truncAddr(addr: string) {
  if (!addr || addr.length < 14) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function getPrice(prices: Record<string, number>, symbol: string): number {
  return prices[symbol] ?? prices[symbol.toUpperCase()] ?? prices[symbol.toLowerCase()] ?? 0
}

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return "Up late"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function calculateDailyPnL(
  holdings: Record<string, number>,
  prices: Record<string, number>,
  coins: CoinData[],
): number {
  let pnl = 0
  for (const [symbol, amount] of Object.entries(holdings)) {
    const price = getPrice(prices, symbol)
    const coin = coins.find((c) => c.symbol === symbol)
    const change = coin?.change24h ?? 0
    if (price && amount) {
      const currentValue = amount * price
      const previousValue = currentValue / (1 + change / 100)
      pnl += currentValue - previousValue
    }
  }
  return pnl
}

interface WalletCardProps {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
}

/**
 * Mini area chart for the account cards — real holdings-weighted history from
 * useAccountHistory, never decorative squiggle. Color follows money direction.
 */
function Sparkline({ series, tone }: { series: number[]; tone: "up" | "down" | "flat" }) {
  const id = React.useId()
  const W = 100
  const H = 40
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const pts = series.map((v, i) => ({
    x: (i / (series.length - 1)) * W,
    y: H - 4 - ((v - min) / span) * (H - 8),
  }))
  // Catmull-Rom → cubic béziers: the 30d history reads as one drawn curve
  // instead of a jagged polyline, without inventing data between samples.
  let line = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    line +=
      ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)},${(p1.y + (p2.y - p0.y) / 6).toFixed(2)}` +
      ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)},${(p2.y - (p3.y - p1.y) / 6).toFixed(2)}` +
      ` ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  const area = `${line} L${W},${H} L0,${H} Z`
  const color = tone === "up" ? "text-credit" : tone === "down" ? "text-debit" : "text-muted-foreground/60"
  const last = pts[pts.length - 1]

  return (
    <div className={`relative w-full ${color}`} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full sm:h-12">
        <defs>
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          {/* The line's own tail fades out toward the past — "now" is the
              loud end of the stroke. */}
          <linearGradient id={`${id}-l`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="35%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id}-a)`} className="spark-fill" />
        <path
          d={line}
          fill="none"
          stroke={`url(#${id}-l)`}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          className="spark-line"
        />
      </svg>
      {/* "Now" marker — HTML, not an SVG circle: preserveAspectRatio="none"
          would stretch a circle into an ellipse. */}
      <span
        className="spark-dot absolute right-0 -translate-y-1/2 translate-x-1/2"
        style={{ top: `${(last.y / H) * 100}%` }}
      >
        <span className="block h-3 w-3 rounded-full bg-current opacity-20 motion-safe:animate-pulse" />
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
      </span>
    </div>
  )
}

// The accounts under the Total — always on screen as cards (no tab
// switching), each linking to the surface where that money actually lives.
// Cash gets no card (a USD balance draws a dead-flat line); it stays inside
// the Total and is called out in the hero's sub-label instead.
// Futures has no card while the venue is unavailable: a tile is a door, and
// this one would open onto a screen that cannot trade. Its balance still
// counts toward the Total and still feeds the 30-day history below — the
// money is real, only the destination isn't ready.

export function WalletCard({ coins, prices, error }: WalletCardProps) {
  const { user, isLoaded } = useAuth()
  const { addresses, walletsGenerated } = useWallet()
  /* `walletsGenerated` is the LEGACY (Privy) provider reporting that it
     provisioned its wallets. A modern-wallet user never gets it — there is no
     Privy wallet to provision — so gating the on-chain total on it zeroed the
     dashboard for exactly the users whose balances had loaded fine.
     `useWalletBalances` already follows the active mode; the totals below just
     have to stop asking the other wallet for permission. Summing an empty
     list is already 0, so nothing is lost by dropping the guard in modern
     mode. */
  const { mode: walletMode } = useWalletMode()
  const [receiveOpen, setReceiveOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const balancesReady = walletMode === "modern" || walletsGenerated
  const { openFlow } = useMoneyFlow()
  const { balances: onChainBalances } = useWalletBalances()
  // One /api/trade/account read serves the Spot/Futures figures AND the
  // futures positions the daily P&L needs.
  const { balances: hlAccountBalances, positions: hlPositions, futuresUsd } = useTradeAccount()
  const [isCopied, setIsCopied] = React.useState<string | null>(null)
  // null = "All networks"; a chain key surfaces that chain's address chip.
  const [selectedWallet, setSelectedWallet] = React.useState<string | null>(null)
  // Balance privacy — masks render as fixed-width dots, never a layout jump.
  // Shared + persisted: the navbar carries the cash figure on every route, so
  // one eye button has to blank both surfaces.
  const { hidden, toggle: toggleHidden } = useBalancePrivacy()

  // Live prices from the crypto service feed — the same source the hub, the
  // assets page and mobile value holdings at. The server-rendered `prices`
  // snapshot seeds first paint; this keeps valuations fresh alongside the 30s
  // balance polls instead of freezing them at render time.
  const [livePrices, setLivePrices] = React.useState<Record<string, number>>(prices)
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
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Dollar Account (worldstreet-wallet) — the Cash card. USD only; NGN is a
  // different currency and never silently folded into a USD figure.
  const { cash: cashBalance } = useCashBalance()

  // SpotV2 ledger data (same source as assets page)
  const [spotLedger, setSpotLedger] = React.useState<LedgerBalance[]>([])
  const [spotV2Positions, setSpotV2Positions] = React.useState<(PositionInfo & { currentPrice: number })[]>([])

  React.useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const [balances, positions] = await Promise.all([
          getSpotBalances(),
          getSpotPositions(),
        ])
        const tokens = positions.map((p) => p.token)
        const priceMap = tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()
        if (cancelled) return
        setSpotLedger(balances)
        setSpotV2Positions(positions.map((p) => ({ ...p, currentPrice: priceMap.get(p.token) ?? 0 })))
      } catch { /* empty state */ }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // On-chain balance: sum of all on-chain tokens valued in USD
  const onChainTotal = React.useMemo(() => {
    if (!balancesReady) return 0
    let total = 0
    for (const b of onChainBalances) {
      const p = getPrice(livePrices, b.symbol)
      total += b.balance * (p > 0 ? p : b.symbol === "USDT" || b.symbol === "USDC" ? 1 : 0)
    }
    return total
  }, [onChainBalances, livePrices, balancesReady])

  // What each chain is worth — the network strip's figures (mobile grammar:
  // the strip carries value, chains are never hidden behind a dropdown).
  const chainTotals = React.useMemo(() => {
    const m: Record<string, number> = Object.fromEntries(NETWORKS.map((n) => [n.key, 0]))
    for (const b of onChainBalances) {
      const p = getPrice(livePrices, b.symbol)
      const v = b.balance * (p > 0 ? p : b.symbol === "USDT" || b.symbol === "USDC" ? 1 : 0)
      // The feed keys by network (arbitrum is its own key even though it shares
      // the ethereum address), so this maps 1:1 onto the strip.
      if (m[b.chain] !== undefined) m[b.chain] += v
    }
    return m
  }, [onChainBalances, livePrices])

  // Spot balance = SpotV2 ledger (available + locked) + positions value (matches assets page)
  const spotBalance = React.useMemo(() => {
    const usdcTotal = spotLedger.reduce((sum, b) => sum + b.available + b.locked, 0)
    const posTotal = spotV2Positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0)
    return usdcTotal + posTotal
  }, [spotLedger, spotV2Positions])

  // Futures balance (Hyperliquid perps account value)
  const futuresBalance = futuresUsd

  // ── Today's P&L, per account ──
  // Main: on-chain holdings moved by each coin's 24h change.
  const mainPnL = React.useMemo(() => {
    if (!balancesReady) return 0
    const h: Record<string, number> = {}
    for (const b of onChainBalances) {
      h[b.symbol] = (h[b.symbol] || 0) + b.balance
    }
    return calculateDailyPnL(h, livePrices, coins)
  }, [onChainBalances, balancesReady, livePrices, coins])

  // Spot: HL spot token holdings, same 24h-change arithmetic (USDC is flat).
  const spotPnL = React.useMemo(() => {
    const h: Record<string, number> = {}
    for (const p of spotV2Positions) {
      h[p.token] = (h[p.token] || 0) + p.quantity
    }
    return calculateDailyPnL(h, livePrices, coins)
  }, [spotV2Positions, livePrices, coins])

  // Futures: the 24h mark-price move on each open position, signed (shorts
  // profit when price falls). Funding and intraday opens aren't served, so
  // this is the price-move component — real data, honestly incomplete.
  const futuresPnL = React.useMemo(() => {
    let pnl = 0
    for (const p of hlPositions) {
      const coin = coins.find((c) => c.symbol === p.symbol)
      const change = coin?.change24h ?? 0
      if (!change || !p.markPrice) continue
      const prevPrice = p.markPrice / (1 + change / 100)
      pnl += p.size * (p.markPrice - prevPrice)
    }
    return pnl
  }, [hlPositions, coins])

  // The stats tile covers every account; the Main card's chip is Main-only.
  const dailyPnL = mainPnL + spotPnL + futuresPnL

  const totalBalance = onChainTotal + spotBalance + futuresBalance + cashBalance

  // ── 30-day value history per account (holdings × real price series) ──
  const accountSpecs: AccountSpec[] = React.useMemo(() => {
    const mainHoldings: Record<string, number> = {}
    for (const b of onChainBalances) {
      mainHoldings[b.symbol] = (mainHoldings[b.symbol] || 0) + b.balance
    }
    const spotHoldings: Record<string, number> = {}
    for (const p of spotV2Positions) {
      spotHoldings[p.token] = (spotHoldings[p.token] || 0) + p.quantity
    }
    const futuresHoldings: Record<string, number> = {}
    for (const p of hlPositions) {
      futuresHoldings[p.symbol] = (futuresHoldings[p.symbol] || 0) + p.size
    }
    return [
      { key: "main", balance: onChainTotal, holdings: mainHoldings },
      { key: "spot", balance: spotBalance, holdings: spotHoldings },
      { key: "futures", balance: futuresBalance, holdings: futuresHoldings },
      { key: "cash", balance: cashBalance, holdings: {} },
    ]
  }, [onChainBalances, spotV2Positions, hlPositions, onChainTotal, spotBalance, futuresBalance, cashBalance])

  const { sparkSeries, changes: periodChanges } = useAccountHistory(accountSpecs)

  /* One curve for the whole portfolio, replacing the per-account cards.
     The accounts were shown as two tiles with a sparkline each — a lot of
     furniture for a breakdown most people read once. The total's own shape is
     the thing worth seeing, so the per-account series are summed into it.
     Accounts report different history lengths, so the sum runs to the SHORTEST:
     padding a missing account with zeros would draw a cliff on the day its
     history begins. */
  const totalSeries = React.useMemo(() => {
    const series = Object.values(sparkSeries).filter(
      (s): s is number[] => Array.isArray(s) && s.length > 1,
    )
    if (series.length === 0) return null
    const length = Math.min(...series.map((s) => s.length))
    return Array.from({ length }, (_, i) =>
      series.reduce((sum, s) => sum + s[s.length - length + i], 0),
    )
  }, [sparkSeries])

  const totalTone: "up" | "down" | "flat" = React.useMemo(() => {
    if (!totalSeries || totalSeries.length < 2) return "flat"
    const first = totalSeries[0]
    const last = totalSeries[totalSeries.length - 1]
    if (Math.abs(first) < 1e-9 || Math.abs(last - first) / Math.abs(first) < 0.00005) return "flat"
    return last > first ? "up" : "down"
  }, [totalSeries])

  const PERIODS = [
    { label: "Today", value: periodChanges.today },
    { label: "7 Days", value: periodChanges.week },
    { label: "30 Days", value: periodChanges.month },
  ]

  // Count active assets across on-chain + Hyperliquid spot
  const activeAssetCount = React.useMemo(() => {
    const onChainCount = onChainBalances.filter((b) => b.balance > 0).length
    const hlCount = (hlAccountBalances?.spotTokens ?? []).filter((t) => t.total > 0).length
    return onChainCount + hlCount
  }, [onChainBalances, hlAccountBalances])

  const handleCopy = (addr: string, chain: string) => {
    if (addr) {
      navigator.clipboard.writeText(addr)
      setIsCopied(chain)
      setTimeout(() => setIsCopied(null), 1500)
    }
  }

  if (error) return <ErrorState message={error} />

  const MASK = "$••••••"
  // All six receivable networks. Arbitrum reuses the Ethereum address, exactly
  // as the mobile registry does — 6 networks, 5 wallet keys.
  const WALLETS = NETWORKS.map((n) => ({
    key: n.key,
    label: n.label,
    addr: addresses?.[n.chain] ?? "",
    icon: NETWORK_ICON[n.key],
  }))
  // No chain selected ("All networks") → no address chip.
  const activeChain = selectedWallet ? WALLETS.find((w) => w.key === selectedWallet) : undefined

  /* Deposit and Withdraw are ONE pair and now look like it: the same arrow,
     mirrored — in and out of the wallet. They used to be an exchange glyph and
     a credit card, two unrelated pictures for two halves of one idea, and
     neither of them said "direction".

     Deposit opens in place — funding a self-custodial wallet is being shown
     its address, which is a modal's worth of content and no reason to leave
     the page. Withdraw goes to /wallet/modern: sending needs a balance to
     pick from, a chain, a destination and an unlock, and that is a screen.
     Legacy mode keeps the cash flow, which is the right one for a wallet the
     user holds no keys to. */
  type DashAction = {
    label: string
    icon: typeof Exchange01Icon
    href?: string
    onClick?: () => void
    vivid: string
    vividLabel: string
    /** One line under the label in the overflow sheet. */
    hint?: string
  }

  const PRIMARY_ACTIONS: DashAction[] = [
    { label: "Deposit", onClick: () => setReceiveOpen(true), icon: ArrowDownLeft01Icon, vivid: "open-deposit", vividLabel: "Show the wallet's deposit addresses" },
    walletMode === "modern"
      ? { label: "Withdraw", href: "/wallet/modern", icon: ArrowUpRight01Icon, vivid: "open-withdraw", vividLabel: "Go to the wallet to send funds" }
      : { label: "Withdraw", onClick: () => openFlow("sell"), icon: ArrowUpRight01Icon, vivid: "open-withdraw", vividLabel: "Open the withdraw modal" },
  ]

  const MORE_ACTIONS: DashAction[] = [
    { label: "Swap",  href: "/swap",  icon: CoinsSwapIcon,       vivid: "go-swap",  vividLabel: "Go to the swap page",           hint: "Trade one coin for another" },
    { label: "Trade", href: "/trade", icon: ChartLineData01Icon, vivid: "go-trade", vividLabel: "Go to the trading workspace",   hint: "Buy and sell on the market" },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ── Hero block — the silk field runs behind everything down to the
             action rail, exactly as the mobile HeaderBackdrop does. ── */}
      <div className="relative -mx-4 -mt-4 px-4 pt-4 pb-5 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
        {/* The silk atmosphere lives in LayoutShell (fixed, full viewport
            width, z-0) so it also runs behind the translucent sidebar —
            nothing to render here. */}

        <div className="relative flex flex-col gap-5">
          {/* Greeting — one time-aware line, no avatar (the navbar carries
              it) and no filler sentence: the balance below is the message.
              suppressHydrationWarning: server + client render minutes apart
              can straddle an hour/date boundary. */}
          <p
            data-onboarding="dash-greeting"
            suppressHydrationWarning
            className="text-sm text-muted-foreground"
          >
            <span className="font-medium text-foreground">
              {timeGreeting()}{isLoaded && user?.firstName ? `, ${user.firstName}` : ""}
            </span>
            {" · "}
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>

          {/* Balance hero — the page's thesis, straight after the greeting.
              Figure + today's P&L on the left, the portfolio's Today / 7d /
              30d moves on the right (derived from real price history). */}
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div data-onboarding="dash-balance" className="flex w-fit flex-col gap-1">
              <div className="flex items-center gap-3">
                <Eyebrow>Est. Total Value</Eyebrow>
                <button
                  onClick={toggleHidden}
                  className={`transition-colors ${hidden ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
                  aria-label={hidden ? "Show balances" : "Hide balances"}
                >
                  <HugeiconsIcon icon={EyeIcon} className="h-[18px] w-[18px]" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Balance
                  value={formatUSD(totalBalance)}
                  hidden={hidden}
                  mask={MASK}
                  className="text-[clamp(2.5rem,11.5vw,3.5rem)] sm:text-[clamp(2.75rem,5.5vw,4.5rem)]"
                />
                {dailyPnL !== 0 && !hidden && <DeltaChip value={dailyPnL} prefix="$" suffix="" />}
              </div>
              <span className="text-[13px] text-muted-foreground">
                All accounts
                {cashBalance > 0 && ` · incl. ${hidden ? "••••" : formatUSD(cashBalance)} cash`}
              </span>
            </div>

            <div className="hidden items-center divide-x divide-border/40 sm:flex">
              {PERIODS.map((p) => (
                <div key={p.label} className="flex flex-col items-end gap-1 px-5 first:pl-0 last:pr-0">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                    {p.label}
                  </span>
                  {p.value === null || hidden ? (
                    <span className="text-[13.5px] font-medium tabular-nums text-muted-foreground/50">––</span>
                  ) : (
                    <ChangeText value={p.value} className="text-[13.5px] font-semibold" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* The portfolio's own 30-day shape. One curve where two account
              cards used to be: the same information the tiles carried between
              them, at the size the number beside it deserves. */}
          {totalSeries && !hidden && (
            <div className="h-14 w-full sm:h-16">
              <Sparkline series={totalSeries} tone={totalTone} />
            </div>
          )}

          {/* Action rail — two verbs and an overflow, no sideways scroll. */}
          <div data-onboarding="dash-actions" className="flex items-stretch gap-2">
            {PRIMARY_ACTIONS.map((a) => {
              const inner = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/[0.14]">
                    <HugeiconsIcon icon={a.icon} className="h-[18px] w-[18px] text-primary" />
                  </span>
                  <span className="text-[15px] font-bold">{a.label}</span>
                </>
              )
              const cls =
                "ws-card-glass flex min-h-14 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-card/60 px-3 ring-1 ring-border/40 transition-all hover:bg-accent/70 active:scale-[0.97] motion-reduce:active:scale-100 sm:flex-none sm:px-5"
              return a.href ? (
                <Link key={a.label} href={a.href} className={cls} data-vivid-target={a.vivid} data-vivid-label={a.vividLabel}>
                  {inner}
                </Link>
              ) : (
                <button key={a.label} type="button" onClick={a.onClick} className={cls} data-vivid-target={a.vivid} data-vivid-label={a.vividLabel}>
                  {inner}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="More actions"
              data-vivid-target="dash-more-actions"
              data-vivid-label="Open the rest of the dashboard actions"
              className="ws-card-glass flex min-h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-card/60 ring-1 ring-border/40 transition-all hover:bg-accent/70 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Where the money actually sits.
              This was a single scrolling row of pills, each carrying a chain
              name and a value in 12px grey — six chains competing for one line,
              so nothing was legible and the differences between them were
              invisible. It is a grid now: every chain on screen at once, its
              value at a size worth reading, and a share bar making the split
              obvious without arithmetic. Selecting one opens its address in
              place rather than appending a chip to the end of the row. */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {WALLETS.map((w) => {
              const active = w.key === selectedWallet
              const value = chainTotals[w.key] ?? 0
              // Share of the on-chain total, which is what these chips add up
              // to — not of the portfolio, which includes accounts they don't.
              const share = onChainTotal > 0 ? (value / onChainTotal) * 100 : 0
              return (
                <button
                  key={w.key}
                  onClick={() => setSelectedWallet(active ? null : w.key)}
                  data-vivid-target={`dash-chain-${w.key}`}
                  data-vivid-label={`Show the ${w.label} address and balance`}
                  aria-pressed={active}
                  className={`ws-card-glass flex flex-col gap-2 rounded-xl px-3 py-2.5 text-left ring-1 transition-all ${
                    active
                      ? "bg-accent/70 ring-primary/30"
                      : "bg-card/50 ring-border/40 hover:bg-accent/50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <img src={w.icon} alt="" className="h-5 w-5 shrink-0 rounded-full" />
                    <span className="truncate text-[12.5px] font-medium">{w.label}</span>
                  </span>
                  <span className="text-[15px] font-semibold leading-none tabular-nums">
                    {hidden ? "••••" : formatUSD(value)}
                  </span>
                  {/* A chain holding nothing gets an empty track rather than a
                      bar of zero width pretending to be a measurement. */}
                  <span
                    aria-hidden
                    className="h-1 w-full overflow-hidden rounded-full bg-foreground/[0.06]"
                  >
                    {share > 0 && (
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.max(share, 3)}%` }}
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* The selected chain's address, in its own row so it is readable
              rather than squeezed onto the end of a scroller. */}
          {activeChain && activeChain.addr && (
            <button
              onClick={() => handleCopy(activeChain.addr, activeChain.key)}
              className="ws-card-glass flex items-center gap-2 self-start rounded-xl bg-card/60 px-3 py-2 ring-1 ring-border/40 transition-colors hover:bg-accent"
            >
              <img src={activeChain.icon} alt="" className="h-4 w-4 shrink-0 rounded-full" />
              <span className="font-mono text-[12px] text-muted-foreground">
                {truncAddr(activeChain.addr)}
              </span>
              <HugeiconsIcon
                icon={Copy01Icon}
                className={`h-3.5 w-3.5 shrink-0 ${
                  isCopied === activeChain.key ? "text-credit" : "text-muted-foreground/50"
                }`}
              />
              <span className="text-[11px] font-medium text-muted-foreground/70">
                {isCopied === activeChain.key ? "Copied" : "Copy"}
              </span>
            </button>
          )}

          <span className="text-[12px] text-muted-foreground">
            {activeAssetCount} assets · {NETWORKS.length} networks
          </span>
        </div>
      </div>

      {/* The overflow — bottom sheet on a phone, dialog on a desktop. */}
      <ResponsiveModal open={moreOpen} onOpenChange={setMoreOpen}>
        <ResponsiveModalContent className="sm:max-w-sm">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>More actions</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="flex flex-col gap-1.5">
            {MORE_ACTIONS.map((a) => (
              <Link
                key={a.label}
                href={a.href ?? "#"}
                onClick={() => setMoreOpen(false)}
                data-vivid-target={a.vivid}
                data-vivid-label={a.vividLabel}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-sunken/70 px-3.5 ring-1 ring-border/25 transition-colors hover:bg-accent/60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.12]">
                  <HugeiconsIcon icon={a.icon} className="h-5 w-5 text-primary" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-semibold">{a.label}</span>
                  {a.hint && <span className="truncate text-[12px] text-muted-foreground">{a.hint}</span>}
                </span>
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60" />
              </Link>
            ))}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Deposit's own surface — the wallet's addresses, per chain. */}
      <ModernReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} />
    </div>
  )
}
