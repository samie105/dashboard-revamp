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

type Market = "spot" | "futures"
type Side = "buy" | "sell"
type OrderType = "market" | "limit"

function fmtPx(p: number) {
  return p.toLocaleString(undefined, { maximumFractionDigits: p < 1 ? 6 : 2 })
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

  // Markets + account
  const refreshAccount = React.useCallback(() => {
    fetchHlAccount().then(setAccount).catch(() => {})
  }, [])

  React.useEffect(() => {
    fetchHlMarkets().then(setMarkets).catch(() => setError("Failed to load markets"))
    refreshAccount()
    const id = setInterval(refreshAccount, 15_000)
    return () => clearInterval(id)
  }, [refreshAccount])

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
      fetchHlOrderBook(bookCoin, 14)
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

  function setMarketTab(m: Market) {
    router.replace(`/trade?market=${m}${symbol ? `&symbol=${symbol}` : ""}`)
  }

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
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent ${m.symbol === symbol ? "bg-accent" : ""}`}
              >
                <span className="font-semibold">
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
  const ticket = !ready ? (
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
      <Link
        href="/fund"
        className="mt-1 flex h-10 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Set up &amp; fund
      </Link>
    </div>
  ) : (
    <div className="flex flex-col gap-3 p-3.5">
      {/* Side */}
      <div className="grid grid-cols-2 gap-1.5">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
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

      {/* Type */}
      <div className="flex items-center gap-0.5 self-start rounded-full bg-surface-sunken p-0.5">
        {(["market", "limit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              orderType === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "market" ? "Market" : "Limit"}
          </button>
        ))}
      </div>

      {orderType === "limit" && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-subtle">Limit price</span>
          <div className="flex items-center rounded-xl bg-surface-sunken focus-within:ring-1 focus-within:ring-foreground/[0.12]">
            <input
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder={price ? fmtPx(price) : "…"}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none placeholder:text-subtle"
            />
            <span className="pr-3 text-[11px] text-subtle">USD</span>
          </div>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-[11px] text-subtle">
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
              onClick={() =>
                setAmountUsd(
                  pct === 1
                    ? String(Math.floor(maxNotional * 100) / 100)
                    : (maxNotional * pct).toFixed(2),
                )
              }
              className="rounded-lg bg-surface-sunken py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {pct === 1 ? "Max" : `${pct * 100}%`}
            </button>
          ))}
        </div>
      )}

      {market === "futures" && (
        <div>
          <div className="flex justify-between text-[11px] text-subtle">
            <span>Leverage</span>
            <span className="font-bold tabular-nums text-foreground">{leverage}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxLev}
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
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
            <span className="text-[11px] text-subtle">Take profit</span>
            <input
              value={tpPrice}
              onChange={(e) => setTpPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="Optional"
              className="rounded-xl bg-surface-sunken px-3 py-2 text-sm tabular-nums outline-none placeholder:text-subtle focus:ring-1 focus:ring-credit/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-subtle">Stop loss</span>
            <input
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="Optional"
              className="rounded-xl bg-surface-sunken px-3 py-2 text-sm tabular-nums outline-none placeholder:text-subtle focus:ring-1 focus:ring-debit/40"
            />
          </label>
        </div>
      )}

      {tpslError && (
        <p className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-[11px] leading-relaxed text-warning">{tpslError}</p>
      )}

      {amt > 0 && price > 0 && (
        <div className="divide-y divide-border/15 rounded-xl bg-surface-sunken/70 px-3 text-[11px] tabular-nums">
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
        <p className="rounded-lg bg-debit-chip px-2.5 py-1.5 text-[11px] leading-relaxed text-debit">{error}</p>
      )}
      {outcome?.success && (
        <p className="rounded-lg bg-credit-chip px-2.5 py-1.5 text-[11px] leading-relaxed text-credit">
          {outcome.resting
            ? "Limit order resting on the book."
            : `Filled ${outcome.filledSize ?? ""} ${outcome.symbol} @ $${outcome.avgFillPrice?.toFixed(2) ?? "—"}`}
        </p>
      )}
      {outcome?.success && outcome.tpslWarning && (
        <p className="rounded-lg bg-warning-chip px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-warning">
          ⚠ {outcome.tpslWarning} — your position is open without that protection.
        </p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
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
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background lg:overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/30 px-3 py-2 lg:flex-nowrap">
        <Link href="/" className="flex shrink-0 items-center gap-2" title="Back to dashboard">
          <Image src="/worldstreet-logo/WorldStreet1x.png" alt="Worldstreet" width={72} height={18} className="h-[18px] w-auto object-contain" />
        </Link>
        <span className="hidden h-5 w-px bg-border/40 sm:block" />

        {/* Market toggle */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-sunken p-0.5">
          {(["spot", "futures"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMarketTab(m)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                market === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "spot" ? "Spot" : "Futures"}
            </button>
          ))}
        </div>

        {/* Pair */}
        <div className="relative shrink-0">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-surface-sunken px-3 py-1.5 text-sm font-bold transition-colors hover:bg-accent"
          >
            {symbol || "—"}
            <span className="text-[10px] font-semibold text-subtle">{market === "futures" ? "PERP" : "/USDC"}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-subtle"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {picker}
        </div>

        {/* Price + 24h stats */}
        <div className="flex min-w-0 items-center gap-4 overflow-x-auto scrollbar-none">
          <span
            className={`shrink-0 text-lg font-bold tabular-nums ${
              lastTick === "up" ? "text-credit" : lastTick === "down" ? "text-debit" : ""
            }`}
          >
            ${fmtPx(price)}
          </span>
          <span className={`shrink-0 text-xs font-semibold tabular-nums ${changeUp ? "text-credit" : "text-debit"}`}>
            {stats ? `${changeUp ? "+" : ""}${stats.changePct.toFixed(2)}%` : "—"}
          </span>
          <span className="hidden shrink-0 flex-col md:flex">
            <span className="text-[9px] uppercase tracking-wide text-subtle">24h High</span>
            <span className="text-[11px] font-medium tabular-nums">{stats ? `$${fmtPx(stats.high)}` : "—"}</span>
          </span>
          <span className="hidden shrink-0 flex-col md:flex">
            <span className="text-[9px] uppercase tracking-wide text-subtle">24h Low</span>
            <span className="text-[11px] font-medium tabular-nums">{stats ? `$${fmtPx(stats.low)}` : "—"}</span>
          </span>
          <span className="hidden shrink-0 flex-col md:flex">
            <span className="text-[9px] uppercase tracking-wide text-subtle">24h Volume</span>
            <span className="text-[11px] font-medium tabular-nums">{stats ? fmtCompact(stats.quoteVolume) : "—"}</span>
          </span>
        </div>

        {/* Balances + money doors */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {balances && (
            <span className="hidden text-[11px] tabular-nums text-muted-foreground xl:block">
              Spot <span className="font-semibold text-foreground">${balances.spotUsdc.toFixed(2)}</span>
              <span className="mx-1 text-subtle">·</span>
              Futures <span className="font-semibold text-foreground">${balances.perpsWithdrawableUsdc.toFixed(2)}</span>
            </span>
          )}
          <Link href="/fund" className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90">
            Fund
          </Link>
          <Link href="/trading-withdraw" className="rounded-full bg-surface-sunken px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-accent">
            Withdraw
          </Link>
        </div>
      </div>

      {/* Workspace body */}
      <div className="flex min-h-0 flex-col lg:flex-1 lg:flex-row">
        {/* Chart + bottom panel */}
        <div className="flex min-h-0 min-w-0 flex-col lg:flex-1">
          <div className="h-[340px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
            <CandleChart coin={bookCoin} />
          </div>
          <PositionsPanel
            account={account}
            busyKey={busyKey}
            onClosePosition={handleClose}
            onCancelOrder={handleCancel}
            className="hidden h-[228px] shrink-0 border-t border-border/30 lg:flex"
          />
        </div>

        {/* Order book rail */}
        <OrderBook
          book={book}
          lastTick={lastTick}
          onPickPrice={pickPrice}
          className="hidden w-[248px] shrink-0 border-l border-border/30 lg:flex xl:w-[276px]"
        />

        {/* Ticket rail */}
        <aside className="shrink-0 border-t border-border/30 lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[320px]">
          {ticket}
        </aside>
      </div>

      {/* Below lg: book + positions continue the scrolling column */}
      <OrderBook
        book={book}
        lastTick={lastTick}
        onPickPrice={pickPrice}
        depth={7}
        className="border-t border-border/30 lg:hidden"
      />
      <PositionsPanel
        account={account}
        busyKey={busyKey}
        onClosePosition={handleClose}
        onCancelOrder={handleCancel}
        className="border-t border-border/30 pb-6 lg:hidden"
      />
    </div>
  )
}
