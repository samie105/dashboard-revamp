import { describe, expect, it, vi } from "vitest"

import { CryptoBackendClient } from "@/lib/crypto-backend/client"
import { CryptoBackendError } from "@/lib/crypto-backend/errors"

/**
 * The CP2 client methods hit the documented path, method and idempotency
 * contract from guide §6.2 (docs/fiat-frontend-integration-guide.md lines
 * 408-428), and unwrap the §4 envelope.
 */

type Captured = { url: string; method: string; headers: Headers; body: string | undefined }

function clientReturning(data: unknown, status = 200, headers: Record<string, string> = {}) {
  const calls: Captured[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
    })
    const body = status < 400 ? { success: true, data, requestId: "req-1" } : data
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
  }) as unknown as typeof fetch
  return { client: new CryptoBackendClient({ fetcher }), calls }
}

describe("compliance (guide §7)", () => {
  it("getFiatCompliance → GET /fiat/compliance, no idempotency key", async () => {
    const { client, calls } = clientReturning([{ id: "c1" }])
    expect(await client.getFiatCompliance()).toEqual([{ id: "c1" }])
    expect(calls[0].url).toBe("/api/crypto/fiat/compliance")
    expect(calls[0].method).toBe("GET")
    expect(calls[0].headers.get("idempotency-key")).toBeNull()
  })

  it("createFiatCustomer → POST /fiat/compliance/customer with the key and body", async () => {
    const { client, calls } = clientReturning({ id: "c1" })
    const input = { provider: "onswitch" as const, legalName: "Example User", email: "user@example.com", country: "NG" }
    await client.createFiatCustomer(input, "key-1")
    expect(calls[0].url).toBe("/api/crypto/fiat/compliance/customer")
    expect(calls[0].method).toBe("POST")
    expect(calls[0].headers.get("idempotency-key")).toBe("key-1")
    expect(JSON.parse(calls[0].body ?? "{}")).toEqual(input)
  })

  it("createBridgeKycLink → POST /fiat/compliance/bridge/kyc-link with the key", async () => {
    const { client, calls } = clientReturning({ customer: {}, kycLink: { url: "https://x" } })
    await client.createBridgeKycLink({ legalName: "Example User", email: "user@example.com", country: "US" }, "key-2")
    expect(calls[0].url).toBe("/api/crypto/fiat/compliance/bridge/kyc-link")
    expect(calls[0].method).toBe("POST")
    expect(calls[0].headers.get("idempotency-key")).toBe("key-2")
  })

  it("syncBridgeCompliance → POST /fiat/compliance/bridge/sync, no body, no key (§6.2: idempotency No)", async () => {
    const { client, calls } = clientReturning({ id: "c1" })
    await client.syncBridgeCompliance()
    expect(calls[0].url).toBe("/api/crypto/fiat/compliance/bridge/sync")
    expect(calls[0].method).toBe("POST")
    expect(calls[0].body).toBeUndefined()
    expect(calls[0].headers.get("idempotency-key")).toBeNull()
  })
})

describe("institutions and beneficiaries (guide §8)", () => {
  it("listFiatInstitutions → GET /fiat/institutions?country=&currency=&channel=", async () => {
    const { client, calls } = clientReturning([])
    await client.listFiatInstitutions({ country: "NG", currency: "NGN", channel: "BANK" })
    expect(calls[0].url).toBe("/api/crypto/fiat/institutions?country=NG&currency=NGN&channel=BANK")
    expect(calls[0].method).toBe("GET")
  })

  it("listFiatBeneficiaryRequirements → GET /fiat/beneficiary-requirements with corridor query", async () => {
    const { client, calls } = clientReturning([])
    await client.listFiatBeneficiaryRequirements({ country: "NG", currency: "NGN", channel: "BANK" })
    expect(calls[0].url).toBe("/api/crypto/fiat/beneficiary-requirements?country=NG&currency=NGN&channel=BANK")
    expect(calls[0].method).toBe("GET")
  })

  it("listFiatBeneficiaries → GET /fiat/beneficiaries", async () => {
    const { client, calls } = clientReturning([])
    await client.listFiatBeneficiaries()
    expect(calls[0].url).toBe("/api/crypto/fiat/beneficiaries")
  })

  it("createFiatBeneficiary → POST /fiat/beneficiaries with the key", async () => {
    const { client, calls } = clientReturning({ id: "b1" })
    await client.createFiatBeneficiary(
      {
        provider: "onswitch",
        direction: "offramp",
        country: "NG",
        currency: "NGN",
        channel: "BANK",
        holderName: "Example User",
        holderType: "individual",
        providerPayload: { bank_code: "000001" },
      },
      "key-3",
    )
    expect(calls[0].url).toBe("/api/crypto/fiat/beneficiaries")
    expect(calls[0].method).toBe("POST")
    expect(calls[0].headers.get("idempotency-key")).toBe("key-3")
  })

  it("deleteFiatBeneficiary → DELETE /fiat/beneficiaries/:id with the key, id encoded", async () => {
    const { client, calls } = clientReturning(null)
    await client.deleteFiatBeneficiary("66f000000000000000000021", "key-4")
    expect(calls[0].url).toBe("/api/crypto/fiat/beneficiaries/66f000000000000000000021")
    expect(calls[0].method).toBe("DELETE")
    expect(calls[0].headers.get("idempotency-key")).toBe("key-4")

    const encoded = clientReturning(null)
    await encoded.client.deleteFiatBeneficiary("a/b", "key-5")
    expect(encoded.calls[0].url).toBe("/api/crypto/fiat/beneficiaries/a%2Fb")
  })
})

describe("errors carry status, code, requestId and Retry-After (guide §4, §12.1)", () => {
  it("throws CryptoBackendError with the Retry-After header on 429", async () => {
    const { client } = clientReturning(
      { success: false, error: { code: "RATE_LIMITED", message: "slow down" }, requestId: "req-429" },
      429,
      { "retry-after": "12" },
    )
    const error = await client.getFiatCompliance().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CryptoBackendError)
    const backendError = error as CryptoBackendError
    expect(backendError.status).toBe(429)
    expect(backendError.code).toBe("RATE_LIMITED")
    expect(backendError.requestId).toBe("req-429")
    expect(backendError.retryAfter).toBe("12")
  })
})
