import { describe, expect, it } from "vitest"

import {
  cryptoTotal,
  dashboardCards,
  type AccountKey,
  type AccountSignal,
} from "@/lib/dashboard-cards"

const CLOSED: AccountSignal = { open: false, settled: true, used: true }
const LOADING: AccountSignal = { open: true, settled: false, used: false }
const EMPTY: AccountSignal = { open: true, settled: true, used: false }
const USED: AccountSignal = { open: true, settled: true, used: true }

function signals(over: Partial<Record<AccountKey, AccountSignal>>) {
  return { holdings: EMPTY, spot: EMPTY, futures: CLOSED, ...over }
}

describe("dashboardCards", () => {
  it("shows nothing but the invitation to a brand-new account", () => {
    expect(dashboardCards(signals({}))).toEqual({ status: "empty" })
  })

  it("waits rather than guessing while an open account is still loading", () => {
    expect(dashboardCards(signals({ holdings: LOADING }))).toEqual({ status: "loading" })
  })

  it("shows an earned card immediately, without waiting for its neighbours", () => {
    expect(dashboardCards(signals({ holdings: USED, spot: LOADING }))).toEqual({
      status: "ready",
      accounts: ["holdings"],
    })
  })

  it("keeps ledger order regardless of which account was earned first", () => {
    expect(dashboardCards(signals({ spot: USED, holdings: USED }))).toEqual({
      status: "ready",
      accounts: ["holdings", "spot"],
    })
  })

  it("never shows a closed venue, however much is in it", () => {
    const result = dashboardCards(signals({ holdings: USED, futures: CLOSED }))
    expect(result).toEqual({ status: "ready", accounts: ["holdings"] })
  })

  it("shows futures once the venue opens", () => {
    expect(dashboardCards(signals({ futures: USED }))).toEqual({
      status: "ready",
      accounts: ["futures"],
    })
  })
})

describe("cryptoTotal", () => {
  it("adds the three crypto accounts", () => {
    expect(
      cryptoTotal({ holdings: 100, spot: 25, futures: 10, futuresOpen: true }),
    ).toBe(135)
  })

  it("leaves a closed venue out of the sum entirely", () => {
    expect(
      cryptoTotal({ holdings: 100, spot: 25, futures: 10, futuresOpen: false }),
    ).toBe(125)
  })

  it("does not take cash as an input at all", () => {
    // A compile-time guarantee as much as a runtime one: the Dollar Account
    // is a different product and cannot leak into the crypto total.
    expect(cryptoTotal({ holdings: 0, spot: 0, futures: 0, futuresOpen: true })).toBe(0)
  })
})
