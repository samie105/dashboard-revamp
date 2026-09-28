import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CryptoBackendClient } from "@/lib/crypto-backend/client"
import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import {
  FIAT_BRIDGE_KYC_LINK_RESPONSE,
  FIAT_COMPLIANCE_LIST,
  FIAT_CONFIG_AVAILABLE,
  FIAT_ERROR_INVALID_REQUEST,
} from "@/lib/crypto-backend/__fixtures__/fiat"
import { __resetFiatMockState, respondFromFiatFixtures } from "@/lib/crypto-backend/dev-mock-fiat-responder"
import {
  buildOnswitchCustomerPayload,
  complianceRecordFor,
  createOnswitchCustomer,
  describeBridgeVirtualAccountRefusal,
  describeComplianceRecord,
  finishBridgeKyc,
  invalidFieldsFrom,
  isBridgeKycRequired,
  isProviderCustomerApproved,
  openKycLink,
  safeKycUrl,
  startBridgeKyc,
  type OnswitchProfileInput,
} from "@/lib/crypto-backend/fiat-compliance"
import { isBridgeVirtualAccountAvailable } from "@/lib/crypto-backend/fiat-capabilities"
import {
  __resetFiatIdempotencyStore,
  fiatFingerprint,
  isUncertainMutationFailure,
} from "@/lib/crypto-backend/fiat-idempotency"
import type { FiatCapabilitySnapshot } from "@/lib/crypto-backend/types"

/**
 * CP4, guide §7 (docs/fiat-frontend-integration-guide.md lines 429-541) and
 * Bridge remains backend-authoritative; the OnSwitch Buy form also mirrors
 * the backend's approved-profile prerequisite as a UX guard.
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
  serialized() {
    return JSON.stringify(Array.from(this.map.entries()))
  }
}

type Sent = { path: string; method: string; idempotencyKey: string | null; body: string | undefined }

/** A client whose requests are answered by the CP1 fixture responder. */
function mockedClient(override?: (sent: Sent) => Response | undefined) {
  const sent: Sent[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://dashboard.test")
    const path = url.pathname.replace(/^\/api\/crypto\//, "")
    const headers = new Headers(init?.headers)
    const entry: Sent = {
      path,
      method: init?.method ?? "GET",
      idempotencyKey: headers.get("idempotency-key"),
      body: typeof init?.body === "string" ? init.body : undefined,
    }
    sent.push(entry)
    const forced = override?.(entry)
    if (forced) return forced
    const response = await respondFromFiatFixtures(new Request(url, init), path)
    return response ?? new Response(null, { status: 404 })
  }) as typeof fetch
  return { client: new CryptoBackendClient({ fetcher }), sent }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal("sessionStorage", storage)
  __resetFiatIdempotencyStore()
  __resetFiatMockState()
})

afterEach(() => {
  __resetFiatIdempotencyStore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("compliance display never exposes the provider customer id (guide lines 435-436)", () => {
  it("drops the id from the view model", () => {
    const [record] = FIAT_COMPLIANCE_LIST
    const view = describeComplianceRecord(record)
    expect(view).not.toHaveProperty("id")
    expect(JSON.stringify(view)).not.toContain(record.id)
  })

  it("keeps the display fields verbatim", () => {
    expect(describeComplianceRecord(FIAT_COMPLIANCE_LIST[0])).toEqual({
      provider: "bridge",
      status: "approved",
      kycStatus: "approved",
      tosStatus: "accepted",
      endorsements: [{ name: "base", status: "approved" }],
      lastSyncedAt: "2026-09-26T10:15:00.000Z",
    })
  })

  it("finds the record for a provider", () => {
    expect(complianceRecordFor(FIAT_COMPLIANCE_LIST, "bridge")?.provider).toBe("bridge")
    expect(complianceRecordFor(FIAT_COMPLIANCE_LIST, "onswitch")).toBeUndefined()
    expect(complianceRecordFor(undefined, "bridge")).toBeUndefined()
  })

  it("uses approved status only as the OnSwitch Buy UX guard", () => {
    expect(isProviderCustomerApproved(FIAT_COMPLIANCE_LIST[0])).toBe(true)
    expect(isProviderCustomerApproved({ ...FIAT_COMPLIANCE_LIST[0], status: "pending" })).toBe(false)
    expect(isProviderCustomerApproved(undefined)).toBe(false)
  })
})

describe("whether KYC is needed comes from /fiat/config (guide §5 lines 311-343)", () => {
  const clone = (): FiatCapabilitySnapshot => JSON.parse(JSON.stringify(FIAT_CONFIG_AVAILABLE))

  it("is required when the guide's example config says so", () => {
    expect(isBridgeKycRequired(FIAT_CONFIG_AVAILABLE, "virtual-account")).toBe(true)
    expect(isBridgeKycRequired(FIAT_CONFIG_AVAILABLE, "withdrawal")).toBe(true)
  })

  it("follows the route's requiresCustomerKyc", () => {
    const config = clone()
    // types.ts:241 types kycRequired as the literal `true` (from the guide's
    // example); a live backend could still send false, so the test widens it.
    ;(config.providers.bridge.account as { kycRequired: boolean }).kycRequired = false
    config.providers.bridge.routes[0].requiresCustomerKyc = false
    expect(isBridgeKycRequired(config, "virtual-account")).toBe(false)
    expect(isBridgeKycRequired(config, "withdrawal")).toBe(true)
  })

  it("follows account.kycRequired", () => {
    const config = clone()
    config.providers.bridge.routes.forEach((route) => (route.requiresCustomerKyc = false))
    expect(isBridgeKycRequired(config, "virtual-account")).toBe(true)
  })

  it("is false with no config", () => {
    expect(isBridgeKycRequired(undefined, "virtual-account")).toBe(false)
  })
})

describe("Bridge compliance remains backend-authoritative", () => {
  it("virtual-account availability depends only on /fiat/config, not on compliance records", () => {
    // isBridgeVirtualAccountAvailable takes the config alone; an unapproved
    // or missing Bridge record can't hide the action. The backend decides.
    expect(isBridgeVirtualAccountAvailable.length).toBe(1)
    expect(isBridgeVirtualAccountAvailable(FIAT_CONFIG_AVAILABLE)).toBe(true)
  })

  it("403 on the virtual-account request stops with verification guidance and is not retried (guide line 991)", () => {
    const error = new CryptoBackendError("x", 403, "FORBIDDEN", undefined, "req-403")
    const described = describeBridgeVirtualAccountRefusal(error)
    expect(described.action).toBe("stop")
    expect(described.message).toMatch(/verification/i)
    expect(described.requestId).toBe("req-403")
    // Definitive rejection: the idempotency key is released, nothing re-sends it.
    expect(isUncertainMutationFailure(error)).toBe(false)
  })

  it.each([
    [409, "FIAT_PROVIDER_NOT_READY", "refetch-capabilities"],
    [409, "IDEMPOTENCY_IN_PROGRESS", "retry-same-key"],
    [422, "BRIDGE_NETWORK_UNSUPPORTED", "refetch-capabilities"],
    [500, "INTERNAL_ERROR", "escalate"],
  ])("other refusals (%i %s) go through the standard mapping → %s", (status, code, action) => {
    expect(describeBridgeVirtualAccountRefusal(new CryptoBackendError("x", status, code)).action).toBe(action)
  })
})

describe("kycLink.url must be https (guide §7, CLAUDE.md rules)", () => {
  it.each([
    "https://provider.example/hosted-kyc/abc",
    FIAT_BRIDGE_KYC_LINK_RESPONSE.kycLink.url,
  ])("accepts %s", (url) => {
    expect(safeKycUrl(url)).toMatch(/^https:\/\//)
  })

  it("normalises the scheme case", () => {
    expect(safeKycUrl("HTTPS://Provider.Example/kyc")).toBe("https://provider.example/kyc")
  })

  it.each([
    "http://provider.example/kyc",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//provider.example/kyc",
    "ftp://provider.example/kyc",
    "/relative/kyc",
    "not a url",
    "",
    "   ",
  ])("rejects %j", (url) => {
    expect(safeKycUrl(url)).toBeNull()
  })

  it("rejects non-strings", () => {
    expect(safeKycUrl(undefined)).toBeNull()
    expect(safeKycUrl(null)).toBeNull()
    expect(safeKycUrl({ toString: () => "https://x" })).toBeNull()
  })

  it("opens an https link in a new tab with noopener,noreferrer", () => {
    const open = vi.fn()
    expect(openKycLink("https://provider.example/kyc", open)).toBe(true)
    expect(open).toHaveBeenCalledWith("https://provider.example/kyc", "_blank", "noopener,noreferrer")
  })

  it.each(["http://provider.example/kyc", "javascript:alert(1)"])("opens nothing for %s", (url) => {
    const open = vi.fn()
    expect(openKycLink(url, open)).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})

describe("Bridge KYC flow: kyc-link → sync (guide lines 461-501, 525-541)", () => {
  const input = { legalName: "  Example User ", email: " user@example.com ", country: "us" }

  it("sends the trimmed body with an idempotency key", async () => {
    const { client, sent } = mockedClient()
    await startBridgeKyc(client, input)
    const request = sent.find((entry) => entry.path === "fiat/compliance/bridge/kyc-link")
    expect(request?.method).toBe("POST")
    expect(request?.idempotencyKey).toMatch(UUID)
    expect(JSON.parse(request?.body ?? "{}")).toEqual({
      legalName: "Example User",
      email: "user@example.com",
      country: "US",
    })
  })

  it("goes pending → approved via sync", async () => {
    const { client, sent } = mockedClient()
    const started = await startBridgeKyc(client, input)
    expect(started.customer.status).toBe("pending")
    expect(started.customer.kycStatus).toBe("pending")

    const synced = await finishBridgeKyc(client)
    expect(synced.status).toBe("approved")
    expect(synced.kycStatus).toBe("approved")

    const sync = sent.find((entry) => entry.path === "fiat/compliance/bridge/sync")
    expect(sync?.method).toBe("POST")
    expect(sync?.idempotencyKey).toBeNull() // guide §6.2 line 414: idempotency "No"
    expect(sync?.body).toBeUndefined() // "No request body is needed."
  })

  it("reuses the key for an exact retry after an uncertain failure, and mints a new one after success", async () => {
    let first = true
    const { client, sent } = mockedClient((entry) => {
      if (entry.path === "fiat/compliance/bridge/kyc-link" && first) {
        first = false
        return new Response(
          JSON.stringify({ success: false, error: { code: "CRYPTO_SERVICE_UNREACHABLE", message: "x" } }),
          { status: 502 },
        )
      }
      return undefined
    })
    await expect(startBridgeKyc(client, input)).rejects.toBeInstanceOf(CryptoBackendError)
    await startBridgeKyc(client, input)
    await startBridgeKyc(client, input)
    const keys = sent.filter((entry) => entry.path === "fiat/compliance/bridge/kyc-link").map((entry) => entry.idempotencyKey)
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[1])
  })

  it("never logs or stores the KYC link, the name or the email", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    )
    const { client } = mockedClient()
    const result = await startBridgeKyc(client, input)
    openKycLink(result.kycLink.url, () => null)

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(result.kycLink.url)
      }
    }
    const stored = storage.serialized()
    expect(stored).not.toContain("hosted-kyc")
    expect(stored).not.toContain("user@example.com")
    expect(stored).not.toContain("Example User")
  })
})

describe("OnSwitch customer profile uses exactly the documented fields (guide lines 506-520)", () => {
  const full: OnswitchProfileInput = {
    legalName: "Example User",
    firstName: "Example",
    lastName: "User",
    email: "user@example.com",
    phone: "+2348000000000",
    country: "ng",
    birthDate: "1990-01-01",
    addressCountry: "ng",
    addressCity: "Lagos",
  }

  it("builds the guide's example body from a full form", () => {
    expect(buildOnswitchCustomerPayload(full)).toEqual({
      provider: "onswitch",
      legalName: "Example User",
      firstName: "Example",
      lastName: "User",
      email: "user@example.com",
      phone: "+2348000000000",
      country: "NG",
      birthDate: "1990-01-01",
      residentialAddress: { country: "NG", city: "Lagos" },
    })
  })

  it("only ever sends documented keys, even if the form object carries extras", () => {
    const withExtras = { ...full, bvn: "12345678901", accountNumber: "0123456789" } as OnswitchProfileInput
    const payload = buildOnswitchCustomerPayload(withExtras)
    const documented = ["provider", "legalName", "firstName", "lastName", "email", "phone", "country", "birthDate", "residentialAddress"]
    expect(Object.keys(payload).every((key) => documented.includes(key))).toBe(true)
    expect(Object.keys(payload.residentialAddress ?? {})).toEqual(["country", "city"])
    expect(JSON.stringify(payload)).not.toContain("0123456789")
  })

  it("leaves blank fields out instead of sending empty strings", () => {
    const payload = buildOnswitchCustomerPayload({
      ...full,
      firstName: " ",
      phone: "",
      addressCountry: "",
      addressCity: "",
    })
    expect(payload).not.toHaveProperty("firstName")
    expect(payload).not.toHaveProperty("phone")
    expect(payload).not.toHaveProperty("residentialAddress")
  })

  it("posts with an idempotency key and gets an OnSwitch record back, storing no personal data", async () => {
    const { client, sent } = mockedClient()
    const record = await createOnswitchCustomer(client, full)
    const request = sent.find((entry) => entry.path === "fiat/compliance/customer")
    expect(request?.idempotencyKey).toMatch(UUID)
    expect(record.provider).toBe("onswitch")
    const stored = storage.serialized()
    expect(stored).not.toContain("user@example.com")
    expect(stored).not.toContain("+2348000000000")
  })
})

describe("INVALID_REQUEST fieldErrors (guide §12.2 lines 1025-1041)", () => {
  it("returns the flagged field names", () => {
    const error = new CryptoBackendError(
      FIAT_ERROR_INVALID_REQUEST.error.message,
      400,
      FIAT_ERROR_INVALID_REQUEST.error.code,
      FIAT_ERROR_INVALID_REQUEST.error.details,
    )
    expect(invalidFieldsFrom(error)).toEqual(["country", "amount"])
  })

  it("returns nothing for other errors", () => {
    expect(invalidFieldsFrom(new CryptoBackendError("x", 400, "FIAT_AMOUNT_INVALID"))).toEqual([])
    expect(invalidFieldsFrom(new CryptoBackendError("x", 400, "INVALID_REQUEST"))).toEqual([])
    expect(invalidFieldsFrom(new Error("x"))).toEqual([])
  })
})

describe("fiatFingerprint", () => {
  it("is stable across key order and hides the input", () => {
    const a = fiatFingerprint({ email: "user@example.com", legalName: "Example User" })
    const b = fiatFingerprint({ legalName: "Example User", email: "user@example.com" })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(a).not.toContain("example")
  })

  it("changes when any value changes", () => {
    expect(fiatFingerprint({ email: "a@example.com" })).not.toBe(fiatFingerprint({ email: "b@example.com" }))
  })
})
