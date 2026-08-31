import { describe, expect, it } from "vitest"

import { createIdempotencyKeyStore, transferFingerprint } from "../idempotency"

const TRANSFER = {
  accountId: "acct_1",
  networkId: "ethereum-mainnet",
  asset: { kind: "native" as const, identifier: "ETH" },
  to: "0x1111111111111111111111111111111111111111",
  amount: "1.5",
}

/** Deterministic mint so the assertions are about identity, not about UUIDs. */
function counter() {
  let n = 0
  return () => `key-${++n}`
}

describe("createIdempotencyKeyStore", () => {
  it("returns the same key for a repeat of the same transfer", () => {
    // The whole point: a double-click, a re-fired mutation, or the client's
    // 401-refresh replay must all carry the key the service has already seen,
    // so it collapses them into one intent instead of creating three.
    const store = createIdempotencyKeyStore(counter())
    expect(store.keyFor(TRANSFER)).toBe("key-1")
    expect(store.keyFor(TRANSFER)).toBe("key-1")
    expect(store.keyFor({ ...TRANSFER })).toBe("key-1")
  })

  it.each([
    ["amount", { amount: "1.6" }],
    ["recipient", { to: "0x2222222222222222222222222222222222222222" }],
    ["network", { networkId: "arbitrum-one" }],
    ["account", { accountId: "acct_2" }],
    ["asset", { asset: { kind: "token" as const, identifier: "0xUSDC" } }],
  ])("mints a new key when the %s changes", (_label, patch) => {
    // Editing any field means a different transfer. Reusing the key here
    // would let the service answer an edited transfer with the old intent.
    const store = createIdempotencyKeyStore(counter())
    expect(store.keyFor(TRANSFER)).toBe("key-1")
    expect(store.keyFor({ ...TRANSFER, ...patch })).toBe("key-2")
  })

  it("keeps each transfer's key stable when several are interleaved", () => {
    const store = createIdempotencyKeyStore(counter())
    const other = { ...TRANSFER, amount: "9" }
    expect(store.keyFor(TRANSFER)).toBe("key-1")
    expect(store.keyFor(other)).toBe("key-2")
    expect(store.keyFor(TRANSFER)).toBe("key-1")
    expect(store.keyFor(other)).toBe("key-2")
  })

  it("mints a fresh key after clear(), so a deliberate repeat send is a new transfer", () => {
    // Sending the same amount to the same address twice on purpose must NOT
    // be deduplicated into the transfer that just completed. `reset()` in the
    // send flow is what calls this.
    const store = createIdempotencyKeyStore(counter())
    expect(store.keyFor(TRANSFER)).toBe("key-1")
    store.clear()
    expect(store.keyFor(TRANSFER)).toBe("key-2")
  })

  it("defaults to real UUIDs that differ per transfer", () => {
    const store = createIdempotencyKeyStore()
    const first = store.keyFor(TRANSFER)
    expect(first).toMatch(/^[0-9a-f-]{36}$/i)
    expect(store.keyFor(TRANSFER)).toBe(first)
    expect(store.keyFor({ ...TRANSFER, amount: "2" })).not.toBe(first)
  })
})

describe("transferFingerprint", () => {
  it("cannot be collided by a delimiter inside a field", () => {
    // A joined string would make these two identical and silently merge two
    // different transfers into one key — i.e. one of them never happens.
    const a = { ...TRANSFER, to: "0xAAA", amount: "1 2" }
    const b = { ...TRANSFER, to: "0xAAA 1", amount: "2" }
    expect(transferFingerprint(a)).not.toBe(transferFingerprint(b))
  })

  it("ignores key order in the asset object", () => {
    const reordered = { ...TRANSFER, asset: { identifier: "ETH", kind: "native" as const } }
    expect(transferFingerprint(reordered)).toBe(transferFingerprint(TRANSFER))
  })
})
