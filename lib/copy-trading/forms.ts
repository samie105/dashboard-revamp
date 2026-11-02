import type { Delegation, GrantInput, MarketKind, SubscriptionInput } from "./types"

export interface GrantForm { spot: boolean; perp: boolean; symbols: string; maxOrderUsd: string; maxDailyNotionalUsd: string; maxLeverage: string; expiresInDays: string }
export interface FollowForm { allocationUsd: string; sizing: "proportional" | "fixed"; usdPerTrade: string; spot: boolean; perp: boolean; symbols: string; maxLeverage: string; maxOrderUsd: string; maxSlippagePct: string }

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const parseSymbols = (raw: string) => [...new Set(raw.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))]
const kindsOf = (f: { spot: boolean; perp: boolean }): MarketKind[] => [...(f.spot ? ["spot" as const] : []), ...(f.perp ? ["perp" as const] : [])]
const whole = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN)

export const DEFAULT_GRANT_FORM: GrantForm = { spot: true, perp: true, symbols: "", maxOrderUsd: "500", maxDailyNotionalUsd: "2000", maxLeverage: "3", expiresInDays: "30" }

export function buildGrantInput(f: GrantForm, masterAddress: string): Result<GrantInput> {
  const kinds = kindsOf(f)
  if (!kinds.length) return fail("Pick at least one of spot or futures.")
  const symbols = parseSymbols(f.symbols)
  if (symbols.some((s) => !/^[\w.@/-]+$/.test(s))) return fail("Symbols can only contain letters, numbers and . @ / -")
  const maxOrderUsd = whole(f.maxOrderUsd), maxDailyNotionalUsd = whole(f.maxDailyNotionalUsd), maxLeverage = whole(f.maxLeverage), expiresInDays = whole(f.expiresInDays)
  if (!(maxOrderUsd >= 1)) return fail("Max order must be a whole number of dollars.")
  if (!(maxDailyNotionalUsd >= maxOrderUsd)) return fail("Daily limit can't be below the max order.")
  if (!(maxLeverage >= 1 && maxLeverage <= 50)) return fail("Leverage must be 1 to 50.")
  if (!(expiresInDays >= 1 && expiresInDays <= 90)) return fail("Access can last 1 to 90 days.")
  return { ok: true, value: { masterAddress, venue: "hyperliquid", kinds, symbols, maxOrderUsd, maxLeverage, maxDailyNotionalUsd, expiresInDays } }
}

/** Starting values that already sit inside a delegation's signed limits. */
export function followDefaults(d: Delegation): FollowForm {
  const g = d.grant
  return {
    allocationUsd: "100", sizing: "proportional", usdPerTrade: "50",
    spot: g.kinds.includes("spot"), perp: g.kinds.includes("perp"),
    symbols: g.symbols.join(", "), maxLeverage: String(Math.min(3, g.maxLeverage)), maxOrderUsd: String(Math.min(250, g.maxOrderUsd)), maxSlippagePct: "1",
  }
}

/** Mirrors the service's checks so errors show before the request, not after. */
export function buildSubscriptionInput(f: FollowForm, leaderId: string, d: Delegation): Result<SubscriptionInput> {
  const g = d.grant
  const kinds = kindsOf(f)
  if (!kinds.length) return fail("Pick at least one of spot or futures.")
  if (!kinds.every((k) => g.kinds.includes(k))) return fail("Your trading access doesn't cover that market type.")
  const allocationUsd = Number(f.allocationUsd)
  if (!(allocationUsd >= 10)) return fail("Allocate at least $10.")
  let sizing: SubscriptionInput["sizing"] = { type: "proportional" }
  if (f.sizing === "fixed") {
    const usdPerTrade = Number(f.usdPerTrade)
    if (!(usdPerTrade >= 10)) return fail("Fixed trades must be at least $10.")
    sizing = { type: "fixed", usdPerTrade }
  }
  const symbols = parseSymbols(f.symbols)
  if (g.symbols.length && (!symbols.length || !symbols.every((s) => g.symbols.includes(s)))) return fail(`Your trading access only covers: ${g.symbols.join(", ")}.`)
  const maxLeverage = whole(f.maxLeverage), maxOrderUsd = Number(f.maxOrderUsd), slip = Number(f.maxSlippagePct)
  if (!(maxLeverage >= 1) || maxLeverage > g.maxLeverage) return fail(`Leverage can't exceed ${g.maxLeverage}x, your signed limit.`)
  if (!(maxOrderUsd >= 10) || maxOrderUsd > g.maxOrderUsd) return fail(`Max order can't exceed $${g.maxOrderUsd}, your signed limit.`)
  if (!(slip >= 0.01 && slip <= 10)) return fail("Slippage must be between 0.01% and 10%.")
  return { ok: true, value: { leaderId, signerRef: d.ref, allocationUsd, sizing, venues: [d.venue], kinds, ...(symbols.length ? { symbols } : {}), maxLeverage, maxOrderUsd, maxSlippageBps: Math.round(slip * 100) } }
}

export function describeGrant(g: Delegation["grant"]): string {
  const markets = g.kinds.map((k) => (k === "perp" ? "Futures" : "Spot")).join(" + ")
  const where = g.symbols.length ? g.symbols.join(", ") : "all markets"
  return `${markets} · ${where} · up to $${g.maxOrderUsd.toLocaleString()} per order, $${g.maxDailyNotionalUsd.toLocaleString()} a day · ${g.maxLeverage}x`
}
