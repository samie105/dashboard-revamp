# Plan: Flutterwave Standard Payment Integration

> Replacing GlobalPay with Flutterwave hosted checkout for fiat-to-USDT deposits.

## Architectural Decisions

- **Payment flow**: Flutterwave Standard (hosted checkout). User is redirected to Flutterwave's payment page, chooses payment method (card, bank transfer, mobile money, USSD), and pays.
- **Currencies**: NGN (Nigerian Naira), GHS (Ghanaian Cedi).
- **Networks**: Solana, Ethereum. Tron is **not** supported in this phase.
- **USDT delivery**: **Manual**. Webhook marks deposit as `payment_confirmed`. Admin manually sends USDT and updates status to `completed`.
- **Webhook security**: HMAC-SHA256 signature verification via `flutterwave-signature` header.
- **API re-verification**: Every webhook calls `GET /charges/{id}` before updating deposit status.
- **Idempotency**: A user can only have **one** pending deposit at a time. `tx_ref` is unique per deposit.
- **No BVN/NIN**: Using standard checkout — no virtual accounts, no KYC documents required.
- **No GlobalPay**: Complete removal. No migration period, no parallel support.
- **Environment**: Production-ready code. Test via Flutterwave sandbox/test keys.

---

## Phase 1: Flutterwave Shared Layer

**What to build**

Create the shared Flutterwave HTTP client and webhook utilities. No user-facing changes.

**Files**

- `lib/flutterwave/config.ts` — Base URLs, timeouts, retry config.
- `lib/flutterwave/client.ts` — Authenticated HTTP client with Bearer token, 3x retry, exponential backoff, 30s timeout.
- `lib/flutterwave/webhook.ts` — HMAC-SHA256 signature verification, payload extraction, status normalization.

**Acceptance criteria**

- [ ] `FLUTTERWAVE_SECRET_KEY` and `FLUTTERWAVE_WEBHOOK_SECRET_HASH` are server-only env vars.
- [ ] Client retries on 5xx, fails fast on 4xx (except 429).
- [ ] `verifyWebhookSignature(rawBody, signature, secret)` returns boolean.
- [ ] `normalizeFlutterwaveStatus(status)` handles `"successful"`, `"succeeded"`, `"completed"`, `"failed"`, `"pending"`, `"cancelled"`.
- [ ] `.env.example` updated: Flutterwave vars added, GlobalPay vars removed.

---

## Phase 2: Deposit Initiation (Standard Checkout)

**What to build**

Rewrite `POST /api/deposit/initiate` to create a Flutterwave standard payment.

**Flow**

1. Authenticate via Clerk.
2. Validate: amount 1–5000 USDT, currency is NGN or GHS, network is solana or ethereum, wallet exists.
3. Fetch rate from CoinGecko (NGN/USD or GHS/USD). If CoinGecko fails, use hardcoded fallback rates (logged as warning).
4. **Idempotency check**: Query for user's pending deposit (`status: { $in: ["pending", "awaiting_verification", "verifying"] }`). If found, return existing deposit + checkout URL.
5. Call `POST /charges` (Flutterwave) with:
   - `tx_ref`: `WS-DEP-{timestamp}-{uuid}`
   - `amount`: fiat amount
   - `currency`: NGN or GHS
   - `redirect_url`: `/deposit?depositId={id}`
   - `customer`: `{ email, name }`
6. **Only after successful Flutterwave response**: Save deposit record with `flutterwaveChargeId`, `flutterwaveReference` (tx_ref), `checkoutUrl`.
7. Return deposit + `checkoutUrl` to client.

**Edge case mitigations**

- **Double-click race condition**: Use `findOneAndUpdate` with `$setOnInsert` or a unique compound index on `userId + status` for pending statuses. Alternatively, wrap steps 4–6 in a MongoDB transaction.
- **Flutterwave API failure**: If `POST /charges` fails, do NOT save a deposit record. Return 502 to client.
- **No name in Clerk**: Fallback to `"WorldStreet"` / `"Customer"` for `customer.name`.
- **GHS rate missing from CoinGecko**: Hardcoded fallback `GHS: 15.5` (update periodically). Log warning.

**Files**

- `app/api/deposit/initiate/route.ts` — Replace GlobalPay with Flutterwave.
- `models/Deposit.ts` — Add `flutterwaveChargeId`, `flutterwaveReference`, `paymentProvider`. Remove active GlobalPay usage (keep old fields in schema for existing records but don't populate).

**Acceptance criteria**

- [ ] Initiate returns a Flutterwave checkout URL.
- [ ] User can only have one pending deposit at a time (idempotency via DB check).
- [ ] If Flutterwave API fails, no deposit record is saved.
- [ ] Tron is rejected with clear error.
- [ ] USD/GBP are rejected with clear error (only NGN/GHS supported).
- [ ] CoinGecko fallback rates work if API is down.
- [ ] Double-click creates only one deposit (race condition handled).

---

## Phase 3: Secure Webhook

**What to build**

Rewrite `POST /api/deposit/webhook` to handle Flutterwave callbacks securely.

**Flow**

1. Read raw body (use `request.text()`, then `JSON.parse()` manually — do NOT use `request.json()` which consumes the stream).
2. Verify `flutterwave-signature` header with HMAC-SHA256. Reject if invalid (401).
   - In development (`NODE_ENV !== "production"`), warn and accept if secret hash is missing.
3. Parse payload. Extract `data.id` (charge ID), `id` (webhook event ID).
4. **Filter by prefix**: Check `data.reference` starts with `WS-DEP-`. If not, return 200 (ignore non-deposit events).
5. Idempotency check: if `webhookEventId` already processed, return 200.
6. Find deposit by `flutterwaveChargeId` or `flutterwaveReference`.
7. If deposit not found, return 404 (Flutterwave will retry).
8. **Re-verify**: Call `GET /charges/{id}` to confirm status.
9. Validate amount/currency with **tolerance**: `Math.abs(charge.amount - deposit.fiatAmount) <= 1.0`.
10. Normalize status via `normalizeFlutterwaveStatus()`.
11. If `status === "successful"`:
    - Update deposit to `payment_confirmed`.
    - Record `webhookEventId`, `webhookProcessedAt`.
    - Return 200.
12. If `status === "failed"`: update to `payment_failed`.
13. If pending: return 200 (no status change).

**Edge case mitigations**

- **Webhook arrives before deposit is saved**: Return 404. Flutterwave retries.
- **Duplicate webhook**: `webhookEventId` deduplication prevents double-processing.
- **Amount mismatch**: Log error with deposit ID, expected vs actual. Return 400. Do not update status.
- **Webhook for non-deposit charge**: Filter by `tx_ref` prefix `WS-DEP-`.
- **Webhook without signature in dev**: Accept with warning if `FLUTTERWAVE_WEBHOOK_SECRET_HASH` is missing and `NODE_ENV !== "production"`.
- **Long-running tasks**: Keep webhook handler fast. Since USDT delivery is manual, just update status and return 200.

**Files**

- `app/api/deposit/webhook/route.ts` — Replace GlobalPay webhook.

**Acceptance criteria**

- [ ] Invalid signature returns 401.
- [ ] Duplicate webhook returns 200 without double-processing.
- [ ] Every successful webhook re-verifies via `GET /charges/{id}`.
- [ ] Amount/currency mismatch logs error and returns 400 (does not update status).
- [ ] Deposit stops at `payment_confirmed` — no auto-USDT delivery.
- [ ] Non-deposit webhooks are ignored (filtered by `tx_ref` prefix).
- [ ] Webhook responds within 60 seconds.
- [ ] Missing deposit returns 404 (triggers Flutterwave retry).

---

## Phase 4: Manual Verification (Fallback)

**What to build**

Rewrite `POST /api/deposit/verify` for users to manually check payment status.

**Flow**

1. Authenticate via Clerk.
2. Validate `depositId`.
3. If deposit has no `flutterwaveChargeId`, return "Payment still processing. Please wait."
4. Call `GET /charges/{id}`.
5. Validate amount/currency with tolerance (`<= 1.0`).
6. Normalize status.
7. Update status: `payment_confirmed`, `payment_failed`, or `awaiting_verification`.

**Edge case mitigations**

- **User clicks verify before webhook arrives**: Clear message explaining the payment is still processing.
- **Amount mismatch on verify**: Log error, return message to contact support.
- **Charge not found on Flutterwave**: Return "Payment not found. Please try again later."

**Files**

- `app/api/deposit/verify/route.ts` — Replace GlobalPay query.
- `components/deposit/deposit-client.tsx` — "I've Paid" button triggers verify. Auto-poll status every 10s while pending.

**Acceptance criteria**

- [ ] Verify calls Flutterwave `GET /charges/{id}`.
- [ ] Returns clear message if no charge exists yet ("Please wait for the webhook...").
- [ ] Successful verification transitions deposit to `payment_confirmed`.
- [ ] Failed verification transitions to `payment_failed`.
- [ ] Pending verification transitions to `awaiting_verification`.
- [ ] Amount/currency mismatch is detected and logged.
- [ ] Frontend auto-polls every 10s while pending.
- [ ] Frontend shows "Verifying..." spinner during manual verify.

---

## Phase 5: Deposit Status, History, Cancel

**What to build**

Update supporting routes to work with Flutterwave deposits.

**Files**

- `app/api/deposit/status/[id]/route.ts` — No structural changes.
- `app/api/deposit/pending/route.ts` — No structural changes.
- `app/api/deposit/history/route.ts` — Add pagination (`?page`, `?limit`).
- `app/api/deposit/status/[id]` (PATCH cancel) — Cancel pending deposits.
- `components/dashboard/pending-deposit.tsx` — Show deposit status.

**Edge case mitigations**

- **Old GlobalPay deposits in history**: UI handles missing `flutterwaveChargeId` gracefully.
- **Cancel after webhook already processed**: Check status before allowing cancel. Only `pending`/`awaiting_verification` can be cancelled.

**Acceptance criteria**

- [ ] History supports pagination.
- [ ] Cancel works for pending Flutterwave deposits.
- [ ] Cancel rejected if deposit is already `payment_confirmed` or beyond.
- [ ] Dashboard widget shows correct status.
- [ ] History UI handles old GlobalPay deposits (missing Flutterwave fields).

---

## Phase 6: Frontend Update

**What to build**

Update `deposit-client.tsx` to use Flutterwave checkout URL.

**Changes**

- Network selector: Solana, Ethereum only.
- Currency selector: NGN, GHS only.
- Payment step: "Pay via Flutterwave" button redirects to checkout URL (**same tab**, not new tab — avoids popup blockers).
- After redirect back: auto-detect `?depositId=` in URL and resume deposit.
- Status polling while pending.
- **Handle all terminal statuses on mount**: If deposit is already `payment_confirmed`, `payment_failed`, `completed`, or `cancelled`, show the appropriate state immediately (don't assume it's always `pending` on redirect).

**Edge case mitigations**

- **Popup blocker**: Use `window.location.href = checkoutUrl` (same-tab redirect) instead of `window.open`.
- **Redirect back to already-completed deposit**: Frontend detects `payment_confirmed` on mount and shows "Payment confirmed — awaiting USDT delivery" state.
- **Redirect back to failed deposit**: Shows "Payment failed" with retry option.
- **User hits back button after paying**: Frontend polls and detects updated status.
- **Checkout URL expiry**: If user returns after a long time and deposit is still `pending`, show "Payment session expired. Start a new deposit." (offer cancel + new initiate).

**Files**

- `components/deposit/deposit-client.tsx`
- `app/deposit/page.tsx`

**Acceptance criteria**

- [ ] Checkout redirects in same tab (no popup blocker issues).
- [ ] Redirect back to `/deposit?depositId=xxx` resumes the deposit.
- [ ] Handles `payment_confirmed` on redirect (shows confirmation, not stuck on pending).
- [ ] Handles `payment_failed` on redirect (shows failure, offers retry).
- [ ] No Tron option in UI.
- [ ] No USD/GBP option in UI.
- [ ] Expired checkout sessions show clear message and offer new deposit.

---

## Phase 7: Cleanup & Go-Live

**What to build**

Remove all GlobalPay code. Ensure production readiness.

**Files**

- `app/api/deposit/initiate/route.ts` — Remove GlobalPay constants and logic.
- `app/api/deposit/verify/route.ts` — Remove GlobalPay constants and logic.
- `app/api/deposit/webhook/route.ts` — Remove GlobalPay logic.
- `.env.example` — Remove `NEXT_PUBLIC_GLOBALPAY_API_KEY`.
- `middleware.ts` — Keep `/api/deposit/webhook` in webhook bypass.

**Acceptance criteria**

- [ ] No GlobalPay API calls remain.
- [ ] No `NEXT_PUBLIC_GLOBALPAY_API_KEY` references.
- [ ] Webhook URL registered in Flutterwave dashboard.
- [ ] Webhook secret hash configured in Flutterwave dashboard.
- [ ] Sandbox tests pass with test keys.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `FLUTTERWAVE_SECRET_KEY` | ✅ | API authentication (server-only) |
| `FLUTTERWAVE_WEBHOOK_SECRET_HASH` | ✅ | Webhook signature verification (server-only) |

**Removed**: `NEXT_PUBLIC_GLOBALPAY_API_KEY`

---

## Flutterwave API Usage

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /charges` | Initiate | Create standard payment, get checkout link |
| `GET /charges/{id}` | Verify | Re-verify charge status |

**Webhook**: `POST /api/deposit/webhook` — `charge.completed` event.

**Headers**: `Authorization: Bearer {FLUTTERWAVE_SECRET_KEY}`, `Content-Type: application/json`.

---

## Idempotency Rules

1. **One pending deposit per user**: Before creating a new deposit, check if user has a deposit in `pending`, `awaiting_verification`, or `verifying`. If yes, return the existing one.
2. **Unique `tx_ref`**: Every deposit has a unique `tx_ref`. Never reuse.
3. **Webhook deduplication**: Track `webhookEventId`. If seen before, return 200 immediately.

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Flutterwave API 5xx | Retry 3x with backoff |
| Flutterwave API 401 | Fail immediately |
| Invalid webhook signature | 401, log error |
| Duplicate webhook | 200, skip |
| Amount/currency mismatch | 400, log for manual review |
| User has pending deposit | Return existing deposit |
| Charge not found | 404, log error |
| CoinGecko API down | Use hardcoded fallback rate, log warning |
| No name in Clerk | Fallback to "WorldStreet Customer" |
| GHS rate missing | Use hardcoded fallback, log warning |

---

## Edge Cases & Mitigations

| # | Edge Case | Mitigation | Phase |
|---|-----------|------------|-------|
| 1 | **Double-click race condition** | Atomic DB check + insert; or MongoDB transaction | 2 |
| 2 | **Orphaned deposit (DB saved before API call)** | Call Flutterwave first, save deposit only on success | 2 |
| 3 | **Webhook arrives before deposit saved** | Return 404; Flutterwave retries | 3 |
| 4 | **Duplicate webhook events** | `webhookEventId` deduplication prevents double-processing | 3 |
| 5 | **Amount mismatch (user paid wrong amount)** | Tolerance check (`<= 1.0`); log error; return 400 | 3, 4 |
| 6 | **Webhook for non-deposit charge** | Filter by `tx_ref` prefix `WS-DEP-` | 3 |
| 7 | **Popup blocker prevents checkout** | Same-tab redirect (`window.location.href`) | 6 |
| 8 | **Redirect back to already-completed deposit** | Frontend handles all terminal statuses on mount | 6 |
| 9 | **Checkout URL expiry** | Show "Session expired" message; offer new deposit | 6 |
| 10 | **CoinGecko API down** | Hardcoded fallback rates (NGN, GHS) | 2 |
| 11 | **GHS rate missing from CoinGecko** | Hardcoded fallback; log warning | 2 |
| 12 | **No name in Clerk** | Fallback to "WorldStreet Customer" | 2 |
| 13 | **Webhook without signature in dev** | Accept with warning if `NODE_ENV !== "production"` | 3 |
| 14 | **Cancel after webhook already processed** | Reject cancel if status > `awaiting_verification` | 5 |
| 15 | **Old GlobalPay deposits in history** | UI handles missing Flutterwave fields gracefully | 5 |
| 16 | **User hits back button after paying** | Frontend polling detects updated status | 4, 6 |
| 17 | **Multiple simultaneous deposits** | One pending deposit per user enforced | 2 |
| 18 | **Flutterwave status variants** | `normalizeFlutterwaveStatus()` handles all known values | 1 |
| 19 | **Long-running webhook processing** | Keep handler fast; no async jobs needed (manual delivery) | 3 |
| 20 | **MongoDB connection failure during webhook** | Return 503; Flutterwave retries | 3 |
