import { readFile } from "node:fs/promises"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CryptoBackendClient } from "@/lib/crypto-backend/client"
import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import {
  FIAT_BRIDGE_VIRTUAL_ACCOUNT,
  FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY,
  FIAT_CONFIG_AVAILABLE,
  FIAT_CONFIG_BLOCKED,
  FIAT_CONFIG_DISABLED,
  FIAT_CONFIG_DISCOVERY_ONLY,
} from "@/lib/crypto-backend/__fixtures__/fiat"
import { __resetFiatMockState, respondFromFiatFixtures } from "@/lib/crypto-backend/dev-mock-fiat-responder"
import {
  BRIDGE_VIRTUAL_ACCOUNT_NETWORK_ID,
  buyRails,
  completedActivityIds,
  createBridgeUsdAccount,
  depositInstructionRows,
  hasNewCompletedDelivery,
} from "@/lib/crypto-backend/fiat-bridge-onramp"
import { displayRows, humanizeValue } from "@/lib/crypto-backend/fiat-display"
import { __resetFiatIdempotencyStore } from "@/lib/crypto-backend/fiat-idempotency"
import type { FiatCapabilitySnapshot, FiatVirtualAccountActivity } from "@/lib/crypto-backend/types"

/**
 * Bridge USD in Buy. Guide §10.1-10.2 (lines 811-888), §11 (lines 982-984),
 * §13 "Bridge USD onramp" (lines 1168-1178), and the CP6 team decisions in
 * docs/FIAT_RAMP_CONTEXT.md.
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
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

type Sent = { path: string; method: string; idempotencyKey: string | null; body?: string; status: number }

function mockedClient(intercept?: (path: string, method: string) => Response | undefined) {
  const sent: Sent[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://dashboard.test")
    const path = url.pathname.replace(/^\/api\/crypto\//, "")
    const method = init?.method ?? "GET"
    const real = (await respondFromFiatFixtures(new Request(url, init), path)) ?? new Response(null, { status: 404 })
    const response = intercept?.(path, method) ?? real
    sent.push({
      path,
      method,
      idempotencyKey: new Headers(init?.headers).get("idempotency-key"),
      body: typeof init?.body === "string" ? init.body : undefined,
      status: response.status,
    })
    return response
  }) as typeof fetch
  return { client: new CryptoBackendClient({ fetcher }), sent }
}

const clone = (): FiatCapabilitySnapshot => JSON.parse(JSON.stringify(FIAT_CONFIG_AVAILABLE))

beforeEach(() => {
  vi.stubGlobal("sessionStorage", new MemoryStorage())
  __resetFiatIdempotencyStore()
  __resetFiatMockState()
})

afterEach(() => {
  __resetFiatIdempotencyStore()
  vi.unstubAllGlobals()
})

describe("Buy rails come from /fiat/config (guide §5, §13 lines 1169-1170)", () => {
  it("offers both rails, local currency first, on the guide's example config", () => {
    expect(buyRails(FIAT_CONFIG_AVAILABLE)).toEqual(["local", "usd"])
  })

  it("offers only USD when the OnSwitch onramp is off", () => {
    const config = clone()
    config.providers.onswitch.directions.onrampEnabled = false
    expect(buyRails(config)).toEqual(["usd"])
  })

  it("offers only local currency when the Bridge virtual-account route is off", () => {
    const config = clone()
    config.providers.bridge.routes[0].status = "unavailable"
    expect(buyRails(config)).toEqual(["local"])
  })

  it.each([
    ["disabled", FIAT_CONFIG_DISABLED],
    ["blocked", FIAT_CONFIG_BLOCKED],
    ["discovery_only", FIAT_CONFIG_DISCOVERY_ONLY],
  ] as const)("offers nothing when the config is %s", (_label, config) => {
    expect(buyRails(config)).toEqual([])
  })

  it("offers nothing before the config loads", () => {
    expect(buyRails(undefined)).toEqual([])
  })
})

describe("creating the USD account (guide §10.1 lines 816-860)", () => {
  it("stays disabled until the backend confirms where networkId comes from (open question 4)", () => {
    expect(BRIDGE_VIRTUAL_ACCOUNT_NETWORK_ID).toBeNull()
  })

  it("posts exactly the guide's body with an idempotency key; asset is USDC, never a contract address", async () => {
    const { client, sent } = mockedClient()
    await createBridgeUsdAccount(client, { walletId: "w1", networkId: "net-1" })
    const request = sent.find((s) => s.path === "fiat/bridge/virtual-accounts" && s.method === "POST")
    expect(JSON.parse(request?.body ?? "{}")).toEqual({ walletId: "w1", networkId: "net-1", asset: "USDC" })
    expect(request?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("a duplicate create returns the same account: shared key, 201 then a 200 replay", async () => {
    const { client, sent } = mockedClient()
    const [a, b] = await Promise.all([
      createBridgeUsdAccount(client, { walletId: "w1", networkId: "net-1" }),
      createBridgeUsdAccount(client, { walletId: "w1", networkId: "net-1" }),
    ])
    const creates = sent.filter((s) => s.path === "fiat/bridge/virtual-accounts" && s.method === "POST")
    expect(creates[1].idempotencyKey).toBe(creates[0].idempotencyKey)
    expect(creates.map((s) => s.status).sort()).toEqual([200, 201])
    expect(b.id).toBe(a.id)
  })

  it("a lost response is retried with the same key and gets the same account", async () => {
    let lose = true
    const { client, sent } = mockedClient((path, method) => {
      if (path === "fiat/bridge/virtual-accounts" && method === "POST" && lose) {
        lose = false
        return new Response(JSON.stringify({ success: false, error: { code: "CRYPTO_SERVICE_UNREACHABLE", message: "x" } }), { status: 502 })
      }
      return undefined
    })
    await expect(createBridgeUsdAccount(client, { walletId: "w1", networkId: "net-1" })).rejects.toBeInstanceOf(CryptoBackendError)
    const account = await createBridgeUsdAccount(client, { walletId: "w1", networkId: "net-1" })
    const creates = sent.filter((s) => s.path === "fiat/bridge/virtual-accounts" && s.method === "POST")
    expect(creates[1].idempotencyKey).toBe(creates[0].idempotencyKey)
    expect(creates[1].status).toBe(200)
    expect(account.id).toBe(FIAT_BRIDGE_VIRTUAL_ACCOUNT.id)
  })
})

describe("deposit instructions are displayed exactly as returned (guide lines 856-858)", () => {
  it("reads the guide's example in order, listing payment rails", () => {
    expect(depositInstructionRows(FIAT_BRIDGE_VIRTUAL_ACCOUNT).map((r) => [r.label, r.value])).toEqual([
      ["Currency", "USD"],
      ["Send by", "ach, wire"],
      ["Account name", "Example User"],
      ["Routing number", "******6789"],
      ["Account number", "******4321"],
      ["Bank", "Example Bank"],
      ["Reference", "WS-VA-000071"],
    ])
  })

  it("masks routing and account numbers until revealed", () => {
    expect(depositInstructionRows(FIAT_BRIDGE_VIRTUAL_ACCOUNT).filter((r) => r.sensitive).map((r) => r.key)).toEqual([
      "routingNumber",
      "accountNumber",
    ])
  })

  it("shows nothing when the backend sends no instructions", () => {
    expect(depositInstructionRows({ depositInstructions: undefined })).toEqual([])
  })
})

describe("shared display helpers", () => {
  it("skips nested objects and mixed arrays, keeps primitive arrays", () => {
    const rows = displayRows(
      { a: "x", nested: { b: 1 }, list: ["ach", "wire"], mixed: ["ach", { b: 1 }], flag: true },
      { labels: {}, sensitiveKeys: new Set() },
    )
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ["a", "x"],
      ["list", "ach, wire"],
    ])
  })

  it("humanizes backend enum values", () => {
    expect(humanizeValue("MOBILE_MONEY")).toBe("Mobile money")
    expect(humanizeValue("completed")).toBe("Completed")
  })
})

describe("balance refresh after a completed delivery (guide §13 lines 1177-1178)", () => {
  const item = (id: string, providerStatus: string): FiatVirtualAccountActivity => ({
    ...FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY[0],
    id,
    providerStatus,
  })

  it("collects only items whose providerStatus is completed", () => {
    expect(completedActivityIds([item("a", "completed"), item("b", "pending")])).toEqual(new Set(["a"]))
    expect(completedActivityIds([])).toEqual(new Set())
    expect(completedActivityIds(undefined)).toBeUndefined()
  })

  it("refreshes when an item becomes completed", () => {
    const before = completedActivityIds([item("a", "pending")])
    const after = completedActivityIds([item("a", "completed")])
    expect(hasNewCompletedDelivery(before, after)).toBe(true)
  })

  it("refreshes when a new completed item appears", () => {
    const before = completedActivityIds([item("a", "completed")])
    const after = completedActivityIds([item("a", "completed"), item("b", "completed")])
    expect(hasNewCompletedDelivery(before, after)).toBe(true)
  })

  it("does not refresh on changes that aren't a completed delivery", () => {
    const before = completedActivityIds([item("a", "completed")])
    expect(hasNewCompletedDelivery(before, completedActivityIds([item("a", "completed"), item("b", "pending")]))).toBe(false)
    expect(hasNewCompletedDelivery(before, completedActivityIds([item("a", "completed")]))).toBe(false)
  })

  it("does not refresh on the first load or while loading", () => {
    expect(hasNewCompletedDelivery(undefined, completedActivityIds([item("a", "completed")]))).toBe(false)
    expect(hasNewCompletedDelivery(new Set(), undefined)).toBe(false)
  })
})

describe("empty activity reads 'No deposits yet', not a failure (guide lines 886-887)", () => {
  it("an empty list is a valid result with no completed deliveries", () => {
    expect(completedActivityIds([])).toEqual(new Set())
  })

  it("BridgeUsdBuy renders the empty message from the data branch, separate from the error branch", async () => {
    const source = await readFile("components/fiat/bridge/BridgeUsdBuy.tsx", "utf8")
    const errorBranch = source.indexOf("activity.error && !activity.data")
    const listBranch = source.indexOf("activity.data && activity.data.length > 0")
    const empty = source.indexOf("No deposits yet")
    expect(errorBranch).toBeGreaterThan(-1)
    expect(listBranch).toBeGreaterThan(errorBranch)
    // The empty message is the fallback after the list branch, not the error branch.
    expect(empty).toBeGreaterThan(listBranch)
  })
})
