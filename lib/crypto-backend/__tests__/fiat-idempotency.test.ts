import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Idempotency manager (guide §3.3 lines 147-157, §9.3, §11, §12.1, §12.3
 * lines 1140-1142, §15). The Node test env has no sessionStorage, so a
 * minimal in-memory Storage stands in for the browser's.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
  dump() {
    return Array.from(this.map.entries())
  }
}

let storage: MemoryStorage

async function loadModule() {
  return await import("@/lib/crypto-backend/fiat-idempotency")
}

/**
 * Build a CryptoBackendError from the same module graph the reloaded
 * idempotency module uses. After vi.resetModules() a top-level import would
 * be a different class and fail `instanceof`.
 */
async function backendError(status: number, code: string) {
  const { CryptoBackendError } = await import("@/lib/crypto-backend/errors")
  return new CryptoBackendError("x", status, code)
}

beforeEach(async () => {
  vi.resetModules()
  storage = new MemoryStorage()
  vi.stubGlobal("sessionStorage", storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const QUOTE = {
  provider: "onswitch",
  direction: "onramp",
  country: "NG",
  currency: "NGN",
  channel: "BANK",
  amount: "100000",
  asset: "ethereum:usdc",
  network: "ethereum-mainnet",
} as const

describe("keyFor — new key per action, same key on retry (guide §3.3)", () => {
  it("returns a UUID", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it("returns the same key for an exact retry of the same request", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    const first = fiatIdempotencyStore.keyFor("quote", QUOTE)
    const retry = fiatIdempotencyStore.keyFor("quote", { ...QUOTE })
    expect(retry).toBe(first)
  })

  it("is insensitive to key order and ignores undefined fields", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    const a = fiatIdempotencyStore.keyFor("quote", QUOTE)
    const reordered = Object.fromEntries(Object.entries(QUOTE).reverse())
    const b = fiatIdempotencyStore.keyFor("quote", { ...reordered, exactOutput: undefined })
    expect(b).toBe(a)
  })

  it.each([
    ["amount", { amount: "200000" }],
    ["channel", { channel: "MOBILE_MONEY" }],
    ["asset", { asset: "arbitrum:usdc" }],
    ["network", { network: "arbitrum-one" }],
    ["direction", { direction: "offramp" }],
  ])("mints a new key when %s changes (never reuse for a different request)", async (_label, change) => {
    const { fiatIdempotencyStore } = await loadModule()
    const original = fiatIdempotencyStore.keyFor("quote", QUOTE)
    const changed = fiatIdempotencyStore.keyFor("quote", { ...QUOTE, ...change })
    expect(changed).not.toBe(original)
  })

  it("mints different keys for different wallets, quotes and beneficiaries on orders", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    const base = { provider: "onswitch", walletId: "w1", quoteId: "q1" }
    const k1 = fiatIdempotencyStore.keyFor("order", base)
    expect(fiatIdempotencyStore.keyFor("order", { ...base, walletId: "w2" })).not.toBe(k1)
    expect(fiatIdempotencyStore.keyFor("order", { ...base, quoteId: "q2" })).not.toBe(k1)
    expect(fiatIdempotencyStore.keyFor("order", { ...base, beneficiaryId: "b1" })).not.toBe(k1)
  })
})

describe("confirm uses its own key (guide §9.3, §11)", () => {
  it("never shares a key with order creation for the same order", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    const orderKey = fiatIdempotencyStore.keyFor("order", { orderId: "o1" })
    const confirmKey = fiatIdempotencyStore.keyFor("confirm", { orderId: "o1" })
    expect(confirmKey).not.toBe(orderKey)
  })

  it("releasing the order key leaves the confirm key intact", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    const confirmKey = fiatIdempotencyStore.keyFor("confirm", { orderId: "o1", transactionHash: "0xabc" })
    fiatIdempotencyStore.releaseAll("order")
    expect(fiatIdempotencyStore.keyFor("confirm", { orderId: "o1", transactionHash: "0xabc" })).toBe(confirmKey)
  })
})

describe("release", () => {
  it("makes the next call for the same identity mint a fresh key", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    const first = fiatIdempotencyStore.keyFor("quote", QUOTE)
    fiatIdempotencyStore.release("quote", QUOTE)
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).not.toBe(first)
  })

  it("releaseAll only clears the named operation", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    const quoteKey = fiatIdempotencyStore.keyFor("quote", QUOTE)
    const vaKey = fiatIdempotencyStore.keyFor("virtual-account", { walletId: "w1", networkId: "ethereum-mainnet", asset: "USDC" })
    fiatIdempotencyStore.releaseAll("quote")
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).not.toBe(quoteKey)
    expect(fiatIdempotencyStore.keyFor("virtual-account", { walletId: "w1", networkId: "ethereum-mainnet", asset: "USDC" })).toBe(vaKey)
  })
})

describe("persistence: sessionStorage with in-memory fallback", () => {
  it("reuses an in-flight key after a tab reload (fresh module, same sessionStorage)", async () => {
    const first = (await loadModule()).fiatIdempotencyStore.keyFor("order", { walletId: "w1", quoteId: "q1" })
    vi.resetModules()
    const afterReload = (await loadModule()).fiatIdempotencyStore.keyFor("order", { walletId: "w1", quoteId: "q1" })
    expect(afterReload).toBe(first)
  })

  it("still returns stable keys when sessionStorage throws", async () => {
    vi.stubGlobal("sessionStorage", {
      get length() {
        throw new Error("blocked")
      },
      getItem() {
        throw new Error("blocked")
      },
      setItem() {
        throw new Error("blocked")
      },
      removeItem() {
        throw new Error("blocked")
      },
      key() {
        throw new Error("blocked")
      },
      clear() {
        throw new Error("blocked")
      },
    })
    const { fiatIdempotencyStore } = await loadModule()
    const a = fiatIdempotencyStore.keyFor("quote", QUOTE)
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).toBe(a)
    fiatIdempotencyStore.release("quote", QUOTE)
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).not.toBe(a)
  })

  it("works when sessionStorage is absent (SSR)", async () => {
    vi.stubGlobal("sessionStorage", undefined)
    const { fiatIdempotencyStore } = await loadModule()
    const a = fiatIdempotencyStore.keyFor("quote", QUOTE)
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).toBe(a)
  })
})

describe("no bank details stored (guide §3.3 line 166, §15)", () => {
  it.each([
    "account_number",
    "accountNumber",
    "bank_account_number",
    "bankAccountNumber",
    "iban",
    "swift",
    "sort_code",
    "sortCode",
    "routing_number",
    "routingNumber",
    "providerPayload",
    "provider_payload",
  ])("refuses an identity containing %s and writes nothing", async (field) => {
    const { fiatIdempotencyStore } = await loadModule()
    expect(() =>
      fiatIdempotencyStore.keyFor("beneficiary-create", {
        provider: "onswitch",
        country: "NG",
        [field]: "0123456789",
      }),
    ).toThrow(/bank details/)
    expect(storage.length).toBe(0)
  })

  it("stores only the fingerprint fields the caller passed, never a raw account number", async () => {
    const { fiatIdempotencyStore } = await loadModule()
    fiatIdempotencyStore.keyFor("beneficiary-create", {
      provider: "onswitch",
      direction: "offramp",
      country: "NG",
      currency: "NGN",
      channel: "BANK",
      holderName: "Example User",
    })
    const serialized = JSON.stringify(storage.dump())
    expect(serialized).not.toMatch(/account_number|accountNumber|routing|iban|0123456789/)
  })
})

describe("runIdempotentMutation — released on a definitive response (guide §12.3 lines 1140-1142)", () => {
  it("releases the key after success", async () => {
    const { runIdempotentMutation, fiatIdempotencyStore } = await loadModule()
    let used = ""
    await runIdempotentMutation("quote", QUOTE, async (key) => {
      used = key
      return "ok"
    })
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).not.toBe(used)
  })

  it.each([
    [400, "INVALID_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "BENEFICIARY_NOT_VERIFIED"],
    [404, "NOT_FOUND"],
    [409, "FIAT_QUOTE_NOT_ACTIVE"],
    [422, "FIAT_CORRIDOR_UNAVAILABLE"],
  ])("releases the key after a definitive rejection (%i %s)", async (status, code) => {
    const { runIdempotentMutation, fiatIdempotencyStore } = await loadModule()
    const error = await backendError(status, code)
    let used = ""
    await expect(
      runIdempotentMutation("quote", QUOTE, async (key) => {
        used = key
        throw error
      }),
    ).rejects.toBe(error)
    expect(fiatIdempotencyStore.keyFor("quote", QUOTE)).not.toBe(used)
  })

  it.each([
    [0, "CRYPTO_BACKEND_UNREACHABLE"],
    [429, "RATE_LIMITED"],
    [409, "IDEMPOTENCY_IN_PROGRESS"],
    [409, "IDEMPOTENT_REQUEST_FAILED"],
    [500, "INTERNAL_ERROR"],
    [502, "PROVIDER_RESPONSE_INVALID"],
    [503, "CRYPTO_SERVICE_UNCONFIGURED"],
    [504, "GATEWAY_TIMEOUT"],
  ])("keeps the key after an uncertain failure (%i %s) so the retry reuses it", async (status, code) => {
    const { runIdempotentMutation } = await loadModule()
    const error = await backendError(status, code)
    const keys: string[] = []
    await expect(
      runIdempotentMutation("order", { walletId: "w1", quoteId: "q1" }, async (key) => {
        keys.push(key)
        throw error
      }),
    ).rejects.toBe(error)
    await runIdempotentMutation("order", { walletId: "w1", quoteId: "q1" }, async (key) => {
      keys.push(key)
      return "ok"
    })
    expect(keys[1]).toBe(keys[0])
  })

  it("keeps the key after an abort or a non-backend throw (outcome unknown)", async () => {
    const { runIdempotentMutation } = await loadModule()
    const keys: string[] = []
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" })
    await expect(
      runIdempotentMutation("order", { walletId: "w1", quoteId: "q1" }, async (key) => {
        keys.push(key)
        throw abort
      }),
    ).rejects.toBe(abort)
    await runIdempotentMutation("order", { walletId: "w1", quoteId: "q1" }, async (key) => {
      keys.push(key)
      return "ok"
    })
    expect(keys[1]).toBe(keys[0])
  })

  it("double-click: two concurrent calls for the same action share one key", async () => {
    const { runIdempotentMutation } = await loadModule()
    const seen: string[] = []
    const mutate = async (key: string) => {
      seen.push(key)
      await new Promise((resolve) => setTimeout(resolve, 5))
      return key
    }
    await Promise.all([
      runIdempotentMutation("order", { walletId: "w1", quoteId: "q1" }, mutate),
      runIdempotentMutation("order", { walletId: "w1", quoteId: "q1" }, mutate),
    ])
    expect(seen[0]).toBe(seen[1])
  })
})
