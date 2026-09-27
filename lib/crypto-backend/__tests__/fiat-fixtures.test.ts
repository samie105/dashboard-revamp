import { describe, expect, it } from "vitest"

import {
  FIAT_BENEFICIARIES_LIST,
  FIAT_BRIDGE_KYC_LINK_RESPONSE,
  FIAT_BRIDGE_SYNC_RESPONSE,
  FIAT_BRIDGE_VIRTUAL_ACCOUNT,
  FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY,
  FIAT_COMPLIANCE_LIST,
  FIAT_CONFIG_AVAILABLE,
  FIAT_CONFIG_BLOCKED,
  FIAT_CONFIG_DISABLED,
  FIAT_CONFIG_DISCOVERY_ONLY,
  FIAT_CUSTOMER_ONSWITCH,
  FIAT_ERROR_AUTH_REQUIRED,
  FIAT_ERROR_BENEFICIARY_NOT_VERIFIED,
  FIAT_ERROR_IDEMPOTENCY_KEY_REQUIRED,
  FIAT_ERROR_INVALID_REQUEST,
  FIAT_ERROR_PROVIDER_NOT_READY,
  FIAT_ERROR_PROVIDER_RESPONSE_INVALID,
  FIAT_ERROR_PROVIDER_VALIDATION,
  FIAT_ERROR_QUOTE_NOT_ACTIVE,
  FIAT_ERROR_RATE_LIMITED,
  FIAT_ERROR_UNAUTHORIZED,
  FIAT_INSTITUTIONS_NG_NGN_BANK,
  FIAT_ORDER_BRIDGE_WITHDRAWAL,
  FIAT_ORDER_ONSWITCH_OFFRAMP,
  FIAT_ORDER_ONSWITCH_ONRAMP,
  FIAT_ORDER_ONSWITCH_ONRAMP_COMPLETED,
  FIAT_ORDER_ONSWITCH_ONRAMP_FAILED,
  FIAT_ORDER_ONSWITCH_ONRAMP_PROVIDER_PROCESSING,
  FIAT_QUOTE_EXPIRED,
  FIAT_QUOTE_OFFRAMP,
  FIAT_QUOTE_ONRAMP,
} from "@/lib/crypto-backend/__fixtures__/fiat"

/**
 * These fixtures are the CP1 contract. The verbatim block below is quoted
 * from docs/fiat-frontend-integration-guide.md and must not drift; the
 * derived block only mutates documented fields on a verbatim base.
 */

describe("fiat fixtures — verbatim §5 config", () => {
  it("matches the guide's illustrative response line-for-line", () => {
    // Guide §5 (docs/fiat-frontend-integration-guide.md lines 220-363).
    expect(FIAT_CONFIG_AVAILABLE.generatedAt).toBe("2026-09-26T10:20:00.000Z")
    expect(FIAT_CONFIG_AVAILABLE.cacheExpiresAt).toBe("2026-09-26T10:21:00.000Z")
    expect(FIAT_CONFIG_AVAILABLE.environment).toBe("sandbox")
    expect(FIAT_CONFIG_AVAILABLE.enabled).toBe(true)
    expect(FIAT_CONFIG_AVAILABLE.availability).toBe("available")
    expect(FIAT_CONFIG_AVAILABLE.rollout).toEqual({ allowlisted: true })
    expect(FIAT_CONFIG_AVAILABLE.readiness.ready).toBe(true)
    expect(FIAT_CONFIG_AVAILABLE.readiness.blockingReasons).toEqual([])
    expect(FIAT_CONFIG_AVAILABLE.readiness.providers.onswitch.provider).toBe("onswitch")
    expect(FIAT_CONFIG_AVAILABLE.readiness.providers.bridge.baseUrl).toBe("https://api.sandbox.bridge.xyz")
    expect(FIAT_CONFIG_AVAILABLE.providers.onswitch.coverage[0]).toEqual({
      countryCode: "NG",
      currencyCode: "NGN",
      channels: ["BANK"],
      directions: ["onramp", "offramp"],
      enabled: true,
      settlementCurrency: "NGN",
      countryName: "Nigeria",
    })
    expect(FIAT_CONFIG_AVAILABLE.providers.onswitch.coverage[1].countryCode).toBe("GH")
    expect(FIAT_CONFIG_AVAILABLE.providers.bridge.routes[0].id).toBe("bridge-usd-virtual-account")
    expect(FIAT_CONFIG_AVAILABLE.providers.bridge.routes[1].id).toBe("bridge-usd-withdrawal")
    expect(FIAT_CONFIG_AVAILABLE.providers.bridge.account.supportedFiat).toEqual(["USD"])
    expect(FIAT_CONFIG_AVAILABLE.assetRoutes).toHaveLength(1)
    expect(FIAT_CONFIG_AVAILABLE.assetRoutes[0].walletReady).toBe(true)
    expect(FIAT_CONFIG_AVAILABLE.assetRoutes[0].status).toBe("wallet_ready")
  })
})

describe("fiat fixtures — verbatim §7 compliance", () => {
  it("matches GET /fiat/compliance illustrative response", () => {
    // Guide §7 (lines 440-460).
    expect(FIAT_COMPLIANCE_LIST).toHaveLength(1)
    const [customer] = FIAT_COMPLIANCE_LIST
    expect(customer.id).toBe("66f000000000000000000001")
    expect(customer.provider).toBe("bridge")
    expect(customer.endorsements).toEqual({ base: "approved" })
    expect(customer.termsAcceptedAt).toBe("2026-09-26T10:10:00.000Z")
  })

  it("matches POST /fiat/compliance/bridge/kyc-link illustrative response", () => {
    // Guide §7 (lines 475-497).
    expect(FIAT_BRIDGE_KYC_LINK_RESPONSE.customer.status).toBe("pending")
    expect(FIAT_BRIDGE_KYC_LINK_RESPONSE.kycLink.url).toBe(
      "https://provider.example/hosted-kyc/<opaque-token>",
    )
    expect(FIAT_BRIDGE_KYC_LINK_RESPONSE.kycLink.tosUrl).toBe(
      "https://provider.example/terms/<opaque-token>",
    )
    expect(FIAT_BRIDGE_KYC_LINK_RESPONSE.kycLink.kycStatus).toBe("pending")
  })

  it("matches POST /fiat/compliance/bridge/sync illustrative response", () => {
    // Guide §7 (lines 527-541).
    expect(FIAT_BRIDGE_SYNC_RESPONSE.status).toBe("approved")
    expect(FIAT_BRIDGE_SYNC_RESPONSE.lastSyncedAt).toBe("2026-09-26T10:30:00.000Z")
  })
})

describe("fiat fixtures — verbatim §8 institutions + beneficiaries", () => {
  it("matches GET /fiat/institutions illustrative response", () => {
    // Guide §8 (lines 558-572).
    expect(FIAT_INSTITUTIONS_NG_NGN_BANK).toHaveLength(1)
    expect(FIAT_INSTITUTIONS_NG_NGN_BANK[0]).toEqual({
      id: "provider-bank-code",
      name: "Example Bank",
      code: "000001",
      country: "NG",
      currency: "NGN",
      channel: "BANK",
    })
  })

  it("matches GET /fiat/beneficiaries illustrative response", () => {
    // Guide §8 (lines 578-602).
    expect(FIAT_BENEFICIARIES_LIST).toHaveLength(1)
    const [beneficiary] = FIAT_BENEFICIARIES_LIST
    expect(beneficiary.status).toBe("verified")
    expect(beneficiary.ownershipStatus).toBe("verified")
    expect(beneficiary.maskedAccount).toBe("******4321")
    expect(beneficiary.verificationReason).toBeNull()
  })
})

describe("fiat fixtures — verbatim §9 quote + orders", () => {
  it("matches POST /fiat/quotes onramp illustrative response", () => {
    // Guide §9.1 (lines 673-699).
    expect(FIAT_QUOTE_ONRAMP.provider).toBe("onswitch")
    expect(FIAT_QUOTE_ONRAMP.direction).toBe("onramp")
    expect(FIAT_QUOTE_ONRAMP.sourceAmount).toBe("100000")
    expect(FIAT_QUOTE_ONRAMP.destinationAmount).toBe("62.450000")
    expect(FIAT_QUOTE_ONRAMP.providerRate).toBe("1602.564102")
    expect(FIAT_QUOTE_ONRAMP.expectedSettlementSeconds).toBe(900)
    expect(FIAT_QUOTE_ONRAMP.state).toBe("active")
  })

  it("matches POST /fiat/orders onramp illustrative response", () => {
    // Guide §9.2 (lines 724-754).
    expect(FIAT_ORDER_ONSWITCH_ONRAMP.id).toBe("66f000000000000000000051")
    expect(FIAT_ORDER_ONSWITCH_ONRAMP.publicReference).toBe("WS-ONSWITCH-000051")
    expect(FIAT_ORDER_ONSWITCH_ONRAMP.state).toBe("awaiting_bank_deposit")
    const instructions = FIAT_ORDER_ONSWITCH_ONRAMP.providerDisplay?.paymentInstructions as
      | Record<string, unknown>
      | undefined
    expect(instructions?.accountNumber).toBe("******1234")
    expect(instructions?.currency).toBe("NGN")
  })

  it("matches POST /fiat/orders offramp illustrative response", () => {
    // Guide §9.2 (lines 761-791).
    expect(FIAT_ORDER_ONSWITCH_OFFRAMP.id).toBe("66f000000000000000000052")
    expect(FIAT_ORDER_ONSWITCH_OFFRAMP.state).toBe("crypto_intent_ready")
    expect(FIAT_ORDER_ONSWITCH_OFFRAMP.providerStatus).toBe("awaiting_crypto_deposit")
    expect(FIAT_ORDER_ONSWITCH_OFFRAMP.cryptoIntent?.to).toBe("0xprovider-deposit-address")
    expect(FIAT_ORDER_ONSWITCH_OFFRAMP.cryptoIntent?.amount).toBe("62.450000")
  })
})

describe("fiat fixtures — verbatim §10 Bridge USD", () => {
  it("matches POST /fiat/bridge/virtual-accounts illustrative response", () => {
    // Guide §10.1 (lines 829-855).
    expect(FIAT_BRIDGE_VIRTUAL_ACCOUNT.id).toBe("66f000000000000000000071")
    expect(FIAT_BRIDGE_VIRTUAL_ACCOUNT.asset).toBe("USDC")
    const instructions = FIAT_BRIDGE_VIRTUAL_ACCOUNT.depositInstructions as Record<string, unknown>
    expect(instructions.paymentRails).toEqual(["ach", "wire"])
    expect(instructions.reference).toBe("WS-VA-000071")
  })

  it("matches activity illustrative response", () => {
    // Guide §10.2 (lines 867-884).
    expect(FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY).toHaveLength(1)
    expect(FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY[0].amount).toBe("250.00")
    expect(FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY[0].sourcePaymentRail).toBe("ach")
  })

  it("matches Bridge USD withdrawal order illustrative response", () => {
    // Guide §10.3 (lines 914-942).
    expect(FIAT_ORDER_BRIDGE_WITHDRAWAL.id).toBe("66f000000000000000000101")
    expect(FIAT_ORDER_BRIDGE_WITHDRAWAL.channel).toBe("ach")
    expect(FIAT_ORDER_BRIDGE_WITHDRAWAL.cryptoIntent?.to).toBe("0x<bridge-deposit-address>")
  })
})

/**
 * Guide §12.2 error envelopes — the user's requested check. UNAUTHORIZED
 * is the ONLY §12.2 example without a requestId (line 1013 in the guide);
 * every other §12.2 example does carry `"requestId": "..."`.
 */
describe("fiat fixtures — verbatim §12.2 error keys", () => {
  const EXPECTED_KEYS: Record<string, ReadonlyArray<string>> = {
    // Lines 1007-1014 — no requestId.
    UNAUTHORIZED: ["error", "success"],
    // Lines 1017-1024 — with requestId.
    AUTH_REQUIRED: ["error", "requestId", "success"],
    // Lines 1027-1041 — with requestId.
    INVALID_REQUEST: ["error", "requestId", "success"],
    // Lines 1044-1051 — with requestId.
    IDEMPOTENCY_KEY_REQUIRED: ["error", "requestId", "success"],
    // Lines 1054-1068 — with requestId.
    FIAT_PROVIDER_NOT_READY: ["error", "requestId", "success"],
    // Lines 1071-1078 — with requestId.
    BENEFICIARY_NOT_VERIFIED: ["error", "requestId", "success"],
    // Lines 1081-1092 — with requestId.
    FIAT_PROVIDER_VALIDATION: ["error", "requestId", "success"],
  }

  const FIXTURES = [
    FIAT_ERROR_UNAUTHORIZED,
    FIAT_ERROR_AUTH_REQUIRED,
    FIAT_ERROR_INVALID_REQUEST,
    FIAT_ERROR_IDEMPOTENCY_KEY_REQUIRED,
    FIAT_ERROR_PROVIDER_NOT_READY,
    FIAT_ERROR_BENEFICIARY_NOT_VERIFIED,
    FIAT_ERROR_PROVIDER_VALIDATION,
  ]

  it.each(FIXTURES)("$error.code carries the guide's top-level keys", (fixture) => {
    const expected = EXPECTED_KEYS[fixture.error.code]
    expect(expected, `no expected keys for ${fixture.error.code}`).toBeDefined()
    expect(Object.keys(fixture).sort()).toEqual([...expected].sort())
  })

  it("UNAUTHORIZED is the only §12.2 example without requestId", () => {
    expect(FIAT_ERROR_UNAUTHORIZED.requestId).toBeUndefined()
    for (const fixture of FIXTURES) {
      if (fixture === FIAT_ERROR_UNAUTHORIZED) continue
      expect(fixture.requestId, `${fixture.error.code} must carry requestId`).toBe("...")
    }
  })
})

describe("fiat fixtures — derived", () => {
  it("FIAT_CONFIG_DISABLED flips only the enabled/availability path", () => {
    expect(FIAT_CONFIG_DISABLED.enabled).toBe(false)
    expect(FIAT_CONFIG_DISABLED.availability).toBe("disabled")
    expect(FIAT_CONFIG_DISABLED.readiness.blockingReasons).toEqual(["FIAT_RAMP_ENABLED is false"])
    expect(FIAT_CONFIG_DISABLED.providers.onswitch.status).toBe("disabled")
    expect(FIAT_CONFIG_DISABLED.providers.bridge.account.virtualAccountsEnabled).toBe(false)
    // Mutations must not leak back to the verbatim base.
    expect(FIAT_CONFIG_AVAILABLE.enabled).toBe(true)
    expect(FIAT_CONFIG_AVAILABLE.availability).toBe("available")
  })

  it("FIAT_CONFIG_BLOCKED only flips top-level availability", () => {
    expect(FIAT_CONFIG_BLOCKED.availability).toBe("blocked")
    expect(FIAT_CONFIG_BLOCKED.enabled).toBe(true)
    expect(FIAT_CONFIG_BLOCKED.providers.onswitch.status).toBe("available")
  })

  it("FIAT_CONFIG_DISCOVERY_ONLY only flips top-level availability", () => {
    expect(FIAT_CONFIG_DISCOVERY_ONLY.availability).toBe("discovery_only")
    expect(FIAT_CONFIG_DISCOVERY_ONLY.enabled).toBe(true)
  })

  it("FIAT_QUOTE_EXPIRED changes only state", () => {
    expect(FIAT_QUOTE_EXPIRED.state).toBe("expired")
    expect(FIAT_QUOTE_EXPIRED.id).toBe(FIAT_QUOTE_ONRAMP.id)
    expect(FIAT_QUOTE_ONRAMP.state).toBe("active")
  })

  it("FIAT_QUOTE_OFFRAMP changes only direction", () => {
    expect(FIAT_QUOTE_OFFRAMP.direction).toBe("offramp")
    expect(FIAT_QUOTE_OFFRAMP.sourceAmount).toBe(FIAT_QUOTE_ONRAMP.sourceAmount)
    expect(FIAT_QUOTE_ONRAMP.direction).toBe("onramp")
  })

  it("FIAT_CUSTOMER_ONSWITCH changes provider and country only", () => {
    expect(FIAT_CUSTOMER_ONSWITCH.provider).toBe("onswitch")
    expect(FIAT_CUSTOMER_ONSWITCH.country).toBe("NG")
    // Everything else inherited from the Bridge base.
    expect(FIAT_CUSTOMER_ONSWITCH.status).toBe(FIAT_COMPLIANCE_LIST[0].status)
    expect(FIAT_CUSTOMER_ONSWITCH.kycStatus).toBe(FIAT_COMPLIANCE_LIST[0].kycStatus)
    // Base is not mutated.
    expect(FIAT_COMPLIANCE_LIST[0].provider).toBe("bridge")
  })

  it("onramp order derived states change only the documented fields", () => {
    expect(FIAT_ORDER_ONSWITCH_ONRAMP_PROVIDER_PROCESSING.state).toBe("provider_processing")
    expect(FIAT_ORDER_ONSWITCH_ONRAMP_PROVIDER_PROCESSING.id).toBe(FIAT_ORDER_ONSWITCH_ONRAMP.id)

    expect(FIAT_ORDER_ONSWITCH_ONRAMP_COMPLETED.state).toBe("completed")
    expect(FIAT_ORDER_ONSWITCH_ONRAMP_COMPLETED.completedAt).toBe("2026-09-26T11:05:00.000Z")

    expect(FIAT_ORDER_ONSWITCH_ONRAMP_FAILED.state).toBe("failed")
    expect(FIAT_ORDER_ONSWITCH_ONRAMP_FAILED.failureReason).toBe("...")
  })

  it("derived errors have shape but placeholder message", () => {
    for (const err of [FIAT_ERROR_QUOTE_NOT_ACTIVE, FIAT_ERROR_RATE_LIMITED, FIAT_ERROR_PROVIDER_RESPONSE_INVALID]) {
      expect(err.success).toBe(false)
      expect(err.error.message).toBe("...")
      expect(err.requestId).toBe("...")
    }
    expect(FIAT_ERROR_QUOTE_NOT_ACTIVE.error.code).toBe("FIAT_QUOTE_NOT_ACTIVE")
    expect(FIAT_ERROR_RATE_LIMITED.error.code).toBe("RATE_LIMITED")
    expect(FIAT_ERROR_PROVIDER_RESPONSE_INVALID.error.code).toBe("PROVIDER_RESPONSE_INVALID")
  })
})
