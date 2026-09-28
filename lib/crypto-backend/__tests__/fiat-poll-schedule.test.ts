import { describe, expect, it } from "vitest"

import {
  FIAT_ORDER_PAUSE_STATES,
  FIAT_ORDER_SLOW_STATES,
  FIAT_ORDER_TERMINAL_STATES,
  fiatConfigRefetchDelayMs,
  nextFiatOrderPollDelayMs,
  nextFiatVirtualAccountPollDelayMs,
} from "@/lib/crypto-backend/fiat-poll-schedule"

/**
 * Guide §11 polling recommendation (docs/fiat-frontend-integration-guide.md
 * lines 976-984) and §5 cache rule (lines 215-216).
 */

describe("order poll ladder", () => {
  it("follows 2s, 4s, 8s, 15s, 30s then settles in the 30-60s band", () => {
    const delays = Array.from({ length: 9 }, (_, count) => nextFiatOrderPollDelayMs("awaiting_bank_deposit", count))
    expect(delays.slice(0, 5)).toEqual([2_000, 4_000, 8_000, 15_000, 30_000])
    for (const delay of delays.slice(5)) {
      expect(delay).toBeGreaterThanOrEqual(30_000)
      expect(delay).toBeLessThanOrEqual(60_000)
    }
  })

  it("starts at 2s before any data has arrived", () => {
    expect(nextFiatOrderPollDelayMs(undefined, 0)).toBe(2_000)
  })

  it("never polls faster than every 2s", () => {
    expect(nextFiatOrderPollDelayMs("provider_processing", -5)).toBe(2_000)
  })

  it.each([
    "created",
    "quoted",
    "awaiting_bank_deposit",
    "awaiting_crypto_deposit",
    "crypto_intent_ready",
    "crypto_submitted",
    "provider_processing",
    "scheduled",
  ])("keeps polling in active state %s", (state) => {
    expect(nextFiatOrderPollDelayMs(state, 3)).not.toBeNull()
  })

  it.each(["completed", "failed", "reversed", "refunded", "refund_failed"])(
    "stops on end state %s",
    (state) => {
      expect(FIAT_ORDER_TERMINAL_STATES.has(state)).toBe(true)
      expect(nextFiatOrderPollDelayMs(state, 0)).toBeNull()
    },
  )

  it("keeps polling refund_in_flight at the slow end of the ladder (a refund can still change)", () => {
    expect(FIAT_ORDER_TERMINAL_STATES.has("refund_in_flight")).toBe(false)
    expect(FIAT_ORDER_SLOW_STATES.has("refund_in_flight")).toBe(true)
    for (const count of [0, 1, 10]) {
      const delay = nextFiatOrderPollDelayMs("refund_in_flight", count)
      expect(delay).toBeGreaterThanOrEqual(30_000)
      expect(delay).toBeLessThanOrEqual(60_000)
    }
  })

  it.each(["manual_review", "blocked"])("stops automatic polling on %s (\"Stop automatic retries\")", (state) => {
    expect(FIAT_ORDER_PAUSE_STATES.has(state)).toBe(true)
    expect(nextFiatOrderPollDelayMs(state, 0)).toBeNull()
  })
})

describe("virtual account / activity poll", () => {
  it("polls in the 15-30s band while the account is open", () => {
    const delay = nextFiatVirtualAccountPollDelayMs("active")
    expect(delay).toBeGreaterThanOrEqual(15_000)
    expect(delay).toBeLessThanOrEqual(30_000)
  })

  it("polls before the account status is known", () => {
    expect(nextFiatVirtualAccountPollDelayMs(undefined)).not.toBeNull()
  })
})

describe("config refetch at cacheExpiresAt", () => {
  const now = Date.parse("2026-09-26T10:20:00.000Z")

  it("refetches exactly at cacheExpiresAt (guide example: 60s)", () => {
    expect(fiatConfigRefetchDelayMs("2026-09-26T10:21:00.000Z", now)).toBe(60_000)
  })

  it("refetches soon (not immediately in a loop) once expired", () => {
    expect(fiatConfigRefetchDelayMs("2026-09-26T10:19:00.000Z", now)).toBe(5_000)
  })

  it("clamps a far-future expiry so a kill-switch flip is still picked up", () => {
    expect(fiatConfigRefetchDelayMs("2026-09-27T10:20:00.000Z", now)).toBe(5 * 60_000)
  })

  it("falls back to the ceiling when missing or malformed", () => {
    expect(fiatConfigRefetchDelayMs(undefined, now)).toBe(5 * 60_000)
    expect(fiatConfigRefetchDelayMs("not a date", now)).toBe(5 * 60_000)
  })
})
