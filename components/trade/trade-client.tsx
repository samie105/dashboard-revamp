"use client"

/**
 * Hyperliquid spot & futures trading — the web equivalent of mobile's
 * HlTradeScreen. Orders execute via the crypto service's /api/trade/* (signed
 * server-side with the caller's session authority); the order book comes
 * straight from Hyperliquid's public info API, exactly as mobile does.
 *
 * URL contract: /trade?market=spot|futures&symbol=BTC — nav and the trade
 * selector deep-link into it.
 *
 * LAYOUT: a full-height exchange workspace (the route renders full-bleed, no
 * sidebar): top bar with pair + 24h stats, chart with the positions/orders
 * panel under it, order book and ticket as fixed right rails — panes separated
 * by hairlines, Binance-fashion, not floating cards. Below lg it becomes a
 * normal scrolling column: chart → ticket → book → positions.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import {
  fetchHlMarkets,
  fetchHlAccount,
  placeSpotOrder,
  placeFuturesOrder,
  closePosition,
  cancelOrder,
  CryptoApiError,
  type HlMarkets,
  type HlAccount,
  type HlOrderOutcome,
} from "@/lib/crypto-api"
import {
  fetchHlOrderBook,
  fetchHl24hStats,
  type HlOrderBook,
  type Hl24hStats,
} from "@/lib/hl-public"
import { CandleChart } from "@/components/trade/candle-chart"
import { OrderBook } from "@/components/trade/order-book"
import { PositionsPanel } from "@/components/trade/positions-panel"
import { MarketsRail } from "@/components/trade/markets-rail"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { BackAction, Eyebrow, Segmented, type SegmentedOption } from "@/components/ui/system"
import { ThemeToggle } from "@/components/theme-toggle"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { registerVividContext } from "@/lib/vivid-page-context"

type Market = "spot" | "futures"
type Side = "buy" | "sell"
type OrderType = "market" | "limit"

const MARKET_TABS: readonly SegmentedOption<Market>[] = [
  { key: "spot", label: "Spot" },
  { key: "futures", label: "Futures" },
]
const ORDER_TYPES: readonly SegmentedOption<OrderType>[] = [
  { key: "market", label: "Market" },
  { key: "limit", label: "Limit" },
]

function fmtPx(p: number) {
  return p.toLocaleString(undefined, { maximumFractionDigits: p < 1 ? 6 : 2 })
}

/** A labelled figure in the market strip — Eyebrow over a tabular value. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="hidden shrink-0 flex-col gap-0.5 md:flex">
      <Eyebrow className="text-[10px] tracking-[0.1em]">{label}</Eyebrow>
      <span className="text-[13px] font-medium tabular-nums">{value}</span>
    </span>
  )
}

function fmtCompact(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export function TradeClient() {
  const params = useSearchParams()
  const router = useRouter()
  const { openFlow } = useMoneyFlow()

  const market: Market = params.get("market") === "futures" ? "futures" : "spot"
  const urlSymbol = params.get("symbol") ?? params.get("pair") ?? ""

  const [markets, setMarkets] = React.useState<HlMarkets | null>(null)
  const [symbol, setSymbol] = React.useState<string>("")
  const [account, setAccount] = React.useState<HlAccount | null>(null)
  const [book, setBook] = React.useState<HlOrderBook | null>(null)
  const [stats, setStats] = React.useState<Hl24hStats | null>(null)
  const [lastTick, setLastTick] = React.useState<"up" | "down" | null>(null)
  const prevMidRef = React.useRef(0)
  const [side, setSide] = React.useState<Side>("buy")
  const [orderType, setOrderType] = React.useState<OrderType>("market")
  const [amountUsd, setAmountUsd] = React.useState("")
  const [limitPrice, setLimitPrice] = React.useState("")
  const [leverage, setLeverage] = React.useState(1)
  const [tpPrice, setTpPrice] = React.useState("")
  const [slPrice, setSlPrice] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [outcome, setOutcome] = React.useState<HlOrderOutcome | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  // Mobile-only view state: which pane sits under the chart, and whether the
  // order ticket sheet is up.
  const [mobilePane, setMobilePane] = React.useState<"book" | "positions" | "orders">("book")
  const [ticketOpen, setTicketOpen] = React.useState(false)
  // Load failures are tracked apart from order errors: an unreachable account
  // must never be mistaken for an account that exists but isn't set up.
  const [marketsError, setMarketsError] = React.useState(false)
  const [accountError, setAccountError] = React.useState(false)

  // Markets + account
  const refreshAccount = React.useCallback(() => {
    fetchHlAccount()
      .then((a) => { setAccount(a); setAccountError(false) })
      .catch(() => setAccountError(true))
  }, [])

  const loadMarkets = React.useCallback(() => {
    setMarketsError(false)
    fetchHlMarkets().then(setMarkets).catch(() => setMarketsError(true))
  }, [])

  React.useEffect(() => {
    loadMarkets()
    refreshAccount()
    const id = setInterval(refreshAccount, 15_000)
    return () => clearInterval(id)
  }, [loadMarkets, refreshAccount])

  // Pick default/URL symbol once markets load.
  const list = React.useMemo(
    () => (market === "spot" ? (markets?.spot ?? []) : (markets?.futures ?? [])),
    [markets, market],
  )
  React.useEffect(() => {
    if (!list.length) return
    const wanted = urlSymbol.toUpperCase()
    const match = list.find((m) => m.symbol.toUpperCase() === wanted)
    setSymbol(match?.symbol ?? (list.find((m) => m.symbol === "BTC")?.symbol ?? list[0].symbol))
  }, [list, urlSymbol])

  const current = React.useMemo(() => list.find((m) => m.symbol === symbol), [list, symbol])
  const maxLev = current && "maxLeverage" in current ? current.maxLeverage : 1

  // Clamp leverage when switching to a contract with a lower max — otherwise
  // the stale higher value is displayed and sent. Futures only: on the Spot
  // tab maxLev is 1 and must not wipe the user's futures setting.
  React.useEffect(() => {
    if (market !== "futures" || !current) return
    setLeverage((l) => Math.min(l, maxLev))
  }, [market, current, maxLev])

  // A new symbol or market invalidates everything priced in the old one.
  React.useEffect(() => {
    setLimitPrice("")
    setTpPrice("")
    setSlPrice("")
    setOutcome(null)
    setError(null)
  }, [symbol, market])

  // Order book — futures use the bare symbol; spot uses the coinName.
  const bookCoin = React.useMemo(() => {
    if (!current) return null
    return market === "spot" ? (current as { coinName: string }).coinName : current.symbol
  }, [current, market])

  React.useEffect(() => {
    if (!bookCoin) return
    let cancelled = false
    setBook(null) // don't show the previous coin's book/price while loading
    prevMidRef.current = 0
    setLastTick(null)
    const load = () =>
      fetchHlOrderBook(bookCoin, 22)
        .then((b) => {
          if (cancelled) return
          if (prevMidRef.current > 0 && b.midPrice !== prevMidRef.current) {
            setLastTick(b.midPrice > prevMidRef.current ? "up" : "down")
          }
          prevMidRef.current = b.midPrice
          setBook(b)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [bookCoin])

  // 24h stats for the header — derived from public candles, refreshed slowly.
  React.useEffect(() => {
    if (!bookCoin) return
    let cancelled = false
    setStats(null)
    const load = () =>
      fetchHl24hStats(bookCoin).then((s) => { if (!cancelled) setStats(s) }).catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [bookCoin])

  const price = book?.midPrice ?? current?.price ?? 0
  const amt = parseFloat(amountUsd) || 0

  // TP/SL sanity — triggers are validated against the expected entry price
  // (limit price for limit orders, mid price for market orders).
  const entryRef = orderType === "limit" ? parseFloat(limitPrice) || 0 : price
  const tp = parseFloat(tpPrice) || 0
  const sl = parseFloat(slPrice) || 0
  const tpslError = React.useMemo(() => {
    if (market !== "futures" || entryRef <= 0) return null
    if (tp > 0 && (side === "buy" ? tp <= entryRef : tp >= entryRef))
      return `Take profit must be ${side === "buy" ? "above" : "below"} the entry price`
    if (sl > 0 && (side === "buy" ? sl >= entryRef : sl <= entryRef))
      return `Stop loss must be ${side === "buy" ? "below" : "above"} the entry price`
    return null
  }, [market, entryRef, tp, sl, side])

  const minOrder = markets?.minOrderUsd ?? 10
  const canSubmit =
    !submitting && !!current && amt >= minOrder &&
    (orderType === "market" || parseFloat(limitPrice) > 0) && !tpslError

  // Switching market carries no symbol: a spot pair name is meaningless on the
  // perps list (and vice versa), so the selection effect picks that market's
  // default and the sync effect below writes it back to the URL.
  function setMarketTab(m: Market) {
    router.replace(`/trade?market=${m}`)
  }

  // Keep the address bar honest — it's what gets refreshed, shared and
  // bookmarked, so it must name the pair actually on screen.
  React.useEffect(() => {
    if (!symbol || urlSymbol.toUpperCase() === symbol.toUpperCase()) return
    router.replace(`/trade?market=${market}&symbol=${symbol}`)
  }, [symbol, market, urlSymbol, router])

  async function submit() {
    if (!current) return
    setSubmitting(true)
    setError(null)
    setOutcome(null)
    try {
      const base = {
        symbol: current.symbol,
        side,
        orderType,
        amountUsd: amt,
        ...(orderType === "limit" ? { limitPrice: parseFloat(limitPrice) } : {}),
      }
      const res =
        market === "spot"
          ? await placeSpotOrder(base)
          : await placeFuturesOrder({
              ...base,
              leverage,
              ...(tp > 0 ? { takeProfitPrice: tp } : {}),
              ...(sl > 0 ? { stopLossPrice: sl } : {}),
            })
      setOutcome(res)
      if (!res.success && res.error) setError(res.error)
      refreshAccount()
    } catch (e) {
      setError(e instanceof CryptoApiError ? e.message : "Order failed. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose(sym: string) {
    setBusyKey(`close:${sym}`)
    try {
      await closePosition({ symbol: sym })
      refreshAccount()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed")
    } finally {
      setBusyKey(null)
    }
  }

  async function handleCancel(oid: number, sym: string, mkt: Market) {
    setBusyKey(`cancel:${oid}`)
    try {
      await cancelOrder({ oid, symbol: sym, market: mkt })
      refreshAccount()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed")
    } finally {
      setBusyKey(null)
    }
  }

  // Publish the live workspace state for Vivid's getCurrentPageContext.
  const vividSnap = React.useRef<Record<string, unknown>>({})
  vividSnap.current = {
    market,
    pair: symbol,
    livePrice: price,
    ticket: {
      side: market === "futures" ? (side === "buy" ? "long" : "short") : side,
      orderType,
      amountUsd: amountUsd || "(empty)",
      ...(orderType === "limit" ? { limitPrice: limitPrice || "(empty)" } : {}),
      ...(market === "futures" ? { leverage, takeProfit: tpPrice || null, stopLoss: slPrice || null } : {}),
      readyToSubmit: canSubmit,
      ...(canSubmit ? {} : { blockedBecause: !current ? "markets not loaded" : amt < minOrder ? `amount below the ${minOrder} minimum` : tpslError ?? "limit price missing" }),
    },
    openPositions: account?.positions.length ?? 0,
    openOrders: account?.openOrders.length ?? 0,
    tradingAccountReady: account?.ready ?? false,
  }
  React.useEffect(() => registerVividContext("tradeWorkspace", () => vividSnap.current), [])

  const filtered = React.useMemo(() => {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter((m) => m.symbol.toLowerCase().includes(q))
  }, [list, search])

  // Book click → hand the price to the ticket as a limit order.
  const pickPrice = React.useCallback((p: number) => {
    setOrderType("limit")
    setLimitPrice(String(p))
  }, [])

  const ready = account?.ready ?? false
  const balances = account?.balances
  const positionCount = account?.positions.length ?? 0
  const orderCount = account?.openOrders.length ?? 0

  // Percent chips: the notional the balance can actually carry. Spot sells
  // spend the token, not USDC, so no honest max exists there.
  const maxNotional =
    market === "spot"
      ? side === "buy"
        ? balances?.spotUsdc ?? 0
        : 0
      : (balances?.perpsWithdrawableUsdc ?? 0) * leverage

  const changeUp = (stats?.changePct ?? 0) >= 0

  /* ── Pair picker dropdown ─────────────────────────────────────────────── */
  const picker = pickerOpen && (
    <>
      <button
        aria-label="Close market picker"
        className="fixed inset-0 z-40 cursor-default"
        onClick={() => { setPickerOpen(false); setSearch("") }}
      />
      <div className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-border/40">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search markets…"
          autoFocus
          data-vivid-target="trade-pair-search"
          data-vivid-label="Search the pair list"
          className="w-full rounded-xl bg-surface-sunken px-3 py-2 text-sm outline-none placeholder:text-subtle"
        />
        <div className="mt-1.5 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No markets match.</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.symbol}
                onClick={() => { setSymbol(m.symbol); setPickerOpen(false); setSearch("") }}
                data-vivid-target={`pick-pair-${m.symbol}`}
                data-vivid-label={`Switch to the ${m.symbol} market`}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent ${m.symbol === symbol ? "bg-accent" : ""}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <CoinAvatar symbol={"coinName" in m ? m.coinName : m.symbol} size="md" />
                  {m.symbol}
                  <span className="ml-1 text-[10px] font-medium text-subtle">
                    {market === "futures" ? "PERP" : "USDC"}
                  </span>
                  {"maxLeverage" in m && (
                    <span className="ml-1.5 rounded bg-primary/[0.12] px-1 py-0.5 text-[9px] font-bold text-primary">
                      {m.maxLeverage}×
                    </span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">${fmtPx(m.price)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )

  /* ── Order ticket ─────────────────────────────────────────────────────── */
  const ticket = accountError ? (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
      </span>
      <div>
        <p className="text-sm font-semibold">Can&apos;t reach your trading account</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Your balances and positions couldn&apos;t be loaded, so orders are on hold. Nothing has
          been placed or cancelled.
        </p>
      </div>
      <button
        onClick={refreshAccount}
        className="mt-1 flex h-10 w-full items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold transition-colors hover:bg-accent"
      >
        Try again
      </button>
    </div>
  ) : !account ? (
    <div className="flex flex-col gap-3 p-3.5">
      <div className="grid grid-cols-2 gap-1.5">
        <div className="h-10 animate-pulse rounded-xl bg-surface-sunken" />
        <div className="h-10 animate-pulse rounded-xl bg-surface-sunken" />
      </div>
      <div className="h-7 w-32 animate-pulse rounded-full bg-surface-sunken" />
      <div className="h-[52px] animate-pulse rounded-xl bg-surface-sunken" />
      <div className="h-11 animate-pulse rounded-full bg-surface-sunken" />
    </div>
  ) : !ready ? (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/[0.12]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
      </span>
      <div>
        <p className="text-sm font-semibold">Trading account not set up</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          One-time setup, then fund it with USDC to start trading.
        </p>
      </div>
      <button
        onClick={() => openFlow("fund")}
        className="mt-1 flex h-10 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Set up &amp; fund
      </button>
    </div>
  ) : (
    <div className="flex flex-col gap-3 p-3.5">
      {/* Side */}
      <div className="grid grid-cols-2 gap-1.5">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            data-vivid-target={s === "buy" ? "trade-side-buy" : "trade-side-sell"}
            data-vivid-label={market === "futures" ? (s === "buy" ? "Long side" : "Short side") : (s === "buy" ? "Buy side" : "Sell side")}
            className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${
              side === s
                ? s === "buy" ? "bg-credit text-white" : "bg-debit text-white"
                : "bg-surface-sunken text-muted-foreground hover:bg-accent"
            }`}
          >
            {market === "futures" ? (s === "buy" ? "Long" : "Short") : (s === "buy" ? "Buy" : "Sell")}
          </button>
        ))}
      </div>

      {/* Type — the house Segmented, same control as everywhere else */}
      <Segmented
        size="sm"
        value={orderType}
        onChange={setOrderType}
        options={ORDER_TYPES}
        className="self-start"
        vividPrefix="order-type"
      />

      {orderType === "limit" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-subtle">Limit price</span>
          <div className="flex items-center rounded-xl bg-surface-sunken focus-within:ring-1 focus-within:ring-foreground/[0.12]">
            <input
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              data-vivid-target="trade-limit-price"
              data-vivid-label="Limit price in USD"
              placeholder={price ? fmtPx(price) : "…"}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none placeholder:text-subtle"
            />
            <span className="pr-3 text-xs text-subtle">USD</span>
          </div>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-xs text-subtle">
          <span>Amount</span>
          {market === "spot" && side === "buy" && balances && (
            <span className="tabular-nums">avail ${balances.spotUsdc.toFixed(2)}</span>
          )}
          {market === "futures" && balances && (
            <span className="tabular-nums">avail ${balances.perpsWithdrawableUsdc.toFixed(2)}</span>
          )}
        </span>
        <div className="flex items-center rounded-xl bg-surface-sunken focus-within:ring-1 focus-within:ring-foreground/[0.12]">
          <input
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            data-vivid-target="trade-amount"
            data-vivid-label="Order amount in USD (the notional)"
            placeholder={`Min ${minOrder}`}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none placeholder:text-subtle"
          />
          <span className="pr-3 text-[11px] text-subtle">USD</span>
        </div>
      </label>

      {maxNotional > 0 && (
        <div className="grid grid-cols-4 gap-1">
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              data-vivid-target={pct === 1 ? "trade-amount-max" : `trade-amount-${pct * 100}pct`}
              data-vivid-label={pct === 1 ? "Use the full available balance" : `Use ${pct * 100}% of the available balance`}
              onClick={() =>
                setAmountUsd(
                  pct === 1
                    ? String(Math.floor(maxNotional * 100) / 100)
                    : (maxNotional * pct).toFixed(2),
                )
              }
              className="rounded-lg bg-surface-sunken py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {pct === 1 ? "Max" : `${pct * 100}%`}
            </button>
          ))}
        </div>
      )}

      {market === "futures" && (
        <div>
          <div className="flex justify-between text-xs text-subtle">
            <span>Leverage</span>
            <span className="font-bold tabular-nums text-foreground">{leverage}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxLev}
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            data-vivid-target="trade-leverage"
            data-vivid-label={`Leverage slider, 1 to ${maxLev}. Fill with a whole number.`}
            className="mt-1 w-full accent-[var(--primary)]"
          />
          <div className="flex justify-between text-[9px] text-subtle">
            <span>1×</span>
            <span>{maxLev}×</span>
          </div>
        </div>
      )}

      {market === "futures" && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-subtle">Take profit</span>
            <input
              value={tpPrice}
              onChange={(e) => setTpPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              data-vivid-target="trade-take-profit"
              data-vivid-label="Take profit trigger price (optional)"
              placeholder="Optional"
              className="rounded-xl bg-surface-sunken px-3 py-2 text-sm tabular-nums outline-none placeholder:text-subtle focus:ring-1 focus:ring-credit/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-subtle">Stop loss</span>
            <input
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              data-vivid-target="trade-stop-loss"
              data-vivid-label="Stop loss trigger price (optional)"
              placeholder="Optional"
              className="rounded-xl bg-surface-sunken px-3 py-2 text-sm tabular-nums outline-none placeholder:text-subtle focus:ring-1 focus:ring-debit/40"
            />
          </label>
        </div>
      )}

      {tpslError && (
        <p role="alert" className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs leading-relaxed text-warning">{tpslError}</p>
      )}

      {amt > 0 && price > 0 && (
        <div className="divide-y divide-border/15 rounded-xl bg-surface-sunken/70 px-3 text-xs tabular-nums">
          <div className="flex justify-between py-1.5">
            <span className="text-subtle">Qty</span>
            {/* Amount IS the notional; leverage only sets the margin used. */}
            <span>≈ {(amt / price).toFixed(6)} {symbol}</span>
          </div>
          {market === "futures" && leverage > 1 && (
            <div className="flex justify-between py-1.5">
              <span className="text-subtle">Margin at {leverage}×</span>
              <span>≈ ${(amt / leverage).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-debit-chip px-2.5 py-1.5 text-xs leading-relaxed text-debit">{error}</p>
      )}
      {outcome?.success && (
        <p role="status" className="rounded-lg bg-credit-chip px-2.5 py-1.5 text-xs leading-relaxed text-credit">
          {outcome.resting
            ? "Limit order resting on the book."
            : `Filled ${outcome.filledSize ?? ""} ${outcome.symbol} @ $${outcome.avgFillPrice?.toFixed(2) ?? "—"}`}
        </p>
      )}
      {outcome?.success && outcome.tpslWarning && (
        <p role="alert" className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-xs font-semibold leading-relaxed text-warning">
          ⚠ {outcome.tpslWarning} — your position is open without that protection.
        </p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        data-vivid-target="trade-submit"
        data-vivid-guard=""
        data-vivid-label={`Place the order — ${market === "futures" ? (side === "buy" ? "long" : "short") : side} ${symbol} for the amount shown. Moves real money.`}
        className={`w-full rounded-full py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          side === "buy" ? "bg-credit hover:bg-credit/90" : "bg-debit hover:bg-debit/90"
        }`}
      >
        {submitting
          ? "Placing…"
          : `${market === "futures" ? (side === "buy" ? "Long" : "Short") : side === "buy" ? "Buy" : "Sell"} ${symbol}`}
      </button>
    </div>
  )

  /* ── Workspace ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/30 px-3 py-2.5 sm:gap-x-5 lg:flex-nowrap">
        {/* This route has no sidebar or navbar, so it carries its own way
            out — a back control, not just a clickable logo. */}
        <div className="order-1 flex shrink-0 items-center gap-1.5 lg:order-none">
          <BackAction to="/" className="mt-0" />
          <Link href="/" className="hidden items-center sm:flex" title="Dashboard">
            <Image src="/worldstreet-logo/WorldStreet1x.png" alt="Worldstreet" width={72} height={18} className="h-[18px] w-auto object-contain" />
          </Link>
        </div>
        <span className="hidden h-6 w-px bg-border/40 sm:block" />

        {/* Market toggle */}
        <Segmented
          value={market}
          onChange={setMarketTab}
          options={MARKET_TABS}
          className="order-4 shrink-0 lg:order-none"
          vividPrefix="market-tab"
        />

        {/* Pair — the rail owns switching on wide screens; this dropdown
            covers every width below xl and still works above it. */}
        <div className="relative order-2 shrink-0 lg:order-none">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            data-vivid-target="trade-pair-picker"
            data-vivid-label="Open the pair picker dropdown"
            className="flex items-center gap-1.5 rounded-xl bg-surface-sunken px-2.5 py-2 text-[15px] font-bold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-3.5"
          >
            <CoinAvatar symbol={bookCoin ?? symbol} size="md" />
            {symbol || "—"}
            <span className="hidden text-[11px] font-semibold text-subtle sm:inline">{market === "futures" ? "PERP" : "/USDC"}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-subtle"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {picker}
        </div>

        {/* Price + 24h stats */}
        <div className="order-3 ml-auto flex min-w-0 items-center gap-3 overflow-x-auto scrollbar-none sm:gap-5 lg:order-none lg:ml-0">
          <span
            aria-live="polite"
            className={`shrink-0 text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${
              lastTick === "up" ? "text-credit" : lastTick === "down" ? "text-debit" : ""
            }`}
          >
            ${fmtPx(price)}
          </span>
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${changeUp ? "text-credit" : "text-debit"}`}>
            {stats ? `${changeUp ? "+" : ""}${stats.changePct.toFixed(2)}%` : "—"}
          </span>
          <Stat label="24h High" value={stats ? `$${fmtPx(stats.high)}` : "—"} />
          <Stat label="24h Low" value={stats ? `$${fmtPx(stats.low)}` : "—"} />
          <Stat label="24h Volume" value={stats ? fmtCompact(stats.quoteVolume) : "—"} />
        </div>

        {/* Balances + money doors */}
        <div className="order-5 ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:order-none">
          {balances && (
            <span className="hidden text-xs tabular-nums text-muted-foreground 2xl:block">
              Spot <span className="font-semibold text-foreground">${balances.spotUsdc.toFixed(2)}</span>
              <span className="mx-1 text-subtle">·</span>
              Futures <span className="font-semibold text-foreground">${balances.perpsWithdrawableUsdc.toFixed(2)}</span>
            </span>
          )}
          {/* Funding is a detour from trading, not a destination — it opens
              over the workspace so the chart and the ticket keep their state. */}
          <button
            onClick={() => openFlow("fund")}
            data-vivid-target="trade-fund-button"
            data-vivid-label="Open the fund-trading-account modal"
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 sm:py-2 sm:text-sm"
          >
            Fund
          </button>
          <button
            onClick={() => openFlow("trading-withdraw")}
            data-vivid-target="trade-withdraw-button"
            data-vivid-label="Open the withdraw-trading-balance modal"
            className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 sm:py-2 sm:text-sm"
          >
            Withdraw
          </button>
          <span className="hidden h-6 w-px bg-border/40 sm:block" />
          {/* The shell's chrome doesn't reach this route, so the theme control
              travels with it. */}
          <ThemeToggle />
        </div>
      </div>

      {/* Workspace body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Markets rail — the full list lives on the left so switching pairs
            is one click, not a menu dive. */}
        <MarketsRail
          list={list}
          market={market}
          symbol={symbol}
          onSelect={setSymbol}
          className="hidden w-[236px] shrink-0 border-r border-border/30 xl:flex"
        />

        {/* Chart + bottom panel */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className="h-[260px] shrink-0 sm:h-[320px] lg:h-auto lg:min-h-0 lg:flex-1"
            data-vivid-target="price-chart"
            data-vivid-label="The candlestick price chart"
          >
            {marketsError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-chip">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
                </span>
                <div>
                  <p className="text-sm font-semibold">Markets couldn&apos;t be loaded</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    Prices and the order book are unavailable right now. Your balances and open
                    positions are unaffected.
                  </p>
                </div>
                <button
                  onClick={loadMarkets}
                  className="rounded-full bg-surface-sunken px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent"
                >
                  Try again
                </button>
              </div>
            ) : !bookCoin ? (
              <div className="flex h-full items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-border/40 border-t-primary" />
              </div>
            ) : (
              <CandleChart coin={bookCoin} />
            )}
          </div>
          <PositionsPanel
            account={account}
            busyKey={busyKey}
            onClosePosition={handleClose}
            onCancelOrder={handleCancel}
            className="hidden h-[228px] shrink-0 border-t border-border/30 lg:flex"
          />

          {/* Below lg the book and positions share one pane instead of
              stacking into an endless scroll — one tap to compare, and the
              chart above never leaves the screen. */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-border/30 lg:hidden">
            <div className="flex shrink-0 items-center border-b border-border/30 px-2 py-1.5">
              <Segmented
                size="sm"
                value={mobilePane}
                onChange={setMobilePane}
                options={[
                  { key: "book", label: "Book" },
                  { key: "positions", label: positionCount ? `Positions · ${positionCount}` : "Positions" },
                  { key: "orders", label: orderCount ? `Orders · ${orderCount}` : "Orders" },
                ]}
              />
            </div>
            {mobilePane === "book" ? (
              <OrderBook
                book={book}
                lastTick={lastTick}
                onPickPrice={(p) => { pickPrice(p); setTicketOpen(true) }}
                className="min-h-0 flex-1"
              />
            ) : (
              <PositionsPanel
                account={account}
                busyKey={busyKey}
                onClosePosition={handleClose}
                onCancelOrder={handleCancel}
                className="min-h-0 flex-1"
                hideTabs
                tab={mobilePane === "orders" ? "orders" : "positions"}
              />
            )}
          </div>
        </div>

        {/* Order book rail */}
        <OrderBook
          book={book}
          lastTick={lastTick}
          onPickPrice={pickPrice}
          className="hidden w-[248px] shrink-0 border-l border-border/30 lg:flex xl:w-[276px]"
        />

        {/* Ticket rail — desktop keeps it always-on; below lg it becomes the
            bottom sheet the action bar opens, so the chart owns the screen. */}
        <aside className="hidden shrink-0 lg:block lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-border/30 xl:w-[320px]">
          {ticket}
        </aside>
      </div>

      {/* Mobile action bar — the ticket is one tap away at all times, and the
          tap already says which side you meant. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border/30 bg-background px-3 py-2.5 safe-area-bottom lg:hidden">
        <button
          onClick={() => { setSide("buy"); setTicketOpen(true) }}
          data-vivid-target="trade-open-ticket-long"
          data-vivid-label="Open the order ticket on the buy/long side"
          className="flex-1 rounded-full bg-credit py-3 text-sm font-bold text-white transition-colors hover:bg-credit/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-credit/40"
        >
          {market === "futures" ? "Long" : "Buy"}
        </button>
        <button
          onClick={() => { setSide("sell"); setTicketOpen(true) }}
          data-vivid-target="trade-open-ticket-short"
          data-vivid-label="Open the order ticket on the sell/short side"
          className="flex-1 rounded-full bg-debit py-3 text-sm font-bold text-white transition-colors hover:bg-debit/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-debit/40"
        >
          {market === "futures" ? "Short" : "Sell"}
        </button>
      </div>

      {/* Ticket sheet (mobile) */}
      <Dialog.Root open={ticketOpen} onOpenChange={setTicketOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm lg:hidden" />
          <Dialog.Popup
            aria-label={`${market === "futures" ? (side === "buy" ? "Long" : "Short") : side === "buy" ? "Buy" : "Sell"} ${symbol}`}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] translate-y-0 flex-col rounded-t-2xl bg-card outline-none transition-transform duration-300 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full safe-area-bottom lg:hidden"
          >
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/[0.16]" />
            <div className="flex shrink-0 items-center justify-between px-4 pt-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                <CoinAvatar symbol={bookCoin ?? symbol} size="sm" />
                {symbol}
                <span className="text-[11px] font-semibold text-subtle">
                  {market === "futures" ? "PERP" : "/USDC"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setTicketOpen(false)}
                aria-label="Close"
                className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{ticket}</div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
