/**
 * Which state an admin page shows, decided in one tested place so no screen
 * can skip one: loading → switching period → access refused → not connected
 * → failed → empty platform → nothing in this period → the figures.
 * Plus the small formatting rules every admin screen shares.
 */

import {
  AdminDataError,
  type AdminActivityStatus,
  type AdminActivityType,
  type AdminKpi,
  type AdminOverview,
  type AdminPeriod,
  type AdminUsers,
  type AdminVolume,
  type AdminWallets,
} from "@/lib/admin/types"

export type AdminViewState =
  | { kind: "loading" }
  /** A new period is loading; the previous period's figures stay on screen, dimmed. */
  | { kind: "switching" }
  | { kind: "forbidden" }
  | { kind: "signed-out" }
  | { kind: "unavailable" }
  | { kind: "error"; requestId?: string }
  | { kind: "empty" }
  | { kind: "no-data" }
  | { kind: "ready" }

export const PERIOD_OPTIONS: readonly { key: AdminPeriod; label: string; long: string; previous: string }[] = [
  { key: "24h", label: "24h", long: "the last 24 hours", previous: "previous 24h" },
  { key: "7d", label: "7d", long: "the last 7 days", previous: "previous 7d" },
  { key: "30d", label: "30d", long: "the last 30 days", previous: "previous 30d" },
  { key: "1y", label: "1y", long: "the last year", previous: "previous year" },
]

export function periodLong(period: AdminPeriod): string {
  return PERIOD_OPTIONS.find((p) => p.key === period)?.long ?? period
}

export function periodPrevious(period: AdminPeriod): string {
  return PERIOD_OPTIONS.find((p) => p.key === period)?.previous ?? "previous period"
}

/** "hour" / "day" / "month": what one point of the period's series covers. */
export function bucketUnit(period: AdminPeriod): string {
  return period === "24h" ? "hour" : period === "1y" ? "month" : "day"
}

function errorState(error: unknown): AdminViewState {
  if (error instanceof AdminDataError) {
    if (error.kind === "forbidden") return { kind: "forbidden" }
    if (error.kind === "unauthenticated") return { kind: "signed-out" }
    if (error.kind === "unavailable") return { kind: "unavailable" }
    return { kind: "error", requestId: error.requestId }
  }
  return { kind: "error" }
}

/**
 * `data` may be the previous period's (kept while the new one loads), so it
 * only counts when its period is the one asked for. An error for the asked
 * period wins over old figures; a background refresh failing doesn't hide
 * figures that are already right.
 */
function baseState<T extends { period: AdminPeriod }>(period: AdminPeriod, data: T | undefined, error: unknown): { state: AdminViewState } | { data: T } {
  const current = data?.period === period ? data : undefined
  if (current) return { data: current }
  if (error) return { state: errorState(error) }
  return { state: data ? { kind: "switching" } : { kind: "loading" } }
}

function decide<T extends { period: AdminPeriod }>(input: { period: AdminPeriod; data?: T; error?: unknown }, isEmpty: (d: T) => boolean, isQuiet: (d: T) => boolean): AdminViewState {
  const base = baseState(input.period, input.data, input.error)
  if ("state" in base) return base.state
  if (isEmpty(base.data)) return { kind: "empty" }
  if (isQuiet(base.data)) return { kind: "no-data" }
  return { kind: "ready" }
}

const allZero = (values: number[]) => values.every((v) => v === 0)

export const overviewState = (input: { period: AdminPeriod; data?: AdminOverview; error?: unknown }) =>
  decide(input, (d) => d.kpis.totalUsers.value === 0, (d) => d.kpis.activeUsers.value === 0 && d.kpis.volumeUsd.value === 0 && allZero(d.series.map((p) => p.volumeUsd + p.activeUsers)))

export const usersState = (input: { period: AdminPeriod; data?: AdminUsers; error?: unknown }) =>
  decide(input, (d) => d.kpis.totalUsers.value === 0, (d) => d.kpis.activeUsers.value === 0 && d.kpis.newUsers.value === 0)

export const walletsState = (input: { period: AdminPeriod; data?: AdminWallets; error?: unknown }) =>
  decide(input, (d) => d.kpis.totalWallets.value === 0, (d) => d.kpis.activeWallets.value === 0 && d.kpis.newWallets.value === 0)

export const volumeState = (input: { period: AdminPeriod; data?: AdminVolume; error?: unknown }) =>
  decide(input, () => false, (d) => d.kpis.volumeUsd.value === 0 && d.kpis.transactions.value === 0)

/** Change against the previous period, in percent; null when there's nothing to compare with. */
export function kpiChange(kpi: AdminKpi): number | null {
  if (kpi.previous === null || !Number.isFinite(kpi.previous) || kpi.previous === 0) return null
  return ((kpi.value - kpi.previous) / Math.abs(kpi.previous)) * 100
}

/**
 * Absolute change against the previous period (for running totals, where a
 * percentage hides the real number: "+1,388 new" beats "▲ 2.9%"); null
 * when there's nothing to compare with.
 */
export function kpiDelta(kpi: AdminKpi): number | null {
  if (kpi.previous === null || !Number.isFinite(kpi.previous)) return null
  return kpi.value - kpi.previous
}

/**
 * What each figure means, shown behind the ⓘ on its card.
 * TODO(lead): these are DRAFTS written from the task's wording; the admin
 * backend's own definitions (what counts as "active", which legs count as
 * volume, fiat included or not) must replace them before release.
 */
export const METRIC_DEFINITIONS = {
  totalUsers: "Every registered account, all time. The change is how many joined in the period.",
  activeUsers: "Accounts that did at least one thing on the crypto dashboard in the period.",
  newUsers: "Accounts created in the period.",
  volumeUsd: "The USD value of all transactions in the period.",
  transactions: "The number of transactions in the period.",
  averageUsd: "Volume divided by the number of transactions.",
  totalWallets: "Every wallet created, all time. The change is how many were created in the period.",
  activeWallets: "Wallets used for at least one transaction in the period.",
  newWallets: "Wallets created in the period.",
} as const

/** Active as a share of total, as a percentage ("—" when there's no total). */
export function activeShare(active: number, total: number): string {
  if (!Number.isFinite(active) || !Number.isFinite(total) || total <= 0) return "—"
  const share = (active / total) * 100
  return `${share < 1 && share > 0 ? share.toFixed(1) : Math.round(share)}%`
}

/** Each part's share of the whole, in percent (0 when the whole is 0). */
export function shares(values: number[]): number[] {
  const whole = values.reduce((s, v) => s + v, 0)
  return values.map((v) => (whole > 0 ? (v / whole) * 100 : 0))
}

const COUNT = new Intl.NumberFormat("en-US")
export function formatCount(value: number): string {
  return Number.isFinite(value) ? COUNT.format(value) : "—"
}

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
export function formatCountCompact(value: number): string {
  return Number.isFinite(value) ? COMPACT.format(value) : "—"
}

/** Axis/tick label for a bucket, by period. UTC, so every admin sees the same buckets. */
export function bucketLabel(at: string, period: AdminPeriod): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ""
  if (period === "24h") return date.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" })
  if (period === "1y") return date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/** "just now", "4m ago", "3h ago", "2d ago", or the date. */
export function timeAgo(at: string | null, now = Date.now()): string {
  if (!at) return "Never"
  const then = Date.parse(at)
  if (Number.isNaN(then)) return "—"
  const s = Math.max(0, Math.round((now - then) / 1_000))
  if (s < 45) return "just now"
  if (s < 3_600) return `${Math.round(s / 60)}m ago`
  if (s < 86_400) return `${Math.round(s / 3_600)}h ago`
  if (s < 30 * 86_400) return `${Math.round(s / 86_400)}d ago`
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export const ACTIVITY_LABEL: Record<AdminActivityType, string> = {
  swap: "Swap",
  buy: "Buy",
  sell: "Sell",
  spot: "Spot trade",
  futures: "Futures",
  bridge: "Bridge",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
}

export const STATUS_TONE: Record<AdminActivityStatus, "success" | "info" | "danger"> = {
  completed: "success",
  pending: "info",
  failed: "danger",
}

/** About `count` evenly spread axis labels. */
export function spreadTicks(labels: string[], count = 5): string[] {
  if (labels.length <= count) return labels
  const step = (labels.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => labels[Math.round(i * step)] ?? "")
}
