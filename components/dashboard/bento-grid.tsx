"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  StarIcon,
  Chart01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Clock01Icon,
  ArrowUpRight01Icon,
  Search01Icon,
  Exchange01Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData, TradeResult } from "@/lib/actions"
import { ErrorState } from "@/components/error-state"

/* ========== Markets Table ========== */
const MARKET_TABS = ["Favorites", "Hot", "New", "Gainers", "Losers", "Turnover", "Spot"] as const
type MarketTab = (typeof MARKET_TABS)[number]

function MarketsTable({ coins, error }: { coins: CoinData[]; error?: string }) {
  const [tab, setTab] = React.useState<MarketTab>("Hot")
  const [search, setSearch] = React.useState("")
  const [visibleCount, setVisibleCount] = React.useState(8)

  const filtered = React.useMemo(() => {
    let list = [...coins]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    }
    switch (tab) {
      case "Gainers":
        list.sort((a, b) => b.change24h - a.change24h)
        break
      case "Losers":
        list.sort((a, b) => a.change24h - b.change24h)
        break
      case "Turnover":
        list.sort((a, b) => b.volume24h - a.volume24h)
        break
      case "Hot":
      case "Spot":
      default:
        list.sort((a, b) => b.marketCap - a.marketCap)
        break
    }
    return list
  }, [coins, tab, search])

  // Reset pagination when filters change
  React.useEffect(() => {
    setVisibleCount(8)
  }, [tab, search])

  const displayed = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Chart01Icon} className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Markets</h3>
          </div>
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-36 rounded-lg bg-accent/50 pl-7 pr-2 py-1.5 text-xs outline-none focus:bg-accent"
            />
          </div>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {MARKET_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {error && filtered.length === 0 ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search01Icon}
          title="No results found"
          description="Try a different search term or tab"
        />
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-border/30 text-xs text-muted-foreground">
                <th className="px-3 sm:px-4 py-2 text-left font-medium">Pair</th>
                <th className="px-3 sm:px-4 py-2 text-right font-medium">Price</th>
                <th className="px-3 sm:px-4 py-2 text-right font-medium">24h</th>
                <th className="hidden sm:table-cell px-4 py-2 text-right font-medium">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {displayed.map((coin) => (
                <tr key={coin.symbol} className="transition-colors hover:bg-accent/30">
                  <td className="px-3 sm:px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {coin.image ? (
                        <img src={coin.image} alt={coin.symbol} className="h-5 w-5 rounded-full" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{coin.symbol}</span>
                      )}
                      <span className="font-medium">{coin.symbol}/USDT</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 text-right font-semibold tabular-nums">
                    {coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${
                        coin.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-2.5 text-right">
                    <a
                      href={`/spot?pair=${coin.symbol}USDT`}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Trade
                      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center p-3">
              <button
                onClick={() => setVisibleCount((c) => c + 8)}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Load More
                <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ========== Recent Trades ========== */
function RecentTrades({ trades, error }: { trades: TradeResult[]; error?: string }) {
  const items = trades.slice(0, 8)

  function formatTime(ts: number) {
    const diff = Date.now() - ts
    if (diff < 60_000) return "Just now"
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return `${Math.floor(diff / 86400_000)}d ago`
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Activity01Icon} className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Recent Trades</h3>
        </div>
        <a href="/transactions" className="text-xs font-medium text-primary hover:underline">
          View all
        </a>
      </div>
      {error && items.length === 0 ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Exchange01Icon}
          title="No recent trades"
          description="Your latest trades will appear here"
          cta={{ label: "Start trading", href: "/spot" }}
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/30">
          {items.map((trade) => (
            <div key={trade.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
              <span
                className={`text-xs font-bold ${
                  trade.side === "buy" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {trade.side === "buy" ? "B" : "S"}
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">BTC/USDT</span>
                <span className="text-xs text-muted-foreground tabular-nums">{parseFloat(trade.amount).toFixed(6)} BTC</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">
                  ${parseFloat(trade.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                  {formatTime(trade.time)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========== Watchlist ========== */
function Watchlist({ coins, error }: { coins: CoinData[]; error?: string }) {
  const items = coins.slice(0, 10)

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
        <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={StarIcon} className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Watchlist</h3>
        </div>
        <a href="/spot" className="text-xs font-medium text-primary hover:underline">
          View all
        </a>
      </div>
      {error && items.length === 0 ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={StarIcon}
          title="No favorites yet"
          description="Star assets to add them to your watchlist"
          cta={{ label: "Browse markets", href: "/spot" }}
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/30">
          {items.map((coin) => (
            <div key={coin.symbol} className="flex items-center gap-3 px-3 py-1.5 transition-colors hover:bg-accent/30">
              {coin.image ? (
                <img src={coin.image} alt={coin.symbol} className="h-5 w-5 rounded-full" />
              ) : (
                <span className="text-xs font-bold text-primary">{coin.symbol.slice(0, 2)}</span>
              )}
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{coin.symbol}</span>
                <span className="text-xs text-muted-foreground">{coin.name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">
                  ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
                    coin.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  <HugeiconsIcon
                    icon={coin.change24h >= 0 ? ArrowUp01Icon : ArrowDown01Icon}
                    className="h-3 w-3"
                  />
                  {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========== Empty State ========== */
function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: typeof Activity01Icon
  title: string
  description: string
  cta?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <HugeiconsIcon icon={icon} className="h-8 w-8 text-muted-foreground/40" />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <span className="text-xs text-muted-foreground/60">{description}</span>
      </div>
      {cta && (
        <a
          href={cta.href}
          className="mt-1 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          {cta.label}
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

/* ========== Dashboard Grid ========== */
interface DashboardGridProps {
  coins: CoinData[]
  trades: TradeResult[]
  error?: string
}

export function DashboardGrid({ coins, trades, error }: DashboardGridProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Column 1: Markets + Recent Trades stacked */}
      <div className="flex flex-col gap-4 lg:col-span-3">
        <MarketsTable coins={coins} error={error} />
        <RecentTrades trades={trades} error={error} />
      </div>

      {/* Column 2: Watchlist */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Watchlist coins={coins} error={error} />
      </div>
    </div>
  )
}
