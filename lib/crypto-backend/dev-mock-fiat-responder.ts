/**
 * Fiat-fixture responder for local-only mock mode.
 *
 * Answers `/fiat/*` requests from the verbatim + derived guide fixtures
 * in `./__fixtures__/fiat.ts`. Reachable from two places, both gated to
 * dev by construction:
 *  1. `lib/dev-mock-crypto-backend.ts` (under DEV_AUTH_BYPASS via the
 *     existing proxy hook at `app/api/crypto/[...path]/route.ts:136-139`).
 *  2. `lib/dev-mock-fetch.ts` (under FIAT_MOCKS_ENABLED, in the browser).
 *
 * The proxy is not modified — only the existing DEV_AUTH_BYPASS hook is
 * reused, per the "only ADD allowlist entries" rule.
 *
 * Behaviour the guide requires (with the cited section):
 *  · §3.3 mutations MUST carry Idempotency-Key. Missing → 400 with the
 *    §12.2 IDEMPOTENCY_KEY_REQUIRED envelope. Same key on retry → 200
 *    with the same resource. The exception is POST /fiat/compliance/
 *    bridge/sync (§6.2 table row: idempotency "No").
 *  · §11: 201 for a fresh create; 200 for an idempotent replay. Applied
 *    to the create endpoints (quotes, orders, virtual accounts,
 *    beneficiaries, kyc-link, customer). Non-create mutations (confirm,
 *    sync, delete) return 200.
 *  · §3.3 + §4: every response carries a requestId, both in the JSON
 *    envelope and in the `x-request-id` response header.
 *  · §11 order lifecycle: GET /fiat/orders/:id for the onramp fixture id
 *    advances awaiting_bank_deposit → provider_processing → completed
 *    across polls. Other ids return their fixed fixture.
 *  · §9.1 direction: POST /fiat/quotes with `direction: "offramp"`
 *    returns the DERIVED FIAT_QUOTE_OFFRAMP; onramp/default returns the
 *    verbatim FIAT_QUOTE_ONRAMP.
 *
 * All guide dates in fixtures are rebased to `now` here so that quotes
 * and payment instructions aren't born expired. The fixture module is
 * pure data; timestamps live at the response layer.
 *
 * `__resetFiatMockState()` is exported for tests only.
 */

import type { NextRequest } from "next/server"
import {
  FIAT_BENEFICIARIES_LIST,
  FIAT_BENEFICIARY_BRIDGE_USD,
  FIAT_BENEFICIARY_REQUIREMENTS_NG_BANK,
  FIAT_BRIDGE_KYC_LINK_RESPONSE,
  FIAT_BRIDGE_SYNC_RESPONSE,
  FIAT_BRIDGE_VIRTUAL_ACCOUNT,
  FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY,
  FIAT_COMPLIANCE_LIST,
  FIAT_CONFIG_AVAILABLE,
  FIAT_CUSTOMER_ONSWITCH,
  FIAT_ERROR_IDEMPOTENCY_KEY_REQUIRED,
  FIAT_INSTITUTIONS_NG_NGN_BANK,
  FIAT_ORDER_BRIDGE_WITHDRAWAL,
  FIAT_ORDER_ONSWITCH_OFFRAMP,
  FIAT_ORDER_ONSWITCH_ONRAMP,
  FIAT_ORDER_ONSWITCH_ONRAMP_COMPLETED,
  FIAT_ORDER_ONSWITCH_ONRAMP_PROVIDER_PROCESSING,
  FIAT_QUOTE_OFFRAMP,
  FIAT_QUOTE_ONRAMP,
} from "./__fixtures__/fiat"
import type {
  FiatCapabilitySnapshot,
  FiatOrder,
  FiatQuote,
  FiatVirtualAccount,
  FiatVirtualAccountActivity,
} from "./types"

/* ── State (module-scope; reset via __resetFiatMockState) ─────────────── */

interface IdempotencyEntry {
  body: unknown
  status: 201 | 200
}
const idempotencyStore = new Map<string, IdempotencyEntry>()
const orderPollCount = new Map<string, number>()
let onswitchCustomerCreated = false

export function __resetFiatMockState(): void {
  idempotencyStore.clear()
  orderPollCount.clear()
  onswitchCustomerCreated = false
}

/* ── Envelope + header helpers ────────────────────────────────────────── */

const nowIso = () => new Date().toISOString()
const shiftIso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()
const mintRequestId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

function envelope<T>(data: T, status: 200 | 201 = 200): Response {
  const requestId = mintRequestId()
  return Response.json(
    { success: true, data, requestId },
    { status, headers: { "x-request-id": requestId } },
  )
}

function errorEnvelope(payload: {
  code: string
  message: string
  details?: unknown
}, status: number): Response {
  const requestId = mintRequestId()
  return Response.json(
    {
      success: false,
      error: {
        code: payload.code,
        message: payload.message,
        ...(payload.details !== undefined ? { details: payload.details } : {}),
      },
      requestId,
    },
    { status, headers: { "x-request-id": requestId } },
  )
}

function missingIdempotencyKey(): Response {
  return errorEnvelope(
    {
      code: FIAT_ERROR_IDEMPOTENCY_KEY_REQUIRED.error.code,
      message: FIAT_ERROR_IDEMPOTENCY_KEY_REQUIRED.error.message,
    },
    400,
  )
}

/* ── Timestamp rebasers ───────────────────────────────────────────────── */

/* Offsets are taken from the guide's own examples so the mock preserves
   the documented lifetimes; recompute them here rather than shipping the
   guide's absolute dates. */
const CACHE_TTL_MS = 60_000 // §5 cacheExpiresAt is 60s after generatedAt.
const QUOTE_TTL_MS = 10 * 60_000 // §9.1 quote expiresAt is 10 minutes after createdAt.
const PAYMENT_INSTRUCTIONS_TTL_MS = 10 * 60_000 // §9.2 onramp instructions expire 10 minutes after order creation.
const OFFRAMP_ORDER_TTL_MS = 30 * 60_000 // §9.2 offramp order expiresAt is 30 minutes after createdAt.

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function freshenConfig(config: FiatCapabilitySnapshot): FiatCapabilitySnapshot {
  const generatedAt = nowIso()
  return { ...cloneJson(config), generatedAt, cacheExpiresAt: shiftIso(CACHE_TTL_MS) }
}

function freshenQuote(quote: FiatQuote): FiatQuote {
  const createdAt = nowIso()
  return {
    ...cloneJson(quote),
    expiresAt: shiftIso(QUOTE_TTL_MS),
    createdAt,
    updatedAt: createdAt,
  }
}

function freshenOnrampOrder(order: FiatOrder): FiatOrder {
  const createdAt = nowIso()
  const clone = cloneJson(order)
  if (clone.providerDisplay && typeof clone.providerDisplay.paymentInstructions === "object") {
    const instructions = clone.providerDisplay.paymentInstructions as Record<string, unknown>
    instructions.expiresAt = shiftIso(PAYMENT_INSTRUCTIONS_TTL_MS)
  }
  clone.createdAt = createdAt
  clone.updatedAt = createdAt
  return clone
}

function freshenOfframpOrder(order: FiatOrder): FiatOrder {
  const createdAt = nowIso()
  return {
    ...cloneJson(order),
    expiresAt: shiftIso(OFFRAMP_ORDER_TTL_MS),
    createdAt,
    updatedAt: createdAt,
  }
}

function freshenVirtualAccount(account: FiatVirtualAccount): FiatVirtualAccount {
  const now = nowIso()
  return { ...cloneJson(account), lastSyncedAt: now, createdAt: now, updatedAt: now }
}

function freshenActivity(items: FiatVirtualAccountActivity[]): FiatVirtualAccountActivity[] {
  const now = nowIso()
  const oneMinuteAgo = shiftIso(-60_000)
  return items.map((item) => ({
    ...cloneJson(item),
    occurredAt: oneMinuteAgo,
    createdAt: now,
    updatedAt: now,
  }))
}

/* ── Idempotent-create helper ─────────────────────────────────────────── */

function idempotentCreate(
  request: Request | NextRequest,
  build: () => unknown,
): Response {
  const key = request.headers.get("idempotency-key")
  if (!key) return missingIdempotencyKey()

  const cached = idempotencyStore.get(key)
  if (cached) return envelope(cached.body, 200)

  const body = build()
  idempotencyStore.set(key, { body, status: 201 })
  return envelope(body, 201)
}

function requireIdempotencyKey<T>(
  request: Request | NextRequest,
  serve: () => T,
): Response {
  const key = request.headers.get("idempotency-key")
  if (!key) return missingIdempotencyKey()
  return envelope(serve(), 200)
}

/* ── Onramp order poll advancement (§11 lifecycle) ────────────────────── */

function advancedOnrampOrder(): FiatOrder {
  const id = FIAT_ORDER_ONSWITCH_ONRAMP.id
  const count = (orderPollCount.get(id) ?? 0) + 1
  orderPollCount.set(id, count)
  if (count >= 3) return freshenOnrampOrder(FIAT_ORDER_ONSWITCH_ONRAMP_COMPLETED)
  if (count === 2) return freshenOnrampOrder(FIAT_ORDER_ONSWITCH_ONRAMP_PROVIDER_PROCESSING)
  return freshenOnrampOrder(FIAT_ORDER_ONSWITCH_ONRAMP)
}

/* ── Router ───────────────────────────────────────────────────────────── */

export async function respondFromFiatFixtures(
  request: Request | NextRequest,
  path: string,
): Promise<Response | null> {
  const method = request.method.toUpperCase()

  // §5
  if (method === "GET" && path === "fiat/config") {
    return envelope(freshenConfig(FIAT_CONFIG_AVAILABLE))
  }

  // §7 compliance
  if (method === "GET" && path === "fiat/compliance") {
    const records = onswitchCustomerCreated
      ? [...cloneJson(FIAT_COMPLIANCE_LIST), cloneJson(FIAT_CUSTOMER_ONSWITCH)]
      : cloneJson(FIAT_COMPLIANCE_LIST)
    return envelope(records)
  }
  if (method === "POST" && path === "fiat/compliance/customer") {
    // DERIVED — not a guide example (guide §7 shows no response body for
    // POST /fiat/compliance/customer). When the request declares
    // `provider: "onswitch"` the mock returns the DERIVED
    // FIAT_CUSTOMER_ONSWITCH record; otherwise the verbatim §7 Bridge
    // record. See FIAT_CUSTOMER_ONSWITCH in ./__fixtures__/fiat.ts.
    const body = await readJson(request)
    const provider = String(body.provider ?? "bridge")
    if (provider === "onswitch") onswitchCustomerCreated = true
    const record = provider === "onswitch"
      ? cloneJson(FIAT_CUSTOMER_ONSWITCH)
      : cloneJson(FIAT_COMPLIANCE_LIST[0])
    return idempotentCreate(request, () => record)
  }
  if (method === "POST" && path === "fiat/compliance/bridge/kyc-link") {
    return idempotentCreate(request, () => cloneJson(FIAT_BRIDGE_KYC_LINK_RESPONSE))
  }
  if (method === "POST" && path === "fiat/compliance/bridge/sync") {
    // Guide §6.2 route table: idempotency "No" for this endpoint, so we
    // do not enforce the header.
    return envelope(cloneJson(FIAT_BRIDGE_SYNC_RESPONSE))
  }

  // §8 institutions and beneficiaries
  if (method === "GET" && path === "fiat/institutions") {
    return envelope(cloneJson(FIAT_INSTITUTIONS_NG_NGN_BANK))
  }
  if (method === "GET" && path === "fiat/beneficiary-requirements") {
    return envelope(cloneJson(FIAT_BENEFICIARY_REQUIREMENTS_NG_BANK))
  }
  if (method === "GET" && path === "fiat/beneficiaries") {
    return envelope(cloneJson([...FIAT_BENEFICIARIES_LIST, FIAT_BENEFICIARY_BRIDGE_USD]))
  }
  if (method === "POST" && path === "fiat/beneficiaries") {
    return idempotentCreate(request, () => cloneJson(FIAT_BENEFICIARIES_LIST[0]))
  }
  if (method === "DELETE" && /^fiat\/beneficiaries\/[^/]+$/.test(path)) {
    // DERIVED — not a guide example. Guide §8 shows the DELETE header
    // pattern for beneficiary deactivation but no response body. The
    // mock returns { success: true, data: null } with a fresh requestId
    // to keep the §4 envelope shape without inventing beneficiary
    // fields. Idempotency-Key required per the §6.2 route table.
    return requireIdempotencyKey(request, () => null)
  }

  // §9 quotes and orders
  if (method === "POST" && path === "fiat/quotes") {
    const body = await readJson(request)
    const direction = String(body.direction ?? "onramp")
    const quote = direction === "offramp" ? FIAT_QUOTE_OFFRAMP : FIAT_QUOTE_ONRAMP
    return idempotentCreate(request, () => freshenQuote(quote))
  }
  if (method === "GET" && /^fiat\/quotes\/[^/]+$/.test(path)) {
    return envelope(freshenQuote(FIAT_QUOTE_ONRAMP))
  }
  if (method === "POST" && path === "fiat/orders") {
    const body = await readJson(request)
    const provider = String(body.provider ?? "onswitch")
    if (provider === "bridge") {
      return idempotentCreate(request, () => freshenOfframpOrder(FIAT_ORDER_BRIDGE_WITHDRAWAL))
    }
    if (body.beneficiaryId) {
      return idempotentCreate(request, () => freshenOfframpOrder(FIAT_ORDER_ONSWITCH_OFFRAMP))
    }
    return idempotentCreate(request, () => freshenOnrampOrder(FIAT_ORDER_ONSWITCH_ONRAMP))
  }
  if (method === "GET" && path === "fiat/orders") {
    return envelope([
      freshenOnrampOrder(FIAT_ORDER_ONSWITCH_ONRAMP),
      freshenOfframpOrder(FIAT_ORDER_ONSWITCH_OFFRAMP),
      freshenOfframpOrder(FIAT_ORDER_BRIDGE_WITHDRAWAL),
    ])
  }
  if (method === "GET" && /^fiat\/orders\/[^/]+$/.test(path)) {
    const id = decodeURIComponent(path.split("/")[2] ?? "")
    if (id === FIAT_ORDER_ONSWITCH_ONRAMP.id) return envelope(advancedOnrampOrder())
    if (id === FIAT_ORDER_ONSWITCH_OFFRAMP.id) return envelope(freshenOfframpOrder(FIAT_ORDER_ONSWITCH_OFFRAMP))
    if (id === FIAT_ORDER_BRIDGE_WITHDRAWAL.id) return envelope(freshenOfframpOrder(FIAT_ORDER_BRIDGE_WITHDRAWAL))
    return errorEnvelope({ code: "NOT_FOUND", message: "Unknown order id" }, 404)
  }
  if (method === "POST" && /^fiat\/orders\/[^/]+\/confirm$/.test(path)) {
    // DERIVED — not a guide example. Guide §9.3 says confirm "returns
    // the updated order" but shows no body. The mock returns the §9.2
    // offramp fixture with state advanced to "crypto_submitted" (from
    // the §11 lifecycle table). Idempotency-Key required per the §6.2
    // route table, and MUST be different from the order-creation key
    // (guide §3.3, §11) — the mock does not police that; the CP2
    // idempotency manager will.
    return requireIdempotencyKey(request, () => ({
      ...freshenOfframpOrder(FIAT_ORDER_ONSWITCH_OFFRAMP),
      state: "crypto_submitted",
    }))
  }

  // §10 Bridge USD
  if (method === "POST" && path === "fiat/bridge/virtual-accounts") {
    return idempotentCreate(request, () => freshenVirtualAccount(FIAT_BRIDGE_VIRTUAL_ACCOUNT))
  }
  if (method === "GET" && path === "fiat/bridge/virtual-accounts") {
    return envelope([freshenVirtualAccount(FIAT_BRIDGE_VIRTUAL_ACCOUNT)])
  }
  if (method === "GET" && /^fiat\/bridge\/virtual-accounts\/[^/]+\/activity$/.test(path)) {
    return envelope(freshenActivity(FIAT_BRIDGE_VIRTUAL_ACCOUNT_ACTIVITY))
  }
  if (method === "GET" && /^fiat\/bridge\/virtual-accounts\/[^/]+$/.test(path)) {
    return envelope(freshenVirtualAccount(FIAT_BRIDGE_VIRTUAL_ACCOUNT))
  }

  return null
}

async function readJson(request: Request | NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.clone().json()) as Record<string, unknown>
  } catch {
    return {}
  }
}
