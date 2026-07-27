"use client"

/**
 * Hyperliquid spot & futures trading — the web equivalent of mobile's
 * HlTradeScreen. Orders execute via the crypto service's /api/trade/* (signed
 * server-side with the caller's session authority); the order book comes
 * straight from Hyperliquid's public info API, exactly as mobile does.
 *
 * URL contract: /trade?market=spot|futures&symbol=BTC — nav and the trade
 * selector deep-link into it.
 */

import * as React from "react"
import Link from "next/link"
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
import { fetchHlOrderBook, type HlOrderBook } from "@/lib/hl-public"
import { CandleChart } from "@/components/trade/candle-chart"

type Market = "spot" | "futures"
type Side = "buy" | "sell"
type OrderType = "market" | "limit"

export function TradeClient() {
  const params = useSearchParams()
  const router = useRouter()

  const market: Market = params.get("market") === "futures" ? "futures" : "spot"
  const urlSymbol = params.get("symbol") ?? params.get("pair") ?? ""

  const [markets, setMarkets] = React.useState<HlMarkets | null>(null)
  const [symbol, setSymbol] = React.useState<string>("")
  const [account, setAccount] = React.useState<HlAccount | null>(null)
  const [book, setBook] = React.useState<HlOrderBook | null>(null)
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
  // the stale higher value is displayed and sent.
  React.useEffect(() => {
    setLeverage((l) => Math.min(l, maxLev))
  }, [maxLev])

  // A new symbol invalidates everything priced in the old one.
  React.useEffect(() => {
    setLimitPrice("")
    setTpPrice("")
    setSlPrice("")
    setOutcome(null)
    setError(null)
  }, [symbol])

  // Order book — futures use the bare symbol; spot uses the coinName.
  const bookCoin = React.useMemo(() => {
    if (!current) return null
    return market === "spot" ? (current as { coinName: string }).coinName : current.symbol
  }, [current, market])

  React.useEffect(() => {
    if (!bookCoin) return
    let cancelled = false
    setBook(null) // don't show the previous coin's book/price while loading
    const load = () =>
      fetchHlOrderBook(bookCoin).then((b) => { if (!cancelled) setBook(b) }).catch(() => {})
    load()
    const id = setInterval(load, 3000)
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

  const canSubmit =
    !submitting && !!current && amt >= (markets?.minOrderUsd ?? 10) &&
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

  const ready = account?.ready ?? false
  const balances = account?.balances

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header: market toggle + symbol picker + price */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">←</Link>
        <div className="flex rounded-xl border border-border/50 p-0.5">
          {(["spot", "futures"] as const).map((m) => (
            <button key={m} onClick={() => setMarketTab(m)}
              className={`rounded-[10px] px-4 py-1.5 text-sm font-semibold transition-colors ${market === m ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "spot" ? "Spot" : "Futures"}
            </button>
          ))}
        </div>
        <button onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-border/50 px-4 py-1.5 text-sm font-bold hover:bg-accent">
          {symbol || "—"}{market === "futures" ? "-PERP" : "/USDC"} ▾
        </button>
        <span className="text-lg font-bold tabular-nums">
          ${price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 2 })}
        </span>
        {book && (
          <span className="text-xs text-muted-foreground tabular-nums">
            spread {book.spread.toFixed(price < 1 ? 6 : 2)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {balances && (
            <>
              <span>Spot ${balances.spotUsdc.toFixed(2)}</span>
              <span>·</span>
              <span>Futures avail ${balances.perpsWithdrawableUsdc.toFixed(2)}</span>
            </>
          )}
          <Link href="/fund" className="rounded-lg bg-primary/10 px-3 py-1.5 font-semibold text-primary hover:bg-primary/20">
            Fund
          </Link>
          <Link href="/trading-withdraw" className="rounded-lg border border-border/50 px-3 py-1.5 font-medium hover:bg-accent">
            Withdraw
          </Link>
        </div>
      </div>

      {/* Symbol picker */}
      {pickerOpen && (
        <div className="mt-3 rounded-2xl border border-border/30 bg-card p-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search markets…"
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <div className="mt-2 grid max-h-64 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-4">
            {filtered.map((m) => (
              <button key={m.symbol}
                onClick={() => { setSymbol(m.symbol); setPickerOpen(false); setSearch("") }}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent ${m.symbol === symbol ? "bg-primary/10 text-primary" : ""}`}>
                <span className="font-medium">{m.symbol}</span>
                <span className="text-xs text-muted-foreground tabular-nums">${m.price.toLocaleString(undefined, { maximumFractionDigits: m.price < 1 ? 4 : 2 })}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        {/* Chart first, order form beside it (form is order-2 below), book and
            positions on the second row. Same coin id as the book (coinName for
            spot, bare symbol for futures). */}
        <div className="rounded-2xl border border-border/30 bg-card p-4 lg:order-1 lg:col-span-8">
          <CandleChart coin={bookCoin} />
        </div>

        {/* Order book */}
        <div className="rounded-2xl border border-border/30 bg-card p-4 lg:order-3 lg:col-span-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order book</p>
          {!book ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs tabular-nums">
              <div>
                <p className="mb-1 font-medium text-emerald-500">Bids</p>
                {book.bids.map((l, i) => (
                  <div key={i} className="relative flex justify-between py-0.5">
                    <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{ width: `${(l.total / (book.bids[book.bids.length - 1]?.total || 1)) * 100}%` }} />
                    <span className="relative text-emerald-500">{l.price.toLocaleString(undefined, { maximumFractionDigits: l.price < 1 ? 6 : 2 })}</span>
                    <span className="relative text-muted-foreground">{l.size.toFixed(3)}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 font-medium text-red-500">Asks</p>
                {book.asks.map((l, i) => (
                  <div key={i} className="relative flex justify-between py-0.5">
                    <div className="absolute inset-y-0 left-0 bg-red-500/10" style={{ width: `${(l.total / (book.asks[book.asks.length - 1]?.total || 1)) * 100}%` }} />
                    <span className="relative text-red-500">{l.price.toLocaleString(undefined, { maximumFractionDigits: l.price < 1 ? 6 : 2 })}</span>
                    <span className="relative text-muted-foreground">{l.size.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Order form */}
        <div className="rounded-2xl border border-border/30 bg-card p-4 lg:order-2 lg:col-span-4">
          {!ready ? (
            <div className="py-6 text-center">
              <p className="text-sm font-semibold">Trading account not set up</p>
              <p className="mt-1 text-xs text-muted-foreground">Set up and fund it to start trading.</p>
              <Link href="/fund" className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90">
                Set up & fund
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["buy", "sell"] as const).map((s) => (
                  <button key={s} onClick={() => setSide(s)}
                    className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${side === s ? (s === "buy" ? "bg-emerald-500 text-white" : "bg-red-500 text-white") : "border border-border/50 text-muted-foreground hover:bg-accent"}`}>
                    {s === "buy" ? "Buy / Long" : "Sell / Short"}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                {(["market", "limit"] as const).map((t) => (
                  <button key={t} onClick={() => setOrderType(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${orderType === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>
                    {t === "market" ? "Market" : "Limit"}
                  </button>
                ))}
              </div>
              {orderType === "limit" && (
                <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal" placeholder={`Limit price (${price ? price.toFixed(price < 1 ? 6 : 2) : "…"})`}
                  className="mt-3 w-full rounded-xl border border-border/50 bg-background px-4 py-2.5 text-sm tabular-nums outline-none focus:border-primary" />
              )}
              <input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal" placeholder={`Amount USD (min ${markets?.minOrderUsd ?? 10})`}
                className="mt-3 w-full rounded-xl border border-border/50 bg-background px-4 py-2.5 text-sm tabular-nums outline-none focus:border-primary" />
              {market === "futures" && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Leverage</span><span className="font-semibold text-foreground">{leverage}×</span>
                  </div>
                  <input type="range" min={1} max={maxLev} value={leverage}
                    onChange={(e) => setLeverage(parseInt(e.target.value))} className="mt-1 w-full accent-[var(--primary)]" />
                </div>
              )}
              {market === "futures" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Take profit</label>
                    <input value={tpPrice} onChange={(e) => setTpPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal" placeholder="Optional"
                      className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Stop loss</label>
                    <input value={slPrice} onChange={(e) => setSlPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal" placeholder="Optional"
                      className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm tabular-nums outline-none focus:border-red-500" />
                  </div>
                </div>
              )}
              {tpslError && <p className="mt-2 text-xs text-amber-500">{tpslError}</p>}
              {amt > 0 && price > 0 && (
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {/* Amount IS the notional; leverage only sets the margin used. */}
                  ≈ {(amt / price).toFixed(6)} {symbol}
                  {market === "futures" && leverage > 1 && ` · margin ≈ $${(amt / leverage).toFixed(2)} at ${leverage}×`}
                </p>
              )}
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              {outcome?.success && (
                <p className="mt-2 text-xs text-emerald-500">
                  {outcome.resting
                    ? "Limit order resting on the book."
                    : `Filled ${outcome.filledSize ?? ""} ${outcome.symbol} @ $${outcome.avgFillPrice?.toFixed(2) ?? "—"}`}
                </p>
              )}
              {outcome?.success && outcome.tpslWarning && (
                <p className="mt-1 text-xs font-semibold text-amber-500">
                  ⚠ {outcome.tpslWarning} — your position is open without that protection.
                </p>
              )}
              <button onClick={submit} disabled={!canSubmit}
                className={`mt-4 w-full rounded-xl py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${side === "buy" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}>
                {submitting ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
              </button>
            </>
          )}
        </div>

        {/* Positions + open orders */}
        <div className="space-y-4 lg:order-4 lg:col-span-4">
          <div className="rounded-2xl border border-border/30 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Positions</p>
            {(account?.positions ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No open positions.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {account!.positions.map((p) => (
                  <div key={p.symbol} className="rounded-xl border border-border/30 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{p.symbol} <span className={p.side === "long" ? "text-emerald-500" : "text-red-500"}>{p.side.toUpperCase()} {p.leverage.value}×</span></span>
                      <button onClick={() => handleClose(p.symbol)} disabled={busyKey === `close:${p.symbol}`}
                        className="rounded-lg bg-red-500/10 px-2.5 py-1 font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-40">
                        {busyKey === `close:${p.symbol}` ? "…" : "Close"}
                      </button>
                    </div>
                    <div className="mt-1 flex justify-between text-muted-foreground tabular-nums">
                      <span>{p.absSize} @ ${p.entryPrice.toLocaleString()}</span>
                      <span className={p.unrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}>
                        {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/30 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open orders</p>
            {(account?.openOrders ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No open orders.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {account!.openOrders.map((o) => (
                  <div key={o.oid} className="flex items-center justify-between rounded-xl border border-border/30 px-3 py-2 text-xs">
                    <div>
                      <span className="font-bold">{o.symbol}</span>{" "}
                      <span className={o.side === "buy" ? "text-emerald-500" : "text-red-500"}>{o.side}</span>{" "}
                      <span className="text-muted-foreground tabular-nums">
                        {o.isTrigger
                          ? `${o.orderType} @ $${(o.triggerPrice ?? o.limitPrice).toLocaleString()}`
                          : `${o.size} @ $${o.limitPrice.toLocaleString()}`}
                      </span>
                    </div>
                    <button onClick={() => handleCancel(o.oid, o.symbol, o.market)} disabled={busyKey === `cancel:${o.oid}`}
                      className="rounded-lg border border-border/50 px-2.5 py-1 font-medium hover:bg-accent disabled:opacity-40">
                      {busyKey === `cancel:${o.oid}` ? "…" : "Cancel"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
