"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  ArrowDown01Icon,
  ChartIcon,
  Menu01Icon,
  Cancel01Icon,
  ArrowUpRight01Icon,
  ArrowLeft01Icon,
  Wallet01Icon,
  UserIcon,
  Settings01Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData, TradeResult, OrderBookLevel } from "@/lib/actions"
import { getOrderBook, getTrades } from "@/lib/actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "@/components/notifications"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useAuth } from "@/components/auth-provider"

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface SpotClientProps {
  coins: CoinData[]
  prices: Record<string, number>
  globalStats: {
    totalMarketCap: number
    totalVolume: number
    btcDominance: number
    marketCapChange24h: number
  }
  initialTrades: Record<string, TradeResult[]>
  initialOrderBook?: { asks: OrderBookLevel[]; bids: OrderBookLevel[] }
}

type OrderType = "market" | "limit"
type MobileTab = "chart" | "orderbook" | "trades" | "orders"

/* ══════════════════════════════════════════════════════════════
   Spot Top Bar  (deposit · notifications · theme · profile)
   ══════════════════════════════════════════════════════════════ */

function SpotTopBar() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = React.useState(false)

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "User"
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <header className="flex items-center justify-between border-b border-border/10 bg-background/80 px-4 py-2 backdrop-blur-xl">
      {/* Left: logo + back */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-primary"
        >
          <img src="/worldstreet-logo/WorldStreet4x.png" alt="WS" className="h-6 w-6 rounded-full" />
          <span className="hidden sm:inline">WorldStreet</span>
        </button>
        <div className="h-5 w-px bg-border/30" />
        <span className="text-xs font-semibold text-muted-foreground">Spot Trading</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 md:gap-2">
        <a
          href="/deposit"
          className="hidden md:flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
        >
          <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5" />
          Deposit
        </a>

        <NotificationBell />
        <ThemeToggle />

        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <PopoverTrigger
            render={
              <button className="relative rounded-full p-1 transition-opacity hover:opacity-80 focus:outline-none" />
            }
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.imageUrl} alt={displayName} />
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end" sideOffset={8}>
            <div className="flex flex-col gap-2 p-1">
              <p className="text-xs font-medium">{displayName}</p>
              <p className="text-[10px] text-muted-foreground">{user?.email}</p>
              <div className="my-1 h-px bg-border/30" />
              <a href="/profile" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent">
                <HugeiconsIcon icon={UserIcon} className="h-3.5 w-3.5" />
                Profile
              </a>
              <a href="/settings" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent">
                <HugeiconsIcon icon={Settings01Icon} className="h-3.5 w-3.5" />
                Settings
              </a>
              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-500 transition-colors hover:bg-accent"
              >
                <HugeiconsIcon icon={Logout01Icon} className="h-3.5 w-3.5" />
                Log out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}

/* ══════════════════════════════════════════════════════════════
   Order Book  (vertical — used in mobile & narrow column)
   ══════════════════════════════════════════════════════════════ */

function OrderBook({
  currentPrice,
  asks: propAsks,
  bids: propBids,
}: {
  currentPrice: number
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
}) {
  const asks = propAsks.length > 0 ? propAsks.slice(-12) : []
  const bids = propBids.length > 0 ? propBids.slice(0, 12) : []

  const maxTotal = Math.max(
    asks[0]?.total ?? 0,
    bids[bids.length - 1]?.total ?? 0,
    1,
  )
  const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2.5">
        <span className="text-xs font-semibold">Order Book</span>
      </div>

      <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>Price (USD)</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex-1 overflow-hidden">
        {asks.map((row, i) => (
          <div key={`a-${i}`} className="relative grid grid-cols-3 gap-1 px-3 py-[3px]">
            <div
              className="absolute inset-y-0 right-0 bg-red-500/8"
              style={{ width: `${(row.total / maxTotal) * 100}%` }}
            />
            <span className="relative z-10 text-[11px] tabular-nums text-red-500">
              {row.price.toFixed(priceDecimals)}
            </span>
            <span className="relative z-10 text-right text-[11px] tabular-nums">
              {row.amount.toFixed(4)}
            </span>
            <span className="relative z-10 text-right text-[11px] tabular-nums text-muted-foreground">
              {row.total.toFixed(4)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center border-y border-border/30 py-2">
        <span className="text-sm font-bold tabular-nums text-foreground">
          ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}
        </span>
        <HugeiconsIcon icon={ArrowUpRight01Icon} className="ml-1 h-3.5 w-3.5 text-emerald-500" />
      </div>

      <div className="flex-1 overflow-hidden">
        {bids.map((row, i) => (
          <div key={`b-${i}`} className="relative grid grid-cols-3 gap-1 px-3 py-[3px]">
            <div
              className="absolute inset-y-0 right-0 bg-emerald-500/8"
              style={{ width: `${(row.total / maxTotal) * 100}%` }}
            />
            <span className="relative z-10 text-[11px] tabular-nums text-emerald-500">
              {row.price.toFixed(priceDecimals)}
            </span>
            <span className="relative z-10 text-right text-[11px] tabular-nums">
              {row.amount.toFixed(4)}
            </span>
            <span className="relative z-10 text-right text-[11px] tabular-nums text-muted-foreground">
              {row.total.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Order Book Wide  (bids left · asks right — desktop bottom)
   ══════════════════════════════════════════════════════════════ */

function OrderBookWide({
  currentPrice,
  asks: propAsks,
  bids: propBids,
}: {
  currentPrice: number
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
}) {
  const asks = propAsks.length > 0 ? propAsks.slice(-15) : []
  const bids = propBids.length > 0 ? propBids.slice(0, 15) : []

  const maxTotal = Math.max(
    asks[0]?.total ?? 0,
    bids[bids.length - 1]?.total ?? 0,
    1,
  )
  const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2

  return (
    <div className="flex flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
        <span className="text-xs font-semibold">Order Book</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}
          </span>
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5 text-emerald-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px p-2">
        {/* Bids (buys) — left */}
        <div>
          <div className="grid grid-cols-3 gap-1 px-2 py-1 text-[10px] text-muted-foreground">
            <span>Price (USD)</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Total</span>
          </div>
          {bids.map((row, i) => (
            <div key={`b-${i}`} className="relative grid grid-cols-3 gap-1 px-2 py-[3px]">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-500/8"
                style={{ width: `${(row.total / maxTotal) * 100}%` }}
              />
              <span className="relative z-10 text-[11px] tabular-nums text-emerald-500">
                {row.price.toFixed(priceDecimals)}
              </span>
              <span className="relative z-10 text-right text-[11px] tabular-nums">
                {row.amount.toFixed(4)}
              </span>
              <span className="relative z-10 text-right text-[11px] tabular-nums text-muted-foreground">
                {row.total.toFixed(4)}
              </span>
            </div>
          ))}
        </div>

        {/* Asks (sells) — right */}
        <div>
          <div className="grid grid-cols-3 gap-1 px-2 py-1 text-[10px] text-muted-foreground">
            <span>Price (USD)</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Total</span>
          </div>
          {asks.map((row, i) => (
            <div key={`a-${i}`} className="relative grid grid-cols-3 gap-1 px-2 py-[3px]">
              <div
                className="absolute inset-y-0 right-0 bg-red-500/8"
                style={{ width: `${(row.total / maxTotal) * 100}%` }}
              />
              <span className="relative z-10 text-[11px] tabular-nums text-red-500">
                {row.price.toFixed(priceDecimals)}
              </span>
              <span className="relative z-10 text-right text-[11px] tabular-nums">
                {row.amount.toFixed(4)}
              </span>
              <span className="relative z-10 text-right text-[11px] tabular-nums text-muted-foreground">
                {row.total.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Chart Area  (SVG line chart, uses Binance data from props)
   ══════════════════════════════════════════════════════════════ */

function ChartArea({
  symbol,
  price,
  change24h,
}: {
  symbol: string
  price: number
  change24h: number
}) {
  const [interval, setInterval] = React.useState("1H")
  const intervals = ["1M", "5M", "15M", "1H", "4H", "1D"]
  const isPositive = change24h >= 0

  const points = React.useMemo(() => {
    const pts: number[] = []
    let p = price * (1 - Math.abs(change24h) / 100)
    for (let i = 0; i < 60; i++) {
      p += (Math.random() - 0.48) * price * 0.003
      pts.push(p)
    }
    pts.push(price)
    return pts
  }, [price, change24h, symbol])

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const pathD = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100
      const y = 100 - ((p - min) / range) * 80 - 10
      return `${i === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border/30 px-3 py-2">
        {intervals.map((iv) => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              interval === iv
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {iv}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <HugeiconsIcon icon={ChartIcon} className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <div className="relative flex-1 p-4">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id={`chart-grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "rgb(16,185,129)" : "rgb(239,68,68)"} stopOpacity="0.15" />
              <stop offset="100%" stopColor={isPositive ? "rgb(16,185,129)" : "rgb(239,68,68)"} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill={`url(#chart-grad-${symbol})`} />
          <path
            d={pathD}
            fill="none"
            stroke={isPositive ? "rgb(16,185,129)" : "rgb(239,68,68)"}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="absolute bottom-4 left-4">
          <p className="text-2xl font-bold tabular-nums">
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-sm font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
            {isPositive ? "+" : ""}{change24h.toFixed(2)}%
          </p>
        </div>

        <div className="absolute right-4 top-4 text-xs text-muted-foreground/20 font-bold">
          {symbol}/USD
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Order Panel  (separate buy / sell — each with Market · Limit nav)
   ══════════════════════════════════════════════════════════════ */

function OrderPanel({
  side,
  symbol,
  price,
}: {
  side: "buy" | "sell"
  symbol: string
  price: number
}) {
  const [orderType, setOrderType] = React.useState<OrderType>("market")
  const [limitPrice, setLimitPrice] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [pct, setPct] = React.useState(0)

  const isBuy = side === "buy"
  const effectivePrice = orderType === "market" ? price : parseFloat(limitPrice) || price
  const numericAmount = parseFloat(amount) || 0
  const total = numericAmount * effectivePrice

  function handlePctClick(p: number) {
    setPct(p)
    const balance = 10000
    if (isBuy) {
      setAmount(((balance * p) / 100 / effectivePrice).toFixed(6))
    } else {
      const held = balance / price
      setAmount(((held * p) / 100).toFixed(6))
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      {/* Header: side label + Market/Limit nav */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
        <span className={`text-xs font-bold ${isBuy ? "text-emerald-500" : "text-red-500"}`}>
          {isBuy ? "Buy" : "Sell"}
        </span>
        <div className="flex gap-0.5 rounded-lg bg-accent/30 p-0.5">
          {(["market", "limit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
                orderType === t
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {/* Limit price input */}
        {orderType === "limit" && (
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">Price</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={limitPrice}
                onChange={(e) => {
                  if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setLimitPrice(e.target.value)
                }}
                placeholder={price.toFixed(2)}
                className="w-full rounded-lg bg-accent/40 py-2 pl-3 pr-12 text-sm tabular-nums outline-none focus:bg-accent"
              />
              <span className="absolute right-3 top-2 text-xs text-muted-foreground">USD</span>
            </div>
          </div>
        )}

        {/* Market price display */}
        {orderType === "market" && (
          <div className="rounded-lg bg-accent/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Market Price</span>
              <span className="text-sm font-medium tabular-nums">
                ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">Amount</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value)
              }}
              placeholder="0.00"
              className="w-full rounded-lg bg-accent/40 py-2 pl-3 pr-12 text-sm tabular-nums outline-none focus:bg-accent"
            />
            <span className="absolute right-3 top-2 text-xs text-muted-foreground">{symbol}</span>
          </div>
        </div>

        {/* Percentage buttons */}
        <div className="flex items-center gap-1">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => handlePctClick(p)}
              className={`flex-1 rounded-md py-1.5 text-[10px] font-medium transition-colors ${
                pct === p
                  ? isBuy
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-red-500/15 text-red-500"
                  : "bg-accent/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="rounded-lg bg-accent/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Total</span>
            <span className="text-sm font-medium tabular-nums">
              ${total > 0 ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00"}
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          disabled={numericAmount <= 0}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isBuy
              ? "bg-emerald-500 hover:bg-emerald-500/90"
              : "bg-red-500 hover:bg-red-500/90"
          }`}
        >
          {isBuy ? "Buy" : "Sell"} {symbol}
        </button>

        {/* Balance */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Available</span>
          <span className="tabular-nums">$10,000.00 USD</span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Recent Trades
   ══════════════════════════════════════════════════════════════ */

function RecentTradesPanel({
  trades,
}: {
  trades: TradeResult[]
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      <div className="border-b border-border/30 px-3 py-2.5">
        <span className="text-xs font-semibold">Recent Trades</span>
      </div>
      <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>Price (USD)</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No trades available</p>
        ) : (
          trades.slice(0, 40).map((trade) => (
            <div key={trade.id} className="grid grid-cols-3 gap-1 px-3 py-[3px]">
              <span
                className={`text-[11px] tabular-nums ${
                  trade.side === "buy" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {parseFloat(trade.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-right text-[11px] tabular-nums">
                {parseFloat(trade.amount).toFixed(4)}
              </span>
              <span className="text-right text-[10px] tabular-nums text-muted-foreground">
                {new Date(trade.time).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Open Orders Panel
   ══════════════════════════════════════════════════════════════ */

function OpenOrdersPanel() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex items-center gap-4 border-b border-border/30 px-4 py-2.5">
        <span className="text-xs font-semibold">Open Orders</span>
        <span className="text-xs text-muted-foreground">Order History</span>
        <span className="text-xs text-muted-foreground">Trade History</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
          <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-xs text-muted-foreground">No open orders</p>
        <p className="text-[10px] text-muted-foreground/60">Your active orders will appear here</p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Pair Header Bar
   ══════════════════════════════════════════════════════════════ */

function PairHeader({
  coin,
  onOpenSearch,
}: {
  coin: CoinData
  onOpenSearch?: () => void
}) {
  const isPositive = coin.change24h >= 0

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card px-4 py-3 overflow-x-auto">
      <button onClick={onOpenSearch} className="flex items-center gap-2 shrink-0">
        {coin.image && <img src={coin.image} alt="" className="h-6 w-6 rounded-full" />}
        <span className="text-sm font-bold">{coin.symbol}/USD</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="h-6 w-px bg-border/30 shrink-0" />

      <div className="flex items-center gap-6 overflow-x-auto">
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] text-muted-foreground">Price</span>
          <span className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
            ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] text-muted-foreground">24h Change</span>
          <span className={`text-xs font-medium tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
            {isPositive ? "+" : ""}{coin.change24h.toFixed(2)}%
          </span>
        </div>
        <div className="hidden md:flex flex-col shrink-0">
          <span className="text-[10px] text-muted-foreground">24h Volume</span>
          <span className="text-xs font-medium tabular-nums">
            ${(coin.volume24h / 1e6).toFixed(2)}M
          </span>
        </div>
        <div className="hidden lg:flex flex-col shrink-0">
          <span className="text-[10px] text-muted-foreground">Market Cap</span>
          <span className="text-xs font-medium tabular-nums">
            ${(coin.marketCap / 1e9).toFixed(2)}B
          </span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Token Search Modal
   ══════════════════════════════════════════════════════════════ */

function TokenSearchModal({
  open,
  onClose,
  coins,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  coins: CoinData[]
  onSelect: (symbol: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onClose])

  React.useEffect(() => {
    if (open) setSearch("")
  }, [open])

  if (!open) return null

  const filtered = coins
    .filter((c) => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    })
    .sort((a, b) => b.volume24h - a.volume24h)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20">
      <div ref={ref} className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/30 p-4">
          <h3 className="text-sm font-semibold">Select Trading Pair</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pairs..."
              className="w-full rounded-xl bg-accent/50 py-2.5 pl-9 pr-3 text-sm outline-none focus:bg-accent"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((coin) => {
              const isPositive = coin.change24h >= 0
              return (
                <button
                  key={coin.symbol}
                  onClick={() => {
                    onSelect(coin.symbol)
                    onClose()
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  {coin.image && <img src={coin.image} alt="" className="h-7 w-7 rounded-full" />}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{coin.symbol}/USD</span>
                    <span className="text-xs text-muted-foreground">{coin.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">
                      ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                      {isPositive ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main SpotClient
   ══════════════════════════════════════════════════════════════ */

export function SpotClient({
  coins,
  prices,
  initialTrades,
  initialOrderBook,
}: SpotClientProps) {
  const [selectedPair, setSelectedPair] = React.useState("BTC")
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("chart")
  const [showSearch, setShowSearch] = React.useState(false)

  // Live orderbook state
  const [orderBookAsks, setOrderBookAsks] = React.useState<OrderBookLevel[]>(
    initialOrderBook?.asks ?? [],
  )
  const [orderBookBids, setOrderBookBids] = React.useState<OrderBookLevel[]>(
    initialOrderBook?.bids ?? [],
  )

  // Live trades state
  const [liveTrades, setLiveTrades] = React.useState<Record<string, TradeResult[]>>(initialTrades)

  // URL param handling
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pair = params.get("pair")
    if (pair) {
      const found = coins.find((c) => c.symbol === pair)
      if (found) setSelectedPair(pair)
    }
  }, [coins])

  // Poll orderbook every 3s (uses Binance → Gate.io fallback via server action)
  React.useEffect(() => {
    let cancelled = false

    async function fetchOB() {
      try {
        const result = await getOrderBook(`${selectedPair}USDT`, 20)
        if (!cancelled && result.success) {
          setOrderBookAsks(result.asks)
          setOrderBookBids(result.bids)
        }
      } catch {
        /* ignore */
      }
    }

    fetchOB()
    const id = window.setInterval(fetchOB, 3_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedPair])

  // Poll trades every 5s (uses Binance → KuCoin → CoinGecko fallback via server action)
  React.useEffect(() => {
    let cancelled = false

    async function fetchTr() {
      try {
        const result = await getTrades(`${selectedPair}USDT`, 50)
        if (!cancelled && result.success) {
          setLiveTrades((prev) => ({ ...prev, [`${selectedPair}USDT`]: result.data }))
        }
      } catch {
        /* ignore */
      }
    }

    if (!liveTrades[`${selectedPair}USDT`]?.length) fetchTr()
    const id = window.setInterval(fetchTr, 5_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedPair])

  const selectedCoin = coins.find((c) => c.symbol === selectedPair) || coins[0]
  const currentPrice = prices[selectedPair] ?? selectedCoin?.price ?? 0
  const trades = liveTrades[`${selectedPair}USDT`] || []

  function handlePairSelect(symbol: string) {
    setSelectedPair(symbol)
    const url = new URL(window.location.href)
    url.searchParams.set("pair", symbol)
    window.history.replaceState({}, "", url.toString())
  }

  const mobileTabs: { id: MobileTab; label: string }[] = [
    { id: "chart", label: "Chart" },
    { id: "orderbook", label: "Book" },
    { id: "trades", label: "Trades" },
    { id: "orders", label: "Orders" },
  ]

  if (!selectedCoin) return null

  return (
    <>
      {/* ── TOP BAR ── */}
      <SpotTopBar />

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden lg:flex flex-col gap-1 px-1 pt-1">
        <PairHeader coin={selectedCoin} onOpenSearch={() => setShowSearch(true)} />

        {/* Main grid: RecentTrades(2) · Chart(4) · Buy(3) · Sell(3) */}
        <div
          className="grid grid-cols-12 gap-1"
          style={{ height: "calc(100vh - 220px)", minHeight: "420px" }}
        >
          <div className="col-span-2 overflow-hidden">
            <RecentTradesPanel trades={trades} />
          </div>
          <div className="col-span-4 overflow-hidden">
            <ChartArea
              symbol={selectedPair}
              price={currentPrice}
              change24h={selectedCoin.change24h}
            />
          </div>
          <div className="col-span-3 overflow-hidden">
            <OrderPanel side="buy" symbol={selectedPair} price={currentPrice} />
          </div>
          <div className="col-span-3 overflow-hidden">
            <OrderPanel side="sell" symbol={selectedPair} price={currentPrice} />
          </div>
        </div>

        {/* Order Book — full width bottom */}
        <OrderBookWide
          currentPrice={currentPrice}
          asks={orderBookAsks}
          bids={orderBookBids}
        />

        {/* Open Orders */}
        <OpenOrdersPanel />
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="flex flex-col gap-2 px-2 pt-2 lg:hidden">
        <PairHeader coin={selectedCoin} onOpenSearch={() => setShowSearch(true)} />

        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-xl bg-accent/30 p-0.5">
          {mobileTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                mobileTab === tab.id ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[400px]">
          {mobileTab === "chart" && (
            <ChartArea
              symbol={selectedPair}
              price={currentPrice}
              change24h={selectedCoin.change24h}
            />
          )}
          {mobileTab === "orderbook" && (
            <OrderBook
              currentPrice={currentPrice}
              asks={orderBookAsks}
              bids={orderBookBids}
            />
          )}
          {mobileTab === "trades" && <RecentTradesPanel trades={trades} />}
          {mobileTab === "orders" && <OpenOrdersPanel />}
        </div>

        {/* Buy / Sell side-by-side */}
        <div className="grid grid-cols-2 gap-2">
          <OrderPanel side="buy" symbol={selectedPair} price={currentPrice} />
          <OrderPanel side="sell" symbol={selectedPair} price={currentPrice} />
        </div>
      </div>

      {/* Token search modal */}
      <TokenSearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        coins={coins}
        onSelect={handlePairSelect}
      />
    </>
  )
}
