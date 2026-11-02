import { describe, expect, it } from "vitest"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { verifyTypedData } from "viem"
import { isAllowedCopyRoute } from "../proxy-routes"
import { buildGrantInput, buildSubscriptionInput, DEFAULT_GRANT_FORM, followDefaults } from "../forms"
import { assertSafeDelegationPayload, revocationTypedData, DELEGATION_DOMAIN_NAME } from "@/lib/crypto-wallet/delegation-signing"
import type { Delegation } from "../types"

const addr = privateKeyToAccount(generatePrivateKey()).address
const delegation = (o: Partial<Delegation["grant"]> = {}): Delegation => ({
  ref: "d1", venue: "hyperliquid", masterAddress: addr, agentAddress: addr, status: "active", createdAt: 0,
  grant: { kinds: ["perp"], symbols: ["BTC", "ETH"], maxOrderUsd: 500, maxLeverage: 3, maxDailyNotionalUsd: 2000, expiresAt: 9e9, ...o },
})

describe("proxy allowlist", () => {
  it("allows the dashboard surface and nothing internal", () => {
    expect(isAllowedCopyRoute("GET", "leaders")).toBe(true)
    expect(isAllowedCopyRoute("POST", "delegations/abc-1/activate")).toBe(true)
    expect(isAllowedCopyRoute("PATCH", "subscriptions/s1")).toBe(true)
    expect(isAllowedCopyRoute("POST", "internal/leader-events")).toBe(false)
    expect(isAllowedCopyRoute("POST", "internal/leaders")).toBe(false)
    expect(isAllowedCopyRoute("GET", "delegations/abc/activate")).toBe(false)
    expect(isAllowedCopyRoute("DELETE", "delegations")).toBe(false)
    expect(isAllowedCopyRoute("GET", "../internal/leaders")).toBe(false)
  })
})

describe("grant form", () => {
  it("builds a payload from the defaults", () => {
    const r = buildGrantInput({ ...DEFAULT_GRANT_FORM, symbols: "btc, eth btc" }, addr)
    expect(r).toMatchObject({ ok: true, value: { kinds: ["spot", "perp"], symbols: ["BTC", "ETH"], maxOrderUsd: 500, expiresInDays: 30, venue: "hyperliquid" } })
  })
  it("rejects bad limits", () => {
    const bad = (o: object) => buildGrantInput({ ...DEFAULT_GRANT_FORM, ...o }, addr)
    expect(bad({ spot: false, perp: false })).toMatchObject({ ok: false })
    expect(bad({ maxOrderUsd: "12.5" })).toMatchObject({ ok: false })
    expect(bad({ maxDailyNotionalUsd: "100" })).toMatchObject({ ok: false })
    expect(bad({ maxLeverage: "51" })).toMatchObject({ ok: false })
    expect(bad({ expiresInDays: "365" })).toMatchObject({ ok: false })
  })
})

describe("follow form mirrors the signed grant", () => {
  const d = delegation()
  it("accepts the defaults for a grant", () => {
    expect(buildSubscriptionInput(followDefaults(d), "L", d)).toMatchObject({ ok: true, value: { signerRef: "d1", kinds: ["perp"], symbols: ["BTC", "ETH"], maxSlippageBps: 100, venues: ["hyperliquid"] } })
  })
  it("blocks anything past the signed limits", () => {
    const f = followDefaults(d)
    expect(buildSubscriptionInput({ ...f, spot: true }, "L", d)).toMatchObject({ ok: false })
    expect(buildSubscriptionInput({ ...f, maxLeverage: "10" }, "L", d)).toMatchObject({ ok: false })
    expect(buildSubscriptionInput({ ...f, maxOrderUsd: "900" }, "L", d)).toMatchObject({ ok: false })
    expect(buildSubscriptionInput({ ...f, symbols: "DOGE" }, "L", d)).toMatchObject({ ok: false })
    expect(buildSubscriptionInput({ ...f, symbols: "" }, "L", d)).toMatchObject({ ok: false })
    expect(buildSubscriptionInput({ ...f, allocationUsd: "5" }, "L", d)).toMatchObject({ ok: false })
  })
  it("allows any symbol when the grant has no symbol limit", () => {
    const open = delegation({ symbols: [] })
    expect(buildSubscriptionInput({ ...followDefaults(open), symbols: "" }, "L", open)).toMatchObject({ ok: true })
  })
})

describe("delegation signing guard", () => {
  const grant = (o: Record<string, unknown> = {}, domain = DELEGATION_DOMAIN_NAME) => ({
    domain: { name: domain, version: "1" }, types: { Delegation: [] }, primaryType: "Delegation",
    message: { delegator: addr.toLowerCase(), scope: "trade-only", ...o } as Record<string, string>,
  })
  it("signs only a trade-only grant for this wallet", () => {
    expect(() => assertSafeDelegationPayload(grant(), addr)).not.toThrow()
    expect(() => assertSafeDelegationPayload(grant({}, "USD Coin"), addr)).toThrow("not a WorldStreet delegation")
    expect(() => assertSafeDelegationPayload(grant({ scope: "all" }), addr)).toThrow("trade-only")
    expect(() => assertSafeDelegationPayload(grant({ delegator: "0x" + "1".repeat(40) }), addr)).toThrow("different wallet")
    expect(() => assertSafeDelegationPayload({ ...grant(), primaryType: "Permit" }, addr)).toThrow("unexpected message type")
    expect(() => assertSafeDelegationPayload({ ...grant(), types: { Delegation: [], Permit: [] } }, addr)).toThrow("extra types")
  })
  it("produces a revocation the service's verifier accepts", async () => {
    const account = privateKeyToAccount(generatePrivateKey())
    const td = revocationTypedData(account.address, "d1")
    expect(() => assertSafeDelegationPayload(td, account.address)).not.toThrow()
    const signature = await account.signTypedData({ domain: td.domain, types: td.types, primaryType: "Revocation", message: td.message as never })
    expect(await verifyTypedData({ address: account.address, signature, domain: td.domain, types: td.types, primaryType: "Revocation", message: td.message as never })).toBe(true)
  })
})
