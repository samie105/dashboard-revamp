/**
 * Fiat compliance logic (CP4). Guide §7, docs/fiat-frontend-integration-guide.md
 * lines 429-541.
 *
 * The backend remains the source of truth for customer compliance (guide
 * lines 10-11). The small approval helper below is only a UX guard for the
 * OnSwitch Buy form: the backend independently enforces the same requirement
 * before every quote and order. Bridge actions intentionally remain
 * backend-authoritative because its capability response has no per-user
 * approval field.
 */

import type { CryptoBackendClient } from "./client"
import { CryptoBackendError } from "./errors"
import { describeFiatError, type FiatErrorDescription } from "./fiat-errors"
import { fiatFingerprint, runIdempotentMutation } from "./fiat-idempotency"
import type { FiatCapabilitySnapshot, FiatCustomer, FiatKycLinkResult } from "./types"

type ComplianceClient = Pick<
  CryptoBackendClient,
  "createBridgeKycLink" | "syncBridgeCompliance" | "createFiatCustomer"
>

/* ── Display ──────────────────────────────────────────────────────────── */

/**
 * What the UI may show about a compliance record. The provider customer id
 * is deliberately absent: guide §7 line 435-436, "Never accept a customer ID
 * from another user or expose provider customer IDs in the UI."
 */
export interface ComplianceRecordView {
  provider: FiatCustomer["provider"]
  status: string
  kycStatus: string
  tosStatus: string
  endorsements: Array<{ name: string; status: string }>
  lastSyncedAt?: string
}

export function describeComplianceRecord(record: FiatCustomer): ComplianceRecordView {
  return {
    provider: record.provider,
    status: record.status,
    kycStatus: record.kycStatus,
    tosStatus: record.tosStatus,
    endorsements: Object.entries(record.endorsements ?? {}).map(([name, status]) => ({
      name,
      status: String(status),
    })),
    ...(record.lastSyncedAt ? { lastSyncedAt: record.lastSyncedAt } : {}),
  }
}

export function complianceRecordFor(
  records: FiatCustomer[] | undefined,
  provider: FiatCustomer["provider"],
): FiatCustomer | undefined {
  return records?.find((record) => record.provider === provider)
}

/**
 * UX-only mirror of the backend's approved customer state. Never use this as
 * an authorization decision: POST /fiat/quotes and POST /fiat/orders still
 * re-check the signed-in user's owned provider customer on the backend.
 */
export function isProviderCustomerApproved(record: Pick<FiatCustomer, "status"> | undefined): boolean {
  return record?.status.trim().toLowerCase() === "approved"
}

/* ── Whether KYC is needed (from /fiat/config, guide §5) ──────────────── */

/**
 * Guide §5 lines 311-343: each Bridge route carries `requiresCustomerKyc`,
 * and `providers.bridge.account.kycRequired` applies to the account. This
 * says whether the KYC step should be offered; it does not say whether this
 * user has completed it (no per-user field exists, open question 19).
 */
export function isBridgeKycRequired(
  config: FiatCapabilitySnapshot | undefined,
  route: "virtual-account" | "withdrawal",
): boolean {
  if (!config) return false
  const bridge = config.providers.bridge
  const match = bridge.routes.find((candidate) =>
    route === "virtual-account"
      ? candidate.direction === "onramp" && candidate.accountType === "virtual_account"
      : candidate.direction === "offramp" && candidate.accountType === "external_bank_account",
  )
  return Boolean(match?.requiresCustomerKyc) || bridge.account.kycRequired === true
}

/* ── Bridge hosted KYC (guide §7 lines 461-501, 525-541) ──────────────── */

export interface BridgeKycInput {
  legalName: string
  email: string
  country: string
}

/**
 * Returns the URL if it's an absolute https: URL, otherwise null. Anything
 * else (http:, javascript:, data:, protocol-relative, malformed) is refused.
 */
export function safeKycUrl(url: unknown): string | null {
  if (typeof url !== "string" || url.trim() === "") return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  return parsed.protocol === "https:" ? parsed.toString() : null
}

/**
 * Open the hosted KYC link in a new tab without giving it a handle back to
 * this page. Returns false (and opens nothing) for a non-https URL. With
 * "noopener", window.open always returns null, so the caller can't tell
 * whether a popup blocker stopped it and should also render the link.
 * The URL is never logged.
 */
export function openKycLink(
  url: unknown,
  open: (url: string, target: string, features: string) => unknown = (u, t, f) =>
    window.open(u, t, f),
): boolean {
  const safe = safeKycUrl(url)
  if (!safe) return false
  open(safe, "_blank", "noopener,noreferrer")
  return true
}

/**
 * POST /fiat/compliance/bridge/kyc-link under an idempotency key. The key's
 * identity is a fingerprint of the body, so the user's name and email never
 * reach sessionStorage, while an exact retry still reuses the key.
 */
export async function startBridgeKyc(
  client: ComplianceClient,
  input: BridgeKycInput,
): Promise<FiatKycLinkResult> {
  const body: BridgeKycInput = {
    legalName: input.legalName.trim(),
    email: input.email.trim(),
    country: input.country.trim().toUpperCase(),
  }
  return runIdempotentMutation(
    "kyc-link",
    { provider: "bridge", body: fiatFingerprint(body) },
    (key) => client.createBridgeKycLink(body, key),
  )
}

/**
 * "I've finished" → POST /fiat/compliance/bridge/sync. No body, no
 * idempotency key (guide §6.2 line 414). The caller then refetches
 * GET /fiat/compliance (guide line 500-501).
 */
export function finishBridgeKyc(client: ComplianceClient): Promise<FiatCustomer> {
  return client.syncBridgeCompliance()
}

/* ── OnSwitch customer profile (guide §7 lines 503-524) ───────────────── */

/** One form field per documented request field (guide lines 506-520). */
export interface OnswitchProfileInput {
  legalName: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  birthDate: string
  addressCountry: string
  addressCity: string
}

export type OnswitchCustomerPayload = Parameters<ComplianceClient["createFiatCustomer"]>[0]

/**
 * Build the POST body from exactly the documented fields. Blank fields are
 * left out rather than sent as empty strings; the guide doesn't say which
 * are required (open question 21), so the backend's fieldErrors decide.
 * `residentialAddress` only ever carries `country` and `city`, the two
 * fields the guide shows.
 */
export function buildOnswitchCustomerPayload(input: OnswitchProfileInput): OnswitchCustomerPayload {
  const text = (value: string) => value.trim()
  const payload: OnswitchCustomerPayload = { provider: "onswitch" }
  const set = <K extends keyof OnswitchCustomerPayload>(key: K, value: string) => {
    if (value) payload[key] = value as OnswitchCustomerPayload[K]
  }
  set("legalName", text(input.legalName))
  set("firstName", text(input.firstName))
  set("lastName", text(input.lastName))
  set("email", text(input.email))
  set("phone", text(input.phone))
  set("country", text(input.country).toUpperCase())
  set("birthDate", text(input.birthDate))
  const addressCountry = text(input.addressCountry).toUpperCase()
  const addressCity = text(input.addressCity)
  if (addressCountry || addressCity) {
    payload.residentialAddress = {
      ...(addressCountry ? { country: addressCountry } : {}),
      ...(addressCity ? { city: addressCity } : {}),
    }
  }
  return payload
}

export function createOnswitchCustomer(
  client: ComplianceClient,
  input: OnswitchProfileInput,
): Promise<FiatCustomer> {
  const payload = buildOnswitchCustomerPayload(input)
  return runIdempotentMutation(
    "customer",
    { provider: "onswitch", body: fiatFingerprint(payload) },
    (key) => client.createFiatCustomer(payload, key),
  )
}

/**
 * Field-level validation errors from an INVALID_REQUEST response (guide
 * §12.2 lines 1025-1041). Returns the names of the fields the backend
 * flagged. The backend's wording isn't returned: the UI shows its own
 * message next to each flagged field, consistent with showing no raw
 * backend text (open question 18).
 */
export function invalidFieldsFrom(error: unknown): string[] {
  if (!(error instanceof CryptoBackendError) || error.code !== "INVALID_REQUEST") return []
  const details = error.details as { fieldErrors?: unknown } | undefined
  const fieldErrors = details?.fieldErrors
  if (!fieldErrors || typeof fieldErrors !== "object") return []
  return Object.entries(fieldErrors as Record<string, unknown>)
    .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
    .map(([field]) => field)
}

/* ── Refusals of the Bridge virtual-account request ───────────────────── */

/**
 * Guide §12.1 line 991: 403 → "Stop the action and show ownership/compliance
 * guidance. Do not retry." For the virtual-account request that guidance is
 * "finish verification". Which code the backend uses for incomplete
 * compliance isn't documented (open question 20); every other refusal goes
 * through the standard fiat error mapping (409 resolves state, etc.).
 */
export function describeBridgeVirtualAccountRefusal(error: unknown): FiatErrorDescription {
  if (error instanceof CryptoBackendError && error.status === 403) {
    return {
      message:
        "Bridge hasn't approved a USD deposit account for you yet. Finish identity verification with Bridge, then try again.",
      action: "stop",
      requestId: error.requestId,
    }
  }
  return describeFiatError(error)
}
