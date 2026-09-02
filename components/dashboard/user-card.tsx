"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  Exchange01Icon,
  CreditCardIcon,
  CoinsSwapIcon,
  Clock01Icon,
  DollarCircleIcon,
  EyeIcon,
  HelpCircleIcon,
  Wallet01Icon,
  Chart01Icon,
  ChartLineData01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  MoreHorizontalIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { Balance, ChangeText, DeltaChip, Eyebrow, Skel } from "@/components/ui/system"
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
import { openWelcomeGuide } from "@/components/welcome-guide"
import { FUTURES_CLOSED } from "@/lib/venues"

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

/* The Total's breakdown — every account that is IN the figure above it.
   It used to be two cards, "Main / On-chain balance" and "Spot / Spot
   trading": three pieces of jargon, and a pair that left out the money making
   up the difference. The screen said $14,688 over cards adding to $9,273, and
   a newcomer had no way to find the rest. Cash was held back because a dollar
   balance draws a dead-flat sparkline — a chart's problem, solved here by
   letting a row exist without one.
   Each label says what the money is FOR, not which system holds it. */
const ACCOUNTS = [
  { key: "cash", label: "Cash", icon: DollarCircleIcon, sub: "Dollars ready to spend", href: "/fund" },
  { key: "main", label: "Crypto wallet", icon: Wallet01Icon, sub: "Coins only you can move", href: "/wallet/modern" },
  { key: "spot", label: "Trading", icon: Chart01Icon, sub: "Ready to buy and sell", href: "/trade" },
] as const

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* Futures' 24h P&L used to be summed in here. It went with the balance
     below: the venue is closed, so counting its movement in "today" put a
     number on the hero that nothing on any screen accounts for. */
  const dailyPnL = mainPnL + spotPnL

  /* Futures is excluded while the venue is closed, exactly as /portfolio
     excludes it. Both pages read one constant now: they were quietly
     disagreeing about the same user's net worth, and the dashboard was the
     one counting money you could not open a screen to see. */
  const totalBalance =
    cashBalance + onChainTotal + spotBalance + (FUTURES_CLOSED ? 0 : futuresBalance)

  const accountBalances: Record<"cash" | "main" | "spot" | "futures", number> = {
    cash: cashBalance,
    main: onChainTotal,
    spot: spotBalance,
    futures: futuresBalance,
  }

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

  /* Deposit opens in place — funding a self-custodial wallet is being shown
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
    walletMode === "modern"
      ? { label: "Deposit", onClick: () => setReceiveOpen(true), icon: Exchange01Icon, vivid: "open-deposit", vividLabel: "Show the wallet's deposit addresses" }
      : { label: "Deposit", onClick: () => openFlow("buy"), icon: Exchange01Icon, vivid: "open-deposit", vividLabel: "Open the deposit modal" },
    walletMode === "modern"
      ? { label: "Withdraw", href: "/wallet/modern", icon: CreditCardIcon, vivid: "open-withdraw", vividLabel: "Go to the wallet to send funds" }
      : { label: "Withdraw", onClick: () => openFlow("sell"), icon: CreditCardIcon, vivid: "open-withdraw", vividLabel: "Open the withdraw modal" },
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
                <Eyebrow>Total balance</Eyebrow>
                <button
                  onClick={toggleHidden}
                  className={`transition-colors ${hidden ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
                  aria-label={hidden ? "Show balances" : "Hide balances"}
                >
                  <HugeiconsIcon icon={EyeIcon} className="h-[18px] w-[18px]" />
                </button>
                {/* The guide, reachable. It used to appear unbidden exactly
                    once, which meant most people met it while busy with
                    something else and could never get it back. Here it sits
                    beside the number they came to the page not understanding. */}
                <button
                  type="button"
                  onClick={openWelcomeGuide}
                  data-vivid-target="open-welcome-guide"
                  data-vivid-label="Open the guide to Worldstreet"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-card/70 px-2.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/40 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <HugeiconsIcon icon={HelpCircleIcon} className="h-3.5 w-3.5" />
                  How this works
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
              {/* Says what the number IS, and points at the answer. It used
                  to read "All accounts · incl. $1,250.75 cash" — a meta string
                  naming one part of a sum whose other parts were nowhere on
                  screen, which is the confusion rather than the cure. */}
              <span className="text-[12.5px] text-muted-foreground">
                Everything below, added up
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

          {/* The breakdown, as a ledger rather than a row of cards.

              Cards were the problem on a phone: each one stacked to roughly
              150px of mostly-empty space, so two accounts filled the screen
              and a third would never have fitted — which is part of why cash
              and futures were left out of a sum they belong to. A ledger fits
              all three above the fold, puts every label beside its figure,
              and lets a row exist without a chart. The gold gradient ring went
              with them: gold means brand, primary action or active state, and
              three identical gold-ringed tiles meant none of those.

              One layout at every width. The sparkline is the only thing that
              waits for room — it appears at md, where there is space for it
              between the label and the figure. */}
          <div
            data-onboarding="dash-balance-cards"
            className="ws-card-glass divide-y divide-border/25 overflow-hidden rounded-2xl bg-card/70 ring-1 ring-border/30"
          >
            {ACCOUNTS.map((a) => {
              const series = sparkSeries[a.key]
              const first = series?.[0] ?? 0
              const cardChange =
                series && Math.abs(first) > 1e-9
                  ? ((series[series.length - 1] - first) / Math.abs(first)) * 100
                  : null
              const tone: "up" | "down" | "flat" =
                cardChange === null || Math.abs(cardChange) < 0.005
                  ? "flat"
                  : cardChange > 0
                    ? "up"
                    : "down"
              /* Cash is a dollar balance and an empty account has no history:
                 both draw a dead-flat line with a pulsing dot on the end, which
                 reads as a stray artifact rather than as "nothing happened".
                 A row is allowed to have no chart. */
              const flat =
                !series || series.length < 2 || Math.max(...series) === Math.min(...series)
              const showSpark = a.key !== "cash" && !flat
              const href =
                a.key === "main" && walletMode !== "modern" ? "/wallet" : a.href
              return (
                <Link
                  key={a.key}
                  href={href}
                  data-vivid-target={`balance-view-${a.key}`}
                  data-vivid-label={`Open the ${a.label} account`}
                  className="group flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-accent/40 active:bg-accent/60 sm:px-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] transition-colors group-hover:bg-primary/[0.12]">
                    <HugeiconsIcon
                      icon={a.icon}
                      className="h-[18px] w-[18px] text-muted-foreground transition-colors group-hover:text-primary"
                    />
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[13.5px] font-semibold leading-none">{a.label}</span>
                    <span className="truncate text-[11.5px] leading-none text-muted-foreground">
                      {a.sub}
                    </span>
                  </span>

                  {showSpark ? (
                    <span className="hidden w-28 shrink-0 md:block">
                      <Sparkline series={series} tone={tone} />
                    </span>
                  ) : null}

                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[15px] font-semibold leading-none tabular-nums tracking-tight">
                      {hidden ? "••••" : formatUSD(accountBalances[a.key])}
                    </span>
                    {cardChange !== null && tone !== "flat" && !hidden ? (
                      <ChangeText value={cardChange} className="text-[11px] leading-none" />
                    ) : (
                      /* The period label belongs to the sparkline, and the
                         sparkline waits for md. On a phone it was a "30d"
                         under a figure with nothing to compare it to. */
                      <span className="hidden text-[11px] leading-none text-muted-foreground/50 md:inline">
                        {showSpark && !hidden ? "30d" : ""}
                      </span>
                    )}
                  </span>

                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
                  />
                </Link>
              )
            })}
          </div>

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

          {/* Network footer — the receive surface, demoted under the actions.
              One box per chain and all six on screen at once (three across
              on a phone, six across on a desktop): nothing to swipe, nothing
              hidden off the edge. Each box carries that chain's value; tap
              one to surface its deposit address underneath, tap again to put
              it away. Arbitrum reuses the Ethereum address, as the registry
              says. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>Networks</Eyebrow>
              <span className="hidden text-[12px] tabular-nums text-muted-foreground lg:block">
                {activeAssetCount} assets · {NETWORKS.length} networks
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
              {WALLETS.map((w) => {
                const active = w.key === selectedWallet
                const value = hidden ? "••••" : formatUSD(chainTotals[w.key] ?? 0)
                return (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => setSelectedWallet(active ? null : w.key)}
                    aria-pressed={active}
                    aria-label={`${w.label}, ${hidden ? "balance hidden" : value}`}
                    className={`ws-card-glass flex min-h-14 min-w-0 flex-col items-start justify-between gap-1.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-all duration-150 active:scale-[0.97] motion-reduce:active:scale-100 ${
                      active ? "bg-accent ring-border/70" : "bg-card/60 ring-border/40 hover:bg-accent/60"
                    }`}
                  >
                    <span className="flex w-full min-w-0 items-center gap-1.5">
                      <img src={w.icon} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full" />
                      <span className="truncate text-[12.5px] font-semibold leading-tight">{w.label}</span>
                    </span>
                    <span className={`text-[13px] leading-none tabular-nums ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {value}
                    </span>
                  </button>
                )
              })}
            </div>
            {activeChain && (
              <div className="ws-card-glass flex min-h-11 items-center gap-3 rounded-xl bg-card/60 px-3.5 py-2 ring-1 ring-border/40 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
                {activeChain.addr ? (
                  <>
                    <span className="shrink-0 text-[12px] text-muted-foreground">{activeChain.label} address</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={activeChain.addr}>
                      <span className="md:hidden">{truncAddr(activeChain.addr)}</span>
                      <span className="hidden md:inline">{activeChain.addr}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeChain.addr, activeChain.key)}
                      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors ${
                        isCopied === activeChain.key
                          ? "bg-credit-chip text-credit"
                          : "bg-foreground/[0.06] hover:bg-foreground/[0.1]"
                      }`}
                    >
                      <HugeiconsIcon icon={isCopied === activeChain.key ? Tick02Icon : Copy01Icon} className="h-3.5 w-3.5" />
                      {isCopied === activeChain.key ? "Copied" : "Copy"}
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-muted-foreground">No {activeChain.label} address yet</span>
                )}
              </div>
            )}
          </div>
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
