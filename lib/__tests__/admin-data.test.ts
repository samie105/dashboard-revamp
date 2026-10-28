import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockFiat, mockOverview, mockUsers, mockVolume, mockWallets, parseMockState, PERIOD_BUCKETS } from "@/lib/admin/mock"
import { AdminDataError, ADMIN_PERIODS, adminErrorKindForStatus } from "@/lib/admin/types"
import { activeShare, attentionItems, bucketLabel, fiatState, funnelRows, retentionShade, filterActivity, safeExternalUrl, toCsv, kpiChange, kpiDelta, METRIC_DEFINITIONS, overviewState, shares, spreadTicks, timeAgo, usersState, volumeState, walletsState } from "@/lib/admin/view"
import { shouldRetryAdmin } from "@/hooks/admin/useAdminData"

async function importUnderEnv<T>(env: Record<string, string | undefined>, loader: () => Promise<T>): Promise<T> {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value ?? "")
  return loader()
}

beforeEach(() => vi.unstubAllEnvs())
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("ADMIN_MOCKS_ENABLED gate", () => {
  it("is false in a production build even with the opt-in set", async () => {
    const { ADMIN_MOCKS_ENABLED } = await importUnderEnv({ NODE_ENV: "production", NEXT_PUBLIC_ADMIN_MOCKS: "true" }, () => import("@/lib/admin-mocks"))
    expect(ADMIN_MOCKS_ENABLED).toBe(false)
  })
  it("is false in tests and in development without the opt-in", async () => {
    expect((await importUnderEnv({ NODE_ENV: "test", NEXT_PUBLIC_ADMIN_MOCKS: "true" }, () => import("@/lib/admin-mocks"))).ADMIN_MOCKS_ENABLED).toBe(false)
    expect((await importUnderEnv({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_MOCKS: undefined }, () => import("@/lib/admin-mocks"))).ADMIN_MOCKS_ENABLED).toBe(false)
  })
  it("is true only in development with the opt-in set", async () => {
    expect((await importUnderEnv({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_MOCKS: "true" }, () => import("@/lib/admin-mocks"))).ADMIN_MOCKS_ENABLED).toBe(true)
  })
  it("ignores the test-host mode that opens the fiat mocks", async () => {
    const { ADMIN_MOCKS_ENABLED } = await importUnderEnv({ NODE_ENV: "production", NEXT_PUBLIC_ADMIN_MOCKS: "true", NEXT_PUBLIC_WORLDSTREET_DASHBOARD_TEST_MODE: "true" }, () => import("@/lib/admin-mocks"))
    expect(ADMIN_MOCKS_ENABLED).toBe(false)
  })
})

describe("admin data source", () => {
  it("in a production build serves no mock figures: every call reports 'not connected'", async () => {
    const { adminData, ADMIN_DATA_IS_MOCK } = await importUnderEnv({ NODE_ENV: "production", NEXT_PUBLIC_ADMIN_MOCKS: "true" }, () => import("@/lib/admin/source"))
    expect(ADMIN_DATA_IS_MOCK).toBe(false)
    for (const call of [adminData.getOverview("7d"), adminData.getUsers("7d", {}), adminData.getWallets("7d"), adminData.getVolume("7d"), adminData.getFiat("7d")]) {
      await expect(call).rejects.toMatchObject({ kind: "unavailable" })
    }
  })
})

const NOW = Date.parse("2026-10-28T12:34:00Z")

describe("mock figures", () => {
  it("gives each period its own bucket count, oldest first", () => {
    for (const period of ADMIN_PERIODS) {
      const { series, previousSeries } = mockOverview(period, "ok", NOW)
      expect(series).toHaveLength(PERIOD_BUCKETS[period].count)
      // The comparison line needs one previous bucket per current bucket, all earlier.
      expect(previousSeries).toHaveLength(series.length)
      expect(Date.parse(previousSeries.at(-1)!.at)).toBeLessThan(Date.parse(series[0]!.at))
      const times = series.map((p) => Date.parse(p.at))
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
  })

  it("keeps KPIs consistent with their series and breakdowns", () => {
    const o = mockOverview("30d", "ok", NOW)
    expect(o.kpis.volumeUsd.value).toBe(o.series.reduce((s, p) => s + p.volumeUsd, 0))
    expect(o.kpis.volumeUsd.spark).toEqual(o.series.map((p) => p.volumeUsd))
    expect(o.kpis.totalUsers.spark.at(-1)).toBe(o.kpis.totalUsers.value)
    const byNetwork = o.volumeByNetwork.reduce((s, b) => s + b.value, 0)
    expect(Math.abs(byNetwork - o.kpis.volumeUsd.value)).toBeLessThan(10)
    expect(o.recentActivity.map((a) => Date.parse(a.at))).toEqual([...o.recentActivity.map((a) => Date.parse(a.at))].sort((a, b) => b - a))
  })

  it("is stable between calls and keeps active within total", () => {
    expect(mockOverview("7d", "ok", NOW)).toEqual(mockOverview("7d", "ok", NOW))
    for (const period of ADMIN_PERIODS) {
      const o = mockOverview(period, "ok", NOW)
      const w = mockWallets(period, "ok", NOW)
      expect(o.kpis.activeUsers.value).toBeLessThanOrEqual(o.kpis.totalUsers.value)
      expect(w.kpis.activeWallets.value).toBeLessThanOrEqual(w.kpis.totalWallets.value)
      for (const n of w.byNetwork) expect(n.active).toBeLessThanOrEqual(n.total)
    }
  })

  it("never puts a full email in user labels", () => {
    const labels = [...mockOverview("7d", "ok", NOW).recentActivity.map((a) => a.userLabel), ...mockUsers("7d", { pageSize: 100 }, "ok", NOW).users.rows.map((u) => u.userLabel)]
    for (const label of labels) expect(label).toMatch(/^[a-z]•••@[a-z.]+$/)
  })

  it("never marks a user active without a last-active time inside the period", () => {
    const { rows } = mockUsers("30d", { pageSize: 100 }, "ok", NOW).users
    for (const u of rows.filter((r) => r.status === "active")) {
      expect(u.lastActiveAt).not.toBeNull()
      expect(NOW - Date.parse(u.lastActiveAt!)).toBeLessThanOrEqual(30 * 24 * 3_600_000)
    }
  })

  it("searches and pages users", () => {
    const first = mockUsers("30d", { page: 1, pageSize: 20 }, "ok", NOW)
    expect(first.users.rows).toHaveLength(20)
    expect(first.users.totalMatching).toBe(240)
    const last = mockUsers("30d", { page: 99, pageSize: 20 }, "ok", NOW)
    expect(last.users.page).toBe(12)
    const gmail = mockUsers("30d", { search: "GMAIL", pageSize: 100 }, "ok", NOW)
    expect(gmail.users.rows.every((u) => u.userLabel.includes("gmail"))).toBe(true)
    expect(mockUsers("30d", { search: "nobody-matches" }, "ok", NOW).users.totalMatching).toBe(0)
  })

  it("models a quiet period and an empty platform", () => {
    const quiet = mockOverview("24h", "no-data", NOW)
    expect(quiet.kpis.totalUsers.value).toBeGreaterThan(0)
    expect(quiet.kpis.activeUsers.value).toBe(0)
    expect(quiet.kpis.volumeUsd.value).toBe(0)
    expect(quiet.recentActivity).toEqual([])
    const empty = mockOverview("24h", "empty", NOW)
    expect(empty.kpis.totalUsers).toMatchObject({ value: 0, previous: null })
    expect(mockWallets("24h", "empty", NOW).byNetwork).toEqual([])
  })

  it("keeps fiat figures consistent with their series", () => {
    const f = mockFiat("30d", "ok", NOW)
    expect(f.series).toHaveLength(30)
    expect(f.previousSeries).toHaveLength(30)
    expect(f.kpis.buyVolumeUsd.value).toBe(f.series.reduce((s, p) => s + p.buyUsd, 0))
    expect(f.kpis.orders.value).toBe(f.series.reduce((s, p) => s + p.orders, 0))
    for (const p of f.payoutProviders) expect(p.successRate).toBeLessThanOrEqual(1)
    expect(fiatState({ period: "30d", data: f }).kind).toBe("ready")
    expect(fiatState({ period: "30d", data: mockFiat("30d", "no-data", NOW) }).kind).toBe("no-data")
  })

  it("only accepts known mock states", () => {
    expect(parseMockState("forbidden")).toBe("forbidden")
    expect(parseMockState("drop table")).toBe("ok")
    expect(parseMockState(null)).toBe("ok")
  })
})

describe("view states", () => {
  const ok = mockOverview("7d", "ok", NOW)

  it("walks loading → figures", () => {
    expect(overviewState({ period: "7d" })).toEqual({ kind: "loading" })
    expect(overviewState({ period: "7d", data: ok })).toEqual({ kind: "ready" })
  })

  it("never shows another period's figures as current", () => {
    expect(overviewState({ period: "30d", data: ok })).toEqual({ kind: "switching" })
    expect(overviewState({ period: "30d", data: ok, error: new AdminDataError("failed", "x") })).toEqual({ kind: "error" })
  })

  it("keeps correct figures when only a background refresh fails", () => {
    expect(overviewState({ period: "7d", data: ok, error: new AdminDataError("failed", "x") })).toEqual({ kind: "ready" })
  })

  it("maps the backend's refusals and outages", () => {
    expect(overviewState({ period: "7d", error: new AdminDataError("forbidden", "x") })).toEqual({ kind: "forbidden" })
    expect(overviewState({ period: "7d", error: new AdminDataError("unauthenticated", "x") })).toEqual({ kind: "signed-out" })
    expect(overviewState({ period: "7d", error: new AdminDataError("unavailable", "x") })).toEqual({ kind: "unavailable" })
    expect(overviewState({ period: "7d", error: new AdminDataError("failed", "x", { requestId: "r1" }) })).toEqual({ kind: "error", requestId: "r1" })
    expect(overviewState({ period: "7d", error: new Error("network") })).toEqual({ kind: "error" })
  })

  it("tells an empty platform from a quiet period on every page", () => {
    expect(overviewState({ period: "7d", data: mockOverview("7d", "empty", NOW) }).kind).toBe("empty")
    expect(overviewState({ period: "7d", data: mockOverview("7d", "no-data", NOW) }).kind).toBe("no-data")
    expect(usersState({ period: "7d", data: mockUsers("7d", {}, "empty", NOW) }).kind).toBe("empty")
    expect(usersState({ period: "7d", data: mockUsers("7d", {}, "no-data", NOW) }).kind).toBe("no-data")
    expect(walletsState({ period: "7d", data: mockWallets("7d", "empty", NOW) }).kind).toBe("empty")
    expect(walletsState({ period: "7d", data: mockWallets("7d", "no-data", NOW) }).kind).toBe("no-data")
    expect(volumeState({ period: "7d", data: mockVolume("7d", "no-data", NOW) }).kind).toBe("no-data")
    expect(volumeState({ period: "7d", data: mockVolume("7d", "ok", NOW) }).kind).toBe("ready")
  })
})

describe("helpers", () => {
  it("computes change vs the previous period, or nothing to compare", () => {
    expect(kpiChange({ value: 110, previous: 100, spark: [] })).toBeCloseTo(10)
    expect(kpiChange({ value: 90, previous: 100, spark: [] })).toBeCloseTo(-10)
    expect(kpiChange({ value: 5, previous: 0, spark: [] })).toBeNull()
    expect(kpiChange({ value: 5, previous: null, spark: [] })).toBeNull()
  })

  it("gives running totals an absolute change", () => {
    expect(kpiDelta({ value: 48_217, previous: 46_829, spark: [] })).toBe(1_388)
    expect(kpiDelta({ value: 5, previous: 5, spark: [] })).toBe(0)
    expect(kpiDelta({ value: 5, previous: null, spark: [] })).toBeNull()
  })

  it("defines every KPI the pages show", () => {
    const o = mockOverview("7d", "ok", NOW).kpis
    const u = mockUsers("7d", {}, "ok", NOW).kpis
    const w = mockWallets("7d", "ok", NOW).kpis
    const v = mockVolume("7d", "ok", NOW).kpis
    for (const key of new Set([...Object.keys(o), ...Object.keys(u), ...Object.keys(w), ...Object.keys(v)])) {
      expect(METRIC_DEFINITIONS[key as keyof typeof METRIC_DEFINITIONS], key).toBeTruthy()
    }
  })

  it("lists what needs attention, worst first, and nothing when all is well", () => {
    const calm = { failedTransactions: { count: 3, rate: 0.001 }, payoutsInReview: 0, payoutsPendingLong: 0, pendingThresholdHours: 6, services: [{ key: "x", label: "X", status: "operational" as const, checkedAt: "" }] }
    expect(attentionItems(calm)).toEqual([])
    const items = attentionItems({ ...calm, failedTransactions: { count: 40, rate: 0.05 }, payoutsInReview: 2, services: [{ key: "fw", label: "Payouts", status: "degraded", detail: "slow", checkedAt: "" }, { key: "sol", label: "Solana", status: "down", checkedAt: "" }] })
    expect(items.map((i) => i.key)).toEqual(["service:sol", "payouts:review", "service:fw", "tx:failed"])
    expect(items[1]!.title).toBe("2 payouts waiting for review")
  })

  it("filters activity by type and status", () => {
    const rows = mockOverview("30d", "ok", NOW).recentActivity
    expect(filterActivity(rows, { type: "all", status: "all" })).toEqual(rows)
    expect(filterActivity(rows, { type: "all", status: "failed" }).every((a) => a.status === "failed")).toBe(true)
    expect(filterActivity(rows, { type: "swap", status: "failed" }).every((a) => a.type === "swap" && a.status === "failed")).toBe(true)
  })

  it("sorts users newest/most first by the chosen key", () => {
    const byVolume = mockUsers("30d", { sort: "volume", pageSize: 50 }, "ok", NOW).users.rows.map((u) => u.volumeUsd)
    expect(byVolume).toEqual([...byVolume].sort((a, b) => b - a))
    const byJoined = mockUsers("30d", { sort: "joined", pageSize: 50 }, "ok", NOW).users.rows.map((u) => Date.parse(u.joinedAt))
    expect(byJoined).toEqual([...byJoined].sort((a, b) => b - a))
  })

  it("only renders https links", () => {
    expect(safeExternalUrl("https://etherscan.io/tx/0xabc")).toBe("https://etherscan.io/tx/0xabc")
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull()
    expect(safeExternalUrl("http://example.com")).toBeNull()
    expect(safeExternalUrl("not a url")).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
  })

  it("writes CSV that spreadsheets can't execute", () => {
    const csv = toCsv(["user", "volume"], [["a•••@gmail.com", 12], ['=HYPERLINK("x")', null], ['say "hi"', -3]])
    expect(csv.split("\r\n")).toEqual([
      `"user","volume"`,
      `"a•••@gmail.com","12"`,
      `"'=HYPERLINK(""x"")",""`,
      `"say ""hi""","-3"`,
    ])
  })

  it("turns funnel counts into shares of signups and of the step before", () => {
    const rows = funnelRows([{ key: "a", label: "A", count: 200 }, { key: "b", label: "B", count: 150 }, { key: "c", label: "C", count: 30 }])
    expect(rows.map((r) => [r.ofSignups, r.fromPrevious])).toEqual([[100, null], [75, 75], [15, 20]])
    expect(funnelRows([{ key: "a", label: "A", count: 0 }, { key: "b", label: "B", count: 0 }]).map((r) => r.ofSignups)).toEqual([0, 0])
  })

  it("models retention: newer cohorts have fewer weeks, shares stay within 0–1", () => {
    const { cohorts } = mockUsers("7d", {}, "ok", NOW).retention
    expect(cohorts.map((c) => c.retained.length)).toEqual([7, 6, 5, 4, 3, 2, 1, 0])
    for (const r of cohorts.flatMap((c) => c.retained)) {
      expect(r).toBeGreaterThan(0)
      expect(r).toBeLessThanOrEqual(1)
    }
    expect(mockUsers("7d", {}, "empty", NOW).retention.cohorts).toEqual([])
    expect(retentionShade(0)).toBe("bg-primary/[0.06]")
    expect(retentionShade(0.99)).toBe("bg-primary/[0.5]")
  })

  it("maps HTTP statuses to error kinds", () => {
    expect(adminErrorKindForStatus(401)).toBe("unauthenticated")
    expect(adminErrorKindForStatus(403)).toBe("forbidden")
    expect(adminErrorKindForStatus(503)).toBe("unavailable")
    expect(adminErrorKindForStatus(500)).toBe("failed")
  })

  it("retries only failures that can change", () => {
    expect(shouldRetryAdmin(0, new AdminDataError("forbidden", "x"))).toBe(false)
    expect(shouldRetryAdmin(0, new AdminDataError("unavailable", "x"))).toBe(false)
    expect(shouldRetryAdmin(1, new AdminDataError("failed", "x"))).toBe(true)
    expect(shouldRetryAdmin(2, new AdminDataError("failed", "x"))).toBe(false)
  })

  it("formats shares, ticks, bucket labels and times", () => {
    expect(activeShare(41, 100)).toBe("41%")
    expect(activeShare(1, 400)).toBe("0.3%")
    expect(activeShare(5, 0)).toBe("—")
    expect(shares([1, 3])).toEqual([25, 75])
    expect(shares([0, 0])).toEqual([0, 0])
    expect(spreadTicks(["a", "b", "c", "d", "e", "f", "g", "h", "i"], 5)).toEqual(["a", "c", "e", "g", "i"])
    expect(bucketLabel("2026-10-28T14:00:00Z", "24h")).toBe("2 PM")
    expect(bucketLabel("2026-10-28T00:00:00Z", "7d")).toBe("Oct 28")
    expect(bucketLabel("2026-10-01T00:00:00Z", "1y")).toBe("Oct")
    expect(timeAgo("2026-10-28T12:30:00Z", NOW)).toBe("4m ago")
    expect(timeAgo(null, NOW)).toBe("Never")
  })
})
