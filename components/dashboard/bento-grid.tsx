"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Clock01Icon,
  ArrowUpRight01Icon,
  Search01Icon,
  Exchange01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData, TradeResult, FuturesMarket } from "@/lib/actions"
import { getFuturesMarkets } from "@/lib/actions"
import { fetchPrices, type Coin } from "@/lib/crypto-api"

// Market rows for the Spot tab — the service's price feed with the display
// fields the old spotv2 pair registry carried.
type SpotV2Pair = Coin & { displaySymbol: string; chain: string; contractAddress: string | null }
import { getSpotBalances, getSpotPositions, getTokenPrices, getSpotTradeHistory } from "@/lib/trade-adapter"
import type { LedgerBalance, PositionInfo } from "@/lib/trade-adapter"
import { ErrorState } from "@/components/error-state"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  CardHeader,
  CardShell,
  ChangeText,
  EmptyState as SystemEmptyState,
  Eyebrow,
  Segmented,
  SkeletonRows,
  SkeletonTable,
  type IllustrationKey,
} from "@/components/ui/system"
import { fetchProfile } from "@/lib/profile-actions"
import { SwapClient } from "@/components/swap/swap-client"
import { ActivityCard } from "@/components/dashboard/activity-card"
// TEMPORARILY OFF — see the parked block below.
// import { WorldstreetTokenCard } from "@/components/dashboard/worldstreet-token-card"
import { useHyperliquidPositions } from "@/hooks/useHyperliquidPositions"
import { useAuth } from "@/components/auth-provider"
import { getCoinImage, coinFallback } from "@/lib/coin-images"
import { ComingSoon, FUTURES_SOON_TITLE, SoonBadge } from "@/components/ui/coming-soon"

const USDT_IMAGE = "https://coin-images.coingecko.com/coins/images/325/small/Tether.png"
const USDC_IMAGE = "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png"

/* ── TEMPORARY: the futures venue is not open ───────────────────────────
   Perpetual futures are not live on the platform yet. Every futures surface in
   this file stays VISIBLE and stays PRESSABLE — the tabs are built, people have
   already found them, and the feature is coming. Selecting one is how you find
   out: its panel is the ComingSoon message instead of the futures UI, so a tap
   explains itself where there is no hover to carry a tooltip. What the gate does
   remove is every link into /trade?market=futures — a tab that explains itself
   is not the same thing as a button into a venue that cannot take an order.
   Flip this one constant to `true` when the venue opens; nothing else in this
   file needs unwinding.

   The `: boolean` annotation is load-bearing. Without it TS narrows the type to
   the literal `false`, and every `tab === "Futures"` / `view === "positions"`
   comparison below becomes a "comparison appears unintentional" error. */
const FUTURES_OPEN: boolean = false

/* ========== Trade Confirm Dialog (mobile) ========== */
type TradeConfirmItem =
  | { type: "spot";    symbol: string; name: string; image: string; price: number; change24h: number }
  | { type: "futures"; symbol: string; name: string; image: string; price: number; change24h: number; leverage: number }

function TradeConfirmDialog({
  item,
  onClose,
}: {
  item: TradeConfirmItem | null
  onClose: () => void
}) {
  const router = useRouter()
  /* Phone-only, exactly as before. The rows below set `tradeItem` at every
     width but this surface was `sm:hidden`, so on a desktop the confirm step
     simply never appeared. Gating `open` on the media query rather than
     hiding the card with a class is what keeps that true now that the modal
     is portalled: a `sm:hidden` popup would still paint its backdrop over the
     page on a desktop, dimming the screen for a dialog nobody can see.
     (Worth knowing separately: because the row's onClick is unconditional, a
     desktop click on a market row currently does nothing at all. That is a
     pre-existing dead click, not something introduced here.) */
  const onPhone = useMediaQuery("(max-width: 639px)")

  /* The item survives the close so the card keeps its content while the exit
     transition plays, instead of blanking the instant it is dismissed.
     Render-phase setState rather than a ref: writing a ref during render is
     unsafe under concurrent rendering (and the lint rule that says so is
     right). This is React's documented "adjust state when a prop changes"
     pattern — the extra render happens before the browser paints, so nothing
     flashes. */
  const [lastItem, setLastItem] = React.useState<TradeConfirmItem | null>(item)
  if (item && item !== lastItem) setLastItem(item)
  const shown = item ?? lastItem

  if (!shown) return null

  const isFutures = shown.type === "futures"
  const isUp = shown.change24h >= 0
  const href = isFutures ? `/trade?market=futures&symbol=${shown.symbol}` : `/trade?symbol=${shown.symbol}`

  function handleTrade() {
    onClose()
    router.push(href)
  }

  return (
    /* The house modal, not a hand-rolled sheet. This was two bare divs — a
       floor-anchored panel with `rounded-t-3xl` and a click-outside handler —
       which meant no focus trap, no Escape, no portal and no scroll lock on a
       surface that starts a trade. Owner call 2026-09-03: every modal pops up
       the same way. ResponsiveModal brings the centred card AND the dialog
       semantics that were missing. */
    <ResponsiveModal open={item !== null && onPhone} onOpenChange={(open) => { if (!open) onClose() }}>
      <ResponsiveModalContent>
        <ResponsiveModalTitle className="sr-only">
          Trade {shown.symbol}
        </ResponsiveModalTitle>
        {/* coin header */}
        <div className="flex items-center gap-3">
          {shown.image ? (
            <img
              src={shown.image}
              alt={shown.symbol}
              className="h-12 w-12 rounded-full object-contain ring-2 ring-primary/30"
              onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(shown.symbol) }}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold bg-primary/10 text-primary">
              {shown.symbol.slice(0, 3)}
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="text-base font-bold">
              {shown.symbol}{isFutures ? "-PERP" : "/USDC"}
            </span>
            <span className="truncate text-xs text-muted-foreground">{shown.name}</span>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end">
            <span className="text-base font-bold tabular-nums">
              ${shown.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: shown.price < 1 ? 4 : 2 })}
            </span>
            <span className={`text-xs font-medium tabular-nums ${
              isUp ? "text-credit" : "text-debit"
            }`}>
              {isUp ? "+" : ""}{shown.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* type badge */}
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {isFutures ? `Perpetual · up to ${(shown as Extract<TradeConfirmItem, {type:"futures"}>).leverage}× leverage` : "Spot Market"}
          </span>
        </div>

        {/* CTAs. min-h-12 rather than py-3: the card is a touch surface and
            44px is the floor. */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border/50 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleTrade}
            className="flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Trade {shown.symbol}
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-4 w-4" />
          </button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
const MARKET_TABS = ["Spot", "Futures"] as const
type MarketTab = (typeof MARKET_TABS)[number]

function MarketsTable({ coins, error }: { coins: CoinData[]; error?: string }) {
  const [tab, setTab] = React.useState<MarketTab>("Spot")
  const [search, setSearch] = React.useState("")
  const [visibleCount, setVisibleCount] = React.useState(5)
  const [futuresMarkets, setFuturesMarkets] = React.useState<FuturesMarket[]>([])
  const [futuresLoading, setFuturesLoading] = React.useState(false)
  const hasFetchedFutures = React.useRef(false)
  const [spotMarkets, setSpotMarkets] = React.useState<SpotV2Pair[]>([])
  const [spotLoading, setSpotLoading] = React.useState(false)
  const hasFetchedSpot = React.useRef(false)
  const [tradeItem, setTradeItem] = React.useState<TradeConfirmItem | null>(null)

  // Fetch futures lazily when tab is selected
  React.useEffect(() => {
    if (tab !== "Futures" || hasFetchedFutures.current) return
    hasFetchedFutures.current = true
    setFuturesLoading(true)
    getFuturesMarkets()
      .then((res) => {
        if (res.success) setFuturesMarkets(res.markets)
      })
      .catch(() => {})
      .finally(() => setFuturesLoading(false))
  }, [tab])

  // Fetch spot markets lazily when Spot tab is selected
  React.useEffect(() => {
    if (tab !== "Spot" || hasFetchedSpot.current) return
    hasFetchedSpot.current = true
    setSpotLoading(true)
    fetchPrices()
      .then((res) => setSpotMarkets(res.coins.map((c) => ({
        ...c,
        displaySymbol: c.symbol.toUpperCase(),
        chain: "",
        contractAddress: null,
      }))))
      .catch(() => {})
      .finally(() => setSpotLoading(false))
  }, [tab])

  const filtered = React.useMemo(() => {
    let list = [...spotMarkets]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    }
    list.sort((a, b) => b.marketCap - a.marketCap)
    return list
  }, [spotMarkets, search])

  // Reset pagination when filters change
  React.useEffect(() => {
    setVisibleCount(5)
  }, [tab, search])

  const displayed = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const filteredFutures = React.useMemo(() => {
    let list = [...futuresMarkets]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) => m.symbol.toLowerCase().includes(q) || m.baseAsset.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => b.openInterest - a.openInterest)
  }, [futuresMarkets, search])

  const displayedFutures = filteredFutures.slice(0, visibleCount)
  const hasMoreFutures = visibleCount < filteredFutures.length

  return (
    <CardShell data-onboarding="dash-markets">
      <TradeConfirmDialog item={tradeItem} onClose={() => setTradeItem(null)} />
      <CardHeader
        title="Markets"
        subtitle="Live prices"
        className="pb-2"
        right={
          <div className="relative shrink-0">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-36 rounded-full bg-surface-sunken py-1.5 pl-8 pr-3 text-xs outline-none transition-colors focus:bg-accent"
            />
          </div>
        }
      />
      <div className="px-4 pb-3">
        <Segmented
          /* Futures is fully pressable — pressing it is how you learn the venue
             is closed (see FUTURES_OPEN). It only reads quieter than the live tabs
             while it is UNSELECTED; selected, it looks like any other tab, because
             its panel is doing the explaining. Segmented styles its own options,
             so the dimming lands on that one button via its `data-seg-key`.
             MARKET_TABS itself is untouched: `MarketTab` is derived from it, so
             narrowing the array would break every `tab === "Futures"` branch. */
          options={MARKET_TABS.map((t) => ({ key: t, label: t }))}
          value={tab}
          onChange={setTab}
          className={
            FUTURES_OPEN || tab === "Futures"
              ? "self-start"
              : "self-start [&_[data-seg-key=Futures]]:opacity-60"
          }
        />
      </div>

      {/* Table — Futures */}
      {tab === "Futures" ? (
        // Closed venue: the tab answers for itself rather than showing a table
        // nobody can trade from. Everything below is untouched — FUTURES_OPEN
        // brings the real table straight back.
        !FUTURES_OPEN ? (
          <ComingSoon compact className="flex flex-1 flex-col justify-center" />
        ) : futuresLoading ? (
          <SkeletonTable rows={5} cols={4} label="Loading contracts" />
        ) : filteredFutures.length === 0 ? (
          <EmptyState illustration="cryptoTrade" title="No contracts found" description="Try a different search term" />
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border/30 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                  <th className="px-3 sm:px-4 py-2 text-left font-medium">Contract</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">Mark Price</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">24h</th>
                  <th className="hidden sm:table-cell px-4 py-2 text-right font-medium">Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayedFutures.map((market) => {
                  const isUp = market.change24h >= 0
                  return (
                    <tr
                      key={market.symbol}
                      className="cursor-pointer transition-colors hover:bg-accent/30 sm:cursor-default"
                      onClick={() => setTradeItem({
                        type: "futures",
                        symbol: market.symbol,
                        name: market.baseAsset,
                        image: market.image || getCoinImage(market.baseAsset) || "",
                        price: market.markPrice,
                        change24h: market.change24h,
                        leverage: market.maxLeverage,
                      })}
                    >
                      <td className="px-3 sm:px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {(market.image || getCoinImage(market.baseAsset)) ? (
                            <img
                              src={market.image || getCoinImage(market.baseAsset)}
                              alt={market.baseAsset}
                              className="h-5 w-5 shrink-0 rounded-full object-contain ring-1 ring-border/50"
                              onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(market.baseAsset) }}
                            />
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-border/50">
                              {market.baseAsset.slice(0, 3)}
                            </span>
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium leading-none">{market.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">Perp · {market.maxLeverage}×</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-semibold tabular-nums">
                        ${market.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: market.markPrice < 1 ? 4 : 2 })}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right">
                        <ChangeText value={market.change24h} />
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-right">
                        {/* The contract still lists, but while futures is
                            closed nothing here navigates into a venue that
                            cannot take an order. See FUTURES_OPEN. */}
                        {FUTURES_OPEN ? (
                          <a
                            href={`/trade?market=futures&symbol=${market.symbol}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border transition-colors hover:bg-primary hover:text-primary-foreground hover:ring-primary"
                          >
                            Trade
                          </a>
                        ) : (
                          <span title={FUTURES_SOON_TITLE} onClick={(e) => e.stopPropagation()}>
                            <SoonBadge />
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Load More (Futures) */}
            {hasMoreFutures && (
              <div className="flex justify-center p-3">
                <button
                  onClick={() => setVisibleCount((c) => c + 5)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Load More
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        /* Table — Total / Main / Spot */
        (tab === "Spot" && spotLoading) ? (
          <SkeletonTable rows={5} cols={4} label="Loading markets" />
        ) : error && filtered.length === 0 ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            illustration="cryptoTrade"
            title="No results found"
            description="Try a different search term or tab"
          />
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border/30 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                  <th className="px-3 sm:px-4 py-2 text-left font-medium">Pair</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-3 sm:px-4 py-2 text-right font-medium">24h</th>
                  <th className="hidden sm:table-cell px-4 py-2 text-right font-medium">Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayed.map((coin) => (
                  <tr
                    key={coin.symbol}
                    className="cursor-pointer transition-colors hover:bg-accent/30 sm:cursor-default"
                    onClick={() => setTradeItem({
                      type: "spot",
                      symbol: coin.symbol,
                      name: coin.name,
                      image: coin.image,
                      price: coin.price,
                      change24h: coin.change24h,
                    })}
                  >
                    <td className="px-3 sm:px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center shrink-0">
                          {coin.image ? (
                            <img src={coin.image} alt="" className="h-5 w-5 rounded-full ring-1 ring-card" />
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-card">
                              {coin.symbol.slice(0, 2)}
                            </span>
                          )}
                          <img
                            src={USDC_IMAGE}
                            alt=""
                            className="h-4 w-4 rounded-full ring-1 ring-card -ml-1.5"
                          />
                        </div>
                        <span className="font-medium">{coin.displaySymbol}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-right font-semibold tabular-nums">
                      {coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-right">
                      <ChangeText value={coin.change24h} />
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-right">
                      <a
                        href={`/trade?symbol=${coin.symbol}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border transition-colors hover:bg-primary hover:text-primary-foreground hover:ring-primary"
                      >
                        Trade
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
                  onClick={() => setVisibleCount((c) => c + 5)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Load More
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      )}
    </CardShell>
  )
}

/* ========== Recent Trades ========== */

function RecentTrades({ coins, error }: { coins: CoinData[]; error?: string }) {
  const { user } = useAuth()
  const [tab, setTab] = React.useState<"spot" | "futures">("spot")

  // SpotV2 trades
  type SpotV2TradeItem = { id: string; pair: string; token: string; side: string; quantity: number; price: number; quoteAmount: number; realizedPnl: number; fee: number; createdAt: Date }
  const [spotTrades, setSpotTrades] = React.useState<SpotV2TradeItem[]>([])
  const [spotTradesLoading, setSpotTradesLoading] = React.useState(true)

  // Futures fills
  const [futuresFills, setFuturesFills] = React.useState<Array<{ coin: string; px: string; sz: string; side: "B" | "A"; time: number; closedPnl: string }>>([])
  const [futuresLoading, setFuturesLoading] = React.useState(true)

  // Fetch SpotV2 trades
  React.useEffect(() => {
    if (!user) { setSpotTradesLoading(false); return }
    let cancelled = false
    getSpotTradeHistory(10).then((trades) => {
      if (!cancelled) setSpotTrades(trades as SpotV2TradeItem[])
    }).catch(() => {}).finally(() => { if (!cancelled) setSpotTradesLoading(false) })
    return () => { cancelled = true }
  }, [user])

  // Fill history isn't served by the crypto service (mobile has no fill log
  // either) — the futures tab shows open positions instead of past fills.
  React.useEffect(() => {
    setFuturesFills([])
    setFuturesLoading(false)
  }, [user])

  /* "2m ago" needs a now to measure against, and reading the clock during
     render makes the output non-idempotent — two renders in the same tick can
     disagree, and React is allowed to do exactly that. The clock is state,
     ticking once a minute, which is also the resolution these labels have: a
     row that said "Just now" four minutes ago now says "4m ago" on its own,
     which it never used to do without an unrelated re-render. */
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  function formatTime(ts: number | Date) {
    const diff = now - (typeof ts === "number" ? ts : new Date(ts).getTime())
    if (diff < 60_000) return "Just now"
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return `${Math.floor(diff / 86400_000)}d ago`
  }

  /* While futures is closed its panel is a static message, so it must never
     wait on a feed that may never answer. FUTURES_OPEN. */
  const loading = tab === "spot" ? spotTradesLoading : FUTURES_OPEN && futuresLoading

  return (
    <CardShell data-onboarding="dash-trades">
      <CardHeader
        title="Recent Trades"
        subtitle="Your latest fills"
        right={
          <Segmented
            options={[
              { key: "spot", label: "Spot" },
              { key: "futures", label: "Futures" },
            ] as const}
            value={tab}
            onChange={setTab}
            // Pressable; just quieter than the live tab until it is selected.
            // See FUTURES_OPEN.
            className={FUTURES_OPEN || tab === "futures" ? undefined : "[&_[data-seg-key=futures]]:opacity-60"}
          />
        }
      />
      {loading ? (
        <SkeletonRows rows={4} label="Loading trades" />
      ) : tab === "spot" ? (
        spotTrades.length === 0 ? (
          <EmptyState
            illustration="noTransactions"
            title="No spot trades yet"
            description="Your SpotV2 trades will appear here"
            cta={{ label: "Start trading", href: "/trade" }}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {spotTrades.map((trade) => {
              const isBuy = trade.side === "buy" || trade.side === "incoming"
              return (
                <div key={trade.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${isBuy ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit"}`}>
                    {isBuy ? "B" : "S"}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="flex items-center shrink-0">
                        {getCoinImage(trade.token) ? (
                          <img src={getCoinImage(trade.token)} alt="" className="h-4.5 w-4.5 rounded-full ring-1 ring-card" onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(trade.token) }} />
                        ) : (
                          <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary ring-1 ring-card">
                            {trade.token.slice(0, 2)}
                          </span>
                        )}
                        <img src={USDC_IMAGE} alt="" className="h-3.5 w-3.5 rounded-full ring-1 ring-card -ml-1.5" />
                      </span>
                      {trade.pair}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {trade.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} {trade.token}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      {/* price isn't served for these rows — show the fiat value */}
                      ${trade.quoteAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                      {formatTime(trade.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        // Closed venue — see FUTURES_OPEN. The fills list below stays intact.
        !FUTURES_OPEN ? (
          <ComingSoon compact className="flex flex-1 flex-col justify-center" />
        ) : futuresFills.length === 0 ? (
          <EmptyState
            illustration="noTransactions"
            title="No futures trades yet"
            description="Your futures fills will appear here"
            /* No CTA while futures is closed — a button into a venue that
               cannot take an order is worse than no button. FUTURES_OPEN. */
            cta={FUTURES_OPEN ? { label: "Trade Futures", href: "/trade?market=futures" } : undefined}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {futuresFills.map((fill, i) => {
              const isBuy = fill.side === "B"
              return (
                <div key={`${fill.coin}-${fill.time}-${i}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${isBuy ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit"}`}>
                    {isBuy ? "B" : "S"}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{fill.coin}-PERP</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {parseFloat(fill.sz).toLocaleString(undefined, { maximumFractionDigits: 4 })} {fill.coin}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      ${parseFloat(fill.px).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                      {formatTime(fill.time)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </CardShell>
  )
}

/* ========== Watchlist ========== */
function Watchlist({ coins, error }: { coins: CoinData[]; error?: string }) {
  const [watchlistSymbols, setWatchlistSymbols] = React.useState<string[] | null>(null)

  React.useEffect(() => {
    fetchProfile()
      .then((result) => {
        if (result.success && result.profile) {
          setWatchlistSymbols(result.profile.watchlist ?? [])
        } else {
          setWatchlistSymbols([])
        }
      })
      .catch(() => setWatchlistSymbols([]))
  }, [])

  const items = React.useMemo(() => {
    if (watchlistSymbols === null) return null
    if (watchlistSymbols.length === 0) return []
    return coins.filter((c) => watchlistSymbols.includes(c.symbol)).slice(0, 10)
  }, [coins, watchlistSymbols])

  return (
    <CardShell data-onboarding="dash-watchlist">
      <CardHeader
        title="Watchlist"
        subtitle="Starred assets"
        link={{ label: "View all", href: "/trade" }}
      />
      {items === null ? (
        <SkeletonRows rows={6} label="Loading watchlist" />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          illustration="cryptoBuy"
          title="No favorites yet"
          description="Star assets on the Spot page to build your watchlist"
          cta={{ label: "Browse markets", href: "/trade" }}
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/30">
          {items.map((coin) => (
            <div key={coin.symbol} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30">
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
                {coin.change24h !== 0 && <ChangeText value={coin.change24h} className="text-xs" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

/* ========== Empty State — the mobile illustration + outlined gold CTA ====== */
function EmptyState({
  illustration = "noCrypto",
  title,
  description,
  cta,
}: {
  illustration?: IllustrationKey
  title: string
  description: string
  cta?: { label: string; href: string }
}) {
  return (
    <SystemEmptyState
      illustration={illustration}
      title={title}
      description={description}
      ctas={cta ? [cta] : []}
    />
  )
}

/* ========== My Positions ========== */
function MyPositions() {
  const { user } = useAuth()
  const { positions, loading: posLoading } = useHyperliquidPositions()

  // SpotV2 data
  const [spotBalances, setSpotBalances] = React.useState<LedgerBalance[]>([])
  const [spotPositions, setSpotPositions] = React.useState<(PositionInfo & { currentPrice: number })[]>([])
  const [spotLoading, setSpotLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user) { setSpotLoading(false); return }
    let cancelled = false

    async function load() {
      try {
        const [balances, positions] = await Promise.all([
          getSpotBalances(),
          getSpotPositions(),
        ])
        // Get current prices for all position tokens
        const tokens = positions.map((p) => p.token)
        const priceMap = tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()

        if (cancelled) return
        setSpotBalances(balances)
        setSpotPositions(
          positions.map((p) => ({
            ...p,
            currentPrice: priceMap.get(p.token) ?? 0,
          })),
        )
      } catch {
        // silently fail — empty state will show
      } finally {
        if (!cancelled) setSpotLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const [view, setView] = React.useState<"positions" | "spot">("spot")

  /* The Futures view is selectable while the venue is closed — it just shows
     the message instead of positions, so it must never wait on the feed. */
  const loading = view === "positions" ? FUTURES_OPEN && posLoading : spotLoading

  // Footer facts — the card always accounts for itself at the bottom edge.
  const spotHoldingsTotal =
    spotBalances.reduce((s, b) => s + b.available + b.locked, 0) +
    spotPositions.reduce((s, p) => s + p.quantity * p.currentPrice, 0)
  const spotHoldingsCount =
    spotBalances.filter((b) => b.available + b.locked > 0).length + spotPositions.length
  const futuresPnlTotal = positions.reduce((s, p) => s + parseFloat(p.unrealizedPnl), 0)

  return (
    <CardShell>
      <CardHeader
        className="flex-wrap"
        title="My Holdings"
        subtitle="Everything you hold, across every chain"
        right={
          <Segmented
            options={[
              { key: "spot", label: "Spot" },
              { key: "positions", label: "Futures" },
            ] as const}
            value={view}
            onChange={setView}
            // Pressable; just quieter than the live tab until it is selected.
            // See FUTURES_OPEN.
            className={FUTURES_OPEN || view === "positions" ? undefined : "[&_[data-seg-key=positions]]:opacity-60"}
          />
        }
        link={{ label: "View all", href: "/portfolio" }}
      />

      {loading ? (
        <SkeletonRows rows={4} label="Loading holdings" />
      ) : view === "positions" ? (
        // Closed venue — see FUTURES_OPEN. The positions list below stays intact.
        !FUTURES_OPEN ? (
          <ComingSoon compact className="flex flex-1 flex-col justify-center" />
        ) : positions.length === 0 ? (
          <EmptyState
            illustration="cryptoTrade"
            title="No open positions"
            description="Your futures positions will appear here"
            /* No CTA while futures is closed. FUTURES_OPEN. */
            cta={FUTURES_OPEN ? { label: "Trade Futures", href: "/trade?market=futures" } : undefined}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {positions.slice(0, 8).map((pos) => {
              const size = parseFloat(pos.szi)
              const isLong = size > 0
              const pnl = parseFloat(pos.unrealizedPnl)
              const roe = parseFloat(pos.returnOnEquity) * 100
              const isProfit = pnl >= 0
              const lev = pos.leverage ? `${pos.leverage.value}×` : ""
              return (
                <div key={pos.coin} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${isLong ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit"}`}>
                    {isLong ? "L" : "S"}
                  </span>
                  {getCoinImage(pos.coin) ? (
                    <img
                      src={getCoinImage(pos.coin)}
                      alt={pos.coin}
                      className="h-5 w-5 shrink-0 rounded-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(pos.coin) }}
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{pos.coin}-PERP</span>
                    <span className="text-xs text-muted-foreground">{lev} · {Math.abs(size).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-semibold tabular-nums ${isProfit ? "text-credit" : "text-debit"}`}>
                      {isProfit ? "+" : ""}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs tabular-nums ${isProfit ? "text-credit/70" : "text-debit/70"}`}>
                      {isProfit ? "+" : ""}{roe.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )
            })}
            {positions.length > 8 && (
              <a href="/portfolio" className="flex items-center justify-center py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                View all {positions.length} positions
              </a>
            )}
          </div>
        )
      ) : (
        spotBalances.length === 0 && spotPositions.length === 0 ? (
          <EmptyState
            illustration="noCrypto"
            title="No spot holdings"
            description="Your spot assets will appear here"
            cta={{ label: "Trade Spot", href: "/trade" }}
          />
        ) : (
          <div className="flex flex-1 flex-col divide-y divide-border/30">
            {/* USDC balance row */}
            {spotBalances.filter((b) => b.available + b.locked > 0).map((b) => (
              <div key={b.token} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30">
                <img src={USDC_IMAGE} alt="USDC" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{b.token}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {b.locked > 0 ? `${b.available.toLocaleString(undefined, { maximumFractionDigits: 2 })} avail · ${b.locked.toLocaleString(undefined, { maximumFractionDigits: 2 })} locked` : `${(b.available + b.locked).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold tabular-nums">
                    ${(b.available + b.locked).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
            {/* Token positions */}
            {spotPositions.slice(0, 8).map((p) => {
              const currentValue = p.quantity * p.currentPrice
              const costBasis = p.quantity * p.avgEntryPrice
              const pnl = currentValue - costBasis
              const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0
              const isProfit = pnl >= 0
              return (
                <div key={p.token} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30">
                  {getCoinImage(p.token) ? (
                    <img
                      src={getCoinImage(p.token)}
                      alt={p.token}
                      className="h-5 w-5 shrink-0 rounded-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = coinFallback(p.token) }}
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                      {p.token.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{p.token}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{p.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {pnl !== 0 && (
                      <span className={`text-xs font-medium tabular-nums ${isProfit ? "text-credit" : "text-debit"}`}>
                        {isProfit ? "+" : ""}{pnlPercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {spotPositions.length > 8 && (
              <a href="/portfolio" className="flex items-center justify-center py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                View all {spotPositions.length} assets
              </a>
            )}
          </div>
        )
      )}

      {/* Bottom line — the card sums itself, so its full height carries
          information instead of trailing off into empty fill. */}
      {!loading && view === "spot" && spotHoldingsCount > 0 && (
        <div className="mt-auto flex items-center justify-between border-t border-border/30 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {spotHoldingsCount} {spotHoldingsCount === 1 ? "asset" : "assets"}
          </span>
          <span className="text-[13px] font-semibold tabular-nums">
            ${spotHoldingsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
      {/* The futures P&L line is part of the futures panel: while the venue is
          closed the card ends on the message, not on a total. FUTURES_OPEN. */}
      {FUTURES_OPEN && !loading && view === "positions" && positions.length > 0 && (
        <div className="mt-auto flex items-center justify-between border-t border-border/30 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {positions.length} open {positions.length === 1 ? "position" : "positions"}
          </span>
          <span className={`text-[13px] font-semibold tabular-nums ${futuresPnlTotal >= 0 ? "text-credit" : "text-debit"}`}>
            {futuresPnlTotal >= 0 ? "+" : "−"}$
            {Math.abs(futuresPnlTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </CardShell>
  )
}

/* ========== Dashboard Grid ========== */
interface DashboardGridProps {
  coins: CoinData[]
  initialTrades: TradeResult[]
  prices: Record<string, number>
  error?: string
}

export function DashboardGrid({ coins, initialTrades, prices, error }: DashboardGridProps) {
  // Information architecture: three paired rows, ownership first.
  // Row 1 — your money in motion: activity beside everything you hold.
  // Row 2 — the market: the screener beside what you starred.
  // Row 3 — acting on it: your fills beside the swap desk.
  // Each row is its own grid so partners stretch to equal height.
  // Each card carries its own `rise` delay, stepping down the page in reading
  // order — the grid assembles card by card instead of landing as one slab.
  // (This plays when the streamed data mounts, after the skeleton, so it also
  // marks the moment the numbers became real.)
  const cell = (delay: number): React.CSSProperties =>
    ({ "--rise-delay": `${delay}ms` }) as React.CSSProperties
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid w-full gap-4 lg:grid-cols-5">
        <div className="rise min-w-0 lg:col-span-2" style={cell(0)}>
          <ActivityCard />
        </div>
        <div className="rise min-w-0 lg:col-span-3" style={cell(70)}>
          <MyPositions />
        </div>
      </div>

      {/* Wayfinding — the page's one break: "your money" above this line,
          "the market" below it. */}
      <div className="rise flex items-center gap-3 pt-1" style={cell(140)}>
        <Eyebrow>Markets &amp; trading</Eyebrow>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-5">
        <div className="rise min-w-0 lg:col-span-3" style={cell(180)}>
          <MarketsTable coins={coins} error={error} />
        </div>
        {/* Right column carries two cards: the user's stars, then the house
            token — the screener is tall enough to partner both. */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {/* TEMPORARILY OFF (2026-09-02) — the house-token work is still in
              progress, so the card and the MnaBanner that scrolls to it are
              both parked. The Watchlist takes the whole column meanwhile.
              Restore this block together with the <MnaBanner /> in
              app/page.tsx; they only make sense as a pair. */}
          <div className="rise min-w-0 flex-1 [&>div]:h-full" style={cell(250)}>
            <Watchlist coins={coins} error={error} />
          </div>
          {/*
          <div className="rise min-w-0 flex-1 [&>div]:h-full" style={cell(320)}>
            <WorldstreetTokenCard />
          </div>
          */}
        </div>
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-5">
        <div className="rise min-w-0 lg:col-span-3" style={cell(320)}>
          <RecentTrades coins={coins} error={error} />
        </div>
        {/* [&>div]:h-full — the compact swap card is shorter than the trades
            list; stretch its shell so the pair shares one bottom edge. */}
        <div className="rise min-w-0 lg:col-span-2 [&>div]:h-full" style={cell(390)}>
          <SwapClient coins={coins} prices={prices} error={error} compact />
        </div>
      </div>
    </div>
  )
}
