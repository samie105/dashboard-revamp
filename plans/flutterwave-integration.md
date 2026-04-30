# Plan: Flutterwave Payment Integration (Replacing GlobalPay)

> Source PRD: Flutterwave Developer Docs (https://developer.flutterwave.com/docs) + Existing GlobalPay integration analysis

## Architectural decisions

Durable decisions that apply across all phases:

- **Payment provider**: Flutterwave v4 API (Pay With Bank Transfer — PWBT)
- **Auth**: Clerk for user auth; Flutterwave Bearer token (`FLUTTERWAVE_SECRET_KEY`) for API calls
- **Webhook security**: HMAC-SHA256 signature verification via `flutterwave-signature` header
- **API re-verification**: Every webhook calls `GET /charges/{id}` before giving value
- **Idempotency**: `X-Idempotency-Key` on all mutating Flutterwave API calls; `webhookEventId` deduplication
- **Routes**: `/api/deposit/*` (existing structure preserved; webhook bypasses auth)
- **Schema**: MongoDB with new `FlutterwaveCustomer` and `FlutterwaveVirtualAccount` models; `Deposit` model extended with Flutterwave fields
- **Key models**: `Deposit`, `FlutterwaveCustomer`, `FlutterwaveVirtualAccount`, `UserWallet`
- **Env vars**: `FLUTTERWAVE_SECRET_KEY` (server-only), `FLUTTERWAVE_WEBHOOK_SECRET_HASH` (server-only)
- **Network support**: Solana, Ethereum, Tron (fixes existing mismatch where UI shows Tron but API rejects it)
- **Customer KYC**: Flutterwave requires `customer` object with name + email; NGN accounts optionally require BVN/NIN
- **Virtual accounts**: Dynamic (one-time use, 1-hour expiry) per deposit
- **Rate source**: CoinGecko (unchanged) with 5% platform markup
- **USDT delivery**: Admin backend treasury service (unchanged architecture)

---

## Phase 1: Flutterwave Infrastructure & Shared Layer

**User stories**: N/A (foundational — enables all subsequent phases)

### What to build

Create the shared Flutterwave integration layer: HTTP client with auth, retries, idempotency, and idempotent key generation. Add the three new MongoDB models (`FlutterwaveCustomer`, `FlutterwaveVirtualAccount`, and extended `Deposit`). Set up server-only environment variables. No user-facing changes yet.

This phase establishes the contract between the app and Flutterwave's v4 API, including sandbox vs. production base URL switching, exponential backoff retry logic, and proper error classification (4xx = fail fast, 5xx = retry).

### Acceptance criteria

- [ ] `lib/flutterwave/config.ts` exists with base URLs, timeouts, retry config
- [ ] `lib/flutterwave/client.ts` exists with Bearer auth, `X-Idempotency-Key`, 3x retry with exponential backoff, 30s timeout
- [ ] `lib/flutterwave/customer.ts` wraps `POST /customers` and `GET /customers/{id}`
- [ ] `lib/flutterwave/virtual-account.ts` wraps `POST /virtual-accounts` (dynamic only)
- [ ] `lib/flutterwave/verify.ts` wraps `GET /charges/{id}` and `GET /charges?virtual_account_id={id}`
- [ ] `lib/flutterwave/webhook.ts` provides HMAC-SHA256 signature verification and payload extraction utilities
- [ ] `models/FlutterwaveCustomer.ts` exists with `clerkUserId`, `flutterwaveCustomerId`, name, email, optional BVN/NIN
- [ ] `models/FlutterwaveVirtualAccount.ts` exists with `depositId`, `flutterwaveVirtualAccountId`, account details, expiry
- [ ] `models/Deposit.ts` extended with `flutterwaveChargeId`, `flutterwaveReference`, `flutterwaveVirtualAccountId`, `virtualAccountNumber`, `virtualAccountBank`, `virtualAccountExpiry`, `webhookEventId`, `webhookProcessedAt`
- [ ] `.env.example` updated: `FLUTTERWAVE_SECRET_KEY` and `FLUTTERWAVE_WEBHOOK_SECRET_HASH` added; `NEXT_PUBLIC_GLOBALPAY_API_KEY` marked deprecated
- [ ] All new files have TypeScript types and follow existing project patterns (e.g., `connectDB`, `NextResponse`)
- [ ] Unit tests for `verifyWebhookSignature` (valid signature, invalid signature, missing signature)

---

## Phase 2: Deposit Initiation with Virtual Accounts

**User stories**: 
- As a user, I want to deposit fiat (NGN) and receive USDT on my chosen blockchain.
- As a user, I want to see a unique bank account number to transfer to, instead of being redirected to an external checkout page.

### What to build

Rewrite `POST /api/deposit/initiate` to use Flutterwave instead of GlobalPay. The flow becomes:

1. Authenticate user via Clerk
2. Validate inputs (amount 1–5000 USDT, valid network, wallet exists)
3. Fetch exchange rate from CoinGecko
4. Get or create a Flutterwave customer (`POST /customers` with user's name + email)
5. Create a dynamic virtual account (`POST /virtual-accounts` with exact fiat amount, 1-hour expiry)
6. Save deposit record with virtual account details
7. Return deposit + virtual account info (bank name, account number, amount, expiry) to the client

The frontend `deposit-client.tsx` is updated to display the virtual account details (bank name, account number, exact amount to transfer, expiry timer) instead of opening an external checkout URL. The user copies the account number and initiates the transfer from their own banking app.

### Acceptance criteria

- [ ] `POST /api/deposit/initiate` creates a Flutterwave customer on first deposit, reuses existing customer on subsequent deposits
- [ ] Dynamic virtual account is created with exact `fiatAmount`, `currency: "NGN"`, 1-hour expiry
- [ ] Deposit record saved with all Flutterwave fields populated
- [ ] Response includes `virtualAccount: { accountNumber, accountBankName, amount, currency, expiryDate, note }`
- [ ] Frontend displays virtual account details in a copy-friendly card
- [ ] Frontend shows expiry countdown timer
- [ ] Frontend no longer opens external checkout URLs
- [ ] Tron network is accepted (fixes existing API validation bug)
- [ ] Error handling: if Flutterwave customer creation fails, return 502 with clear message
- [ ] Error handling: if virtual account creation fails, no deposit record is persisted
- [ ] Idempotency: duplicate `initiate` calls with same reference return the same virtual account (via `X-Idempotency-Key`)

---

## Phase 3: Secure Webhook with Signature Verification

**User stories**:
- As a platform, I want to ensure webhook callbacks are authentic and not spoofed.
- As a platform, I want to prevent duplicate webhook events from double-crediting users.

### What to build

Rewrite `POST /api/deposit/webhook` with full security:

1. Read raw request body for signature verification
2. Verify `flutterwave-signature` header using HMAC-SHA256 + `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
3. Reject requests with invalid/missing signatures (return 401)
4. Parse payload and extract `charge.id` and webhook event `id`
5. Check idempotency: if `webhookEventId` already processed, return 200 immediately
6. Find deposit by `flutterwaveChargeId` or `flutterwaveReference`
7. **CRITICAL**: Call `GET /charges/{id}` to re-verify the charge before giving value
8. Validate `charge.amount === deposit.fiatAmount` and `charge.currency === deposit.fiatCurrency`
9. Update deposit status: `payment_confirmed` → `sending_usdt`
10. Record `webhookEventId` and `webhookProcessedAt`

Also update `middleware.ts` to ensure `/api/deposit/webhook` remains in the webhook bypass list (already exists, verify it stays).

### Acceptance criteria

- [ ] Webhook rejects requests without `flutterwave-signature` header (401)
- [ ] Webhook rejects requests with invalid signature (401)
- [ ] Webhook accepts valid signatures and processes the charge
- [ ] Duplicate webhook events (same `id`) are idempotently handled (200, no double processing)
- [ ] Every webhook calls `GET /charges/{id}` before updating deposit status
- [ ] Amount/currency mismatch returns 400 and logs error for manual review
- [ ] Deposit status transitions: `pending` → `payment_confirmed` → `sending_usdt`
- [ ] `webhookEventId` and `webhookProcessedAt` are persisted
- [ ] Webhook responds within 60 seconds (Flutterwave timeout requirement)
- [ ] Long-running USDT delivery is dispatched asynchronously (not awaited in webhook response)

---

## Phase 4: User-Initiated Verification (Poll Fallback)

**User stories**:
- As a user, I want to manually verify my payment if the webhook is delayed or missed.
- As a user, I want clear feedback on whether my bank transfer was received.

### What to build

Rewrite `POST /api/deposit/verify` to use Flutterwave's charge verification API:

1. Authenticate user via Clerk
2. Validate `depositId`
3. Check deposit is in a verifiable state (`pending`, `awaiting_verification`, `payment_failed`)
4. If no `flutterwaveChargeId` exists yet, return message asking user to wait for webhook
5. Call `GET /charges/{id}` to get authoritative status
6. Validate amount and currency match
7. Update deposit status accordingly (`payment_confirmed`, `payment_failed`, or `awaiting_verification`)
8. Return updated deposit with user-friendly message

Update the frontend "I've Paid" button to trigger this verification. Add a polling mechanism on the payment step that auto-refreshes status every 10 seconds while the deposit is in `pending` or `awaiting_verification`.

### Acceptance criteria

- [ ] `POST /api/deposit/verify` calls `GET /charges/{id}` via Flutterwave API
- [ ] Returns clear message if no charge exists yet ("Please wait for the webhook...")
- [ ] Successful verification transitions deposit to `payment_confirmed` → `sending_usdt`
- [ ] Failed verification transitions to `payment_failed`
- [ ] Pending verification transitions to `awaiting_verification`
- [ ] Amount/currency mismatch is detected and logged
- [ ] Frontend auto-polls deposit status every 10 seconds while in `pending`/`awaiting_verification`
- [ ] Frontend shows "Verifying..." spinner during manual verify
- [ ] Frontend handles all status transitions gracefully

---

## Phase 5: Deposit Status, History & Cancellation

**User stories**:
- As a user, I want to see my deposit history and current status.
- As a user, I want to cancel a pending deposit if I haven't paid yet.

### What to build

Update existing routes to work with Flutterwave deposits:

- `GET /api/deposit/status/[id]` — no structural changes; returns deposit with Flutterwave fields
- `GET /api/deposit/pending` — no structural changes; filters on Flutterwave deposit statuses
- `GET /api/deposit/history` — add pagination support (`?page` and `?limit` query params)
- `PATCH /api/deposit/status/[id]` (cancel) — ensure cancellation works for `pending` Flutterwave deposits; optionally close the virtual account via Flutterwave API if supported

Update `components/dashboard/pending-deposit.tsx` to show Flutterwave virtual account details in the dashboard widget.

### Acceptance criteria

- [ ] `GET /api/deposit/status/[id]` returns deposit with all Flutterwave fields
- [ ] `GET /api/deposit/pending` returns the most recent in-progress Flutterwave deposit
- [ ] `GET /api/deposit/history` supports `?page` and `?limit` query params (default: page 1, limit 20)
- [ ] `PATCH /api/deposit/status/[id]` with `action: "cancel"` works for `pending` Flutterwave deposits
- [ ] Cancelled deposits cannot be reactivated
- [ ] Dashboard pending deposit widget shows virtual account number and bank name
- [ ] Deposit history list shows Flutterwave-specific status labels
- [ ] All existing deposit statuses remain valid for backward compatibility

---

## Phase 6: Testing, Observability & Go-Live

**User stories**:
- As a developer, I want to test payment flows in sandbox before going live.
- As an operator, I want to monitor payment success rates and detect issues.

### What to build

1. **Sandbox testing**: Use `X-Scenario-Key: issuer:approved` and `issuer:failed` headers to simulate success/failure in Flutterwave sandbox
2. **Integration tests**: End-to-end tests for initiate → webhook → verify flow
3. **Monitoring**: Add structured logging to all Flutterwave API calls (request ID, latency, status code)
4. **Alerts**: Log webhook failures, signature mismatches, and amount mismatches with high severity
5. **Dashboard**: Add a simple admin view (or log-based) to track Flutterwave deposit metrics
6. **Go-live checklist**: Verify production credentials, webhook URL registration in Flutterwave dashboard, secret hash configuration

### Acceptance criteria

- [ ] Sandbox tests pass for successful deposit flow (`issuer:approved`)
- [ ] Sandbox tests pass for failed deposit flow (`issuer:failed`)
- [ ] Webhook signature verification tested with valid and invalid signatures
- [ ] Duplicate webhook idempotency tested
- [ ] Amount mismatch scenario tested and handled correctly
- [ ] All Flutterwave API calls log structured data (endpoint, latency, status, error if any)
- [ ] Webhook errors log with `console.error` for alerting integration
- [ ] Production `FLUTTERWAVE_SECRET_KEY` and `FLUTTERWAVE_WEBHOOK_SECRET_HASH` are configured
- [ ] Webhook URL is registered in Flutterwave dashboard
- [ ] Webhook retries are enabled in Flutterwave dashboard
- [ ] Old GlobalPay env vars are removed from production
- [ ] Runbook exists for manual intervention (e.g., stuck deposits, webhook failures)

---

## Phase 7: GlobalPay Deprecation & Cleanup

**User stories**:
- As a platform, I want to cleanly remove GlobalPay without breaking existing deposits.

### What to build

1. Add `paymentProvider` field to `Deposit` model (`"globalpay" | "flutterwave"`) for new deposits
2. Backfill existing deposits with `paymentProvider: "globalpay"`
3. Remove GlobalPay API calls from `initiate`, `verify`, and `webhook` routes
4. Remove `NEXT_PUBLIC_GLOBALPAY_API_KEY` from all environments
5. Archive or delete `lib/` GlobalPay utilities if any exist
6. Update documentation and runbooks

### Acceptance criteria

- [ ] All new deposits have `paymentProvider: "flutterwave"`
- [ ] Existing GlobalPay deposits remain queryable and viewable in history
- [ ] GlobalPay API calls removed from all routes
- [ ] `NEXT_PUBLIC_GLOBALPAY_API_KEY` removed from `.env.example` and all environments
- [ ] No GlobalPay references remain in active code paths
- [ ] Deposit history correctly displays both GlobalPay and Flutterwave deposits
- [ ] Migration script run to backfill `paymentProvider` on existing records

---

## Appendix: File Inventory

### New files to create

| File | Phase |
|------|-------|
| `lib/flutterwave/config.ts` | 1 |
| `lib/flutterwave/client.ts` | 1 |
| `lib/flutterwave/customer.ts` | 1 |
| `lib/flutterwave/virtual-account.ts` | 1 |
| `lib/flutterwave/verify.ts` | 1 |
| `lib/flutterwave/webhook.ts` | 1 |
| `models/FlutterwaveCustomer.ts` | 1 |
| `models/FlutterwaveVirtualAccount.ts` | 1 |

### Files to modify

| File | Phase | Change |
|------|-------|--------|
| `models/Deposit.ts` | 1 | Add Flutterwave fields |
| `.env.example` | 1 | Add Flutterwave vars, deprecate GlobalPay |
| `app/api/deposit/initiate/route.ts` | 2 | Replace GlobalPay with Flutterwave |
| `components/deposit/deposit-client.tsx` | 2 | Show virtual account instead of checkout URL |
| `app/api/deposit/webhook/route.ts` | 3 | Add signature verification, API re-verification, idempotency |
| `app/api/deposit/verify/route.ts` | 4 | Replace GlobalPay query with Flutterwave charge verify |
| `components/deposit/deposit-client.tsx` | 4 | Auto-poll status, manual verify button |
| `app/api/deposit/history/route.ts` | 5 | Add pagination |
| `components/dashboard/pending-deposit.tsx` | 5 | Show virtual account details |
| `middleware.ts` | 3 | Verify webhook bypass (no change likely needed) |
| All deposit API routes | 6 | Add structured logging |
| `models/Deposit.ts` | 7 | Add `paymentProvider` field |
| All modified routes | 7 | Remove GlobalPay code paths |

---

## Appendix: Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Webhook signature verification misconfigured | Medium | High | Test with invalid signatures in sandbox; log all verification failures |
| Flutterwave API downtime during deposit | Low | High | Retry with backoff; user can manually verify later |
| Virtual account expiry before user pays | Medium | Medium | 1-hour expiry with clear UI countdown; user can initiate new deposit |
| Duplicate webhook events | Medium | High | `webhookEventId` deduplication; idempotent status transitions |
| Amount mismatch (user sends wrong amount) | Low | High | Validate `charge.amount === deposit.fiatAmount`; manual review queue |
| BVN/NIN required for NGN virtual accounts | Medium | Medium | Collect during onboarding or prompt at first deposit; allow retry |
| Clerk user has no firstName/lastName | Low | Medium | Fallback to "WorldStreet Customer" |
| Existing GlobalPay deposits in flight during cutover | Low | High | Phase 7: keep GlobalPay webhook handler until all pending deposits resolve |

---

## Appendix: Flutterwave API Reference (Quick)

| Endpoint | Method | Purpose | Idempotency Key |
|----------|--------|---------|-----------------|
| `/customers` | POST | Create customer | `flw-customer-{email}` |
| `/customers/{id}` | GET | Get customer | N/A |
| `/virtual-accounts` | POST | Create virtual account | `flw-va-{reference}` |
| `/charges/{id}` | GET | Verify charge | N/A |
| `/charges` | GET | List charges | N/A |

**Headers on all requests**: `Authorization: Bearer {FLUTTERWAVE_SECRET_KEY}`, `Content-Type: application/json`, `Accept: application/json`

**Webhook**: `POST` to `/api/deposit/webhook` with `flutterwave-signature` header (HMAC-SHA256 of raw body)

**Webhook payload**: `{ id, timestamp, type: "charge.completed", data: { id, amount, currency, status, reference, customer, payment_method } }`
