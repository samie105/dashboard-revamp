/**
 * The admin dashboard's data contract. Screens only ever see these types;
 * where the data comes from is decided in lib/admin/source.ts alone, so
 * wiring the real admin backend is a change to that one file.
 *
 * These shapes are the frontend's, written from the task's scope (users,
 * active users, volume and wallets across periods, with changes, trends,
 * breakdowns, a users list and recent activity). The admin backend's own
 * response shapes aren't in this repo, so mapping them onto these types —
 * and supplying every field marked here — belongs in source.ts.
 */

export const ADMIN_PERIODS = ["24h", "7d", "30d", "1y"] as const
export type AdminPeriod = (typeof ADMIN_PERIODS)[number]

/**
 * One headline figure. `previous` is the same figure for the period before
 * (for "▲ 12% vs previous 7d"); null when the backend can't say. `spark` is
 * the figure across the period's buckets, oldest first.
 */
export type AdminKpi = { value: number; previous: number | null; spark: number[] }

/** One time bucket of the period (hourly for 24h, daily for 7d/30d, monthly for 1y). */
export type AdminSeriesPoint = {
  /** Start of the bucket, ISO 8601. */
  at: string
  activeUsers: number
  newUsers: number
  volumeUsd: number
  transactions: number
  activeWallets: number
  newWallets: number
}

/** A share of a whole, e.g. volume on one network. `key` is stable; `label` is for display. */
export type AdminBreakdown = { key: string; label: string; value: number }

export const ADMIN_ACTIVITY_TYPES = ["swap", "buy", "sell", "spot", "futures", "bridge", "deposit", "withdrawal"] as const
export type AdminActivityType = (typeof ADMIN_ACTIVITY_TYPES)[number]
export type AdminActivityStatus = "completed" | "pending" | "failed"

export type AdminActivity = {
  id: string
  at: string
  /** Masked by the backend (e.g. "a•••@gmail.com"); the frontend never sees a full email. */
  userLabel: string
  type: AdminActivityType
  networkLabel: string
  amountUsd: number
  status: AdminActivityStatus
  /** The on-chain transaction, when there is one. */
  txHash?: string
  /** A block-explorer link for it, supplied by the backend (only https links are shown). */
  explorerUrl?: string
}

export type AdminServiceStatus = "operational" | "degraded" | "down"

/** One dependency the platform needs (a payout provider, the rate feed, a chain connection). */
export type AdminServiceHealth = {
  key: string
  label: string
  status: AdminServiceStatus
  /** A short, safe explanation for anything not operational. */
  detail?: string
  checkedAt: string
}

/**
 * What an admin should look at now. Counts are for the chosen period except
 * the queues, which are "right now".
 */
export type AdminAttention = {
  failedTransactions: { count: number; rate: number }
  /** Sell payouts stopped for a person to check (crypto received, payout unclear). */
  payoutsInReview: number
  /** Payouts still pending after `pendingThresholdHours`. */
  payoutsPendingLong: number
  pendingThresholdHours: number
  services: AdminServiceHealth[]
}

export type AdminOverview = {
  period: AdminPeriod
  /** When the figures were computed, ISO 8601. */
  asOf: string
  kpis: { totalUsers: AdminKpi; activeUsers: AdminKpi; volumeUsd: AdminKpi; totalWallets: AdminKpi }
  series: AdminSeriesPoint[]
  /** The period before, bucketed the same way (same length), for the comparison line. */
  previousSeries: AdminSeriesPoint[]
  volumeByNetwork: AdminBreakdown[]
  volumeByProduct: AdminBreakdown[]
  walletsByNetwork: AdminBreakdown[]
  /** Newest first. */
  recentActivity: AdminActivity[]
  attention: AdminAttention
}

export type AdminUserRow = {
  id: string
  /** Masked by the backend. */
  userLabel: string
  joinedAt: string
  lastActiveAt: string | null
  wallets: number
  volumeUsd: number
  /** Active = did something within the chosen period. */
  status: "active" | "dormant"
}

export const ADMIN_USER_SORTS = ["joined", "lastActive", "volume"] as const
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number]

/** Sorting is newest/most first for every key. */
export type AdminUsersQuery = { search?: string; page?: number; pageSize?: number; sort?: AdminUserSort }

export type AdminUsers = {
  period: AdminPeriod
  asOf: string
  kpis: { totalUsers: AdminKpi; activeUsers: AdminKpi; newUsers: AdminKpi }
  series: AdminSeriesPoint[]
  /** The period before, bucketed the same way (same length), for the comparison line. */
  previousSeries: AdminSeriesPoint[]
  users: { rows: AdminUserRow[]; totalMatching: number; page: number; pageSize: number; search: string; sort: AdminUserSort }
}

export type AdminNetworkWallets = { key: string; label: string; total: number; active: number }

export type AdminWallets = {
  period: AdminPeriod
  asOf: string
  kpis: { totalWallets: AdminKpi; activeWallets: AdminKpi; newWallets: AdminKpi }
  series: AdminSeriesPoint[]
  /** The period before, bucketed the same way (same length), for the comparison line. */
  previousSeries: AdminSeriesPoint[]
  byNetwork: AdminNetworkWallets[]
}

export type AdminVolume = {
  period: AdminPeriod
  asOf: string
  kpis: { volumeUsd: AdminKpi; transactions: AdminKpi; averageUsd: AdminKpi }
  series: AdminSeriesPoint[]
  /** The period before, bucketed the same way (same length), for the comparison line. */
  previousSeries: AdminSeriesPoint[]
  byNetwork: AdminBreakdown[]
  byProduct: AdminBreakdown[]
}

export type AdminRequestOptions = { signal?: AbortSignal }

/** What every admin screen reads through. One implementation is live at a time (source.ts). */
export interface AdminDataSource {
  getOverview(period: AdminPeriod, options?: AdminRequestOptions): Promise<AdminOverview>
  getUsers(period: AdminPeriod, query: AdminUsersQuery, options?: AdminRequestOptions): Promise<AdminUsers>
  getWallets(period: AdminPeriod, options?: AdminRequestOptions): Promise<AdminWallets>
  getVolume(period: AdminPeriod, options?: AdminRequestOptions): Promise<AdminVolume>
}

/**
 * Why admin data couldn't be shown. Access itself is decided by the backend
 * (RBAC); the frontend only renders its answer:
 *  - `unauthenticated` / `forbidden`: the backend's 401 / 403;
 *  - `unavailable`: no data source is connected (or it's switched off);
 *  - `failed`: anything else, retryable.
 */
export type AdminErrorKind = "unauthenticated" | "forbidden" | "unavailable" | "failed"

export class AdminDataError extends Error {
  readonly kind: AdminErrorKind
  readonly status?: number
  /** For support; shown as small print, never the backend's message. */
  readonly requestId?: string

  constructor(kind: AdminErrorKind, message: string, options: { status?: number; requestId?: string } = {}) {
    super(message)
    this.name = "AdminDataError"
    this.kind = kind
    this.status = options.status
    this.requestId = options.requestId
  }
}

/** Map an HTTP status onto an error kind (for the real source in source.ts). */
export function adminErrorKindForStatus(status: number): AdminErrorKind {
  if (status === 401) return "unauthenticated"
  if (status === 403) return "forbidden"
  if (status === 404 || status === 501 || status === 503) return "unavailable"
  return "failed"
}
