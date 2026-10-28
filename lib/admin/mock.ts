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

import {
  AdminDataError,
  ADMIN_ACTIVITY_TYPES,
  type AdminActivity,
  type AdminAttention,
  type AdminBreakdown,
  type AdminDataSource,
  type AdminKpi,
  type AdminNetworkWallets,
  type AdminOverview,
  type AdminPeriod,
  type AdminSeriesPoint,
  type AdminUserRow,
  type AdminUsers,
  type AdminUsersQuery,
  type AdminVolume,
  type AdminWallets,
} from "@/lib/admin/types"

export const ADMIN_MOCK_STATES = ["ok", "loading", "empty", "no-data", "error", "forbidden", "unavailable", "slow"] as const
export type AdminMockState = (typeof ADMIN_MOCK_STATES)[number]

export function parseMockState(value: string | null | undefined): AdminMockState {
  return (ADMIN_MOCK_STATES as readonly string[]).includes(value ?? "") ? (value as AdminMockState) : "ok"
}

function currentMockState(): AdminMockState {
  if (typeof window === "undefined") return "ok"
  return parseMockState(new URLSearchParams(window.location.search).get("mockState"))
}

const HOUR = 60 * 60 * 1_000
const DAY = 24 * HOUR

/** Buckets per period: hourly for a day, daily for a week and a month, monthly for a year. */
export const PERIOD_BUCKETS: Record<AdminPeriod, { count: number; stepMs: number }> = {
  "24h": { count: 24, stepMs: HOUR },
  "7d": { count: 7, stepMs: DAY },
  "30d": { count: 30, stepMs: DAY },
  "1y": { count: 12, stepMs: 30 * DAY },
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
/** Active users across the whole period, as a share of all users. */
const ACTIVE_SHARE: Record<AdminPeriod, number> = { "24h": 0.06, "7d": 0.19, "30d": 0.41, "1y": 0.78 }
/** Typical active users within ONE bucket (an hour, a day, a month). */
const ACTIVE_PER_BUCKET: Record<AdminPeriod, number> = { "24h": 260, "7d": 2_900, "30d": 2_700, "1y": 14_000 }
const NEW_USERS_PER_BUCKET: Record<AdminPeriod, number> = { "24h": 9, "7d": 210, "30d": 190, "1y": 3_400 }
const VOLUME_PER_BUCKET: Record<AdminPeriod, number> = { "24h": 52_000, "7d": 1_180_000, "30d": 1_090_000, "1y": 31_500_000 }
const AVERAGE_TICKET_USD = 286

const NETWORKS = [
  { key: "solana", label: "Solana", volume: 0.44, wallets: 0.31 },
  { key: "ethereum", label: "Ethereum", volume: 0.29, wallets: 0.34 },
  { key: "tron", label: "Tron", volume: 0.14, wallets: 0.17 },
  { key: "ton", label: "TON", volume: 0.08, wallets: 0.11 },
  { key: "sui", label: "Sui", volume: 0.05, wallets: 0.07 },
] as const

const PRODUCTS = [
  { key: "swap", label: "Swap", share: 0.34 },
  { key: "spot", label: "Spot trading", share: 0.22 },
  { key: "futures", label: "Futures", share: 0.18 },
  { key: "buy", label: "Buy", share: 0.12 },
  { key: "sell", label: "Sell", share: 0.09 },
  { key: "bridge", label: "Bridge", share: 0.05 },
] as const

type Ctx = { period: AdminPeriod; now: number; empty: boolean; quiet: boolean }

function ctx(period: AdminPeriod, state: AdminMockState, now: number): Ctx {
  return { period, now, empty: state === "empty", quiet: state === "no-data" || state === "empty" }
}

/** The period's buckets. `previous` builds the period before it, for the change figures. */
function buildSeries({ period, now, quiet }: Ctx, previous = false): AdminSeriesPoint[] {
  const { count, stepMs } = PERIOD_BUCKETS[period]
  const random = seeded(SEED[period] + (previous ? 1_000 : 0))
  const end = Math.floor(now / stepMs) * stepMs - (previous ? count * stepMs : 0)
  const drift = previous ? 0.9 : 1
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(end - (count - 1 - i) * stepMs).toISOString()
    if (quiet && !previous) return { at, activeUsers: 0, newUsers: 0, volumeUsd: 0, transactions: 0, activeWallets: 0, newWallets: 0 }
    const wave = (0.6 + random() * 0.8) * (0.85 + (i / count) * 0.3) * drift
    const volumeUsd = Math.round(VOLUME_PER_BUCKET[period] * wave)
    const activeUsers = Math.round(ACTIVE_PER_BUCKET[period] * (0.7 + random() * 0.6) * drift)
    const newUsers = Math.round(NEW_USERS_PER_BUCKET[period] * (0.5 + random()) * drift)
    return {
      at,
      activeUsers,
      newUsers,
      volumeUsd,
      transactions: Math.max(1, Math.round(volumeUsd / (AVERAGE_TICKET_USD * (0.8 + random() * 0.4)))),
      activeWallets: Math.round(activeUsers * 1.18),
      newWallets: Math.round(newUsers * 1.3),
    }
  })
}

const sum = (points: AdminSeriesPoint[], key: keyof Omit<AdminSeriesPoint, "at">) => points.reduce((s, p) => s + p[key], 0)

function kpi(value: number, previous: number | null, spark: number[]): AdminKpi {
  return { value, previous, spark }
}

/** A running total that ends at `total`, for "all-time" KPIs' sparklines. */
function cumulative(total: number, additions: number[]): number[] {
  let running = total - additions.reduce((s, n) => s + n, 0)
  return additions.map((n) => (running += n))
}

function split<T extends { key: string; label: string }>(items: readonly T[], whole: number, share: (item: T) => number): AdminBreakdown[] {
  return items.map((item) => ({ key: item.key, label: item.label, value: Math.round(whole * share(item)) })).sort((a, b) => b.value - a.value)
}

function headline(c: Ctx) {
  const series = buildSeries(c)
  const before = buildSeries(c, true)
  const totalUsers = c.empty ? 0 : TOTAL_USERS
  const totalWallets = c.empty ? 0 : TOTAL_WALLETS
  const newUsers = sum(series, "newUsers")
  const newWallets = sum(series, "newWallets")
  const activeUsers = c.quiet ? 0 : Math.round(TOTAL_USERS * ACTIVE_SHARE[c.period])
  const activeBefore = Math.round(TOTAL_USERS * ACTIVE_SHARE[c.period] * 0.94)
  const activeWallets = c.quiet ? 0 : Math.round(TOTAL_WALLETS * ACTIVE_SHARE[c.period] * 0.92)
  return {
    series,
    before,
    totalUsers: kpi(totalUsers, c.empty ? null : totalUsers - newUsers, c.empty ? series.map(() => 0) : cumulative(totalUsers, series.map((p) => p.newUsers))),
    activeUsers: kpi(activeUsers, c.empty ? null : activeBefore, series.map((p) => p.activeUsers)),
    newUsers: kpi(newUsers, c.empty ? null : sum(before, "newUsers"), series.map((p) => p.newUsers)),
    totalWallets: kpi(totalWallets, c.empty ? null : totalWallets - newWallets, c.empty ? series.map(() => 0) : cumulative(totalWallets, series.map((p) => p.newWallets))),
    activeWallets: kpi(activeWallets, c.empty ? null : Math.round(activeBefore * 1.18), series.map((p) => p.activeWallets)),
    newWallets: kpi(newWallets, c.empty ? null : sum(before, "newWallets"), series.map((p) => p.newWallets)),
    volumeUsd: kpi(sum(series, "volumeUsd"), c.empty ? null : sum(before, "volumeUsd"), series.map((p) => p.volumeUsd)),
    transactions: kpi(sum(series, "transactions"), c.empty ? null : sum(before, "transactions"), series.map((p) => p.transactions)),
  }
}

const EMAIL_HOSTS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "proton.me"]
const LETTERS = "abcdefghijklmnopqrstuvwxyz"

function userLabel(random: () => number): string {
  return `${LETTERS[Math.floor(random() * 26)]}•••@${EMAIL_HOSTS[Math.floor(random() * EMAIL_HOSTS.length)]}`
}

function recentActivity(c: Ctx): AdminActivity[] {
  if (c.quiet) return []
  const random = seeded(SEED[c.period] + 7)
  const span = PERIOD_BUCKETS[c.period].count * PERIOD_BUCKETS[c.period].stepMs
  return Array.from({ length: 12 }, (_, i) => {
    const r = random()
    return {
      id: `act_${c.period}_${i}`,
      at: new Date(c.now - Math.round((i + random()) * Math.min(span / 12, 40 * 60 * 1_000))).toISOString(),
      userLabel: userLabel(random),
      type: ADMIN_ACTIVITY_TYPES[Math.floor(random() * ADMIN_ACTIVITY_TYPES.length)]!,
      networkLabel: NETWORKS[Math.floor(random() * NETWORKS.length)]!.label,
      amountUsd: Math.round((40 + random() * 4_800) * 100) / 100,
      status: r > 0.92 ? "failed" : r > 0.8 ? "pending" : "completed",
      // Deposits and withdrawals are on-chain; the rest happen inside the platform.
      ...(i % 3 === 0 ? { txHash: `0x${Math.floor(random() * 1e15).toString(16).padStart(16, "0")}${"a".repeat(48)}`, explorerUrl: `https://etherscan.io/tx/0x${"a".repeat(64)}` } : {}),
    } as AdminActivity
  })
}

const USER_COUNT = 240

function allUsers(c: Ctx): AdminUserRow[] {
  if (c.empty) return []
  const random = seeded(4_242)
  const activeWindow = PERIOD_BUCKETS[c.period].count * PERIOD_BUCKETS[c.period].stepMs
  return Array.from({ length: USER_COUNT }, (_, i) => {
    const joinedAt = c.now - Math.round(random() * 500 * DAY)
    const sinceActive = Math.round(random() * 90 * DAY)
    const lastActive = Math.max(joinedAt, c.now - sinceActive)
    // A few accounts never did anything; they can't be active.
    const neverActive = random() <= 0.05
    const active = !c.quiet && !neverActive && c.now - lastActive <= activeWindow
    return {
      id: `usr_${(1_000 + i).toString(36)}`,
      userLabel: userLabel(random),
      joinedAt: new Date(joinedAt).toISOString(),
      lastActiveAt: neverActive ? null : new Date(lastActive).toISOString(),
      wallets: 1 + Math.floor(random() * 4),
      volumeUsd: Math.round(random() * random() * 180_000),
      status: active ? "active" : "dormant",
    }
  })
}

function attention(c: Ctx, transactions: number, now: number): AdminAttention {
  const checkedAt = new Date(now - 60_000).toISOString()
  const failed = c.quiet ? 0 : Math.round(transactions * 0.021)
  return {
    failedTransactions: { count: failed, rate: transactions > 0 ? failed / transactions : 0 },
    payoutsInReview: c.empty ? 0 : 3,
    payoutsPendingLong: c.empty ? 0 : 1,
    pendingThresholdHours: 6,
    services: [
      { key: "flutterwave", label: "Bank payouts (Flutterwave)", status: "degraded", detail: "Exchange rates endpoint failing; payouts still sending", checkedAt },
      { key: "paystack", label: "Bank payouts (Paystack)", status: "operational", checkedAt },
      { key: "rates", label: "Exchange rate feed", status: "operational", checkedAt },
      { key: "solana-rpc", label: "Solana connection", status: "operational", checkedAt },
      { key: "ethereum-rpc", label: "Ethereum connection", status: "operational", checkedAt },
    ],
  }
}

export function mockOverview(period: AdminPeriod, state: AdminMockState, now = Date.now()): AdminOverview {
  const c = ctx(period, state, now)
  const h = headline(c)
  return {
    period,
    asOf: new Date(now).toISOString(),
    kpis: { totalUsers: h.totalUsers, activeUsers: h.activeUsers, volumeUsd: h.volumeUsd, totalWallets: h.totalWallets },
    series: h.series,
    previousSeries: c.empty ? h.before.map((p) => ({ ...p, activeUsers: 0, newUsers: 0, volumeUsd: 0, transactions: 0, activeWallets: 0, newWallets: 0 })) : h.before,
    volumeByNetwork: c.quiet ? [] : split(NETWORKS, h.volumeUsd.value, (n) => n.volume),
    volumeByProduct: c.quiet ? [] : split(PRODUCTS, h.volumeUsd.value, (p) => p.share),
    walletsByNetwork: c.empty ? [] : split(NETWORKS, h.totalWallets.value, (n) => n.wallets),
    recentActivity: recentActivity(c),
    attention: attention(c, h.transactions.value, now),
  }
}

export function mockUsers(period: AdminPeriod, query: AdminUsersQuery, state: AdminMockState, now = Date.now()): AdminUsers {
  const c = ctx(period, state, now)
  const h = headline(c)
  const search = (query.search ?? "").trim().toLowerCase()
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100)
  const sort = query.sort ?? "joined"
  const time = (at: string | null) => (at ? Date.parse(at) : 0)
  const order: Record<typeof sort, (a: AdminUserRow, b: AdminUserRow) => number> = {
    joined: (a, b) => time(b.joinedAt) - time(a.joinedAt),
    lastActive: (a, b) => time(b.lastActiveAt) - time(a.lastActiveAt),
    volume: (a, b) => b.volumeUsd - a.volumeUsd,
  }
  const matching = allUsers(c)
    .filter((u) => !search || u.userLabel.toLowerCase().includes(search) || u.id.toLowerCase().includes(search))
    .sort(order[sort])
  const pages = Math.max(1, Math.ceil(matching.length / pageSize))
  const page = Math.min(Math.max(query.page ?? 1, 1), pages)
  return {
    period,
    asOf: new Date(now).toISOString(),
    kpis: { totalUsers: h.totalUsers, activeUsers: h.activeUsers, newUsers: h.newUsers },
    series: h.series,
    previousSeries: c.empty ? h.before.map((p) => ({ ...p, activeUsers: 0, newUsers: 0, volumeUsd: 0, transactions: 0, activeWallets: 0, newWallets: 0 })) : h.before,
    users: { rows: matching.slice((page - 1) * pageSize, page * pageSize), totalMatching: matching.length, page, pageSize, search, sort },
  }
}

export function mockWallets(period: AdminPeriod, state: AdminMockState, now = Date.now()): AdminWallets {
  const c = ctx(period, state, now)
  const h = headline(c)
  const byNetwork: AdminNetworkWallets[] = c.empty
    ? []
    : NETWORKS.map((n) => ({ key: n.key, label: n.label, total: Math.round(h.totalWallets.value * n.wallets), active: Math.round(h.activeWallets.value * n.wallets) })).sort((a, b) => b.total - a.total)
  return {
    period,
    asOf: new Date(now).toISOString(),
    kpis: { totalWallets: h.totalWallets, activeWallets: h.activeWallets, newWallets: h.newWallets },
    series: h.series,
    previousSeries: c.empty ? h.before.map((p) => ({ ...p, activeUsers: 0, newUsers: 0, volumeUsd: 0, transactions: 0, activeWallets: 0, newWallets: 0 })) : h.before,
    byNetwork,
  }
}

export function mockVolume(period: AdminPeriod, state: AdminMockState, now = Date.now()): AdminVolume {
  const c = ctx(period, state, now)
  const h = headline(c)
  const average = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) / 100 : 0)
  return {
    period,
    asOf: new Date(now).toISOString(),
    kpis: {
      volumeUsd: h.volumeUsd,
      transactions: h.transactions,
      averageUsd: kpi(
        average(h.volumeUsd.value, h.transactions.value),
        h.volumeUsd.previous !== null && h.transactions.previous ? average(h.volumeUsd.previous, h.transactions.previous) : null,
        h.series.map((p) => average(p.volumeUsd, p.transactions)),
      ),
    },
    series: h.series,
    previousSeries: c.empty ? h.before.map((p) => ({ ...p, activeUsers: 0, newUsers: 0, volumeUsd: 0, transactions: 0, activeWallets: 0, newWallets: 0 })) : h.before,
    byNetwork: c.quiet ? [] : split(NETWORKS, h.volumeUsd.value, (n) => n.volume),
    byProduct: c.quiet ? [] : split(PRODUCTS, h.volumeUsd.value, (p) => p.share),
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
  getUsers: (period, query, options) => respond((state) => mockUsers(period, query, state), options?.signal),
  getWallets: (period, options) => respond((state) => mockWallets(period, state), options?.signal),
  getVolume: (period, options) => respond((state) => mockVolume(period, state), options?.signal),
}
