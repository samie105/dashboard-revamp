"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  CheckmarkCircle01Icon,
  ShieldCheck,
  ArrowUpRight01Icon,
  ArrowDown01Icon,
  Clock01Icon,
  StarIcon,
  InformationCircleIcon,
  UserMultiple02Icon,
  MoneyReceiveSquareIcon,
  Timer01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// ── Types ────────────────────────────────────────────────────────────────

interface Advertiser {
  id: string
  name: string
  avatar: string | null
  isVerified: boolean
  isMerchant: boolean
  orders: number
  completionRate: number
  avgRelease: string
  rating: number
}

interface P2POffer {
  id: string
  advertiser: Advertiser
  asset: string
  fiat: string
  price: number
  minAmount: number
  maxAmount: number
  available: number
  paymentMethods: string[]
  side: "buy" | "sell"
}

// ── Constants ────────────────────────────────────────────────────────────

const ASSETS = ["USDT", "BTC", "ETH", "BNB", "SOL"] as const
const FIATS = ["NGN", "USD", "GBP", "EUR"] as const

const PAYMENT_COLORS: Record<string, string> = {
  "Bank Transfer": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "Opay": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Palmpay": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "Moniepoint": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "Kuda": "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  "USSD": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Cash App": "bg-green-500/10 text-green-600 dark:text-green-400",
  "Wise": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  "Payoneer": "bg-red-500/10 text-red-600 dark:text-red-400",
}

const MOCK_OFFERS: P2POffer[] = [
  {
    id: "1",
    advertiser: { id: "a1", name: "Adebayo_FX", avatar: null, isVerified: true, isMerchant: true, orders: 3847, completionRate: 99.2, avgRelease: "2 min", rating: 4.9 },
    asset: "USDT", fiat: "NGN", price: 1620, minAmount: 10000, maxAmount: 5000000, available: 45230, paymentMethods: ["Bank Transfer", "Opay", "Palmpay"], side: "buy",
  },
  {
    id: "2",
    advertiser: { id: "a2", name: "Chidinma_Trade", avatar: null, isVerified: true, isMerchant: false, orders: 1254, completionRate: 98.7, avgRelease: "5 min", rating: 4.8 },
    asset: "USDT", fiat: "NGN", price: 1618, minAmount: 5000, maxAmount: 3000000, available: 28100, paymentMethods: ["Bank Transfer", "Kuda"], side: "buy",
  },
  {
    id: "3",
    advertiser: { id: "a3", name: "KingDavid_OTC", avatar: null, isVerified: true, isMerchant: true, orders: 6512, completionRate: 99.5, avgRelease: "1 min", rating: 5.0 },
    asset: "USDT", fiat: "NGN", price: 1625, minAmount: 50000, maxAmount: 10000000, available: 120000, paymentMethods: ["Bank Transfer", "Opay", "Moniepoint"], side: "buy",
  },
  {
    id: "4",
    advertiser: { id: "a4", name: "Amina_Exchange", avatar: null, isVerified: false, isMerchant: false, orders: 342, completionRate: 96.1, avgRelease: "8 min", rating: 4.5 },
    asset: "USDT", fiat: "NGN", price: 1615, minAmount: 2000, maxAmount: 500000, available: 8500, paymentMethods: ["Opay", "Palmpay"], side: "buy",
  },
  {
    id: "5",
    advertiser: { id: "a5", name: "ObiFX_Pro", avatar: null, isVerified: true, isMerchant: true, orders: 4201, completionRate: 99.8, avgRelease: "1 min", rating: 5.0 },
    asset: "USDT", fiat: "NGN", price: 1622, minAmount: 20000, maxAmount: 8000000, available: 95000, paymentMethods: ["Bank Transfer", "Opay", "Kuda", "Moniepoint"], side: "buy",
  },
  {
    id: "6",
    advertiser: { id: "a6", name: "Fatou_P2P", avatar: null, isVerified: true, isMerchant: false, orders: 876, completionRate: 97.9, avgRelease: "4 min", rating: 4.7 },
    asset: "USDT", fiat: "NGN", price: 1619, minAmount: 10000, maxAmount: 2000000, available: 15600, paymentMethods: ["Bank Transfer", "Palmpay"], side: "buy",
  },
  {
    id: "7",
    advertiser: { id: "a7", name: "Tunde_Crypto", avatar: null, isVerified: true, isMerchant: true, orders: 2890, completionRate: 98.5, avgRelease: "3 min", rating: 4.8 },
    asset: "USDT", fiat: "NGN", price: 1630, minAmount: 5000, maxAmount: 4000000, available: 62000, paymentMethods: ["Bank Transfer", "Opay"], side: "sell",
  },
  {
    id: "8",
    advertiser: { id: "a8", name: "Grace_OTC", avatar: null, isVerified: true, isMerchant: false, orders: 1567, completionRate: 99.0, avgRelease: "3 min", rating: 4.9 },
    asset: "USDT", fiat: "NGN", price: 1632, minAmount: 10000, maxAmount: 6000000, available: 41000, paymentMethods: ["Bank Transfer", "Moniepoint", "Kuda"], side: "sell",
  },
  {
    id: "9",
    advertiser: { id: "a9", name: "Emeka_FX", avatar: null, isVerified: false, isMerchant: false, orders: 210, completionRate: 95.3, avgRelease: "10 min", rating: 4.3 },
    asset: "USDT", fiat: "NGN", price: 1635, minAmount: 2000, maxAmount: 1000000, available: 5200, paymentMethods: ["Opay", "Palmpay"], side: "sell",
  },
  {
    id: "10",
    advertiser: { id: "a10", name: "Blessing_Trade", avatar: null, isVerified: true, isMerchant: true, orders: 5102, completionRate: 99.6, avgRelease: "2 min", rating: 5.0 },
    asset: "USDT", fiat: "NGN", price: 1628, minAmount: 30000, maxAmount: 15000000, available: 200000, paymentMethods: ["Bank Transfer", "Opay", "Moniepoint", "Kuda"], side: "sell",
  },
  {
    id: "11",
    advertiser: { id: "a11", name: "Sola_BTC", avatar: null, isVerified: true, isMerchant: true, orders: 1892, completionRate: 99.1, avgRelease: "2 min", rating: 4.9 },
    asset: "BTC", fiat: "NGN", price: 172500000, minAmount: 50000, maxAmount: 20000000, available: 0.45, paymentMethods: ["Bank Transfer", "Opay"], side: "buy",
  },
  {
    id: "12",
    advertiser: { id: "a12", name: "Ngozi_ETH", avatar: null, isVerified: true, isMerchant: false, orders: 756, completionRate: 98.2, avgRelease: "5 min", rating: 4.7 },
    asset: "ETH", fiat: "NGN", price: 5940000, minAmount: 20000, maxAmount: 10000000, available: 3.8, paymentMethods: ["Bank Transfer", "Kuda", "Palmpay"], side: "buy",
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtAmount(n: number, fiat: string): string {
  if (fiat === "NGN") return `₦${n.toLocaleString()}`
  if (fiat === "USD") return `$${n.toLocaleString()}`
  if (fiat === "GBP") return `£${n.toLocaleString()}`
  if (fiat === "EUR") return `€${n.toLocaleString()}`
  return n.toLocaleString()
}

function fmtAvailable(n: number, asset: string): string {
  if (asset === "BTC" || asset === "ETH" || asset === "BNB" || asset === "SOL") {
    return `${n.toFixed(4)} ${asset}`
  }
  return `${n.toLocaleString()} ${asset}`
}

function getInitials(name: string): string {
  return name.split("_").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

// ── Offer Card ───────────────────────────────────────────────────────────

function OfferCard({ offer, side }: { offer: P2POffer; side: "buy" | "sell" }) {
  const adv = offer.advertiser
  return (
    <div className="group rounded-2xl border border-border/40 bg-card p-4 transition-all hover:border-border/60 hover:shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Advertiser info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border border-border/30">
              <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                {getInitials(adv.name)}
              </AvatarFallback>
            </Avatar>
            {adv.isVerified && (
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{adv.name}</span>
              {adv.isMerchant && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
                  Merchant
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{adv.orders.toLocaleString()} orders</span>
              <span className="text-border">·</span>
              <span>{adv.completionRate}%</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5">
                <HugeiconsIcon icon={StarIcon} className="h-2.5 w-2.5 text-amber-400" />
                {adv.rating}
              </span>
            </div>
          </div>
        </div>

        {/* Price & limits */}
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="text-lg font-bold tabular-nums">
            {fmtAmount(offer.price, offer.fiat)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Limit: {fmtAmount(offer.minAmount, offer.fiat)} – {fmtAmount(offer.maxAmount, offer.fiat)}
          </span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Available:</span>
          <span className="text-[11px] font-medium">{fmtAvailable(offer.available, offer.asset)}</span>
          <span className="mx-1 text-border">|</span>
          <div className="flex flex-wrap gap-1">
            {offer.paymentMethods.map((pm) => (
              <span
                key={pm}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${PAYMENT_COLORS[pm] ?? "bg-accent text-foreground"}`}
              >
                {pm}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <HugeiconsIcon icon={Timer01Icon} className="h-3 w-3" />
            ~{adv.avgRelease}
          </span>
          <button
            className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors ${
              side === "buy"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            {side === "buy" ? "Buy" : "Sell"} {offer.asset}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Quick Stats ──────────────────────────────────────────────────────────

function QuickStats() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { icon: UserMultiple02Icon, label: "Active Traders", value: "2,847", color: "text-primary" },
        { icon: MoneyReceiveSquareIcon, label: "24h Volume", value: "₦1.2B", color: "text-emerald-500" },
        { icon: Timer01Icon, label: "Avg. Release", value: "< 3 min", color: "text-orange-500" },
        { icon: Wallet01Icon, label: "Total Orders", value: "142K+", color: "text-purple-500" },
      ].map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4"
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/60 ${s.color}`}>
            <HugeiconsIcon icon={s.icon} className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold">{s.value}</span>
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Sidebar Panels ───────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { step: "1", title: "Place an Order", desc: "Browse offers and start a trade with your preferred advertiser." },
    { step: "2", title: "Make Payment", desc: "Send payment via the advertiser's listed method within the time limit." },
    { step: "3", title: "Receive Crypto", desc: "Once confirmed, crypto is released from escrow to your wallet." },
  ]
  return (
    <div className="rounded-2xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={InformationCircleIcon} className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">How It Works</h3>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {steps.map((s) => (
          <div key={s.step} className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {s.step}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold">{s.title}</span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SafetyTips() {
  const tips = [
    "Always trade within the platform escrow system.",
    "Never release crypto before confirming payment.",
    "Check the advertiser's completion rate and reviews.",
    "Use only the listed payment methods.",
  ]
  return (
    <div className="rounded-2xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={ShieldCheck} className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-semibold">Safety Tips</h3>
      </div>
      <ul className="flex flex-col gap-2.5 p-4">
        {tips.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Main Client ──────────────────────────────────────────────────────────

export function P2PClient() {
  const [side, setSide] = React.useState<"buy" | "sell">("buy")
  const [asset, setAsset] = React.useState<string>("USDT")
  const [search, setSearch] = React.useState("")

  const offers = React.useMemo(() => {
    return MOCK_OFFERS.filter((o) => {
      if (o.side !== side) return false
      if (o.asset !== asset) return false
      if (search) {
        const q = search.toLowerCase()
        if (!o.advertiser.name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [side, asset, search])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">P2P Trading</h1>
        <p className="text-sm text-muted-foreground">
          Buy and sell crypto directly with other traders using local payment methods
        </p>
      </div>

      {/* Stats */}
      <QuickStats />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Buy / Sell toggle */}
        <div className="flex items-center rounded-xl bg-accent/50 p-1">
          <button
            onClick={() => setSide("buy")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              side === "buy"
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide("sell")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              side === "sell"
                ? "bg-red-500 text-white shadow-md shadow-red-500/25"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sell
          </button>
        </div>

        {/* Asset pills */}
        <div className="flex items-center gap-1">
          {ASSETS.map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                asset === a
                  ? "bg-primary text-white shadow-sm"
                  : "bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2.5 top-[7px] h-3.5 w-3.5 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search advertiser..."
            className="w-40 rounded-xl bg-accent/50 py-1.5 pl-8 pr-3 text-xs outline-none transition-all focus:w-56 focus:bg-accent"
          />
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* Offers */}
        <div className="flex flex-col gap-3">
          {offers.length > 0 ? (
            offers.map((o) => <OfferCard key={o.id} offer={o} side={side} />)
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card py-16 text-center">
              <HugeiconsIcon icon={Search01Icon} className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <span className="text-sm font-medium text-muted-foreground">
                No {side} offers for {asset}
              </span>
              <span className="mt-1 text-xs text-muted-foreground/70">
                Try switching to {side === "buy" ? "sell" : "buy"} or another asset
              </span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <HowItWorks />
          <SafetyTips />
        </div>
      </div>
    </div>
  )
}
