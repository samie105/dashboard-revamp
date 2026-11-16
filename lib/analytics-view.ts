/**
 * What the analytics page says about the user's own activity.
 *
 * Every figure here is summed from the rows the transactions page already
 * shows (useUnifiedTransactions over GET /transactions, and GET /fiat/orders),
 * using the same rules for direction, kind, status and valuation
 * (lib/transactions-view.ts), so the two pages cannot disagree about a row.
 *
 * Rules that hold across the module:
 *  · a stopped transaction (failed, cancelled, expired) moved nothing, so it
 *    counts towards outcomes but never towards volume;
 *  · a row without a USD valuation adds nothing to a USD figure, and the
 *    figure carries how many rows it had to leave out, so the page can say so
 *    instead of printing a total that quietly skipped some;
 *  · bank orders are counted on their own: a sell's crypto leg is already a
 *    wallet row, so adding the order too would count the same money twice.
 */

import { orderStatus } from "@/lib/fiat-history"
import { chainLabel, daysAgo, directionOf, isStopped, kindOf, statusGroup, type KindKey } from "@/lib/transactions-view"
import type { FiatOrder } from "@/lib/crypto-backend/types"
import type { UnifiedTransaction } from "@/types/transactions"

export type AnalyticsRange = "7d" | "30d" | "90d" | "all"

export const ANALYTICS_RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
]

export const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90, all: Infinity }

const DAY = 86_400_000

const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())

/** Rows created within the range, counted in whole local days (today is day 0). */
export function inRange<T extends { createdAt: string }>(rows: T[], range: AnalyticsRange, now: Date): T[] {
  const days = RANGE_DAYS[range]
  return rows.filter((r) => {
    const ago = daysAgo(r.createdAt, now)
    return ago >= 0 && ago < days
  })
}

/* ── Totals ─────────────────────────────────────────────────────────────── */

export type UsdFigure = { usd: number; count: number; unpriced: number }

const emptyFigure = (): UsdFigure => ({ usd: 0, count: 0, unpriced: 0 })

function add(f: UsdFigure, tx: UnifiedTransaction) {
  f.count += 1
  if (tx.valueUsd == null) f.unpriced += 1
  else f.usd += tx.valueUsd
}

const isTrade = (tx: UnifiedTransaction) => tx.type === "swap" || tx.type === "spot_trade" || tx.type === "spot_order"

export type Totals = {
  moneyIn: UsdFigure
  moneyOut: UsdFigure
  traded: UsdFigure
  /** Every row in range, stopped ones included. */
  transactions: number
}

/** Money in, money out and traded volume, from rows that moved something. */
export function totals(rows: UnifiedTransaction[]): Totals {
  const t: Totals = { moneyIn: emptyFigure(), moneyOut: emptyFigure(), traded: emptyFigure(), transactions: rows.length }
  for (const tx of rows) {
    if (isStopped(tx.status)) continue
    if (isTrade(tx)) add(t.traded, tx)
    else {
      const d = directionOf(tx)
      if (d === "in") add(t.moneyIn, tx)
      else if (d === "out") add(t.moneyOut, tx)
    }
  }
  return t
}

/* ── Flow over time ─────────────────────────────────────────────────────── */

export type FlowBucket = {
  /** Local midnight the bucket starts at. */
  start: Date
  /** Days the bucket spans (1, 7 or a calendar month's length). */
  span: "day" | "week" | "month"
  in: number
  out: number
  /** Rows in the bucket, stopped ones included. */
  count: number
}

function bucketStarts(range: AnalyticsRange, now: Date, oldest: Date | null): { starts: Date[]; span: FlowBucket["span"] } {
  const today = startOfDay(now)
  const daysBack = (n: number) => Array.from({ length: n }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i)))
  if (range === "7d") return { starts: daysBack(7), span: "day" }
  if (range === "30d") return { starts: daysBack(30), span: "day" }
  const weeks = (n: number) => Array.from({ length: n }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 * (n - 1 - i) - 6))
  if (range === "90d") return { starts: weeks(13), span: "week" }
  // All: weekly back to the oldest row, or monthly once that passes half a year.
  const from = oldest ? startOfDay(oldest) : today
  const spanDays = Math.round((today.getTime() - from.getTime()) / DAY) + 1
  if (spanDays <= 26 * 7) return { starts: weeks(Math.max(1, Math.ceil(spanDays / 7))), span: "week" }
  const months: Date[] = []
  for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= today; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d)
  return { starts: months, span: "month" }
}

/**
 * Money in and out per bucket, oldest first: days for 7D and 30D, weeks for
 * 90D, and weeks or months for All depending on how far back the rows go.
 * Unpriced and stopped rows add to `count` only.
 */
export function flowSeries(rows: UnifiedTransaction[], range: AnalyticsRange, now: Date): FlowBucket[] {
  const oldest = rows.reduce<Date | null>((m, r) => {
    const d = new Date(r.createdAt)
    return !m || d < m ? d : m
  }, null)
  const { starts, span } = bucketStarts(range, now, oldest)
  const buckets: FlowBucket[] = starts.map((start) => ({ start, span, in: 0, out: 0, count: 0 }))
  for (const tx of rows) {
    const at = new Date(tx.createdAt).getTime()
    let i = -1
    for (let k = buckets.length - 1; k >= 0; k--) {
      if (at >= buckets[k].start.getTime()) {
        i = k
        break
      }
    }
    if (i < 0) continue
    const b = buckets[i]
    b.count += 1
    if (isStopped(tx.status) || tx.valueUsd == null || isTrade(tx)) continue
    const d = directionOf(tx)
    if (d === "in") b.in += tx.valueUsd
    else if (d === "out") b.out += tx.valueUsd
  }
  return buckets
}

/* ── Breakdowns ─────────────────────────────────────────────────────────── */

export type Slice = { key: string; label: string; count: number; usd: number; unpriced: number }

const KIND_LABELS: Record<Exclude<KindKey, "all">, string> = {
  deposit: "Deposits",
  withdrawal: "Withdrawals",
  swap: "Swaps",
  trade: "Trades",
  transfer: "Transfers",
}

function rank(map: Map<string, Slice>, limit: number): Slice[] {
  const sorted = [...map.values()].sort((a, b) => b.count - a.count || b.usd - a.usd || a.label.localeCompare(b.label))
  if (sorted.length <= limit) return sorted
  const head = sorted.slice(0, limit - 1)
  const other = sorted.slice(limit - 1).reduce<Slice>(
    (o, s) => ({ ...o, count: o.count + s.count, usd: o.usd + s.usd, unpriced: o.unpriced + s.unpriced }),
    { key: "other", label: "Other", count: 0, usd: 0, unpriced: 0 },
  )
  return [...head, other]
}

function sliceBy(rows: UnifiedTransaction[], keyOf: (tx: UnifiedTransaction) => { key: string; label: string } | null, limit: number): Slice[] {
  const map = new Map<string, Slice>()
  for (const tx of rows) {
    if (isStopped(tx.status)) continue
    const k = keyOf(tx)
    if (!k) continue
    const s = map.get(k.key) ?? { ...k, count: 0, usd: 0, unpriced: 0 }
    s.count += 1
    if (tx.valueUsd == null) s.unpriced += 1
    else s.usd += tx.valueUsd
    map.set(k.key, s)
  }
  return rank(map, limit)
}

/** What the user did, by the transactions page's own type tabs. */
export function byKind(rows: UnifiedTransaction[]): Slice[] {
  return sliceBy(
    rows,
    (tx) => {
      const k = kindOf(tx)
      return k ? { key: k, label: KIND_LABELS[k] } : null
    },
    5,
  )
}

/** Where it happened: networks, top five and the rest as Other. */
export function byNetwork(rows: UnifiedTransaction[], limit = 6): Slice[] {
  return sliceBy(rows, (tx) => (tx.chain ? { key: tx.chain, label: chainLabel(tx.chain) ?? tx.chain } : null), limit)
}

/** Which assets moved, by symbol. Rows the ledger couldn't name are left out. */
export function byAsset(rows: UnifiedTransaction[], limit = 6): Slice[] {
  return sliceBy(
    rows,
    (tx) => {
      const sym = tx.token?.trim()
      if (!sym || sym === "Unknown") return null
      return { key: sym.toUpperCase(), label: sym.length > 12 ? `${sym.slice(0, 4)}…${sym.slice(-4)}` : sym }
    },
    limit,
  )
}

/* ── Outcomes ───────────────────────────────────────────────────────────── */

export type Outcomes = {
  completed: number
  pending: number
  failed: number
  /** Median seconds from created to confirmed, over rows that carry both. */
  medianSettleSeconds: number | null
  settledSample: number
  /** How many confirmed within each SETTLE_BANDS band. */
  settleBands: number[]
}

/** Upper bounds, in seconds, of the confirm-time bands; the last is open. */
export const SETTLE_BANDS: { label: string; upTo: number }[] = [
  { label: "Under 10s", upTo: 10 },
  { label: "10–30s", upTo: 30 },
  { label: "30s–1m", upTo: 60 },
  { label: "1–5m", upTo: 300 },
  { label: "Over 5m", upTo: Infinity },
]

export function outcomes(rows: UnifiedTransaction[]): Outcomes {
  const o: Outcomes = { completed: 0, pending: 0, failed: 0, medianSettleSeconds: null, settledSample: 0, settleBands: SETTLE_BANDS.map(() => 0) }
  const durations: number[] = []
  for (const tx of rows) {
    o[statusGroup(tx.status)] += 1
    if (tx.status === "completed" && tx.completedAt) {
      const s = (Date.parse(tx.completedAt) - Date.parse(tx.createdAt)) / 1000
      if (Number.isFinite(s) && s >= 0) {
        durations.push(s)
        o.settleBands[SETTLE_BANDS.findIndex((b) => s < b.upTo)] += 1
      }
    }
  }
  if (durations.length) {
    durations.sort((a, b) => a - b)
    const mid = Math.floor(durations.length / 2)
    o.medianSettleSeconds = durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2
    o.settledSample = durations.length
  }
  return o
}

/** "12s", "4m", "1h 20m", "2d" — a duration for a figure, not a timer. */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
  return `${Math.round(h / 24)}d`
}

/* ── Rhythm ─────────────────────────────────────────────────────────────── */

/** Monday-first weekdays, and the day cut into eight three-hour blocks. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
export const BLOCKS = 8

/** Rows per weekday × three-hour block, in the viewer's local time. */
export function rhythm(rows: { createdAt: string }[]): number[][] {
  const grid = WEEKDAYS.map(() => Array.from({ length: BLOCKS }, () => 0))
  for (const r of rows) {
    const d = new Date(r.createdAt)
    if (Number.isNaN(d.getTime())) continue
    grid[(d.getDay() + 6) % 7][Math.floor(d.getHours() / 3)] += 1
  }
  return grid
}

/* ── Bank orders ────────────────────────────────────────────────────────── */

export type BankSide = { total: number; completed: number; pending: number; failed: number }
export type BankSummary = { buys: BankSide; sells: BankSide }

/** Buy and sell orders by outcome, using the history list's own status mapping. */
export function bankSummary(orders: FiatOrder[]): BankSummary {
  const side = (): BankSide => ({ total: 0, completed: 0, pending: 0, failed: 0 })
  const s: BankSummary = { buys: side(), sells: side() }
  for (const o of orders) {
    const t = o.direction === "onramp" ? s.buys : s.sells
    t.total += 1
    t[statusGroup(orderStatus(o.state))] += 1
  }
  return s
}
