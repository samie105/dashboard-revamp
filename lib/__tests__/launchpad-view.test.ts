import { describe, expect, it } from "vitest"

import type { LaunchpadToken } from "@/lib/crypto-backend/types"
import { agoFrom, cardView, heroStats, lamportsToSol, progressLabel, sortAndSearch, spotlightOf, viewStatus } from "@/lib/launchpad-view"

function token(over: Partial<LaunchpadToken> & { launchId: string }): LaunchpadToken {
  return {
    status: "live",
    chainFamily: "solana",
    networkId: "solana-devnet",
    creatorAddress: "c",
    name: over.launchId,
    symbol: over.launchId.toUpperCase(),
    allocation: { creatorBps: 200 },
    curve: { solRaised: "10000000000", progressBps: 1176, graduationLamports: "85000000000", refreshedAt: "" },
    createdAt: "2026-10-08T10:00:00Z",
    updatedAt: "2026-10-08T10:00:00Z",
    ...over,
  }
}

describe("lamportsToSol", () => {
  it("converts base units and rejects junk", () => {
    expect(lamportsToSol("590901290")).toBeCloseTo(0.5909)
    expect(lamportsToSol("85000000000")).toBe(85)
    expect(lamportsToSol(undefined)).toBeNull()
    expect(lamportsToSol("-5")).toBeNull()
    expect(lamportsToSol("1e9")).toBeNull()
  })
})

describe("cardView", () => {
  it("reads every figure off the token", () => {
    const v = cardView(token({ launchId: "spike", description: "  hi  ", mint: "MINT" }))
    expect(v).toMatchObject({ id: "spike", symbol: "SPIKE", description: "hi", mint: "MINT", status: "live", progressBps: 1176, solRaised: 10, graduationSol: 85, remainingSol: 75, creatorBps: 200 })
  })
  it("has no curve figures without a curve", () => {
    const v = cardView(token({ launchId: "x", curve: undefined }))
    expect(v.solRaised).toBeNull()
    expect(v.graduationSol).toBeNull()
    expect(v.remainingSol).toBeNull()
    expect(v.progressBps).toBe(0)
  })
  it("is full once graduating or graduated, and caps raised at the target", () => {
    const v = cardView(token({ launchId: "g", status: "graduated", curve: { solRaised: "90000000000", progressBps: 10000, graduationLamports: "85000000000", refreshedAt: "" } }))
    expect(v.progressBps).toBe(10_000)
    expect(v.solRaised).toBe(85)
    expect(v.remainingSol).toBe(0)
  })
  it("keeps other statuses distinct", () => {
    expect(viewStatus("deploying")).toBe("other")
    expect(viewStatus("graduating")).toBe("graduating")
  })
})

describe("discovery figures", () => {
  const live = [cardView(token({ launchId: "a" })), cardView(token({ launchId: "b", curve: { solRaised: "40000000000", progressBps: 4706, graduationLamports: "85000000000", refreshedAt: "" } }))]
  const grad = [cardView(token({ launchId: "g", status: "graduated", curve: { solRaised: "85000000000", progressBps: 10000, graduationLamports: "85000000000", refreshedAt: "" } }))]

  it("sums the hero stats, counting each launch once", () => {
    expect(heroStats(live, grad)).toEqual({ onCurve: 2, solRaised: 135, graduated: 1 })
    expect(heroStats([...live, grad[0]], grad).solRaised).toBe(135)
    expect(heroStats(undefined, undefined)).toEqual({ onCurve: null, solRaised: null, graduated: null })
  })
  it("spotlights the live launch closest to graduation", () => {
    expect(spotlightOf(live)?.id).toBe("b")
    expect(spotlightOf([])).toBeNull()
  })
  it("searches and sorts", () => {
    expect(sortAndSearch(live, "", "progress").map((v) => v.id)).toEqual(["b", "a"])
    expect(sortAndSearch(live, " A ", "progress").map((v) => v.id)).toEqual(["a"])
    const newer = cardView(token({ launchId: "n", createdAt: "2026-10-08T12:00:00Z" }))
    expect(sortAndSearch([...live, newer], "", "newest")[0].id).toBe("n")
  })
  it("labels progress and time", () => {
    expect(progressLabel(69, "live")).toBe("0.7%")
    expect(progressLabel(4706, "live")).toBe("47%")
    expect(progressLabel(10000, "graduating")).toBe("Full")
    const now = Date.parse("2026-10-08T12:00:00Z")
    expect(agoFrom("2026-10-08T11:30:00Z", now)).toBe("30m ago")
    expect(agoFrom("2026-10-07T12:00:00Z", now)).toBe("yesterday")
    expect(agoFrom("2026-10-08T11:30:00Z", 0)).toBe("")
  })
})
