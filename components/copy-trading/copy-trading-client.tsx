"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  CheckmarkCircle01Icon,
  ShieldCheck,
  ArrowUpRight01Icon,
  Cancel01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { fetchProfile, markOnboardingComplete } from "@/lib/profile-actions"
import type { ProfileData } from "@/lib/profile-actions"

// ── Types ────────────────────────────────────────────────────────────────

interface Trader {
  id: string
  name: string
  avatar: string
  badge: "elite" | "verified" | "rising" | null
  followers: number
  copiers: number
  totalPnl: number
  totalPnlPercent: number
  winRate: number
  weeklyPnl: number
  drawdown: number
  sharpeRatio: number
  avgHoldTime: string
  tradingDays: number
  totalTrades: number
  preferredAssets: {
    symbol: string
    name: string
    image: string
  }[]
  bio: string
  riskLevel: "low" | "medium" | "high"
  minCopy: number
  profitShare: number
  joined: string
  weeklyData: number[]
}

const ASSET_ICONS: Record<string, string> = {
  BTC: "https://assets.coincap.io/assets/icons/btc@2x.png",
  ETH: "https://assets.coincap.io/assets/icons/eth@2x.png",
  SOL: "https://assets.coincap.io/assets/icons/sol@2x.png",
  LINK: "https://assets.coincap.io/assets/icons/link@2x.png",
  DOGE: "https://assets.coincap.io/assets/icons/doge@2x.png",
  ARB: "https://assets.coincap.io/assets/icons/arb@2x.png",
  OP: "https://assets.coincap.io/assets/icons/op@2x.png",
  PEPE: "https://assets.coincap.io/assets/icons/pepe@2x.png",
  SHIB: "https://assets.coincap.io/assets/icons/shib@2x.png",
}

// ── Mock traders (will be replaced by real API) ──────────────────────────

const MOCK_TRADERS: Trader[] = [
  {
    id: "t1",
    name: "Chinedu Okafor",
    avatar: "https://picsum.photos/seed/portrait-17/120/120",
    badge: "elite",
    followers: 12847,
    copiers: 3241,
    totalPnl: 284530,
    totalPnlPercent: 312.4,
    winRate: 78.2,
    weeklyPnl: 8.4,
    drawdown: 12.3,
    sharpeRatio: 2.8,
    avgHoldTime: "4h 32m",
    tradingDays: 892,
    totalTrades: 15420,
    preferredAssets: [
      { symbol: "BTC", name: "Bitcoin", image: ASSET_ICONS.BTC },
      { symbol: "ETH", name: "Ethereum", image: ASSET_ICONS.ETH },
      { symbol: "SOL", name: "Solana", image: ASSET_ICONS.SOL },
    ],
    bio: "Algorithmic trend-following strategies. Focus on high-conviction setups with strict risk management.",
    riskLevel: "medium",
    minCopy: 50,
    profitShare: 10,
    joined: "2024-03-15",
    weeklyData: [2.1, 1.8, -0.5, 3.2, 1.4, 0.8, -0.4],
  },
  {
    id: "t2",
    name: "Amina Bello",
    avatar: "https://picsum.photos/seed/portrait-22/120/120",
    badge: "verified",
    followers: 8934,
    copiers: 2187,
    totalPnl: 198450,
    totalPnlPercent: 245.8,
    winRate: 72.6,
    weeklyPnl: 12.1,
    drawdown: 18.5,
    sharpeRatio: 2.1,
    avgHoldTime: "2h 15m",
    tradingDays: 654,
    totalTrades: 22310,
    preferredAssets: [
      { symbol: "SOL", name: "Solana", image: ASSET_ICONS.SOL },
      { symbol: "ETH", name: "Ethereum", image: ASSET_ICONS.ETH },
      { symbol: "DOGE", name: "Dogecoin", image: ASSET_ICONS.DOGE },
    ],
    bio: "Solana ecosystem specialist. High-frequency scalping on Solana DEXes and perp markets.",
    riskLevel: "high",
    minCopy: 25,
    profitShare: 15,
    joined: "2024-06-22",
    weeklyData: [4.2, -1.1, 3.8, 2.5, 1.9, -0.8, 1.6],
  },
  {
    id: "t3",
    name: "Ifeoma Nwosu",
    avatar: "https://picsum.photos/seed/portrait-31/120/120",
    badge: "elite",
    followers: 15210,
    copiers: 4532,
    totalPnl: 412780,
    totalPnlPercent: 487.2,
    winRate: 81.4,
    weeklyPnl: 5.2,
    drawdown: 8.1,
    sharpeRatio: 3.4,
    avgHoldTime: "18h 45m",
    tradingDays: 1120,
    totalTrades: 8920,
    preferredAssets: [
      { symbol: "BTC", name: "Bitcoin", image: ASSET_ICONS.BTC },
      { symbol: "ETH", name: "Ethereum", image: ASSET_ICONS.ETH },
      { symbol: "LINK", name: "Chainlink", image: ASSET_ICONS.LINK },
    ],
    bio: "Macro-focused swing trader. Patient entries with high R:R ratios. 3+ year track record.",
    riskLevel: "low",
    minCopy: 100,
    profitShare: 12,
    joined: "2023-01-10",
    weeklyData: [1.2, 0.8, 1.5, 0.6, 0.9, 0.4, -0.2],
  },
  {
    id: "t4",
    name: "Kossi Hounkpe",
    avatar: "https://picsum.photos/seed/portrait-44/120/120",
    badge: "rising",
    followers: 3420,
    copiers: 876,
    totalPnl: 67890,
    totalPnlPercent: 134.5,
    winRate: 69.8,
    weeklyPnl: 6.7,
    drawdown: 15.4,
    sharpeRatio: 1.9,
    avgHoldTime: "6h 12m",
    tradingDays: 312,
    totalTrades: 6540,
    preferredAssets: [
      { symbol: "ETH", name: "Ethereum", image: ASSET_ICONS.ETH },
      { symbol: "ARB", name: "Arbitrum", image: ASSET_ICONS.ARB },
      { symbol: "OP", name: "Optimism", image: ASSET_ICONS.OP },
    ],
    bio: "L2 ecosystems specialist. Trading US off-hours when volatility spikes on Arbitrum and Optimism.",
    riskLevel: "medium",
    minCopy: 25,
    profitShare: 8,
    joined: "2025-02-18",
    weeklyData: [1.8, 2.4, -1.2, 1.6, 0.9, 1.2, -0.2],
  },
  {
    id: "t5",
    name: "Afiwa Dossou",
    avatar: "https://picsum.photos/seed/portrait-58/120/120",
    badge: "verified",
    followers: 6712,
    copiers: 1543,
    totalPnl: 156320,
    totalPnlPercent: 198.7,
    winRate: 74.1,
    weeklyPnl: 4.8,
    drawdown: 10.2,
    sharpeRatio: 2.5,
    avgHoldTime: "1h 48m",
    tradingDays: 548,
    totalTrades: 31200,
    preferredAssets: [
      { symbol: "BTC", name: "Bitcoin", image: ASSET_ICONS.BTC },
      { symbol: "ETH", name: "Ethereum", image: ASSET_ICONS.ETH },
      { symbol: "SOL", name: "Solana", image: ASSET_ICONS.SOL },
      { symbol: "DOGE", name: "Dogecoin", image: ASSET_ICONS.DOGE },
    ],
    bio: "Quantitative mean-reversion and momentum strategies. Fully automated execution with manual oversight.",
    riskLevel: "low",
    minCopy: 75,
    profitShare: 10,
    joined: "2024-08-05",
    weeklyData: [0.8, 1.1, 0.6, 1.3, 0.9, 0.7, 0.5],
  },
  {
    id: "t6",
    name: "Romuald Soglo",
    avatar: "https://picsum.photos/seed/portrait-63/120/120",
    badge: null,
    followers: 2145,
    copiers: 432,
    totalPnl: 34560,
    totalPnlPercent: 89.3,
    winRate: 65.2,
    weeklyPnl: 9.8,
    drawdown: 22.1,
    sharpeRatio: 1.4,
    avgHoldTime: "3h 20m",
    tradingDays: 198,
    totalTrades: 4870,
    preferredAssets: [
      { symbol: "PEPE", name: "Pepe", image: ASSET_ICONS.PEPE },
      { symbol: "DOGE", name: "Dogecoin", image: ASSET_ICONS.DOGE },
      { symbol: "SHIB", name: "Shiba Inu", image: ASSET_ICONS.SHIB },
      { symbol: "SOL", name: "Solana", image: ASSET_ICONS.SOL },
    ],
    bio: "Meme coin and altcoin momentum plays. High risk, high reward. Not for the faint-hearted.",
    riskLevel: "high",
    minCopy: 10,
    profitShare: 20,
    joined: "2025-06-01",
    weeklyData: [5.1, -3.2, 4.8, -1.5, 6.2, -2.1, 0.5],
  },
]

// ── Tabs ─────────────────────────────────────────────────────────────────

const TABS = ["All", "Top Performers", "Trending", "Low Risk", "New Traders"] as const
type Tab = (typeof TABS)[number]

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function riskColor(level: "low" | "medium" | "high") {
  return level === "low"
    ? "text-emerald-500 bg-emerald-500/10"
    : level === "medium"
      ? "text-amber-500 bg-amber-500/10"
      : "text-red-500 bg-red-500/10"
}

function badgeConfig(badge: Trader["badge"]) {
  if (badge === "elite") return { label: "Elite", className: "bg-primary/10 text-primary" }
  if (badge === "verified") return { label: "Verified", className: "bg-emerald-500/10 text-emerald-500" }
  if (badge === "rising") return { label: "Rising Star", className: "bg-amber-500/10 text-amber-500" }
  return null
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

// ── Sparkline ────────────────────────────────────────────────────────────

function MiniSparkline({ data }: { data: number[] }) {
  const h = 28
  const w = 80
  const max = Math.max(...data.map(Math.abs), 0.01)
  const mid = h / 2
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = mid - (v / max) * (mid - 2)
      return `${x},${y}`
    })
    .join(" ")
  const isPositive = data.reduce((a, b) => a + b, 0) >= 0

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-20" preserveAspectRatio="none">
      <line x1="0" y1={mid} x2={w} y2={mid} stroke="currentColor" className="text-border/40" strokeWidth="0.5" />
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Onboarding Steps ─────────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="copy-header"]',
    title: "Copy Trading",
    description:
      "Follow top-performing traders and automatically mirror their trades in real-time. No manual execution needed.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="copy-tabs"]',
    title: "Filter Traders",
    description:
      "Browse by category: Top Performers for proven results, Trending for momentum, Low Risk for conservative strategies, or discover New Traders.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="copy-grid"]',
    title: "Trader Cards",
    description:
      "Each card shows the trader's performance, win rate, risk level, and a weekly PnL chart. Click any card to see full stats.",
    placement: "top",
  },
  {
    target: '[data-onboarding="copy-how"]',
    title: "How It Works",
    description:
      "New to copy trading? This section walks you through the entire process step by step.",
    placement: "left",
  },
]

// ── Trader Detail Sheet ──────────────────────────────────────────────────

function TraderDetail({
  trader,
  onClose,
  onCopy,
}: {
  trader: Trader
  onClose: () => void
  onCopy: (id: string) => void
}) {
  const badge = badgeConfig(trader.badge)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border/40 bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-card/95 backdrop-blur-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={trader.avatar} alt={`${trader.name} avatar`} />
              <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                {getInitials(trader.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{trader.name}</span>
                {badge && (
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Trading for {trader.tradingDays} days · Joined {new Date(trader.joined).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent">
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>

        {/* Bio */}
        <div className="px-5 py-4 border-b border-border/30">
          <p className="text-xs text-muted-foreground leading-relaxed">{trader.bio}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trader.preferredAssets.map((asset) => (
              <span key={asset.symbol} className="inline-flex items-center gap-1 rounded-full bg-accent/60 px-2 py-0.5 text-[10px] font-medium text-foreground">
                <Avatar className="h-3.5 w-3.5">
                  <AvatarImage src={asset.image} alt={asset.name} loading="lazy" />
                  <AvatarFallback className="text-[8px]">{asset.symbol[0]}</AvatarFallback>
                </Avatar>
                {asset.symbol}/USDT
              </span>
            ))}
          </div>
        </div>

        {/* Performance grid */}
        <div className="grid grid-cols-3 divide-x divide-border/30 border-b border-border/30">
          <div className="flex flex-col items-center gap-1 p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total PnL</span>
            <span className={`text-lg font-bold tabular-nums ${trader.totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              ${formatCompact(trader.totalPnl)}
            </span>
            <span className={`text-[10px] font-medium tabular-nums ${trader.totalPnlPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {trader.totalPnlPercent >= 0 ? "+" : ""}{trader.totalPnlPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Win Rate</span>
            <span className="text-lg font-bold tabular-nums">{trader.winRate}%</span>
            <span className="text-[10px] text-muted-foreground">{trader.totalTrades.toLocaleString()} trades</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Weekly</span>
            <span className={`text-lg font-bold tabular-nums ${trader.weeklyPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {trader.weeklyPnl >= 0 ? "+" : ""}{trader.weeklyPnl}%
            </span>
            <MiniSparkline data={trader.weeklyData} />
          </div>
        </div>

        {/* Detailed stats */}
        <div className="grid grid-cols-2 gap-px bg-border/30 border-b border-border/30">
          {[
            { label: "Sharpe Ratio", value: trader.sharpeRatio.toFixed(1) },
            { label: "Max Drawdown", value: `${trader.drawdown}%` },
            { label: "Avg Hold Time", value: trader.avgHoldTime },
            { label: "Copiers", value: formatCompact(trader.copiers) },
            { label: "Followers", value: formatCompact(trader.followers) },
            { label: "Profit Share", value: `${trader.profitShare}%` },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between bg-card px-4 py-3">
              <span className="text-[11px] text-muted-foreground">{stat.label}</span>
              <span className="text-xs font-semibold tabular-nums">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Risk + Min copy */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Risk Level</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${riskColor(trader.riskLevel)}`}>
              {trader.riskLevel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Min. Copy</span>
            <span className="text-xs font-semibold">${trader.minCopy}</span>
          </div>
        </div>

        {/* CTA */}
        <div className="p-5">
          <button
            onClick={() => onCopy(trader.id)}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Copy This Trader
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            You can stop copying at any time. {trader.profitShare}% profit share applies.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Copy Confirmation Sheet ──────────────────────────────────────────────

function CopyConfirmation({
  trader,
  onClose,
}: {
  trader: Trader
  onClose: () => void
}) {
  const [amount, setAmount] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  function handleConfirm() {
    // Backend will handle — just show success state for now
    setCopied(true)
  }

  if (copied) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-sm rounded-2xl border border-border/40 bg-card p-8 text-center shadow-2xl"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-7 w-7 text-emerald-500" />
          </div>
          <h3 className="text-base font-semibold">Copying {trader.name}!</h3>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            You&apos;re now mirroring their trades with ${amount || trader.minCopy}. You can manage or stop this anytime from your portfolio.
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-border/40 bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <h3 className="text-sm font-semibold">Copy {trader.name}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Amount input */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
              Copy Amount (USDT)
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min $${trader.minCopy}`}
                min={trader.minCopy}
                className="w-full rounded-xl border border-border/30 bg-accent/20 py-3 pl-4 pr-16 text-sm font-medium outline-none transition-colors focus:border-primary/50 focus:bg-accent/30"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">USDT</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[50, 100, 250, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
                    amount === String(v) ? "bg-primary/10 text-primary" : "bg-accent/50 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-border/30 bg-accent/10 p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Trader</span>
              <span className="font-medium">{trader.name}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Profit Share</span>
              <span className="font-medium">{trader.profitShare}%</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Risk Level</span>
              <span className={`font-medium capitalize ${trader.riskLevel === "low" ? "text-emerald-500" : trader.riskLevel === "medium" ? "text-amber-500" : "text-red-500"}`}>
                {trader.riskLevel}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Min. Amount</span>
              <span className="font-medium">${trader.minCopy}</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
            <HugeiconsIcon icon={InformationCircleIcon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
              Past performance does not guarantee future results. Copy trading involves risk. Only invest what you can afford to lose.
            </p>
          </div>

          <button
            onClick={handleConfirm}
            disabled={Number(amount) < trader.minCopy && amount !== ""}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Copy — ${amount || trader.minCopy}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Trader Card ──────────────────────────────────────────────────────────

function TraderCard({
  trader,
  onSelect,
}: {
  trader: Trader
  onSelect: (trader: Trader) => void
}) {
  const badge = badgeConfig(trader.badge)

  return (
    <button
      onClick={() => onSelect(trader)}
      className="group flex flex-col rounded-2xl border border-border/40 bg-card shadow-sm transition-all hover:border-primary/20 hover:shadow-md text-left"
    >
      {/* Top row: avatar + name + badge */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={trader.avatar} alt={`${trader.name} avatar`} />
          <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
            {getInitials(trader.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{trader.name}</span>
            {badge && (
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${riskColor(trader.riskLevel)}`}>
              {trader.riskLevel} risk
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatCompact(trader.copiers)} copiers
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border/30 border-t border-border/30">
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">PnL</span>
          <span className={`text-sm font-bold tabular-nums ${trader.totalPnlPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {trader.totalPnlPercent >= 0 ? "+" : ""}{trader.totalPnlPercent.toFixed(1)}%
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Win</span>
          <span className="text-sm font-bold tabular-nums">{trader.winRate}%</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-3">
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Weekly</span>
          <span className={`text-sm font-bold tabular-nums ${trader.weeklyPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {trader.weeklyPnl >= 0 ? "+" : ""}{trader.weeklyPnl}%
          </span>
        </div>
      </div>

      {/* Sparkline + pairs */}
      <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
        <div className="flex items-center gap-1">
          {trader.preferredAssets.slice(0, 3).map((asset) => (
            <span key={asset.symbol} className="inline-flex items-center gap-1 rounded bg-accent/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              <Avatar className="h-3 w-3">
                <AvatarImage src={asset.image} alt={asset.name} loading="lazy" />
                <AvatarFallback className="text-[7px]">{asset.symbol[0]}</AvatarFallback>
              </Avatar>
              {asset.symbol}
            </span>
          ))}
        </div>
        <MiniSparkline data={trader.weeklyData} />
      </div>

      {/* CTA strip */}
      <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
        <span className="text-[10px] text-muted-foreground">
          Min ${trader.minCopy} · {trader.profitShare}% share
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:underline">
          Copy
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
        </span>
      </div>
    </button>
  )
}

// ── How It Works ─────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { num: "01", title: "Browse Traders", desc: "Explore the leaderboard and compare performance, risk levels, and strategies." },
    { num: "02", title: "Choose & Copy", desc: "Pick a trader and set your copy amount. Their trades are automatically mirrored." },
    { num: "03", title: "Earn Together", desc: "When they profit, you profit (minus their profit share). Stop anytime." },
  ]

  return (
    <div data-onboarding="copy-how" className="rounded-2xl border border-border/40 bg-card shadow-sm">
      <div className="border-b border-border/30 px-4 py-3">
        <h3 className="text-sm font-semibold">How Copy Trading Works</h3>
      </div>
      <div className="divide-y divide-border/30">
        {steps.map((step) => (
          <div key={step.num} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {step.num}
            </span>
            <div>
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Safety Tips ──────────────────────────────────────────────────────────

function SafetyTips() {
  const tips = [
    "Diversify by copying 2-3 traders with different strategies",
    "Start with the minimum copy amount until you're comfortable",
    "Check trader drawdown history before committing larger amounts",
    "Low risk ≠ no risk. Always invest responsibly",
  ]

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
      <div className="border-b border-border/30 px-4 py-3">
        <h3 className="text-sm font-semibold">Safety Tips</h3>
      </div>
      <div className="space-y-2 p-4">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-2">
            <HugeiconsIcon icon={ShieldCheck} className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

interface CopyTradingClientProps {
  coins: CoinData[]
  error?: string
}

export function CopyTradingClient({ coins, error }: CopyTradingClientProps) {
  const [tab, setTab] = React.useState<Tab>("All")
  const [search, setSearch] = React.useState("")
  const [selectedTrader, setSelectedTrader] = React.useState<Trader | null>(null)
  const [copyingTrader, setCopyingTrader] = React.useState<Trader | null>(null)
  const [profile, setProfile] = React.useState<ProfileData | null>(null)

  React.useEffect(() => {
    fetchProfile().then((r) => {
      if (r.success && r.profile) setProfile(r.profile)
    })
  }, [])

  const isOnboardingDone = profile?.onboardingCompleted?.includes("copy-trading") ?? false

  const filtered = React.useMemo(() => {
    let traders = [...MOCK_TRADERS]

    // Search
    if (search) {
      const q = search.toLowerCase()
      traders = traders.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.preferredAssets.some((asset) =>
            asset.symbol.toLowerCase().includes(q) || asset.name.toLowerCase().includes(q),
          ),
      )
    }

    // Tab filter
    switch (tab) {
      case "All":
        traders.sort((a, b) => b.totalPnlPercent - a.totalPnlPercent)
        break
      case "Top Performers":
        traders.sort((a, b) => b.totalPnlPercent - a.totalPnlPercent)
        break
      case "Trending":
        traders.sort((a, b) => b.weeklyPnl - a.weeklyPnl)
        break
      case "Low Risk":
        traders = traders.filter((t) => t.riskLevel === "low" || t.riskLevel === "medium")
        traders.sort((a, b) => a.drawdown - b.drawdown)
        break
      case "New Traders":
        traders.sort((a, b) => new Date(b.joined).getTime() - new Date(a.joined).getTime())
        break
    }

    return traders
  }, [tab, search])

  function handleCopy(id: string) {
    const trader = MOCK_TRADERS.find((t) => t.id === id)
    if (trader) {
      setSelectedTrader(null)
      setCopyingTrader(trader)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div data-onboarding="copy-header" className="flex flex-col gap-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Copy Trading</h1>
          <p className="text-xs text-muted-foreground">
            Mirror top traders automatically. When they trade, you trade. Tracking {coins.length} market assets.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Market data is temporarily unavailable, but you can still browse and set up copy profiles.
        </div>
      ) : null}

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Tabs + search */}
          <div data-onboarding="copy-tabs" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="relative">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search traders or assets..."
                className="w-full sm:w-64 rounded-xl border border-border/30 bg-accent/20 py-2 pl-8 pr-4 text-xs outline-none transition-colors focus:border-primary/50 focus:bg-accent/30"
              />
            </div>
          </div>

          {/* Trader grid */}
          <div data-onboarding="copy-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/40 bg-card py-16 text-center">
                <HugeiconsIcon icon={Search01Icon} className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No traders found</p>
                  <p className="text-xs text-muted-foreground/60">Try a different search or category</p>
                </div>
              </div>
            ) : (
              filtered.map((trader) => (
                <TraderCard key={trader.id} trader={trader} onSelect={setSelectedTrader} />
              ))
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          <HowItWorks />
          <SafetyTips />
        </div>
      </div>

      {/* Trader Detail Modal */}
      {selectedTrader && (
        <TraderDetail
          trader={selectedTrader}
          onClose={() => setSelectedTrader(null)}
          onCopy={handleCopy}
        />
      )}

      {/* Copy Confirmation Modal */}
      {copyingTrader && (
        <CopyConfirmation
          trader={copyingTrader}
          onClose={() => setCopyingTrader(null)}
        />
      )}

      {/* Onboarding */}
      <OnboardingFlow
        steps={ONBOARDING_STEPS}
        storageKey="copy-trading"
        completed={isOnboardingDone}
        onComplete={() => markOnboardingComplete("copy-trading")}
      />
    </div>
  )
}
