import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockOverview, mockWallets, parseMockState, PERIOD_BUCKETS } from "@/lib/admin/mock"
import { AdminDataError, ADMIN_PERIODS, adminErrorKindForStatus, type AdminOverview } from "@/lib/admin/types"
import { activeShare, bucketLabel, overviewState, walletsState } from "@/lib/admin/view"
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
    await expect(adminData.getOverview("7d")).rejects.toMatchObject({ kind: "unavailable" })
    await expect(adminData.getWallets("7d")).rejects.toMatchObject({ kind: "unavailable" })
  })
})

describe("mock figures", () => {
  const now = Date.parse("2026-10-28T12:34:00Z")

  it("gives each period its own bucket count, oldest first", () => {
    for (const period of ADMIN_PERIODS) {
      const { points } = mockOverview(period, "ok", now).volume
      expect(points).toHaveLength(PERIOD_BUCKETS[period].count)
      expect(points.map((p) => Date.parse(p.at))).toEqual([...points.map((p) => Date.parse(p.at))].sort((a, b) => a - b))
    }
  })

  it("adds the buckets up to the period total, and is stable between calls", () => {
    const a = mockOverview("30d", "ok", now)
    expect(a.volume.totalUsd).toBe(a.volume.points.reduce((s, p) => s + p.usd, 0))
    expect(mockOverview("30d", "ok", now)).toEqual(a)
  })

  it("keeps active within total", () => {
    for (const period of ADMIN_PERIODS) {
      const o = mockOverview(period, "ok", now)
      const w = mockWallets(period, "ok", now)
      expect(o.users.active).toBeLessThanOrEqual(o.users.total)
      expect(w.active).toBeLessThanOrEqual(w.total)
    }
  })

  it("models 'no data for this period' and an empty platform", () => {
    const noData = mockOverview("24h", "no-data", now)
    expect(noData.users.total).toBeGreaterThan(0)
    expect(noData.users.active).toBe(0)
    expect(noData.volume.totalUsd).toBe(0)
    expect(mockOverview("24h", "empty", now).users.total).toBe(0)
    expect(mockWallets("24h", "empty", now).total).toBe(0)
  })

  it("only accepts known mock states", () => {
    expect(parseMockState("forbidden")).toBe("forbidden")
    expect(parseMockState("drop table")).toBe("ok")
    expect(parseMockState(null)).toBe("ok")
  })
})

describe("view states", () => {
  const ok = mockOverview("7d", "ok", Date.parse("2026-10-28T00:00:00Z"))

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

  it("tells an empty platform from a quiet period", () => {
    expect(overviewState({ period: "7d", data: mockOverview("7d", "empty") })).toEqual({ kind: "empty" })
    expect(overviewState({ period: "7d", data: mockOverview("7d", "no-data") })).toEqual({ kind: "no-data" })
    const someVolumeNoActive: AdminOverview = { ...ok, users: { ...ok.users, active: 0 } }
    expect(overviewState({ period: "7d", data: someVolumeNoActive })).toEqual({ kind: "ready" })
    expect(walletsState({ period: "7d", data: mockWallets("7d", "no-data") })).toEqual({ kind: "no-data" })
    expect(walletsState({ period: "7d", data: mockWallets("7d", "empty") })).toEqual({ kind: "empty" })
  })
})

describe("helpers", () => {
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

  it("formats shares and bucket labels", () => {
    expect(activeShare(41, 100)).toBe("41%")
    expect(activeShare(1, 400)).toBe("0.3%")
    expect(activeShare(5, 0)).toBe("—")
    expect(bucketLabel("2026-10-28T14:00:00Z", "24h")).toBe("2 PM")
    expect(bucketLabel("2026-10-28T00:00:00Z", "7d")).toBe("Oct 28")
    expect(bucketLabel("2026-10-01T00:00:00Z", "1y")).toBe("Oct")
  })
})
