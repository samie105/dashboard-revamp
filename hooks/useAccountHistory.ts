"use client"

/**
 * Holdings-weighted value history for the dashboard's account cards.
 *
 * There is no server-side balance-history ledger, so these series are derived
 * from real price history instead of invented: each account's curve is
 *
 *   value(t) = offset + Σ quantity × price(t)
 *
 * anchored so the last point equals the LIVE balance (offset = balance − Σ
 * quantity × latest price). Stables, cash, and anything without chart data
 * fold into the flat offset. Futures positions pass signed sizes, so a short
 * curves up when its market falls — the same arithmetic as the daily P&L.
 *
 * Honest caveat, by construction: this shows what the CURRENT basket did over
 * the window, not deposits/withdrawals — the standard treatment when no
 * balance ledger exists.
 */

import * as React from "react"
import { getChartData } from "@/lib/actions"

/** Signed token quantities. Symbols with no chart data just flatten. */
export type Holdings = Record<string, number>

export interface AccountSpec {
  key: string
  balance: number
  holdings: Holdings
}

export interface PeriodChanges {
  today: number | null
  week: number | null
  month: number | null
}

const SPARK_POINTS = 40
/** CoinGecko serves ~hourly points at the 30-day range. */
const POINTS_PER_DAY = 24

/* A 30-day curve barely changes hour to hour, so a cached copy painted NOW
   beats a fresh one in five seconds. Series persist in localStorage and
   hydrate synchronously on mount; anything older than the TTL refetches in
   the background and swaps in when it lands. */
const CACHE_PREFIX = "ws:chart30d:"
const CACHE_TTL = 15 * 60_000

function readCachedSeries(sym: string): { ts: number; prices: number[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + sym)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts?: unknown; prices?: unknown }
    if (typeof parsed.ts !== "number" || !Array.isArray(parsed.prices)) return null
    return { ts: parsed.ts, prices: parsed.prices as number[] }
  } catch {
    return null
  }
}

function writeCachedSeries(sym: string, prices: number[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + sym, JSON.stringify({ ts: Date.now(), prices }))
  } catch { /* quota/private mode — cache is best-effort */ }
}

/* One in-flight request per symbol, shared across effect re-runs (strict mode
   double-fires effects in dev — without this every symbol fetched twice). */
const inflight = new Map<string, Promise<number[]>>()

function fetchSeries(sym: string): Promise<number[]> {
  let p = inflight.get(sym)
  if (!p) {
    p = getChartData(sym, "30D")
      .then((res) => res.data.map((pt) => pt.price))
      .catch(() => [] as number[])
      .finally(() => inflight.delete(sym))
    inflight.set(sym, p)
  }
  return p
}

function sampleAt(series: number[], i: number, length: number): number {
  const idx = Math.round((i * (series.length - 1)) / (length - 1))
  return series[idx]
}

function pctChange(from: number, to: number): number | null {
  if (!isFinite(from) || Math.abs(from) < 1e-9) return null
  return ((to - from) / Math.abs(from)) * 100
}

export function useAccountHistory(accounts: AccountSpec[]) {
  const [priceSeries, setPriceSeries] = React.useState<Record<string, number[]>>({})

  // Union of symbols across accounts, stables excluded (flat by definition).
  const symbols = React.useMemo(() => {
    const set = new Set<string>()
    for (const a of accounts) {
      for (const [sym, qty] of Object.entries(a.holdings)) {
        if (qty !== 0 && sym !== "USDT" && sym !== "USDC" && sym !== "USD") set.add(sym)
      }
    }
    return [...set].sort()
  }, [accounts])

  React.useEffect(() => {
    let cancelled = false
    const missing = symbols.filter((s) => priceSeries[s] === undefined)
    if (missing.length === 0) return

    // 1) Hydrate instantly from localStorage — even a stale curve paints now.
    //    Spread order matters: prev wins, so a hydrate never clobbers a
    //    fresher series that landed between render and this effect.
    const hydrated: Record<string, number[]> = {}
    const toFetch: string[] = []
    for (const sym of missing) {
      const cached = readCachedSeries(sym)
      if (cached && cached.prices.length > 1) {
        hydrated[sym] = cached.prices
        if (Date.now() - cached.ts > CACHE_TTL) toFetch.push(sym)
      } else {
        toFetch.push(sym)
      }
    }
    if (Object.keys(hydrated).length > 0) {
      setPriceSeries((prev) => ({ ...hydrated, ...prev }))
    }

    // 2) Fetch the rest, painting each symbol AS IT ARRIVES — one slow
    //    CoinGecko response no longer holds every card's curve hostage.
    for (const sym of toFetch) {
      fetchSeries(sym).then((prices) => {
        if (prices.length > 1) writeCachedSeries(sym, prices)
        if (!cancelled) setPriceSeries((prev) => ({ ...prev, [sym]: prices }))
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols])

  return React.useMemo(() => {
    const loading = symbols.some((s) => priceSeries[s] === undefined)

    // Common grid: the shortest non-empty series (they're all ~30d hourly).
    const usable = symbols.map((s) => priceSeries[s]).filter((s): s is number[] => !!s && s.length > 1)
    const gridLen = usable.length > 0 ? Math.min(...usable.map((s) => s.length)) : 0

    const rawSeries: Record<string, number[]> = {}
    const sparkSeries: Record<string, number[]> = {}

    for (const a of accounts) {
      const weighted: { qty: number; series: number[] }[] = []
      let offset = a.balance
      for (const [sym, qty] of Object.entries(a.holdings)) {
        const series = priceSeries[sym]
        if (!qty || !series || series.length < 2) continue
        weighted.push({ qty, series })
        offset -= qty * series[series.length - 1]
      }

      if (weighted.length === 0 || gridLen < 2) {
        // Nothing chartable — a flat line at the live balance (Cash, and any
        // account whose assets have no chart data). Real, just unexciting.
        rawSeries[a.key] = [a.balance, a.balance]
        sparkSeries[a.key] = [a.balance, a.balance]
        continue
      }

      const raw = Array.from({ length: gridLen }, (_, i) =>
        weighted.reduce((sum, w) => sum + w.qty * sampleAt(w.series, i, gridLen), offset),
      )
      rawSeries[a.key] = raw
      sparkSeries[a.key] = Array.from({ length: SPARK_POINTS }, (_, i) =>
        sampleAt(raw, i, SPARK_POINTS),
      )
    }

    // Total portfolio on the common grid (flat accounts broadcast their balance).
    const totalLen = gridLen >= 2 ? gridLen : 2
    const totalRaw = Array.from({ length: totalLen }, (_, i) =>
      accounts.reduce((sum, a) => {
        const raw = rawSeries[a.key]
        return sum + (raw ? sampleAt(raw, i, totalLen) : a.balance)
      }, 0),
    )

    const last = totalRaw[totalRaw.length - 1]
    const at = (pointsBack: number) => totalRaw[Math.max(0, totalRaw.length - 1 - pointsBack)]
    const changes: PeriodChanges =
      gridLen >= 2
        ? {
            today: pctChange(at(POINTS_PER_DAY), last),
            week: pctChange(at(7 * POINTS_PER_DAY), last),
            month: pctChange(totalRaw[0], last),
          }
        : { today: null, week: null, month: null }

    return { sparkSeries, changes, loading }
  }, [accounts, priceSeries, symbols])
}
