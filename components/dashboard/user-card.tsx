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
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useTradeAccount } from "@/hooks/useTradeAccount"
import { useAccountHistory, type AccountSpec } from "@/hooks/useAccountHistory"
import { getSpotBalances, getSpotPositions, getTokenPrices } from "@/lib/trade-adapter"
import type { LedgerBalance, PositionInfo } from "@/lib/trade-adapter"
import { fetchPrices } from "@/lib/crypto-api"
import { useCashBalance } from "@/hooks/useCashBalance"
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"
import { openWelcomeGuide } from "@/components/welcome-guide"
import { FUTURES_CLOSED } from "@/lib/venues"
import {
  ACCOUNT_KEYS,
  cryptoTotal,
  dashboardCards,
  type AccountKey,
  type AccountSignal,
} from "@/lib/dashboard-cards"

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

/* The Total's breakdown — the three things a crypto balance is made of, in
   the owner's own words: what you HOLD, what you have moved into SPOT, and
   what is in FUTURES.

   The labels are the platform's labels. An earlier pass renamed Spot to
   "Trading" to sound friendlier; that is reverted, because every other screen
   in the ecosystem still says spot and futures and a dashboard that alone
   calls them something else is a translation problem, not a simplification.
   Plain language still governs the line underneath, which is where the
   explaining actually belongs.

   Cash is gone from here entirely. Dollars live in the Dollar Account — a
   separate product with its own dashboard — and a cash card sitting on the
   crypto screen is precisely what had people arriving expecting to deposit
   money into a wallet. The figure did not disappear with the card: it is a
   quiet line under the hero now (see below), out of the total and out of the
   way.

   WHICH of these render is `dashboardCards`' decision, not this table's. */
const ACCOUNTS: Record<
  AccountKey,
  { label: string; icon: typeof Wallet01Icon; sub: string; href: string }
> = {
  holdings: { label: "Holdings", icon: Wallet01Icon, sub: "Coins only you can move", href: "/wallet/modern" },
  spot: { label: "Spot", icon: Chart01Icon, sub: "Money you moved over to buy and sell with", href: "/trade" },
  futures: { label: "Futures", icon: ChartLineData01Icon, sub: "Your futures trading account", href: "/trade" },
}

/* The row is as wide as it has cards. Now that cards are earned one at a
   time, the common case is one or two of them — and a lone card sitting in a
   third of the row with two empty columns beside it reads as two cards that
   failed to load, which is the exact opposite of what earning a card is meant
   to say. Literal class names, because Tailwind cannot see an interpolated
   one. */
const CARD_GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
}

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
  const [moreOpen, setMoreOpen] = React.useState(false)
  const balancesReady = walletMode === "modern" || walletsGenerated
  const { openDoor } = useMoneyFlow()
  const { balances: onChainBalances, isLoading: onChainLoading } = useWalletBalances()
  // One /api/trade/account read serves the Spot/Futures figures AND the
  // futures positions the daily P&L needs.
  const {
    balances: hlAccountBalances,
    positions: hlPositions,
    futuresUsd,
    isLoading: tradeAccountLoading,
  } = useTradeAccount()
  /* Does this person have a wallet at all? Only the Networks strip asks, and
     only `needsSetup` can answer it: it is a CONFIRMED 404 from the backend,
     so it cannot be true while the lookup is still in flight — a wallet that
     exists never flashes "set up your wallet" on its way in. The query is
     shared with the wallet page through its react-query key, so this costs
     no extra request. */
  const walletState = useCryptoWalletState()
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

  /* Dollar Account (worldstreet-wallet). It is NOT part of the crypto total
     any more — that is a different product — but it is still the balance a
     phone user has no other way to see, so the hero carries it as a quiet
     second line. `loaded` is what keeps a placeholder zero from being read as
     a real one. USD only; NGN is a different currency and never silently
     folded into a USD figure. */
  const { cash: cashBalance, loaded: cashLoaded } = useCashBalance()

  // SpotV2 ledger data (same source as assets page)
  const [spotLedger, setSpotLedger] = React.useState<LedgerBalance[]>([])
  const [spotV2Positions, setSpotV2Positions] = React.useState<(PositionInfo & { currentPrice: number })[]>([])
  /* Whether the read above has come BACK, which the data alone cannot say —
     an empty ledger and an unasked question look identical. The Spot card is
     withheld until this flips, so a brand-new user is never shown a $0.00
     that is really a request in flight. */
  const [spotLoaded, setSpotLoaded] = React.useState(false)

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
      } catch { /* empty state */ } finally {
        /* A failed read still counts as answered. It is not the truth, but
           the alternative is that one sulking service pins the whole
           breakdown on skeletons forever — and "we could not reach spot"
           looks the same to the user as "you have not used spot yet". */
        if (!cancelled) setSpotLoaded(true)
      }
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

  const futuresOpen = !FUTURES_CLOSED

  /* Holdings + Spot + Futures, and nothing else. The arithmetic lives in
     `lib/dashboard-cards` so it can be asserted without mounting React, and
     so the dashboard and /portfolio cannot drift apart again.

     Two things are deliberately absent. Futures, because the venue is closed
     and the larger figure counted money nobody could open a screen to reach.
     And cash: the hero is the CRYPTO balance now, so folding a dollar
     balance into it was quietly answering "what are my coins worth?" with a
     number that included money that is not coins. */
  const totalBalance = cryptoTotal({
    holdings: onChainTotal,
    spot: spotBalance,
    futures: futuresBalance,
    futuresOpen,
  })

  const accountBalances: Record<AccountKey, number> = {
    holdings: onChainTotal,
    spot: spotBalance,
    futures: futuresBalance,
  }

  /* Which cards are allowed to exist. `used` is read GENEROUSLY — the
     question is "has this person used this account", not "is it above zero
     right this second", because a trader who happens to be flat today should
     get their cards, not the new-user invitation. `settled` is the other
     half: it says an answer actually arrived, so a card is never withheld on
     the strength of a placeholder zero. */
  const accountSignals: Record<AccountKey, AccountSignal> = {
    holdings: {
      open: true,
      /* `balancesReady` is a constant true in modern mode; in legacy mode it
         is the Privy provisioning flag, and until it flips `onChainTotal` is
         pinned to 0 above — so the figure is not an answer yet either. */
      settled: balancesReady && !onChainLoading,
      used: onChainBalances.length > 0 || onChainTotal > 0,
    },
    spot: {
      open: true,
      /* A signed-out visitor's ledger never loads because it is never asked
         for. That is still a settled answer, and it is "nothing". */
      settled: spotLoaded || (isLoaded && !user),
      used: spotLedger.length > 0 || spotV2Positions.length > 0 || spotBalance > 0,
    },
    futures: {
      open: futuresOpen,
      settled: !tradeAccountLoading,
      used: futuresBalance > 0 || hlPositions.length > 0,
    },
  }
  const cards = dashboardCards(accountSignals)
  // How many skeletons the loading state owes: one per account that could
  // still turn up, which is two while futures is shut and three when it opens.
  const openAccountCount = ACCOUNT_KEYS.filter((key) => accountSignals[key].open).length

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
    /* Exactly the money in `totalBalance`, because these curves are what the
       Today / 7d / 30d figures beside the hero are computed from — a spec
       list that disagrees with the total would have the percentages
       describing a different pile of money than the number above them. So
       cash is gone with its card, and a closed futures venue contributes the
       zero it contributes to the sum. */
    return [
      { key: "holdings", balance: onChainTotal, holdings: mainHoldings },
      { key: "spot", balance: spotBalance, holdings: spotHoldings },
      {
        key: "futures",
        balance: futuresOpen ? futuresBalance : 0,
        holdings: futuresOpen ? futuresHoldings : {},
      },
    ]
  }, [onChainBalances, spotV2Positions, hlPositions, onChainTotal, spotBalance, futuresBalance, futuresOpen])

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
  /* Six tiles reading $0.00 over addresses that do not exist is what someone
     with no wallet at all used to be shown — a dead grid where the next step
     should be. `needsSetup` is a confirmed 404 and so cannot be true mid-flight,
     which is the whole point: a wallet that exists must never flash "set up
     your wallet" on its way in.
     Scoped to modern mode because that is the only mode this answer is about
     and the only mode the CTA's destination serves — a legacy-wallet user gets
     their addresses from Privy and would be sent to the wrong screen. */
  const needsWalletSetup = walletMode === "modern" && walletState.needsSetup

  /* Both verbs open the same question first: where is the money coming from,
     or where is it going. That used to be decided FOR the user by whichever
     wallet mode they happened to be in — modern Deposit went straight to a
     list of addresses, legacy Deposit opened the cash flow, and Withdraw was
     a link to a whole other page — so the button meant a different thing to
     two people looking at the same screen. The chooser owns that branch now,
     which is why the `walletMode` conditional is gone from this pair. */
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
    { label: "Deposit", onClick: () => openDoor("deposit"), icon: Exchange01Icon, vivid: "open-deposit", vividLabel: "Ask where the money is coming from, then deposit" },
    /* Withdraw no longer asks a question. Cash withdrawals are shut until
       there is a treasury to settle them (CASH_WITHDRAWALS_CLOSED in
       money-doors.tsx), which leaves exactly one way out, and a chooser with
       one option is a dead click — so this walks straight to the send screen.
       The label has to say what actually happens, because Vivid reads it to
       decide what pressing this does. It goes back to asking on its own when
       that constant flips. */
    { label: "Withdraw", onClick: () => openDoor("withdraw"), icon: CreditCardIcon, vivid: "open-withdraw", vividLabel: "Send crypto out of your wallet" },
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
              {/* flex-wrap is load-bearing now that the label is three words.
                  "TOTAL CRYPTO BALANCE" at 12px with 0.08em tracking, plus the
                  eye and the guide pill, runs past the content box below about
                  360px — which is a real phone, not an edge case. Wrapping puts
                  the pill on its own line there instead of squeezing it. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {/* Not just "Total balance". There are two balances in a
                    Worldstreet user's life and they belong to different
                    products: this one, which is Holdings + Spot + Futures, and
                    the Dollar Account's cash — which now sits directly
                    underneath it. Naming this one "crypto" is what lets the
                    two be told apart at a glance, and it is the same fix as
                    renaming the app itself: the confusion was never that
                    people could not read the number, it was that they could
                    not tell which money it counted. */}
                <Eyebrow>Total crypto balance</Eyebrow>
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
                {/* font-medium overrides Balance own font-light. The house hero
                   weight is Poppins Light 300 (design-system/02) and still is
                   everywhere else; owner call on 2026-09-03 that the dashboard
                   total specifically wants weight behind it — 600 read too
                   heavy, so 500. Poppins Medium is loaded in app/layout.tsx
                   FOR THIS: drop the weight there and 500 gets synthesised. */}
                <Balance
                  value={formatUSD(totalBalance)}
                  hidden={hidden}
                  mask={MASK}
                  className="font-medium text-[clamp(2.5rem,11.5vw,3.5rem)] sm:text-[clamp(2.75rem,5.5vw,4.5rem)]"
                />
                {dailyPnL !== 0 && !hidden && <DeltaChip value={dailyPnL} prefix="$" suffix="" />}
              </div>
              {/* The Dollar Account, which is the one balance with nowhere
                  else to be on a phone — the navbar that carries it is a
                  desktop surface, and the cash card is gone from below.
                  It replaced a line reading "Everything below, added up",
                  which described the layout rather than telling anyone
                  anything they did not already have eyes for.
                  Deliberately subordinate, and deliberately outside the
                  figure above it: this money is a different product, and the
                  point of the line is to say so while still letting someone
                  find their dollars. `loaded` holds the figure back so a real
                  $0.00 is never confused with a request in flight. */}
              <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <HugeiconsIcon icon={DollarCircleIcon} className="h-[15px] w-[15px] text-muted-foreground/70" />
                Dollar Account
                <span className="font-medium tabular-nums text-foreground/80">
                  {hidden ? MASK : cashLoaded ? formatUSD(cashBalance) : "––"}
                </span>
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

          {/* Account cards — the Total's breakdown, every figure on screen at
              once instead of hidden behind tabs. Each card is a door to the
              surface where that money actually lives.

              A card is EARNED, not permanent. Someone who signed up a minute
              ago holds nothing and has traded nothing, and three cards reading
              $0.00 do not inform them — they say the product is empty and
              that they are already behind. So the row has three states
              (`dashboardCards`): skeletons while the accounts are still
              answering, one invitation when every answer came back empty, and
              the earned cards once there is something true to put in them.
              The dashboard fills in as the platform gets used.

              `data-onboarding` stays on the wrapper in ALL THREE — the
              coachmark tour skips a step whose target is missing, and the
              step about the accounts is the one a brand-new user, i.e. exactly
              the person seeing the invitation, most needs. */}
          {cards.status === "empty" ? (
            <div data-onboarding="dash-balance-cards">
              <div className="ws-card-glass relative flex flex-col gap-3.5 rounded-2xl bg-card/70 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                {/* Same masked gold stroke as the cards it stands in for, so
                    the empty state reads as the row rather than as an error
                    that replaced it. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl p-px opacity-80"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--primary) 55%, transparent), color-mix(in oklab, var(--primary) 14%, transparent) 38%, transparent 68%)",
                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    maskComposite: "exclude",
                  }}
                />
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/[0.12]">
                  <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5 text-primary" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-semibold">Your accounts will show up here</span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">
                    Buy your first coin, or have someone send you one. It lands in your holdings
                    and this is where you will see what it is worth.
                  </span>
                </div>
                <Link
                  href="/buy"
                  data-vivid-target="start-first-buy"
                  data-vivid-label="Buy a first coin to get started"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97] motion-reduce:active:scale-100 sm:ml-auto"
                >
                  Buy a coin
                  <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : cards.status === "loading" ? (
            <div
              data-onboarding="dash-balance-cards"
              role="status"
              aria-busy="true"
              aria-label="Loading your accounts"
              className={`grid grid-cols-1 gap-2.5 ${CARD_GRID_COLS[openAccountCount] ?? "sm:grid-cols-3"}`}
            >
              {/* Card-shaped, not a generic bar: the row is about to be cards,
                  and a skeleton that is the wrong shape re-lays-out the page
                  the moment the real answer lands. */}
              {Array.from({ length: openAccountCount }, (_, i) => (
                <div
                  key={i}
                  className="ws-card-glass flex min-w-0 flex-col gap-2 rounded-2xl bg-card/70 p-3.5 pb-3 sm:gap-3 sm:p-4 sm:pb-3.5"
                >
                  <div className="flex items-center gap-2">
                    <Skel className="h-7 w-7 rounded-lg" />
                    <Skel className="h-3 w-20" />
                  </div>
                  <Skel className="h-[22px] w-28" />
                  <Skel className="h-8 w-full sm:h-12" />
                  <Skel className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : (
          <div
            data-onboarding="dash-balance-cards"
            className={`grid grid-cols-1 gap-2.5 ${CARD_GRID_COLS[cards.accounts.length] ?? "sm:grid-cols-3"}`}
          >
            {cards.accounts.map((accountKey) => {
              const a = ACCOUNTS[accountKey]
              const series = sparkSeries[accountKey]
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
              /* An account with no movement to plot draws a dead-flat line
                 with a pulsing dot on the end, which reads as a stray artifact
                 rather than as "nothing happened". Those cards keep their
                 height and skip the chart. (The cash exemption that used to
                 live on this line went with the cash card.) */
              const flat =
                !series || series.length < 2 || Math.max(...series) === Math.min(...series)
              const showSpark = !flat
              /* Holdings is the wallet, and which wallet that is depends on
                 the mode the user is in. */
              const href =
                accountKey === "holdings" && walletMode !== "modern" ? "/wallet" : a.href
              return (
                <Link
                  key={accountKey}
                  href={href}
                  data-vivid-target={`balance-view-${accountKey}`}
                  data-vivid-label={`Open the ${a.label} account`}
                  className="ws-card-glass group relative flex min-w-0 flex-col gap-2 rounded-2xl bg-card/70 p-3.5 pb-3 sm:gap-3 sm:p-4 sm:pb-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/60 hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.5)] motion-reduce:hover:translate-y-0"
                >
                  {/* Gradient stroke — brand gold dissolving diagonally to
                      nothing. Masked ring (padding-box XOR) instead of a
                      border-image so the translucent fill keeps showing the
                      silk through the card. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl p-px opacity-80 transition-opacity group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(135deg, color-mix(in oklab, var(--primary) 55%, transparent), color-mix(in oklab, var(--primary) 14%, transparent) 38%, transparent 68%)",
                      WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      maskComposite: "exclude",
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05]">
                      <HugeiconsIcon icon={a.icon} className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <Eyebrow>{a.label}</Eyebrow>
                    <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <span className="text-[22px] font-semibold leading-none tabular-nums tracking-tight">
                    {hidden ? "••••" : formatUSD(accountBalances[accountKey])}
                  </span>
                  {/* Three states, not two. A chart when there is movement to
                     draw; the loading skeleton only while the history is still
                     being computed; and NOTHING at all for an account that will
                     never have a line — an account holding only stables has
                     nothing to plot. Reserving the band for those left a hole
                     in the middle of the card, and a skeleton there would be
                     promising a chart that is never coming. */}
                  {showSpark ? (
                    <Sparkline series={series!} tone={tone} />
                  ) : !series ? (
                    <Skel className="h-8 w-full rounded-md sm:h-12" />
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{a.sub}</span>
                    {cardChange !== null && tone !== "flat" && !hidden ? (
                      <ChangeText value={cardChange} className="text-[11.5px]" />
                    ) : (
                      <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground/50">
                        {hidden ? "••" : showSpark ? "30d" : ""}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
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
              {!needsWalletSetup && (
                <span className="hidden text-[12px] tabular-nums text-muted-foreground lg:block">
                  {activeAssetCount} assets · {NETWORKS.length} networks
                </span>
              )}
            </div>
            {needsWalletSetup ? (
              /* No wallet, so there are no addresses to tap and no balances to
                 read — the grid would be six boxes of nothing standing between
                 this person and the one thing they need to do next. */
              <div className="ws-card-glass flex flex-col gap-3 rounded-2xl bg-card/70 p-4 ring-1 ring-border/40 sm:flex-row sm:items-center sm:gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/[0.12]">
                  <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5 text-primary" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-semibold">Set up your wallet to continue</span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">
                    It takes a minute, and it gives you an address on every network so people can
                    send you coins.
                  </span>
                </div>
                <Link
                  href="/wallet/modern"
                  data-vivid-target="start-wallet-setup"
                  data-vivid-label="Set up the wallet"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97] motion-reduce:active:scale-100 sm:ml-auto"
                >
                  Set up wallet
                  <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-4 w-4" />
                </Link>
              </div>
            ) : (
            <>
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
            </>
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

      {/* The receive modal used to be mounted here, because Deposit opened it
          directly. Deposit now opens the chooser — where is this money coming
          from — and the addresses are one of the answers it offers, so the
          modal lives with the flow rather than being a second door onto the
          same thing from a screen that no longer knows the question. */}
    </div>
  )
}
