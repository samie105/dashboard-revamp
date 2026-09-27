/**
 * Fiat ramp fixtures — verbatim copies of the illustrative responses in
 * docs/fiat-frontend-integration-guide.md ("the guide"). Every value in
 * the "Verbatim" section below is quoted from the guide as-is; nothing is
 * invented. Each export cites the section it comes from so a reader can
 * check it against the source.
 *
 * These are used by the local-only mock mode (an extension of
 * lib/dev-mock-crypto-backend.ts — one mock module, one place to look) and
 * by tests. They are pure data: no dates are computed, no ids are minted.
 * The mock layer shifts guide dates like `expiresAt`, `cacheExpiresAt`,
 * `createdAt`, `updatedAt` relative to now so quotes and payment
 * instructions aren't born expired; the fixtures themselves stay a stable
 * reference the tests pin against.
 *
 * The DERIVED section holds shapes for states the guide names but shows no
 * example body for (guide §5 disabled/blocked/discovery_only, §9.1 expired
 * quote, §11 order states like provider_processing/completed/failed, and
 * error codes from §12.1 that §12.2 doesn't illustrate). Each derived
 * fixture is built by cloning a verbatim fixture and changing ONLY the
 * documented field. No new fields, no invented text — error messages that
 * the guide doesn't give are rendered as the literal `"..."` so nothing is
 * fabricated.
 *
 * When CP2 lands the missing types (FiatCustomer, FiatKycLink,
 * FiatBeneficiary, FiatInstitution) the local shape-only interfaces below
 * get replaced with the imported types.
 */

import type {
  FiatCapabilitySnapshot,
  FiatOrder,
  FiatQuote,
  FiatVirtualAccount,
  FiatVirtualAccountActivity,
} from "@/lib/crypto-backend/types"

/* ── Envelope helpers ─────────────────────────────────────────────────────
   The guide's §4 success envelope: { success: true, data, requestId? }.
   Errors: { success: false, error: { code, message, details? }, requestId? }.
   Fixture responders wrap the payloads below in these envelopes. */

export type FiatApiSuccess<T> = { success: true; data: T; requestId?: string }
export type FiatApiFailure = {
  success: false
  error: { code: string; message: string; details?: unknown }
  requestId?: string
}

/* ══════════════════════════════════════════════════════════════════════════
 * VERBATIM — copied field-for-field from the guide's illustrative responses.
 * ══════════════════════════════════════════════════════════════════════════ */

/* ── §5 GET /fiat/config ──────────────────────────────────────────────── */

/** Guide §5: "Illustrative successful response" for GET /fiat/config. */
export const FIAT_CONFIG_AVAILABLE: FiatCapabilitySnapshot = {
  generatedAt: "2026-09-26T10:20:00.000Z",
  cacheExpiresAt: "2026-09-26T10:21:00.000Z",
  environment: "sandbox",
  enabled: true,
  availability: "available",
  rollout: { allowlisted: true },
  readiness: {
    environment: "sandbox",
    featureEnabled: true,
    productionApproved: true,
    complianceApproved: true,
    ready: true,
    blockingReasons: [],
    providers: {
      onswitch: {
        provider: "onswitch",
        environment: "sandbox",
        baseUrl: "https://api.onswitch.xyz",
        enabled: true,
        keyConfigured: true,
        configured: true,
        keyEnvironmentValid: true,
        accountApproved: true,
        webhookConfigured: true,
        complianceApproved: true,
        discoveryAvailable: true,
        operationAvailable: true,
        blockingReasons: [],
      },
      bridge: {
        provider: "bridge",
        environment: "sandbox",
        baseUrl: "https://api.sandbox.bridge.xyz",
        enabled: true,
        keyConfigured: true,
        configured: true,
        keyEnvironmentValid: true,
        accountApproved: true,
        webhookConfigured: true,
        complianceApproved: true,
        discoveryAvailable: true,
        operationAvailable: true,
        blockingReasons: [],
      },
    },
  },
  providers: {
    onswitch: {
      status: "available",
      directions: { onrampEnabled: true, offrampEnabled: true },
      coverage: [
        {
          countryCode: "NG",
          currencyCode: "NGN",
          channels: ["BANK"],
          directions: ["onramp", "offramp"],
          enabled: true,
          settlementCurrency: "NGN",
          countryName: "Nigeria",
        },
        {
          countryCode: "GH",
          currencyCode: "GHS",
          channels: ["MOBILE_MONEY"],
          directions: ["onramp", "offramp"],
          enabled: true,
          settlementCurrency: "GHS",
          countryName: "Ghana",
        },
      ],
      assets: [
        {
          providerAssetId: "ethereum:usdc",
          symbol: "USDC",
          decimals: 6,
          chain: "ethereum",
          address: "0x...",
          onrampSupported: true,
          offrampSupported: true,
        },
      ],
    },
    bridge: {
      status: "available",
      routes: [
        {
          id: "bridge-usd-virtual-account",
          provider: "bridge",
          direction: "onramp",
          fiatCurrency: "USD",
          paymentRail: "ach_or_wire",
          accountType: "virtual_account",
          requiresCustomerKyc: true,
          requiresOwnedExternalAccount: false,
          status: "available",
          notes: [],
        },
        {
          id: "bridge-usd-withdrawal",
          provider: "bridge",
          direction: "offramp",
          fiatCurrency: "USD",
          paymentRail: "ach_or_wire",
          accountType: "external_bank_account",
          requiresCustomerKyc: true,
          requiresOwnedExternalAccount: true,
          status: "available",
          notes: [],
        },
      ],
      account: {
        customerRequired: true,
        kycRequired: true,
        supportedFiat: ["USD"],
        virtualAccountsEnabled: true,
        withdrawalsEnabled: true,
        liquidationEnabled: true,
      },
    },
  },
  assetRoutes: [
    {
      provider: "onswitch",
      providerAssetId: "ethereum:usdc",
      symbol: "USDC",
      decimals: 6,
      providerChain: "ethereum",
      providerAddress: "0x...",
      localNetworkId: "ethereum-mainnet",
      walletReady: true,
      status: "wallet_ready",
      onrampSupported: true,
      offrampSupported: true,
    },
  ],
}

/* ── §7 Compliance ─────────────────────────────────────────────────────── */

// CP2 replaces these with typed FiatCustomer / FiatKycLink / FiatKycLinkResult.
interface FiatCustomerFixture {
  id: string
  provider: "bridge" | "onswitch"
  status: string
  country: string
  kycStatus: string
  tosStatus: string
  endorsements: Record<string, string>
  termsAcceptedAt?: string
  lastSyncedAt?: string
  createdAt?: string
  updatedAt?: string
}

interface FiatKycLinkFixture {
  url: string
  tosUrl: string
  kycStatus: string
  tosStatus: string
}

/** Guide §7: "Illustrative response" for GET /fiat/compliance. */
export const FIAT_COMPLIANCE_LIST: FiatCustomerFixture[] = [
  {
    id: "66f000000000000000000001",
    provider: "bridge",
    status: "approved",
    country: "US",
    kycStatus: "approved",
    tosStatus: "accepted",
    endorsements: { base: "approved" },
    termsAcceptedAt: "2026-09-26T10:10:00.000Z",
    lastSyncedAt: "2026-09-26T10:15:00.000Z",
    createdAt: "2026-09-25T09:00:00.000Z",
    updatedAt: "2026-09-26T10:15:00.000Z",
  },
]

/** Guide §7: "Illustrative response" for POST /fiat/compliance/bridge/kyc-link. */
export const FIAT_BRIDGE_KYC_LINK_RESPONSE: {
  customer: FiatCustomerFixture
  kycLink: FiatKycLinkFixture
} = {
  customer: {
    id: "66f000000000000000000001",
    provider: "bridge",
    status: "pending",
    country: "US",
    kycStatus: "pending",
    tosStatus: "pending",
    endorsements: {},
    createdAt: "2026-09-26T10:20:00.000Z",
    updatedAt: "2026-09-26T10:20:00.000Z",
  },
  kycLink: {
    url: "https://provider.example/hosted-kyc/<opaque-token>",
    tosUrl: "https://provider.example/terms/<opaque-token>",
    kycStatus: "pending",
    tosStatus: "pending",
  },
}

/** Guide §7: "Illustrative response" for POST /fiat/compliance/bridge/sync. */
export const FIAT_BRIDGE_SYNC_RESPONSE: FiatCustomerFixture = {
  id: "66f000000000000000000001",
  provider: "bridge",
  status: "approved",
  country: "US",
  kycStatus: "approved",
  tosStatus: "accepted",
  endorsements: { base: "approved" },
  lastSyncedAt: "2026-09-26T10:30:00.000Z",
}

/* ── §8 Institutions and beneficiaries ─────────────────────────────────── */

// CP2 replaces these with typed FiatInstitution / FiatBeneficiary.
interface FiatInstitutionFixture {
  id: string
  name: string
  code?: string
  country?: string
  currency?: string
  channel?: string
}

interface FiatBeneficiaryFixture {
  id: string
  provider: "onswitch" | "bridge"
  direction: "onramp" | "offramp"
  country: string
  currency: string
  channel: string
  holderType: string
  holderName: string
  maskedAccount: string
  ownershipStatus: string
  verificationMethod?: string
  verificationReason?: string | null
  status: string
  verifiedAt?: string
  createdAt: string
  updatedAt: string
}

/** Guide §8: "Illustrative response" for GET /fiat/institutions. */
export const FIAT_INSTITUTIONS_NG_NGN_BANK: FiatInstitutionFixture[] = [
  {
    id: "provider-bank-code",
    name: "Example Bank",
    code: "000001",
    country: "NG",
    currency: "NGN",
    channel: "BANK",
  },
]

/** Guide §8: "Illustrative response" for GET /fiat/beneficiaries. */
export const FIAT_BENEFICIARIES_LIST: FiatBeneficiaryFixture[] = [
  {
    id: "66f000000000000000000021",
    provider: "onswitch",
    direction: "offramp",
    country: "NG",
    currency: "NGN",
    channel: "BANK",
    holderType: "individual",
    holderName: "EXAMPLE USER",
    maskedAccount: "******4321",
    ownershipStatus: "verified",
    verificationMethod: "provider_lookup",
    verificationReason: null,
    status: "verified",
    verifiedAt: "2026-09-26T10:40:00.000Z",
    createdAt: "2026-09-26T10:39:00.000Z",
    updatedAt: "2026-09-26T10:40:00.000Z",
  },
]

/* ── §9 OnSwitch quotes and orders ─────────────────────────────────────── */

/** Guide §9.1: "Illustrative response" for POST /fiat/quotes (onramp). */
export const FIAT_QUOTE_ONRAMP: FiatQuote = {
  id: "66f000000000000000000031",
  provider: "onswitch",
  direction: "onramp",
  country: "NG",
  currency: "NGN",
  channel: "BANK",
  exactOutput: false,
  sourceAmount: "100000",
  sourceCurrency: "NGN",
  destinationAmount: "62.450000",
  destinationCurrency: "USDC",
  asset: "ethereum:usdc",
  network: "ethereum-mainnet",
  providerRate: "1602.564102",
  providerFee: "500",
  worldstreetFee: "100",
  expectedSettlementSeconds: 900,
  expiresAt: "2026-09-26T10:55:00.000Z",
  state: "active",
  createdAt: "2026-09-26T10:45:00.000Z",
  updatedAt: "2026-09-26T10:45:00.000Z",
}

/** Guide §9.2: "Illustrative onramp response" for POST /fiat/orders. */
export const FIAT_ORDER_ONSWITCH_ONRAMP: FiatOrder = {
  id: "66f000000000000000000051",
  publicReference: "WS-ONSWITCH-000051",
  provider: "onswitch",
  direction: "onramp",
  country: "NG",
  currency: "NGN",
  channel: "BANK",
  asset: "ethereum:usdc",
  network: "ethereum-mainnet",
  quoteId: "66f000000000000000000031",
  state: "awaiting_bank_deposit",
  providerStatus: "pending",
  providerDisplay: {
    paymentInstructions: {
      amount: "100000",
      currency: "NGN",
      bankName: "Example Bank",
      accountName: "WorldStreet Settlement",
      accountNumber: "******1234",
      expiresAt: "2026-09-26T11:00:00.000Z",
    },
  },
  createdAt: "2026-09-26T10:50:00.000Z",
  updatedAt: "2026-09-26T10:50:00.000Z",
}

/** Guide §9.2: "Illustrative offramp response" for POST /fiat/orders. */
export const FIAT_ORDER_ONSWITCH_OFFRAMP: FiatOrder = {
  id: "66f000000000000000000052",
  publicReference: "WS-ONSWITCH-000052",
  provider: "onswitch",
  direction: "offramp",
  country: "NG",
  currency: "NGN",
  channel: "BANK",
  asset: "ethereum:usdc",
  network: "ethereum-mainnet",
  beneficiaryId: "66f000000000000000000021",
  quoteId: "66f000000000000000000032",
  localCryptoIntentId: "66f000000000000000000061",
  state: "crypto_intent_ready",
  providerStatus: "awaiting_crypto_deposit",
  cryptoIntent: {
    id: "66f000000000000000000061",
    status: "prepared",
    to: "0xprovider-deposit-address",
    amount: "62.450000",
    asset: "USDC",
    network: "ethereum-mainnet",
  },
  expiresAt: "2026-09-26T11:20:00.000Z",
  createdAt: "2026-09-26T10:50:00.000Z",
  updatedAt: "2026-09-26T10:50:00.000Z",
}

/* ── §10 Bridge USD flow ───────────────────────────────────────────────── */

/** Guide §10.1: "Illustrative response" for POST /fiat/bridge/virtual-accounts. */
export const FIAT_BRIDGE_VIRTUAL_ACCOUNT: FiatVirtualAccount = {
  id: "66f000000000000000000071",
  provider: "bridge",
  walletId: "66f000000000000000000041",
  networkId: "ethereum-mainnet",
  asset: "USDC",
  destinationAddress: "0x<worldstreet-user-usdc-address>",
  status: "active",
  providerStatus: "active",
  depositInstructions: {
    currency: "USD",
    paymentRails: ["ach", "wire"],
    accountName: "Example User",
    routingNumber: "******6789",
    accountNumber: "******4321",
    bankName: "Example Bank",
    reference: "WS-VA-000071",
  },
  lastSyncedAt: "2026-09-26T11:00:00.000Z",
  createdAt: "2026-09-26T11:00:00.000Z",
  updatedAt: "2026-09-26T11:00:00.000Z",
}

/** Guide §10.2: "Illustrative activity response". */
export const FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY: FiatVirtualAccountActivity[] = [
  {
    id: "66f000000000000000000081",
    virtualAccountId: "66f000000000000000000071",
    providerStatus: "completed",
    amount: "250.00",
    currency: "USD",
    destinationTxHash: "0x<worldstreet-settlement-tx>",
    sourcePaymentRail: "ach",
    occurredAt: "2026-09-27T14:00:00.000Z",
    createdAt: "2026-09-27T14:01:00.000Z",
    updatedAt: "2026-09-27T14:01:00.000Z",
  },
]

/** Guide §10.3: "Illustrative response" for a Bridge USD withdrawal order. */
export const FIAT_ORDER_BRIDGE_WITHDRAWAL: FiatOrder = {
  id: "66f000000000000000000101",
  publicReference: "WS-BRIDGE-000101",
  provider: "bridge",
  direction: "offramp",
  country: "US",
  currency: "USD",
  channel: "ach",
  asset: "0x<canonical-worldstreet-usdc-address>",
  network: "ethereum-mainnet",
  beneficiaryId: "66f000000000000000000091",
  localCryptoIntentId: "66f000000000000000000111",
  state: "crypto_intent_ready",
  providerStatus: "awaiting_crypto_deposit",
  cryptoIntent: {
    id: "66f000000000000000000111",
    status: "prepared",
    to: "0x<bridge-deposit-address>",
    amount: "100.00",
    asset: "USDC",
    network: "ethereum-mainnet",
  },
  createdAt: "2026-09-26T11:10:00.000Z",
  updatedAt: "2026-09-26T11:10:00.000Z",
}

/* ── §12.2 Representative error responses ──────────────────────────────── */

/** Guide §12.2 "Missing dashboard session" — the only §12.2 example without requestId. */
export const FIAT_ERROR_UNAUTHORIZED: FiatApiFailure = {
  success: false,
  error: {
    code: "UNAUTHORIZED",
    message: "Unauthorized",
  },
}

/** Guide §12.2 "Missing/invalid direct backend session". */
export const FIAT_ERROR_AUTH_REQUIRED: FiatApiFailure = {
  success: false,
  error: {
    code: "AUTH_REQUIRED",
    message: "Authentication required",
  },
  requestId: "...",
}

/** Guide §12.2 "Malformed request body". */
export const FIAT_ERROR_INVALID_REQUEST: FiatApiFailure = {
  success: false,
  error: {
    code: "INVALID_REQUEST",
    message: "Request validation failed",
    details: {
      formErrors: [],
      fieldErrors: {
        country: ["Invalid input: expected string, received undefined"],
        amount: ["Invalid input: expected string or number, received undefined"],
      },
    },
  },
  requestId: "...",
}

/** Guide §12.2 "Missing idempotency key". */
export const FIAT_ERROR_IDEMPOTENCY_KEY_REQUIRED: FiatApiFailure = {
  success: false,
  error: {
    code: "IDEMPOTENCY_KEY_REQUIRED",
    message: "Idempotency-Key header is required",
  },
  requestId: "...",
}

/** Guide §12.2 "Feature/provider not ready". */
export const FIAT_ERROR_PROVIDER_NOT_READY: FiatApiFailure = {
  success: false,
  error: {
    code: "FIAT_PROVIDER_NOT_READY",
    message: "bridge operation is not approved",
    details: {
      provider: "bridge",
      blockingReasons: [
        "FIAT_RAMP_ENABLED is false",
        "BRIDGE account approval is not complete",
      ],
    },
  },
  requestId: "...",
}

/** Guide §12.2 "Not owned or not verified". */
export const FIAT_ERROR_BENEFICIARY_NOT_VERIFIED: FiatApiFailure = {
  success: false,
  error: {
    code: "BENEFICIARY_NOT_VERIFIED",
    message: "The selected beneficiary is not verified for this account",
  },
  requestId: "...",
}

/** Guide §12.2 "Provider/corridor rejection". */
export const FIAT_ERROR_PROVIDER_VALIDATION: FiatApiFailure = {
  success: false,
  error: {
    code: "FIAT_PROVIDER_VALIDATION",
    message: "The selected corridor is not available",
    details: {
      provider: "onswitch",
      providerCode: "<sanitized-provider-code>",
    },
  },
  requestId: "...",
}

/* ══════════════════════════════════════════════════════════════════════════
 * DERIVED — not a guide example.
 *
 * The guide names these states/codes but shows no example body. Each
 * derivation clones a verbatim fixture and mutates ONLY the documented
 * field(s). Error messages the guide doesn't provide are rendered as the
 * literal `"..."`; blocking-reason strings are quoted from §12.2's
 * FIAT_PROVIDER_NOT_READY example so nothing is invented.
 * ══════════════════════════════════════════════════════════════════════════ */

// Deep-clones a JSON-safe fixture so mutations don't leak back to the verbatim source.
const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/* ── Config states from §5's status enum ──────────────────────────────── */

/** DERIVED — not a guide example. Base: §5 FIAT_CONFIG_AVAILABLE.
 *  Change: availability → "disabled" (guide §5 status enum);
 *  readiness/provider fields flipped consistently with the enum entry
 *  "Hide or disable fiat actions. The global switch is off or the provider
 *  is not enabled." The blocking-reason string is quoted verbatim from
 *  §12.2's FIAT_PROVIDER_NOT_READY example. */
export const FIAT_CONFIG_DISABLED: FiatCapabilitySnapshot = (() => {
  const config = cloneJson(FIAT_CONFIG_AVAILABLE)
  config.enabled = false
  config.availability = "disabled"
  config.readiness.featureEnabled = false
  config.readiness.ready = false
  config.readiness.blockingReasons = ["FIAT_RAMP_ENABLED is false"]
  config.readiness.providers.onswitch.enabled = false
  config.readiness.providers.onswitch.operationAvailable = false
  config.readiness.providers.onswitch.blockingReasons = ["FIAT_RAMP_ENABLED is false"]
  config.readiness.providers.bridge.enabled = false
  config.readiness.providers.bridge.operationAvailable = false
  config.readiness.providers.bridge.blockingReasons = ["FIAT_RAMP_ENABLED is false"]
  config.providers.onswitch.status = "disabled"
  config.providers.onswitch.directions = { onrampEnabled: false, offrampEnabled: false }
  config.providers.bridge.status = "disabled"
  config.providers.bridge.account.virtualAccountsEnabled = false
  config.providers.bridge.account.withdrawalsEnabled = false
  return config
})()

/** DERIVED — not a guide example. Base: §5 FIAT_CONFIG_AVAILABLE.
 *  Change: availability → "blocked" (guide §5 status enum:
 *  "temporarily unavailable"). Providers keep their `available` shape;
 *  only the top-level availability flips. */
export const FIAT_CONFIG_BLOCKED: FiatCapabilitySnapshot = (() => {
  const config = cloneJson(FIAT_CONFIG_AVAILABLE)
  config.availability = "blocked"
  return config
})()

/** DERIVED — not a guide example. Base: §5 FIAT_CONFIG_AVAILABLE.
 *  Change: availability → "discovery_only" (guide §5 status enum:
 *  read-only capability discovery). */
export const FIAT_CONFIG_DISCOVERY_ONLY: FiatCapabilitySnapshot = (() => {
  const config = cloneJson(FIAT_CONFIG_AVAILABLE)
  config.availability = "discovery_only"
  return config
})()

/* ── Quote states from §9.1's state enum ──────────────────────────────── */

/** DERIVED — not a guide example. Base: §9.1 FIAT_QUOTE_ONRAMP.
 *  Change: state → "expired". Source of the enum values ("active" |
 *  "accepted" | "expired" | "superseded" | string): `FiatQuote` in
 *  lib/crypto-backend/types.ts. The guide only shows an active quote in
 *  its illustrative response and does not enumerate other state
 *  values. */
export const FIAT_QUOTE_EXPIRED: FiatQuote = (() => {
  const quote = cloneJson(FIAT_QUOTE_ONRAMP)
  quote.state = "expired"
  return quote
})()

/* ── Order states from §11's lifecycle table ──────────────────────────── */

/** DERIVED — not a guide example. Base: §9.2 FIAT_ORDER_ONSWITCH_ONRAMP.
 *  Change: state → "provider_processing" (guide §11 lifecycle). */
export const FIAT_ORDER_ONSWITCH_ONRAMP_PROVIDER_PROCESSING: FiatOrder = (() => {
  const order = cloneJson(FIAT_ORDER_ONSWITCH_ONRAMP)
  order.state = "provider_processing"
  return order
})()

/** DERIVED — not a guide example. Base: §9.2 FIAT_ORDER_ONSWITCH_ONRAMP.
 *  Change: state → "completed" (from the §11 lifecycle table) and
 *  completedAt set. `completedAt` is not named in the guide; source is
 *  the `FiatOrder` interface in lib/crypto-backend/types.ts, which
 *  declares it as an optional string field. */
export const FIAT_ORDER_ONSWITCH_ONRAMP_COMPLETED: FiatOrder = (() => {
  const order = cloneJson(FIAT_ORDER_ONSWITCH_ONRAMP)
  order.state = "completed"
  order.completedAt = "2026-09-26T11:05:00.000Z"
  return order
})()

/** DERIVED — not a guide example. Base: §9.2 FIAT_ORDER_ONSWITCH_ONRAMP.
 *  Change: state → "failed" (from the §11 lifecycle table) and
 *  failureReason set. `failureReason` is not named in the guide (§11
 *  only says "Show the backend's safe reason" for the failed/reversed/
 *  refund states without naming the carrying field); source is the
 *  `FiatOrder` interface in lib/crypto-backend/types.ts, which declares
 *  failureReason/reviewReason/refundReason as optional string fields.
 *  Which one carries the shown reason for a given state is an open
 *  question tracked in docs/FIAT_RAMP_CONTEXT.md. The reason text is
 *  rendered as "..." because the guide gives no example. */
export const FIAT_ORDER_ONSWITCH_ONRAMP_FAILED: FiatOrder = (() => {
  const order = cloneJson(FIAT_ORDER_ONSWITCH_ONRAMP)
  order.state = "failed"
  order.failureReason = "..."
  return order
})()

/* ── Error codes from §12.1's table that §12.2 doesn't illustrate ─────── */

/** DERIVED — not a guide example. Code from guide §12.1 table (409). Body
 *  follows §4 envelope. Message rendered as "..." because the guide gives
 *  no example. */
export const FIAT_ERROR_QUOTE_NOT_ACTIVE: FiatApiFailure = {
  success: false,
  error: {
    code: "FIAT_QUOTE_NOT_ACTIVE",
    message: "...",
  },
  requestId: "...",
}

/** DERIVED — not a guide example. Code from guide §12.1 table (429). Body
 *  follows §4 envelope. Message rendered as "..." because the guide gives
 *  no example. The `Retry-After` header (also documented in §12.1) is set
 *  by the mock layer at response time, not carried in the payload. */
export const FIAT_ERROR_RATE_LIMITED: FiatApiFailure = {
  success: false,
  error: {
    code: "RATE_LIMITED",
    message: "...",
  },
  requestId: "...",
}

/** DERIVED — not a guide example. Code from guide §12.1 table (502). Body
 *  follows §4 envelope. Message rendered as "..." because the guide gives
 *  no example. */
export const FIAT_ERROR_PROVIDER_RESPONSE_INVALID: FiatApiFailure = {
  success: false,
  error: {
    code: "PROVIDER_RESPONSE_INVALID",
    message: "...",
  },
  requestId: "...",
}

/* ── Quote direction from §9.1's request contract ─────────────────────── */

/** DERIVED — not a guide example. Base: §9.1 FIAT_QUOTE_ONRAMP.
 *  Change: direction → "offramp" (guide §9.1 accepts direction:
 *  "onramp"|"offramp" on POST /fiat/quotes but only shows an onramp
 *  response body). Nothing else is touched — the mock exists to
 *  demonstrate the direction round-trip in a fiat-shaped response, not
 *  to compute real numbers.
 *
 *  WARNING: sourceAmount, destinationAmount, sourceCurrency and
 *  destinationCurrency here are placeholders inherited from the onramp
 *  fixture. In a real offramp the source is crypto and the destination
 *  is fiat, so those fields are semantically reversed. UI code MUST NOT
 *  drive offramp display logic from this fixture's numbers; the
 *  offramp quote screen renders from real backend responses only, and
 *  tests that assert offramp display behaviour need their own fixture. */
export const FIAT_QUOTE_OFFRAMP: FiatQuote = (() => {
  const quote = cloneJson(FIAT_QUOTE_ONRAMP)
  quote.direction = "offramp"
  return quote
})()

/* ── Compliance customer from §7's request contract ───────────────────── */

/** DERIVED — not a guide example. Base: §7 FIAT_COMPLIANCE_LIST[0] (the
 *  Bridge customer response). Change: provider → "onswitch" and country →
 *  "NG" so the customer record matches an OnSwitch profile creation call
 *  (guide §7 shows the OnSwitch POST body with country "NG"). No new
 *  fields — only documented values on existing fields are changed.
 *  Guide §7 shows no response body for POST /fiat/compliance/customer,
 *  which is why this is derived rather than verbatim. */
export const FIAT_CUSTOMER_ONSWITCH: FiatCustomerFixture = (() => {
  const customer = cloneJson(FIAT_COMPLIANCE_LIST[0])
  customer.provider = "onswitch"
  customer.country = "NG"
  return customer
})()
