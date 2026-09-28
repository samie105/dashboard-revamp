import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CryptoBackendClient } from "@/lib/crypto-backend/client"
import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import {
  FIAT_CONFIG_AVAILABLE,
  FIAT_CONFIG_BLOCKED,
  FIAT_CONFIG_DISABLED,
  FIAT_CONFIG_DISCOVERY_ONLY,
  FIAT_ERROR_QUOTE_NOT_ACTIVE,
  FIAT_ORDER_ONSWITCH_ONRAMP,
  FIAT_QUOTE_ONRAMP,
} from "@/lib/crypto-backend/__fixtures__/fiat"
import { __resetFiatMockState, respondFromFiatFixtures } from "@/lib/crypto-backend/dev-mock-fiat-responder"
import { maskValue } from "@/lib/crypto-backend/fiat-display"
import { __resetFiatIdempotencyStore } from "@/lib/crypto-backend/fiat-idempotency"
import {
  buildOnrampQuoteRequest,
  createOnrampOrder,
  isQuoteUsable,
  isValidAmount,
  ONRAMP_STAGES,
  needsRequote,
  onrampAvailability,
  onrampOptions,
  onrampOrderView,
  onrampStageIndex,
  paymentInstructionsFrom,
  quoteSecondsLeft,
  requestOnrampQuote,
} from "@/lib/crypto-backend/fiat-onramp"
import type { FiatCapabilitySnapshot } from "@/lib/crypto-backend/types"

/**
 * Buy → OnSwitch onramp. Guide §5 (lines 368-377), §9.1-9.2 (lines 641-757),
 * §11 (lines 947-984), §13 (lines 1145-1156).
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

type Sent = { path: string; method: string; idempotencyKey: string | null; status: number }

/**
 * A client answered by the fixture responder. `intercept` can replace the
 * response the client sees (the responder still processes the request, so a
 * "lost" response still records the idempotent result, like a real timeout).
 */
function mockedClient(intercept?: (path: string, method: string, real: Response) => Response | undefined) {
  const sent: Sent[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://dashboard.test")
    const path = url.pathname.replace(/^\/api\/crypto\//, "")
    const method = init?.method ?? "GET"
    const real = (await respondFromFiatFixtures(new Request(url, init), path)) ?? new Response(null, { status: 404 })
    const response = intercept?.(path, method, real) ?? real
    sent.push({ path, method, idempotencyKey: new Headers(init?.headers).get("idempotency-key"), status: response.status })
    return response
  }) as typeof fetch
  return { client: new CryptoBackendClient({ fetcher }), sent }
}

const clone = (): FiatCapabilitySnapshot => JSON.parse(JSON.stringify(FIAT_CONFIG_AVAILABLE))
const NG_BANK = () => onrampOptions(FIAT_CONFIG_AVAILABLE).find((o) => o.countryCode === "NG" && o.channel === "BANK")!

beforeEach(() => {
  vi.stubGlobal("sessionStorage", new MemoryStorage())
  __resetFiatIdempotencyStore()
  __resetFiatMockState()
})

afterEach(() => {
  __resetFiatIdempotencyStore()
  vi.unstubAllGlobals()
})

describe("availability follows every §5 status (lines 368-377)", () => {
  it.each([
    ["available", FIAT_CONFIG_AVAILABLE, "available"],
    ["disabled", FIAT_CONFIG_DISABLED, "disabled"],
    ["blocked", FIAT_CONFIG_BLOCKED, "blocked"],
    ["discovery_only", FIAT_CONFIG_DISCOVERY_ONLY, "discovery_only"],
  ] as const)("%s config → %s", (_label, config, expected) => {
    expect(onrampAvailability(config)).toBe(expected)
  })

  it("is loading before the config arrives", () => {
    expect(onrampAvailability(undefined)).toBe("loading")
  })

  it("is unavailable when the OnSwitch onramp direction is off", () => {
    const config = clone()
    config.providers.onswitch.directions.onrampEnabled = false
    expect(onrampAvailability(config)).toBe("unavailable")
  })

  it("is unavailable when no asset route is wallet-ready", () => {
    const config = clone()
    config.assetRoutes[0].walletReady = false
    expect(onrampAvailability(config)).toBe("unavailable")
  })
})

describe("options come only from /fiat/config (guide lines 364-366, 375-377)", () => {
  it("offers each enabled corridor × channel × wallet-ready route from the guide's example", () => {
    expect(onrampOptions(FIAT_CONFIG_AVAILABLE).map((o) => [o.countryCode, o.currencyCode, o.channel, o.asset, o.network])).toEqual([
      ["NG", "NGN", "BANK", "ethereum:usdc", "ethereum-mainnet"],
      ["GH", "GHS", "MOBILE_MONEY", "ethereum:usdc", "ethereum-mainnet"],
    ])
  })

  it("offers one option per channel a corridor lists", () => {
    const config = clone()
    config.providers.onswitch.coverage[0].channels = ["BANK", "MOBILE_MONEY"]
    expect(onrampOptions(config).filter((o) => o.countryCode === "NG").map((o) => o.channel)).toEqual(["BANK", "MOBILE_MONEY"])
  })

  it("skips a wallet-ready route with no localNetworkId rather than guessing a network", () => {
    const config = clone()
    delete config.assetRoutes[0].localNetworkId
    expect(onrampOptions(config)).toEqual([])
  })

  it("offers nothing when the config isn't available", () => {
    expect(onrampOptions(FIAT_CONFIG_BLOCKED)).toEqual([])
  })
})

describe("quote request (guide §9.1 lines 646-657)", () => {
  it("matches the guide's onramp example body exactly", () => {
    expect(buildOnrampQuoteRequest(NG_BANK(), " 100000 ")).toEqual({
      provider: "onswitch",
      direction: "onramp",
      country: "NG",
      currency: "NGN",
      channel: "BANK",
      amount: "100000",
      asset: "ethereum:usdc",
      network: "ethereum-mainnet",
      exactOutput: false,
    })
  })

  it.each([
    ["100000", true],
    ["12.50", true],
    ["0.01", true],
    ["0", false],
    ["0.00", false],
    ["-1", false],
    ["1e5", false],
    ["", false],
    ["abc", false],
    ["1,000", false],
  ])("amount %j valid: %s", (amount, valid) => {
    expect(isValidAmount(amount)).toBe(valid)
  })

  it("posts the quote with an idempotency key", async () => {
    const { client, sent } = mockedClient()
    const quote = await requestOnrampQuote(client, buildOnrampQuoteRequest(NG_BANK(), "100000"))
    expect(quote.state).toBe("active")
    expect(sent[0]).toMatchObject({ path: "fiat/quotes", method: "POST", status: 201 })
    expect(sent[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe("quote expiry (guide line 700-701)", () => {
  const now = Date.parse("2026-09-26T10:50:00.000Z")

  it("counts down to expiresAt", () => {
    expect(quoteSecondsLeft(FIAT_QUOTE_ONRAMP, now)).toBe(300)
  })

  it("is usable while active and not expired", () => {
    expect(isQuoteUsable(FIAT_QUOTE_ONRAMP, now)).toBe(true)
  })

  it("is not usable once expiresAt has passed", () => {
    expect(isQuoteUsable(FIAT_QUOTE_ONRAMP, Date.parse("2026-09-26T10:55:00.000Z"))).toBe(false)
    expect(quoteSecondsLeft(FIAT_QUOTE_ONRAMP, Date.parse("2026-09-26T11:00:00.000Z"))).toBe(0)
  })

  it("is not usable in any state other than active", () => {
    expect(isQuoteUsable({ ...FIAT_QUOTE_ONRAMP, state: "expired" }, now)).toBe(false)
    expect(isQuoteUsable({ ...FIAT_QUOTE_ONRAMP, state: "superseded" }, now)).toBe(false)
  })

  it("treats an unparseable expiry as expired", () => {
    expect(quoteSecondsLeft({ expiresAt: "soon" }, now)).toBe(0)
  })
})

describe("expired quote → FIAT_QUOTE_NOT_ACTIVE → re-quote with a new key (guide lines 970-971)", () => {
  it("detects the code, and the re-quote gets a new idempotency key", async () => {
    const { client, sent } = mockedClient((path, method) =>
      path === "fiat/orders" && method === "POST"
        ? new Response(JSON.stringify(FIAT_ERROR_QUOTE_NOT_ACTIVE), { status: 409 })
        : undefined,
    )
    const request = buildOnrampQuoteRequest(NG_BANK(), "100000")
    const quote = await requestOnrampQuote(client, request)

    const error = await createOnrampOrder(client, { walletId: "w1", quoteId: quote.id }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CryptoBackendError)
    expect(needsRequote(error)).toBe(true)

    await requestOnrampQuote(client, request)
    const quoteKeys = sent.filter((s) => s.path === "fiat/quotes").map((s) => s.idempotencyKey)
    expect(quoteKeys).toHaveLength(2)
    expect(quoteKeys[1]).not.toBe(quoteKeys[0])
  })

  it("does not treat other errors as a re-quote", () => {
    expect(needsRequote(new CryptoBackendError("x", 409, "IDEMPOTENCY_IN_PROGRESS"))).toBe(false)
    expect(needsRequote(new Error("x"))).toBe(false)
  })
})

describe("order creation (guide §9.2, §11 lines 964-975)", () => {
  it("201 creates the record but is not treated as paid: the screen is payment instructions", async () => {
    const { client, sent } = mockedClient()
    const order = await createOnrampOrder(client, { walletId: "w1", quoteId: FIAT_QUOTE_ONRAMP.id })
    expect(sent.at(-1)?.status).toBe(201)
    const view = onrampOrderView(order)
    expect(view.screen).toBe("pay")
    expect(view.terminal).toBe(false)
  })

  it("double-click creates one order: both calls share one key, the second is a 200 replay of the same order", async () => {
    const { client, sent } = mockedClient()
    const [a, b] = await Promise.all([
      createOnrampOrder(client, { walletId: "w1", quoteId: FIAT_QUOTE_ONRAMP.id }),
      createOnrampOrder(client, { walletId: "w1", quoteId: FIAT_QUOTE_ONRAMP.id }),
    ])
    const orderCalls = sent.filter((s) => s.path === "fiat/orders")
    expect(orderCalls.map((s) => s.idempotencyKey)).toEqual([orderCalls[0].idempotencyKey, orderCalls[0].idempotencyKey])
    expect(orderCalls.map((s) => s.status).sort()).toEqual([200, 201])
    expect(b).toEqual(a)
  })

  it("a lost response is retried with the same key and the 200 replay renders the same order", async () => {
    let lose = true
    const { client, sent } = mockedClient((path, method) => {
      if (path === "fiat/orders" && method === "POST" && lose) {
        lose = false
        return new Response(JSON.stringify({ success: false, error: { code: "CRYPTO_SERVICE_UNREACHABLE", message: "x" } }), { status: 502 })
      }
      return undefined
    })
    const input = { walletId: "w1", quoteId: FIAT_QUOTE_ONRAMP.id }
    await expect(createOnrampOrder(client, input)).rejects.toBeInstanceOf(CryptoBackendError)
    const replayed = await createOnrampOrder(client, input)

    const orderCalls = sent.filter((s) => s.path === "fiat/orders")
    expect(orderCalls[1].idempotencyKey).toBe(orderCalls[0].idempotencyKey)
    expect(orderCalls[1].status).toBe(200)
    expect(replayed.id).toBe(FIAT_ORDER_ONSWITCH_ONRAMP.id)
    expect(onrampOrderView(replayed).screen).toBe("pay")
  })
})

describe("every §11 state renders (guide lines 954-963)", () => {
  it.each([
    ["created", "continue", false],
    ["quoted", "continue", false],
    ["awaiting_bank_deposit", "pay", false],
    ["awaiting_crypto_deposit", "processing", false],
    ["crypto_intent_ready", "processing", false],
    ["crypto_submitted", "processing", false],
    ["provider_processing", "processing", false],
    ["scheduled", "processing", false],
    ["completed", "completed", true],
    ["manual_review", "review", false],
    ["blocked", "review", false],
    ["failed", "problem", true],
    ["reversed", "problem", true],
    ["refund_in_flight", "problem", false],
    ["refunded", "problem", true],
    ["refund_failed", "problem", true],
    ["something_new", "unknown", false],
  ])("%s → %s (terminal: %s)", (state, screen, terminal) => {
    expect(onrampOrderView({ state })).toEqual({ screen, terminal })
  })

  it("shows the backend's reason on review and problem states, as given", () => {
    expect(onrampOrderView({ state: "failed", failureReason: "Payment amount did not match" }).reason).toBe(
      "Payment amount did not match",
    )
    expect(onrampOrderView({ state: "manual_review", reviewReason: "Compliance check" }).reason).toBe("Compliance check")
    expect(onrampOrderView({ state: "refunded", refundReason: "Sent after expiry" }).reason).toBe("Sent after expiry")
    expect(onrampOrderView({ state: "refund_in_flight", refundReason: "Wrong amount received" })).toEqual({
      screen: "problem",
      terminal: false,
      reason: "Wrong amount received",
    })
  })

  it("shows no reason on normal states, and ignores blank reasons", () => {
    expect(onrampOrderView({ state: "awaiting_bank_deposit", failureReason: "x" }).reason).toBeUndefined()
    expect(onrampOrderView({ state: "failed", failureReason: "  " }).reason).toBeUndefined()
  })
})

describe("payment instructions render only what the backend returns (guide lines 755-757)", () => {
  it("reads the guide's example in order, pulling expiresAt out for the countdown", () => {
    const { rows, expiresAt } = paymentInstructionsFrom(FIAT_ORDER_ONSWITCH_ONRAMP.providerDisplay)
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["Amount", "100000"],
      ["Currency", "NGN"],
      ["Bank", "Example Bank"],
      ["Account name", "WorldStreet Settlement"],
      ["Account number", "******1234"],
    ])
    expect(expiresAt).toBe("2026-09-26T11:00:00.000Z")
  })

  it("marks the account number as sensitive (masked until revealed)", () => {
    const { rows } = paymentInstructionsFrom(FIAT_ORDER_ONSWITCH_ONRAMP.providerDisplay)
    expect(rows.filter((r) => r.sensitive).map((r) => r.key)).toEqual(["accountNumber"])
  })

  it("shows unknown string/number fields with a readable label and skips nested objects", () => {
    const { rows } = paymentInstructionsFrom({
      paymentInstructions: { walletPhone: "+233000000000", ussdCode: 123, nested: { a: 1 }, flag: true },
    })
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["Wallet Phone", "+233000000000"],
      ["Ussd Code", "123"],
    ])
  })

  it.each([undefined, {}, { paymentInstructions: null }, { paymentInstructions: ["x"] }, { paymentInstructions: "text" }])(
    "renders nothing when instructions are missing or malformed (%j)",
    (providerDisplay) => {
      expect(paymentInstructionsFrom(providerDisplay as Record<string, unknown> | undefined)).toEqual({ rows: [] })
    },
  )

  it("masks all but the last four characters", () => {
    expect(maskValue("0123456789")).toBe("••••••6789")
    expect(maskValue("12")).toBe("••••12")
  })
})

describe("status stages restate the §11 groups (guide lines 954-961)", () => {
  it("has one stage per group an onramp passes through", () => {
    expect(ONRAMP_STAGES.map((s) => s.key)).toEqual(["created", "awaiting_bank_deposit", "provider_processing", "completed"])
  })

  it.each([
    ["created", 0],
    ["quoted", 0],
    ["awaiting_bank_deposit", 1],
    ["provider_processing", 2],
    ["scheduled", 2],
    ["crypto_submitted", 2],
    ["completed", 4],
    ["manual_review", null],
    ["failed", null],
    ["refund_in_flight", null],
    ["something_new", null],
  ])("%s → stage %s", (state, index) => {
    expect(onrampStageIndex(state)).toBe(index)
  })
})
