/**
 * The live admin data source.
 *
 * The browser calls only /api/admin/* on dashboard-revamp. That server route
 * owns the backend URL and forwards a Clerk bearer token through an explicit
 * admin allowlist, so no backend URL or admin credential is exposed to client
 * JavaScript. Local demo data remains available only behind the development
 * mock flag in lib/admin-mocks.ts.
 */

import { ADMIN_MOCKS_ENABLED } from "@/lib/admin-mocks"
import {
  adminErrorKindForStatus,
  AdminDataError,
  ADMIN_CONTROL_KEYS,
  type AdminActivity,
  type AdminActivityType,
  type AdminAuditAction,
  type AdminAuditLog,
  type AdminAuditQuery,
  type AdminBreakdown,
  type AdminClientEvent,
  type AdminControl,
  type AdminControlKey,
  type AdminControlUpdate,
  type AdminControls,
  type AdminInviteInput,
  type AdminMember,
  type AdminMemberUpdate,
  type AdminMembers,
  type AdminDataSource,
  type AdminFiat,
  type AdminFiatPoint,
  type AdminKpi,
  type AdminOverview,
  type AdminPeriod,
  type AdminReconciliation,
  type AdminRequestOptions,
  type AdminSeriesPoint,
  type AdminServiceHealth,
  type AdminTransactionStatus,
  type AdminTransactionRow,
  type AdminTransactions,
  type AdminTransactionsQuery,
  type AdminUserRow,
  type AdminUsers,
  type AdminUsersQuery,
  type AdminVolume,
  type AdminWallets,
} from "@/lib/admin/types"
import { parseCustomPeriod } from "@/lib/admin/types"

type JsonRecord = Record<string, unknown>
type ApiEnvelope<T> = { success?: boolean; data?: T; requestId?: string; warnings?: string[]; asOf?: string; status?: string }

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function count(value: unknown): number {
  return finiteNumber(value) ?? 0
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []
}

function dateText(value: unknown, fallback = new Date(0).toISOString()): string {
  const valueText = text(value)
  return valueText && !Number.isNaN(Date.parse(valueText)) ? valueText : fallback
}

function apiMessage(kind: ReturnType<typeof adminErrorKindForStatus>): string {
  if (kind === "unauthenticated") return "Sign in again to see admin data"
  if (kind === "forbidden") return "Your account does not have access to this admin area"
  if (kind === "unavailable") return "The admin service is temporarily unavailable"
  return "The admin service could not complete the request"
}

async function requestAdmin<T>(path: string, init: RequestInit = {}, options?: AdminRequestOptions): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers)
  headers.set("accept", "application/json")
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json")
  if (options?.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey)
  if (options?.ifMatch) headers.set("if-match", options.ifMatch)

  let response: Response
  try {
    response = await fetch(`/api/admin/${path}`, { ...init, headers, cache: "no-store", signal: options?.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new AdminDataError("unavailable", "Admin service is unreachable")
  }

  const body = await response.json().catch(() => ({})) as JsonRecord
  if (!response.ok) {
    const kind = adminErrorKindForStatus(response.status)
    const requestId = text(body.requestId) || response.headers.get("x-request-id") || undefined
    throw new AdminDataError(kind, apiMessage(kind), { status: response.status, requestId })
  }
  return body as ApiEnvelope<T>
}

function queryForPeriod(period: AdminPeriod): string {
  const custom = parseCustomPeriod(period, Number.MAX_SAFE_INTEGER)
  if (custom) return `from=${encodeURIComponent(custom.from)}&to=${encodeURIComponent(custom.to)}`
  return `period=${encodeURIComponent(period)}`
}

function queryString(values: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") search.set(key, String(value))
  const result = search.toString()
  return result ? `?${result}` : ""
}

function mapKpi(value: unknown): AdminKpi {
  const input = record(value)
  const spark = Array.isArray(input.spark) ? input.spark.map(finiteNumber) : []
  return { value: finiteNumber(input.value), previous: finiteNumber(input.previous), spark }
}

function mapSeries(value: unknown): AdminSeriesPoint[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const point = record(item)
    return {
      at: dateText(point.at),
      activeUsers: count(point.activeUsers),
      newUsers: count(point.newUsers),
      volumeUsd: finiteNumber(point.volumeUsd),
      transactions: count(point.transactions),
      activeWallets: count(point.activeWallets),
      newWallets: count(point.newWallets),
    }
  })
}

function mapBreakdowns(value: unknown): AdminBreakdown[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const input = record(item)
    return { key: text(input.key), label: text(input.label, text(input.key)), value: count(input.value) }
  })
}

function mapActivityType(value: unknown): AdminActivityType {
  const candidate = text(value).toLowerCase()
  return ["swap", "buy", "sell", "spot", "futures", "bridge", "deposit", "withdrawal"].includes(candidate)
    ? candidate as AdminActivityType
    : "withdrawal"
}

function mapActivity(value: unknown): AdminActivity[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const input = record(item)
    const status = text(input.status)
    return {
      id: text(input.id),
      at: dateText(input.at),
      userLabel: text(input.userLabel, "user:•••"),
      type: mapActivityType(input.type),
      networkLabel: text(input.networkLabel, "Unknown network"),
      amountDisplay: text(input.amountDisplay) || null,
      amountUsd: finiteNumber(input.amountUsd),
      status: status === "completed" || status === "failed" ? status : "pending",
      ...(text(input.txHash) ? { txHash: text(input.txHash) } : {}),
      ...(text(input.explorerUrl) ? { explorerUrl: text(input.explorerUrl) } : {}),
    }
  })
}

function mapServices(value: unknown): AdminServiceHealth[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const input = record(item)
    const status = text(input.status)
    return {
      key: text(input.key),
      label: text(input.label, text(input.key)),
      status: status === "down" || status === "degraded" ? status : "operational",
      ...(text(input.detail) ? { detail: text(input.detail) } : {}),
      checkedAt: dateText(input.checkedAt),
    }
  })
}

function mapPeriod(value: unknown, requested: AdminPeriod): AdminPeriod {
  const candidate = text(value)
  return candidate ? candidate as AdminPeriod : requested
}

function mapOverview(value: unknown, requested: AdminPeriod): AdminOverview {
  const input = record(value)
  const kpis = record(input.kpis)
  const attention = record(input.attention)
  const failed = record(attention.failedTransactions)
  return {
    period: mapPeriod(input.period, requested),
    asOf: dateText(input.asOf),
    kpis: {
      totalUsers: mapKpi(kpis.totalUsers),
      activeUsers: mapKpi(kpis.activeUsers),
      volumeUsd: mapKpi(kpis.volumeUsd),
      totalWallets: mapKpi(kpis.totalWallets),
    },
    series: mapSeries(input.series),
    previousSeries: mapSeries(input.previousSeries),
    volumeByNetwork: mapBreakdowns(input.volumeByNetwork),
    volumeByProduct: mapBreakdowns(input.volumeByProduct),
    walletsByNetwork: mapBreakdowns(input.walletsByNetwork),
    recentActivity: mapActivity(input.recentActivity),
    attention: {
      failedTransactions: { count: count(failed.count), rate: finiteNumber(failed.rate) ?? 0 },
      payoutsInReview: count(attention.payoutsInReview),
      payoutsPendingLong: count(attention.payoutsPendingLong),
      pendingThresholdHours: count(attention.pendingThresholdHours),
      services: mapServices(attention.services),
    },
  }
}

function mapUserRows(value: unknown): AdminUserRow[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const input = record(item)
    const status = text(input.status)
    return {
      id: text(input.id),
      userLabel: text(input.userLabel, "user:•••"),
      joinedAt: dateText(input.joinedAt),
      lastActiveAt: text(input.lastActiveAt) ? dateText(input.lastActiveAt) : null,
      wallets: count(input.wallets),
      volumeUsd: finiteNumber(input.volumeUsd),
      status: status === "locked" ? "locked" : status === "active" ? "active" : "dormant",
    }
  })
}

function mapUsers(value: unknown, requested: AdminPeriod): AdminUsers {
  const input = record(value)
  const kpis = record(input.kpis)
  const users = record(input.users)
  const retention = record(input.retention)
  const rawSort = text(users.sort)
  return {
    period: mapPeriod(input.period, requested),
    asOf: dateText(input.asOf),
    kpis: { totalUsers: mapKpi(kpis.totalUsers), activeUsers: mapKpi(kpis.activeUsers), newUsers: mapKpi(kpis.newUsers) },
    series: mapSeries(input.series),
    previousSeries: mapSeries(input.previousSeries),
    users: {
      rows: mapUserRows(users.rows),
      totalMatching: count(users.totalMatching),
      page: count(users.page) || 1,
      pageSize: count(users.pageSize) || 20,
      search: text(users.search),
      sort: rawSort === "lastActive" || rawSort === "volume" ? rawSort : "joined",
    },
    funnel: Array.isArray(input.funnel) ? input.funnel.map((item) => { const row = record(item); return { key: text(row.key), label: text(row.label, text(row.key)), count: count(row.count) } }) : [],
    retention: { weeks: count(retention.weeks), cohorts: Array.isArray(retention.cohorts) ? retention.cohorts as AdminUsers["retention"]["cohorts"] : [] },
  }
}

function mapWallets(value: unknown, requested: AdminPeriod): AdminWallets {
  const input = record(value)
  const kpis = record(input.kpis)
  return {
    period: mapPeriod(input.period, requested),
    asOf: dateText(input.asOf),
    kpis: { totalWallets: mapKpi(kpis.totalWallets), activeWallets: mapKpi(kpis.activeWallets), newWallets: mapKpi(kpis.newWallets) },
    series: mapSeries(input.series),
    previousSeries: mapSeries(input.previousSeries),
    byNetwork: Array.isArray(input.byNetwork) ? input.byNetwork.map((item) => { const row = record(item); return { key: text(row.key), label: text(row.label, text(row.key)), total: count(row.total), active: count(row.active) } }) : [],
  }
}

function mapVolume(value: unknown, requested: AdminPeriod): AdminVolume {
  const input = record(value)
  const kpis = record(input.kpis)
  return {
    period: mapPeriod(input.period, requested),
    asOf: dateText(input.asOf),
    kpis: { volumeUsd: mapKpi(kpis.volumeUsd), transactions: mapKpi(kpis.transactions), averageUsd: mapKpi(kpis.averageUsd) },
    series: mapSeries(input.series),
    previousSeries: mapSeries(input.previousSeries),
    byNetwork: mapBreakdowns(input.byNetwork),
    byProduct: mapBreakdowns(input.byProduct),
    warnings: strings(input.warnings),
  }
}

function mapFiatPoint(value: unknown): AdminFiatPoint {
  const input = record(value)
  return { at: dateText(input.at), buyUsd: finiteNumber(input.buyUsd), sellUsd: finiteNumber(input.sellUsd), orders: count(input.orders) }
}

function mapFiat(value: unknown, requested: AdminPeriod): AdminFiat {
  const input = record(value)
  const kpis = record(input.kpis)
  const pointList = (items: unknown) => Array.isArray(items) ? items.map(mapFiatPoint) : []
  return {
    period: mapPeriod(input.period, requested),
    asOf: dateText(input.asOf),
    kpis: {
      buyVolumeUsd: mapKpi(kpis.buyVolumeUsd),
      sellVolumeUsd: mapKpi(kpis.sellVolumeUsd),
      orders: mapKpi(kpis.orders),
      payoutSuccessPct: mapKpi(kpis.payoutSuccessPct),
      averagePayoutMinutes: mapKpi(kpis.averagePayoutMinutes),
    },
    series: pointList(input.series),
    previousSeries: pointList(input.previousSeries),
    ordersByStatus: mapBreakdowns(input.ordersByStatus),
    volumeByCurrency: mapBreakdowns(input.volumeByCurrency),
    payoutProviders: Array.isArray(input.payoutProviders) ? input.payoutProviders.map((item) => { const row = record(item); return { key: text(row.key), label: text(row.label, text(row.key)), payouts: count(row.payouts), successRate: finiteNumber(row.successRate) ?? 0, averageMinutes: finiteNumber(row.averageMinutes) } }) : [],
    warnings: strings(input.warnings),
  }
}

function mapTransactions(value: unknown): AdminTransactions {
  const input = record(value)
  const allowed = ["submitted", "confirmed", "failed", "unknown"]
  return {
    rows: Array.isArray(input.rows) ? input.rows.map((item) => {
      const row = record(item)
      const rawStatus = text(row.status)
      return {
        id: text(row.id),
        userLabel: text(row.userLabel, "user:•••"),
        at: dateText(row.at),
        action: text(row.action, "Transaction"),
        networkLabel: text(row.networkLabel, text(row.networkId, "Unknown network")),
        networkId: text(row.networkId),
        chainFamily: text(row.chainFamily),
        status: (allowed.includes(rawStatus) ? rawStatus : "unknown") as AdminTransactionStatus,
        amountDisplay: text(row.amountDisplay) || null,
        assetSymbol: text(row.assetSymbol) || null,
        amountUsd: finiteNumber(row.amountUsd),
        txHash: text(row.txHash),
        ...(text(row.valuationSource) ? { valuationSource: text(row.valuationSource) as AdminTransactionRow["valuationSource"] } : {}),
        ...(text(row.valuationSnapshotKind) ? { valuationSnapshotKind: text(row.valuationSnapshotKind) as AdminTransactionRow["valuationSnapshotKind"] } : {}),
        ...(text(row.confirmedAt) ? { confirmedAt: dateText(row.confirmedAt) } : {}),
        ...(text(row.failureCode) ? { failureCode: text(row.failureCode) } : {}),
      }
    }) : [],
    totalMatching: count(input.totalMatching),
    page: count(input.page) || 1,
    pageSize: count(input.pageSize) || 50,
    asOf: dateText(input.asOf),
    warnings: strings(input.warnings),
  }
}

function mapAuditAction(value: unknown): AdminAuditAction {
  const actions = ["signed_in", "viewed", "exported", "role_changed", "setting_changed", "job_started", "job_cancelled", "transaction_reconciled", "admin_invited", "admin_revoked", "admin_role_changed"]
  const candidate = text(value)
  return actions.includes(candidate) ? candidate as AdminAuditAction : "viewed"
}

function mapAudit(value: unknown): AdminAuditLog {
  const input = record(value)
  return {
    rows: Array.isArray(input.rows) ? input.rows.map((item) => { const row = record(item); return { id: text(row.id), at: dateText(row.at), actorLabel: text(row.actorLabel, "admin:•••"), action: mapAuditAction(row.action), target: text(row.target), ipLabel: text(row.ipLabel, "•••") } }) : [],
    totalMatching: count(input.totalMatching),
    page: count(input.page) || 1,
    pageSize: count(input.pageSize) || 25,
    action: input.action ? mapAuditAction(input.action) : null,
    asOf: dateText(input.asOf),
  }
}

function mapControl(value: unknown): AdminControl {
  const input = record(value)
  const key = text(input.key)
  return {
    key: (ADMIN_CONTROL_KEYS as readonly string[]).includes(key) ? key as AdminControlKey : "wallet_operations",
    paused: input.paused === true,
    effectivePaused: input.effectivePaused === true,
    ...(text(input.reason) ? { reason: text(input.reason) } : {}),
    version: count(input.version),
    ...(text(input.updatedBy) ? { updatedBy: text(input.updatedBy) } : {}),
    ...(text(input.updatedAt) ? { updatedAt: dateText(input.updatedAt) } : {}),
    configuredByEnv: input.configuredByEnv === true,
    ...(input.state === "live" || input.state === "paused" || input.state === "soon" ? { state: input.state } : {}),
  }
}

function mapControls(value: unknown): AdminControls {
  const input = record(value)
  return { controls: Array.isArray(input.controls) ? input.controls.map(mapControl) : [], asOf: dateText(input.asOf) }
}

function mapAdminMember(value: unknown): AdminMember {
  const input = record(value)
  const role = text(input.role)
  const status = text(input.status)
  return {
    id: text(input.id),
    email: text(input.email),
    displayName: text(input.displayName) || null,
    role: role === "operations" || role === "finance" || role === "super_admin" ? role : "viewer",
    status: status === "active" || status === "suspended" || status === "revoked" ? status : "invited",
    emailVerifiedAt: text(input.emailVerifiedAt) ? dateText(input.emailVerifiedAt) : null,
    lastLoginAt: text(input.lastLoginAt) ? dateText(input.lastLoginAt) : null,
    lastInviteAt: text(input.lastInviteAt) ? dateText(input.lastInviteAt) : null,
    createdAt: dateText(input.createdAt),
    updatedAt: dateText(input.updatedAt),
  }
}

function mapAdminMembers(value: unknown): AdminMembers {
  const input = record(value)
  return { admins: Array.isArray(input.admins) ? input.admins.map(mapAdminMember) : [], asOf: dateText(input.asOf) }
}

const liveAdminData: AdminDataSource = {
  async getOverview(period, options) {
    const response = await requestAdmin<JsonRecord>(`overview?${queryForPeriod(period)}`, {}, options)
    return mapOverview(response.data, period)
  },
  async getUsers(period, query, options) {
    const periodParams = new URLSearchParams(queryForPeriod(period))
    const response = await requestAdmin<JsonRecord>(`users${queryString({ period: periodParams.get("period") ?? undefined, from: periodParams.get("from") ?? undefined, to: periodParams.get("to") ?? undefined, search: query.search, page: query.page, pageSize: query.pageSize, sort: query.sort })}`, {}, options)
    return mapUsers(response.data, period)
  },
  async getWallets(period, options) {
    const response = await requestAdmin<JsonRecord>(`wallets?${queryForPeriod(period)}`, {}, options)
    return mapWallets(response.data, period)
  },
  async getVolume(period, options) {
    const response = await requestAdmin<JsonRecord>(`volume?${queryForPeriod(period)}`, {}, options)
    return mapVolume(response.data, period)
  },
  async getFiat(period, options) {
    const response = await requestAdmin<JsonRecord>(`fiat?${queryForPeriod(period)}`, {}, options)
    return mapFiat(response.data, period)
  },
  async getTransactions(query, options) {
    const period = query.period ?? "30d"
    const periodParams = new URLSearchParams(queryForPeriod(period))
    const response = await requestAdmin<JsonRecord>(`transactions${queryString({ period: periodParams.get("period") ?? undefined, from: periodParams.get("from") ?? undefined, to: periodParams.get("to") ?? undefined, status: query.status, page: query.page, pageSize: query.pageSize })}`, {}, options)
    return mapTransactions(response.data)
  },
  async getAuditLog(query, options) {
    const response = await requestAdmin<JsonRecord>(`audit${queryString({ action: query.action, page: query.page, pageSize: query.pageSize })}`, {}, options)
    return mapAudit(response.data)
  },
  async recordEvent(event: AdminClientEvent) {
    await requestAdmin<JsonRecord>("audit/client-events", { method: "POST", body: JSON.stringify(event) })
  },
  async getControls(options) {
    const response = await requestAdmin<JsonRecord>("controls", {}, options)
    return mapControls(response.data)
  },
  async updateControl(input: AdminControlUpdate, options) {
    const response = await requestAdmin<JsonRecord>(`controls/${encodeURIComponent(input.key)}`, { method: "PUT", body: JSON.stringify({ paused: input.paused, reason: input.reason, expectedVersion: input.expectedVersion }) }, { ...options, idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID(), ifMatch: options?.ifMatch ?? `"${input.expectedVersion}"` })
    return mapControl(record(response.data).control)
  },
  async reconcileTransaction(transactionId, options) {
    const response = await requestAdmin<JsonRecord>(`transactions/${encodeURIComponent(transactionId)}/reconcile`, { method: "POST", body: "{}" }, { ...options, idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID() })
    return record(record(response.data).reconciliation) as unknown as AdminReconciliation
  },
  async getAdminMembers(options) {
    const response = await requestAdmin<JsonRecord>("admins", {}, options)
    return mapAdminMembers(response.data)
  },
  async inviteAdmin(input: AdminInviteInput, options) {
    const response = await requestAdmin<JsonRecord>("admins/invitations", { method: "POST", body: JSON.stringify(input) }, { ...options, idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID() })
    return mapAdminMember(record(response.data).admin)
  },
  async updateAdminMember(input: AdminMemberUpdate, options) {
    const { adminId, ...body } = input
    const response = await requestAdmin<JsonRecord>(`admins/${encodeURIComponent(adminId)}`, { method: "PATCH", body: JSON.stringify(body) }, { ...options, idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID() })
    return mapAdminMember(record(response.data).admin)
  },
  async revokeAdminMember(adminId: string, options) {
    const response = await requestAdmin<JsonRecord>(`admins/${encodeURIComponent(adminId)}/revoke`, { method: "POST", body: "{}" }, { ...options, idempotencyKey: options?.idempotencyKey ?? crypto.randomUUID() })
    return mapAdminMember(record(response.data).admin)
  },
}

const notConnectedError = () => new AdminDataError("unavailable", "Admin data is not connected yet")

const loadMock: () => Promise<AdminDataSource> = process.env.NODE_ENV === "development"
  ? () => import("@/lib/admin/mock").then((module) => module.mockAdminData)
  : () => Promise.reject(notConnectedError())

const mockAdminData: AdminDataSource = {
  getOverview: async (period, options) => (await loadMock()).getOverview(period, options),
  getUsers: async (period, query, options) => (await loadMock()).getUsers(period, query, options),
  getWallets: async (period, options) => (await loadMock()).getWallets(period, options),
  getVolume: async (period, options) => (await loadMock()).getVolume(period, options),
  getFiat: async (period, options) => (await loadMock()).getFiat(period, options),
  getTransactions: async (query, options) => (await loadMock()).getTransactions(query, options),
  getAuditLog: async (query, options) => (await loadMock()).getAuditLog(query, options),
  getControls: async (options) => (await loadMock()).getControls(options),
  updateControl: async (input, options) => (await loadMock()).updateControl(input, options),
  reconcileTransaction: async (transactionId, options) => (await loadMock()).reconcileTransaction(transactionId, options),
  getAdminMembers: async (options) => (await loadMock()).getAdminMembers(options),
  inviteAdmin: async (input, options) => (await loadMock()).inviteAdmin(input, options),
  updateAdminMember: async (input, options) => (await loadMock()).updateAdminMember(input, options),
  revokeAdminMember: async (adminId, options) => (await loadMock()).revokeAdminMember(adminId, options),
  recordEvent: async (event) => (await loadMock()).recordEvent(event),
}

export const adminData: AdminDataSource = ADMIN_MOCKS_ENABLED ? mockAdminData : liveAdminData

/** True only while the screens are showing invented development figures. */
export const ADMIN_DATA_IS_MOCK = ADMIN_MOCKS_ENABLED
