import { beforeEach, describe, expect, it } from "vitest"

import {
  __resetFiatMockState,
  respondFromFiatFixtures,
} from "@/lib/crypto-backend/dev-mock-fiat-responder"
import {
  FIAT_ORDER_BRIDGE_WITHDRAWAL,
  FIAT_ORDER_ONSWITCH_OFFRAMP,
  FIAT_ORDER_ONSWITCH_ONRAMP,
} from "@/lib/crypto-backend/__fixtures__/fiat"

const BASE = "https://dashboard.example.test/api/crypto/"

function request(
  method: string,
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Request {
  const headers = new Headers()
  if (options.body !== undefined) headers.set("content-type", "application/json")
  if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey)
  return new Request(`${BASE}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

type ResponseBody = {
  success: boolean
  requestId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper reads many shapes
  data?: any
  error?: { code: string; message: string; details?: unknown }
}

async function respond(
  method: string,
  path: string,
  options?: { body?: unknown; idempotencyKey?: string },
): Promise<{ response: Response; body: ResponseBody }> {
  const response = await respondFromFiatFixtures(request(method, path, options), path)
  if (!response) throw new Error(`no response for ${method} ${path}`)
  const body = (await response.clone().json()) as ResponseBody
  return { response, body }
}

beforeEach(() => {
  __resetFiatMockState()
})

describe("dev-mock-fiat-responder envelope + requestId", () => {
  it("returns 200 with success envelope, requestId, and x-request-id header on GET /fiat/config", async () => {
    const { response, body } = await respond("GET", "fiat/config")
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(typeof body.requestId).toBe("string")
    expect(body.requestId?.length ?? 0).toBeGreaterThan(0)
    expect(response.headers.get("x-request-id")).toBe(body.requestId)
    expect(body.data.availability).toBe("available")
  })

  it("shifts config generatedAt/cacheExpiresAt to now so it isn't born stale", async () => {
    const before = Date.now()
    const { body } = await respond("GET", "fiat/config")
    const after = Date.now()
    const generated = Date.parse(body.data.generatedAt)
    const expires = Date.parse(body.data.cacheExpiresAt)
    expect(generated).toBeGreaterThanOrEqual(before)
    expect(generated).toBeLessThanOrEqual(after)
    expect(expires - generated).toBeGreaterThan(30_000)
  })

  it("returns only safe beneficiary requirement metadata", async () => {
    const { body } = await respond("GET", "fiat/beneficiary-requirements")
    expect(body.success).toBe(true)
    expect(body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "bank.account_number", required: true }),
    ]))
    expect(JSON.stringify(body.data)).not.toContain("3048915627")
  })
})

describe("dev-mock-fiat-responder idempotency (guide §3.3, §6.2)", () => {
  it("POST /fiat/quotes without Idempotency-Key returns 400 IDEMPOTENCY_KEY_REQUIRED", async () => {
    const { response, body } = await respond("POST", "fiat/quotes", { body: { direction: "onramp" } })
    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error?.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    expect(body.error?.message).toBe("Idempotency-Key header is required")
    expect(body.requestId).toBeTruthy()
    expect(response.headers.get("x-request-id")).toBe(body.requestId)
  })

  it("POST /fiat/orders without Idempotency-Key returns 400 IDEMPOTENCY_KEY_REQUIRED", async () => {
    const { response, body } = await respond("POST", "fiat/orders", {
      body: { provider: "onswitch", walletId: "w-1", quoteId: "q-1" },
    })
    expect(response.status).toBe(400)
    expect(body.error?.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
  })

  it("POST /fiat/orders/:id/confirm without Idempotency-Key returns 400", async () => {
    const { response, body } = await respond("POST", "fiat/orders/order-x/confirm", {
      body: { transactionHash: "0xabc" },
    })
    expect(response.status).toBe(400)
    expect(body.error?.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
  })

  it("DELETE /fiat/beneficiaries/:id without Idempotency-Key returns 400", async () => {
    const { response, body } = await respond("DELETE", "fiat/beneficiaries/b-1")
    expect(response.status).toBe(400)
    expect(body.error?.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
  })

  it("first create returns 201, replay with same key returns 200 with the same resource", async () => {
    const key = "test-key-1"
    const first = await respond("POST", "fiat/quotes", {
      body: { direction: "onramp" },
      idempotencyKey: key,
    })
    expect(first.response.status).toBe(201)
    const replay = await respond("POST", "fiat/quotes", {
      body: { direction: "onramp" },
      idempotencyKey: key,
    })
    expect(replay.response.status).toBe(200)
    expect(replay.body.data).toEqual(first.body.data)
  })

  it("different idempotency keys create separate resources", async () => {
    const a = await respond("POST", "fiat/quotes", {
      body: { direction: "onramp" },
      idempotencyKey: "key-a",
    })
    const b = await respond("POST", "fiat/quotes", {
      body: { direction: "onramp" },
      idempotencyKey: "key-b",
    })
    expect(a.response.status).toBe(201)
    expect(b.response.status).toBe(201)
  })

  it("POST /fiat/compliance/bridge/sync does NOT require Idempotency-Key (guide §6.2)", async () => {
    const { response, body } = await respond("POST", "fiat/compliance/bridge/sync")
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe("approved")
  })
})

describe("dev-mock-fiat-responder direction-aware quotes (guide §9.1)", () => {
  it("POST /fiat/quotes with direction=offramp returns the derived offramp fixture", async () => {
    const { body } = await respond("POST", "fiat/quotes", {
      body: { direction: "offramp" },
      idempotencyKey: "k-off",
    })
    expect(body.data.direction).toBe("offramp")
  })

  it("POST /fiat/quotes with direction=onramp returns the onramp fixture", async () => {
    const { body } = await respond("POST", "fiat/quotes", {
      body: { direction: "onramp" },
      idempotencyKey: "k-on",
    })
    expect(body.data.direction).toBe("onramp")
  })
})

describe("dev-mock-fiat-responder id-based order lookup (guide §11)", () => {
  it("GET /fiat/orders/:id returns the offramp fixture for its id", async () => {
    const { body } = await respond("GET", `fiat/orders/${FIAT_ORDER_ONSWITCH_OFFRAMP.id}`)
    expect(body.data.id).toBe(FIAT_ORDER_ONSWITCH_OFFRAMP.id)
    expect(body.data.direction).toBe("offramp")
    expect(body.data.state).toBe("crypto_intent_ready")
  })

  it("GET /fiat/orders/:id returns the Bridge withdrawal fixture for its id", async () => {
    const { body } = await respond("GET", `fiat/orders/${FIAT_ORDER_BRIDGE_WITHDRAWAL.id}`)
    expect(body.data.id).toBe(FIAT_ORDER_BRIDGE_WITHDRAWAL.id)
    expect(body.data.provider).toBe("bridge")
  })

  it("GET /fiat/orders/:id for an unknown id returns 404", async () => {
    const { response, body } = await respond("GET", "fiat/orders/unknown-id")
    expect(response.status).toBe(404)
    expect(body.error?.code).toBe("NOT_FOUND")
  })

  it("GET onramp order advances awaiting_bank_deposit → provider_processing → completed", async () => {
    const path = `fiat/orders/${FIAT_ORDER_ONSWITCH_ONRAMP.id}`
    const first = await respond("GET", path)
    const second = await respond("GET", path)
    const third = await respond("GET", path)
    expect(first.body.data.state).toBe("awaiting_bank_deposit")
    expect(second.body.data.state).toBe("provider_processing")
    expect(third.body.data.state).toBe("completed")
    expect(third.body.data.completedAt).toBeTruthy()
    // Terminal — a fourth poll stays completed.
    const fourth = await respond("GET", path)
    expect(fourth.body.data.state).toBe("completed")
  })
})

describe("dev-mock-fiat-responder compliance customer (derived, guide §7)", () => {
  it("surfaces the approved OnSwitch record after the profile mutation", async () => {
    const before = await respond("GET", "fiat/compliance")
    expect(before.body.data.some((record: { provider: string }) => record.provider === "onswitch")).toBe(false)

    await respond("POST", "fiat/compliance/customer", {
      body: { provider: "onswitch", legalName: "Example", email: "e@x", country: "NG" },
      idempotencyKey: "cust-on-get",
    })
    const after = await respond("GET", "fiat/compliance")
    expect(after.body.data.find((record: { provider: string }) => record.provider === "onswitch")?.status).toBe("approved")
  })

  it("returns an onswitch record when the request declares provider=onswitch", async () => {
    const { body } = await respond("POST", "fiat/compliance/customer", {
      body: { provider: "onswitch", legalName: "Example", email: "e@x", country: "NG" },
      idempotencyKey: "cust-on",
    })
    expect(body.data.provider).toBe("onswitch")
    expect(body.data.country).toBe("NG")
  })

  it("returns the Bridge record when the request declares provider=bridge", async () => {
    const { body } = await respond("POST", "fiat/compliance/customer", {
      body: { provider: "bridge", legalName: "Example", email: "e@x", country: "US" },
      idempotencyKey: "cust-br",
    })
    expect(body.data.provider).toBe("bridge")
    expect(body.data.country).toBe("US")
  })
})

describe("dev-mock-fiat-responder DELETE beneficiary (derived)", () => {
  it("returns 200 with { success: true, data: null } and a requestId", async () => {
    const { response, body } = await respond("DELETE", "fiat/beneficiaries/b-1", {
      idempotencyKey: "del-1",
    })
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
    expect(body.requestId).toBeTruthy()
    expect(response.headers.get("x-request-id")).toBe(body.requestId)
  })
})

describe("dev-mock-fiat-responder confirm (derived)", () => {
  it("returns an order advanced to crypto_submitted (§11 lifecycle)", async () => {
    const { response, body } = await respond(
      "POST",
      `fiat/orders/${FIAT_ORDER_ONSWITCH_OFFRAMP.id}/confirm`,
      { body: { transactionHash: "0xabc" }, idempotencyKey: "confirm-1" },
    )
    expect(response.status).toBe(200)
    expect(body.data.state).toBe("crypto_submitted")
  })
})

describe("dev-mock-fiat-responder — freshened timestamps", () => {
  it("quote expiresAt is in the future relative to createdAt", async () => {
    const { body } = await respond("POST", "fiat/quotes", {
      body: { direction: "onramp" },
      idempotencyKey: "quote-time",
    })
    const created = Date.parse(body.data.createdAt)
    const expires = Date.parse(body.data.expiresAt)
    expect(expires).toBeGreaterThan(created)
    expect(expires - created).toBeGreaterThan(60_000)
  })

  it("onramp order payment instructions expiresAt is in the future", async () => {
    const { body } = await respond("POST", "fiat/orders", {
      body: { provider: "onswitch", walletId: "w", quoteId: "q" },
      idempotencyKey: "order-time",
    })
    const instructions = body.data.providerDisplay.paymentInstructions
    expect(Date.parse(instructions.expiresAt)).toBeGreaterThan(Date.now())
  })

  it("virtual account timestamps are current", async () => {
    const { body } = await respond("POST", "fiat/bridge/virtual-accounts", {
      body: { walletId: "w", networkId: "ethereum-mainnet", asset: "USDC" },
      idempotencyKey: "va-time",
    })
    const created = Date.parse(body.data.createdAt)
    expect(created).toBeGreaterThanOrEqual(Date.now() - 5_000)
    expect(created).toBeLessThanOrEqual(Date.now() + 5_000)
  })
})

describe("dev-mock-fiat-responder — unknown fiat path", () => {
  it("returns null so the caller can decide (fall through vs 404)", async () => {
    const response = await respondFromFiatFixtures(
      request("GET", "fiat/something-not-mocked"),
      "fiat/something-not-mocked",
    )
    expect(response).toBeNull()
  })
})
