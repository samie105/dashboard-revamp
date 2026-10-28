/**
 * The admin dashboard's data contract. Screens only ever see these types;
 * where the data comes from is decided in lib/admin/source.ts alone, so
 * wiring the real admin backend is a change to that one file.
 *
 * These shapes are the frontend's, written from the task's scope (users,
 * active users, volume per period; total and active wallets). The admin
 * backend's own response shapes aren't in this repo, so mapping them onto
 * these types belongs in source.ts too.
 */

export const ADMIN_PERIODS = ["24h", "7d", "30d", "1y"] as const
export type AdminPeriod = (typeof ADMIN_PERIODS)[number]

export type AdminVolumePoint = {
  /** Start of the bucket, ISO 8601. */
  at: string
  usd: number
}

export type AdminOverview = {
  period: AdminPeriod
  /** When the figures were computed, ISO 8601. */
  asOf: string
  users: {
    /** Every registered user, regardless of period. */
    total: number
    /** Users active within the period. */
    active: number
  }
  volume: {
    /** Total volume within the period, in USD. */
    totalUsd: number
    /** The period split into buckets, oldest first. */
    points: AdminVolumePoint[]
  }
}

export type AdminWallets = {
  period: AdminPeriod
  asOf: string
  /** Every wallet, regardless of period. */
  total: number
  /** Wallets active within the period. */
  active: number
}

export type AdminRequestOptions = { signal?: AbortSignal }

/** What every admin screen reads through. One implementation is live at a time (source.ts). */
export interface AdminDataSource {
  getOverview(period: AdminPeriod, options?: AdminRequestOptions): Promise<AdminOverview>
  getWallets(period: AdminPeriod, options?: AdminRequestOptions): Promise<AdminWallets>
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
