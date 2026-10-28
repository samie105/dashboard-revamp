/**
 * Which state an admin panel shows, decided in one tested place so no screen
 * can skip one: loading → access refused → not connected → failed → empty
 * platform → nothing in this period → the figures.
 */

import { AdminDataError, type AdminOverview, type AdminPeriod, type AdminWallets } from "@/lib/admin/types"

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

export const PERIOD_OPTIONS: readonly { key: AdminPeriod; label: string; long: string }[] = [
  { key: "24h", label: "24h", long: "the last 24 hours" },
  { key: "7d", label: "7d", long: "the last 7 days" },
  { key: "30d", label: "30d", long: "the last 30 days" },
  { key: "1y", label: "1y", long: "the last year" },
]

export function periodLong(period: AdminPeriod): string {
  return PERIOD_OPTIONS.find((p) => p.key === period)?.long ?? period
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

/** True when the period had no activity at all (but the platform isn't empty). */
export function overviewHasNoActivity(data: AdminOverview): boolean {
  return data.users.active === 0 && data.volume.totalUsd === 0 && data.volume.points.every((p) => p.usd === 0)
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

export function overviewState(input: { period: AdminPeriod; data?: AdminOverview; error?: unknown }): AdminViewState {
  const base = baseState(input.period, input.data, input.error)
  if ("state" in base) return base.state
  if (base.data.users.total === 0) return { kind: "empty" }
  if (overviewHasNoActivity(base.data)) return { kind: "no-data" }
  return { kind: "ready" }
}

export function walletsState(input: { period: AdminPeriod; data?: AdminWallets; error?: unknown }): AdminViewState {
  const base = baseState(input.period, input.data, input.error)
  if ("state" in base) return base.state
  if (base.data.total === 0) return { kind: "empty" }
  if (base.data.active === 0) return { kind: "no-data" }
  return { kind: "ready" }
}

/** Active as a share of total, as a whole-number percentage ("—" when there's no total). */
export function activeShare(active: number, total: number): string {
  if (!Number.isFinite(active) || !Number.isFinite(total) || total <= 0) return "—"
  const share = (active / total) * 100
  return `${share < 1 && share > 0 ? share.toFixed(1) : Math.round(share)}%`
}

const COUNT = new Intl.NumberFormat("en-US")
export function formatCount(value: number): string {
  return Number.isFinite(value) ? COUNT.format(value) : "—"
}

/** Axis/tick label for a volume bucket, by period. */
export function bucketLabel(at: string, period: AdminPeriod): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ""
  if (period === "24h") return date.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" })
  if (period === "1y") return date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}
