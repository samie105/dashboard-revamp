/**
 * Invented admin figures for local development. Only reachable through
 * lib/admin/source.ts while ADMIN_MOCKS_ENABLED (lib/admin-mocks.ts) is true,
 * which a production build can never be.
 *
 * Every screen state can be forced with `?mockState=` on an admin URL:
 *   ok (default) · loading · empty · no-data · error · forbidden · unavailable · slow
 * `no-data` keeps the all-time totals but leaves the chosen period with no
 * activity; `empty` is a platform with no users or wallets at all.
 *
 * Figures are seeded by period, so a reload shows the same numbers.
 */

import { AdminDataError, type AdminDataSource, type AdminOverview, type AdminPeriod, type AdminVolumePoint, type AdminWallets } from "@/lib/admin/types"

export const ADMIN_MOCK_STATES = ["ok", "loading", "empty", "no-data", "error", "forbidden", "unavailable", "slow"] as const
export type AdminMockState = (typeof ADMIN_MOCK_STATES)[number]

export function parseMockState(value: string | null | undefined): AdminMockState {
  return (ADMIN_MOCK_STATES as readonly string[]).includes(value ?? "") ? (value as AdminMockState) : "ok"
}

function currentMockState(): AdminMockState {
  if (typeof window === "undefined") return "ok"
  return parseMockState(new URLSearchParams(window.location.search).get("mockState"))
}

/** Buckets per period: hourly for a day, daily for a week and a month, monthly for a year. */
export const PERIOD_BUCKETS: Record<AdminPeriod, { count: number; stepMs: number }> = {
  "24h": { count: 24, stepMs: 60 * 60 * 1_000 },
  "7d": { count: 7, stepMs: 24 * 60 * 60 * 1_000 },
  "30d": { count: 30, stepMs: 24 * 60 * 60 * 1_000 },
  "1y": { count: 12, stepMs: 30 * 24 * 60 * 60 * 1_000 },
}

/** Small deterministic PRNG (mulberry32), so mock figures are stable between reloads. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const SEED: Record<AdminPeriod, number> = { "24h": 24, "7d": 7, "30d": 30, "1y": 365 }
const TOTAL_USERS = 48_217
const TOTAL_WALLETS = 61_904
const ACTIVE_SHARE: Record<AdminPeriod, number> = { "24h": 0.06, "7d": 0.19, "30d": 0.41, "1y": 0.78 }
const VOLUME_PER_BUCKET: Record<AdminPeriod, number> = { "24h": 52_000, "7d": 1_180_000, "30d": 1_090_000, "1y": 31_500_000 }

function volumePoints(period: AdminPeriod, now: number, zero: boolean): AdminVolumePoint[] {
  const { count, stepMs } = PERIOD_BUCKETS[period]
  const random = seeded(SEED[period])
  const end = Math.floor(now / stepMs) * stepMs
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(end - (count - 1 - i) * stepMs).toISOString()
    const usd = zero ? 0 : Math.round(VOLUME_PER_BUCKET[period] * (0.55 + random() * 0.9) * (0.85 + (i / count) * 0.3))
    return { at, usd }
  })
}

export function mockOverview(period: AdminPeriod, state: AdminMockState, now = Date.now()): AdminOverview {
  const empty = state === "empty"
  const noData = state === "no-data" || empty
  const points = volumePoints(period, now, noData)
  return {
    period,
    asOf: new Date(now).toISOString(),
    users: {
      total: empty ? 0 : TOTAL_USERS,
      active: noData ? 0 : Math.round(TOTAL_USERS * ACTIVE_SHARE[period]),
    },
    volume: { totalUsd: points.reduce((sum, p) => sum + p.usd, 0), points },
  }
}

export function mockWallets(period: AdminPeriod, state: AdminMockState, now = Date.now()): AdminWallets {
  const empty = state === "empty"
  const noData = state === "no-data" || empty
  return {
    period,
    asOf: new Date(now).toISOString(),
    total: empty ? 0 : TOTAL_WALLETS,
    active: noData ? 0 : Math.round(TOTAL_WALLETS * ACTIVE_SHARE[period] * 0.92),
  }
}

/** Wait like a network call would, and stop if the caller gives up. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })
}

async function respond<T>(build: (state: AdminMockState) => T, signal?: AbortSignal): Promise<T> {
  const state = currentMockState()
  if (state === "loading") return new Promise<T>(() => {}) // stays loading, to inspect skeletons
  await delay(state === "slow" ? 3_000 : 450, signal)
  if (state === "error") throw new AdminDataError("failed", "Mock: the admin service failed", { status: 500, requestId: "mock-req-500" })
  if (state === "forbidden") throw new AdminDataError("forbidden", "Mock: this account has no admin role", { status: 403, requestId: "mock-req-403" })
  if (state === "unavailable") throw new AdminDataError("unavailable", "Mock: admin data is not connected", { status: 503 })
  return build(state)
}

export const mockAdminData: AdminDataSource = {
  getOverview: (period, options) => respond((state) => mockOverview(period, state), options?.signal),
  getWallets: (period, options) => respond((state) => mockWallets(period, state), options?.signal),
}
