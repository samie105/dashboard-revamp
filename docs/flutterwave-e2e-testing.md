# Flutterwave Integration — End-to-End Testing Guide

> Complete testing checklist for the Flutterwave deposit flow. Run these in order.

---

## Prerequisites

### 1. Environment Variables

Add these to your `.env.local`:

```env
# Flutterwave (Payment Provider)
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X  # Test secret key
FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_webhook_secret_hash                # From Flutterwave Dashboard → Settings → Webhooks

# Clerk (Authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# MongoDB
MONGODB_URI=mongodb+srv://...

# Privy (Wallet Custody)
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# Admin Backend (Treasury)
ADMIN_BACKEND_URL=https://...
ADMIN_BACKEND_API_KEY=...

# CoinGecko (Exchange Rates)
# No API key required for free tier

# RPC Endpoints
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_ETH_RPC=https://cloudflare-eth.com

# Node environment
NODE_ENV=development
```

**Where to get Flutterwave credentials:**
1. Sign up at [https://flutterwave.com](https://flutterwave.com)
2. Go to **Dashboard → Settings → API Keys**
3. Copy **Secret Key** (use test key for sandbox)
4. Go to **Settings → Webhooks**
5. Set webhook URL to `https://your-domain.com/api/deposit/webhook`
6. Copy **Webhook Secret Hash**

### 2. Test Cards (Flutterwave Sandbox)

| Card Number | CVV | Expiry | PIN | OTP | Result |
|---|---|---|---|---|---|
| `5531886652142950` | `564` | `09/32` | `3310` | `12345` | Success |
| `5399838383838381` | `470` | `10/31` | `3310` | `12345` | Success |
| `4187427415564246` | `828` | `09/32` | `3310` | `12345` | Success |
| `4556052704172643` | `899` | `01/31` | `3310` | `12345` | Declined |

### 3. Test Mobile Money (Ghana — GHS)

| Provider | Phone Number | OTP | Result |
|---|---|---|---|
| MTN | `0551234987` | `12345` | Success |
| Vodafone | `0501234987` | `12345` | Success |

---

## Test Suite

### Phase 1: Shared Layer Tests

#### 1.1 Config Loading
```bash
# Start dev server
npm run dev

# Test config is loaded correctly
curl http://localhost:3000/api/health  # if you have a health endpoint
```

**Verify:**
- [ ] `lib/flutterwave/config.ts` loads without errors
- [ ] `FLUTTERWAVE_BASE_URL` points to sandbox in development
- [ ] `FALLBACK_RATES` has NGN: 1580 and GHS: 15.5

#### 1.2 HTTP Client
```typescript
// In a test file or console
import { flutterwaveFetch } from "@/lib/flutterwave/client"

// Test authenticated GET
const response = await flutterwaveFetch("GET", "/charges/12345")
console.log(response)
```

**Verify:**
- [ ] Bearer token is attached correctly
- [ ] 3x retry with exponential backoff works
- [ ] 30s timeout is enforced
- [ ] Idempotency key is generated for POST requests

#### 1.3 Webhook Signature Verification
```bash
# Test with a known payload and secret
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: wrong_hash" \
  -d '{"event":"charge.completed","data":{"id":123}}'
```

**Verify:**
- [ ] Returns 401 with wrong signature
- [ ] Returns 200 with correct signature

---

### Phase 2: Deposit Initiation Tests

#### 2.1 Basic NGN Deposit
```bash
curl -X POST http://localhost:3000/api/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{
    "usdtAmount": 10,
    "fiatCurrency": "NGN",
    "network": "solana"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "deposit": {
    "_id": "...",
    "usdtAmount": 10,
    "fiatAmount": 16590,
    "fiatCurrency": "NGN",
    "network": "solana",
    "status": "pending",
    "paymentProvider": "flutterwave",
    "flutterwaveReference": "WS-DEP-..."
  },
  "checkoutUrl": "https://checkout.flutterwave.com/v3/hosted/pay/..."
}
```

**Verify:**
- [ ] Deposit created in MongoDB with `paymentProvider: "flutterwave"`
- [ ] `flutterwaveReference` starts with `WS-DEP-`
- [ ] `checkoutUrl` is a valid Flutterwave hosted checkout URL
- [ ] `fiatAmount` = `usdtAmount` × rate × 1.05 (5% fee)

#### 2.2 GHS Deposit
```bash
curl -X POST http://localhost:3000/api/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{
    "usdtAmount": 50,
    "fiatCurrency": "GHS",
    "network": "ethereum"
  }'
```

**Verify:**
- [ ] Deposit created with `fiatCurrency: "GHS"`
- [ ] `fiatAmount` calculated using GHS rate

#### 2.3 Invalid Currency (Should Fail)
```bash
curl -X POST http://localhost:3000/api/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{
    "usdtAmount": 10,
    "fiatCurrency": "USD",
    "network": "solana"
  }'
```

**Expected:** `400 Bad Request` — "Only NGN and GHS are supported"

#### 2.4 Invalid Network (Should Fail)
```bash
curl -X POST http://localhost:3000/api/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{
    "usdtAmount": 10,
    "fiatCurrency": "NGN",
    "network": "tron"
  }'
```

**Expected:** `400 Bad Request` — "Only solana and ethereum are supported"

#### 2.5 Double-Click / Duplicate Deposit (Idempotency)
```bash
# Run the same request twice rapidly
curl -X POST http://localhost:3000/api/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{"usdtAmount": 10, "fiatCurrency": "NGN", "network": "solana"}' &
curl -X POST http://localhost:3000/api/deposit/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{"usdtAmount": 10, "fiatCurrency": "NGN", "network": "solana"}' &
```

**Verify:**
- [ ] Only one deposit created
- [ ] Second request returns existing deposit or error

#### 2.6 Amount Bounds
```bash
# Too low (< 1)
curl -X POST ... -d '{"usdtAmount": 0.5, "fiatCurrency": "NGN", "network": "solana"}'
# Expected: 400 — "USDT amount must be between 1 and 5000"

# Too high (> 5000)
curl -X POST ... -d '{"usdtAmount": 5001, "fiatCurrency": "NGN", "network": "solana"}'
# Expected: 400 — "USDT amount must be between 1 and 5000"
```

---

### Phase 3: Webhook Tests

#### 3.1 Successful Payment Webhook

**Step 1:** Create a deposit (see 2.1)

**Step 2:** Complete payment on Flutterwave checkout using test card:
- Card: `5531886652142950`
- CVV: `564`
- Expiry: `09/32`
- PIN: `3310`
- OTP: `12345`

**Step 3:** Wait for webhook (or simulate):
```bash
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: CORRECT_HASH" \
  -d '{
    "event": "charge.completed",
    "data": {
      "id": 123456789,
      "tx_ref": "WS-DEP-xxx",
      "flw_ref": "FLW-MOCK-xxx",
      "amount": 16590,
      "currency": "NGN",
      "charged_amount": 16590,
      "status": "successful"
    }
  }'
```

**Verify in MongoDB:**
```bash
# Check deposit status
mongosh "your-mongodb-uri" --eval 'db.deposits.findOne({flutterwaveReference: "WS-DEP-xxx"})'
```

**Expected:**
- [ ] `status` changed to `"payment_confirmed"`
- [ ] `flutterwaveChargeId` set to webhook charge ID
- [ ] `webhookEventId` set
- [ ] `webhookProcessedAt` is a Date
- [ ] `updatedAt` is updated

#### 3.2 Failed Payment Webhook
```bash
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: CORRECT_HASH" \
  -d '{
    "event": "charge.completed",
    "data": {
      "id": 123456789,
      "tx_ref": "WS-DEP-xxx",
      "flw_ref": "FLW-MOCK-xxx",
      "amount": 16590,
      "currency": "NGN",
      "charged_amount": 16590,
      "status": "failed"
    }
  }'
```

**Verify:**
- [ ] `status` changed to `"payment_failed"`

#### 3.3 Invalid Signature (Should Reject)
```bash
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: wrong_hash" \
  -d '{"event":"charge.completed","data":{"id":123}}'
```

**Expected:** `401 Unauthorized` — "Invalid webhook signature"

#### 3.4 Duplicate Webhook (Idempotency)
```bash
# Send the same webhook twice
curl -X POST http://localhost:3000/api/deposit/webhook ...
curl -X POST http://localhost:3000/api/deposit/webhook ...
```

**Verify:**
- [ ] Second webhook returns 200 but does not re-process
- [ ] Deposit status does not change on second call

#### 3.5 Amount Mismatch (Tolerance Check)
```bash
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: CORRECT_HASH" \
  -d '{
    "event": "charge.completed",
    "data": {
      "id": 123456789,
      "tx_ref": "WS-DEP-xxx",
      "amount": 99999,
      "currency": "NGN",
      "charged_amount": 99999,
      "status": "successful"
    }
  }'
```

**Expected:** `400 Bad Request` — "Amount mismatch"

#### 3.6 Wrong Reference Prefix
```bash
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: CORRECT_HASH" \
  -d '{
    "event": "charge.completed",
    "data": {
      "tx_ref": "OTHER-PREFIX-xxx",
      "status": "successful"
    }
  }'
```

**Expected:** `200 OK` but ignored (not our transaction)

---

### Phase 4: Manual Verification Tests

#### 4.1 Verify Successful Charge
```bash
curl -X POST http://localhost:3000/api/deposit/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{
    "depositId": "YOUR_DEPOSIT_ID"
  }'
```

**Expected (if payment successful):**
```json
{
  "success": true,
  "status": "payment_confirmed",
  "deposit": { ... }
}
```

#### 4.2 Verify Failed Charge
**Expected:**
```json
{
  "success": true,
  "status": "payment_failed",
  "deposit": { ... }
}
```

#### 4.3 Verify Non-Existent Deposit
```bash
curl -X POST http://localhost:3000/api/deposit/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{"depositId": "nonexistent"}'
```

**Expected:** `404 Not Found`

---

### Phase 5: History & Status Tests

#### 5.1 Deposit History
```bash
curl "http://localhost:3000/api/deposit/history?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_CLERK_JWT"
```

**Verify:**
- [ ] Returns array of deposits
- [ ] Pagination works (page, limit)
- [ ] Old GlobalPay deposits still visible (backward compatibility)
- [ ] New Flutterwave deposits show `paymentProvider: "flutterwave"`

#### 5.2 Single Deposit Status
```bash
curl http://localhost:3000/api/deposit/status/YOUR_DEPOSIT_ID \
  -H "Authorization: Bearer YOUR_CLERK_JWT"
```

**Verify:**
- [ ] Returns correct deposit
- [ ] Status matches MongoDB

#### 5.3 Cancel Deposit
```bash
curl -X PATCH http://localhost:3000/api/deposit/status/YOUR_DEPOSIT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -d '{"status": "cancelled"}'
```

**Verify:**
- [ ] Only cancellable if status is `pending`
- [ ] Returns error if already `payment_confirmed`

---

### Phase 6: Frontend Tests

#### 6.1 Deposit Page Load
1. Navigate to `/deposit`
2. **Verify:**
   - [ ] Currency selector shows NGN and GHS
   - [ ] Network selector shows Solana and Ethereum (no Tron)
   - [ ] Solana is pre-selected
   - [ ] NGN is pre-selected
   - [ ] Exchange rate displays correctly

#### 6.2 Currency Switch
1. Select GHS from currency dropdown
2. **Verify:**
   - [ ] Rate updates to GHS rate
   - [ ] Fiat amount calculation uses GHS
   - [ ] Symbol changes to GH₵

#### 6.3 Amount Entry
1. Enter `100` USDT
2. **Verify:**
   - [ ] Fiat amount = 100 × rate × 1.05
   - [ ] "Pay" button becomes active
   - [ ] Validation shows error for < 1 or > 5000

#### 6.4 Initiate Deposit
1. Fill form and click "Buy USDT"
2. **Verify:**
   - [ ] Loading state shows
   - [ ] Success: deposit card appears with "Pay" button
   - [ ] Clicking "Pay" redirects to Flutterwave checkout (same tab)

#### 6.5 Payment Completion
1. Complete payment on Flutterwave checkout
2. Return to app
3. **Verify:**
   - [ ] Deposit status shows "Payment confirmed"
   - [ ] Message says "USDT will be sent to your wallet shortly"
   - [ ] No automatic USDT delivery (manual process)

#### 6.6 Pending Deposit Banner
1. Create a deposit but don't complete payment
2. Navigate to dashboard
3. **Verify:**
   - [ ] Pending deposit banner shows
   - [ ] Clicking banner goes to `/deposit`
   - [ ] Resume button works

#### 6.7 History Page
1. Navigate to `/transactions` or deposit history
2. **Verify:**
   - [ ] All deposits listed
   - [ ] Old GlobalPay deposits show without Flutterwave fields
   - [ ] New Flutterwave deposits show provider badge
   - [ ] Pagination works

---

### Phase 7: Edge Cases & Error Handling

#### 7.1 CoinGecko Down (Fallback Rates)
```bash
# Temporarily break CoinGecko URL in config or block network
curl http://localhost:3000/api/p2p/rates
```

**Verify:**
- [ ] Returns hardcoded fallback rates (NGN: 1580, GHS: 15.5)
- [ ] Deposit initiation still works

#### 7.2 Flutterwave API Down
```bash
# This is harder to simulate — check logs during actual downtime
```

**Verify:**
- [ ] Client gets meaningful error message
- [ ] Deposit is not created if Flutterwave call fails
- [ ] Retry logic works (3 attempts)

#### 7.3 Network Switch Mid-Flow
1. Start deposit with Solana
2. Change to Ethereum before clicking "Buy"
3. **Verify:**
   - [ ] New deposit uses Ethereum network
   - [ ] Old pending deposit is still accessible

#### 7.4 Browser Refresh During Payment
1. Click "Pay" and get redirected to Flutterwave
2. Refresh the app in another tab
3. **Verify:**
   - [ ] Pending deposit banner shows
   - [ ] Can resume from where left off

#### 7.5 Multiple Pending Deposits
1. Try to create a second deposit while one is pending
2. **Verify:**
   - [ ] Blocked with error message
   - [ ] Suggests completing or cancelling existing deposit

---

### Phase 8: Security Tests

#### 8.1 Webhook Without Auth Header
```bash
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"charge.completed"}'
```

**Expected:** `401 Unauthorized`

#### 8.2 Webhook With Tampered Payload
```bash
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: CORRECT_HASH" \
  -d '{"event":"charge.completed","data":{"tx_ref":"WS-DEP-xxx","amount":99999}}'
```

**Expected:** `400 Bad Request` (amount mismatch)

#### 8.3 API Route Without JWT
```bash
curl -X POST http://localhost:3000/api/deposit/initiate \
  -H "Content-Type: application/json" \
  -d '{"usdtAmount": 10, "fiatCurrency": "NGN", "network": "solana"}'
```

**Expected:** `401 Unauthorized`

#### 8.4 Webhook Route Bypasses Auth
```bash
# Webhook route should NOT require Clerk JWT
curl -X POST http://localhost:3000/api/deposit/webhook \
  -H "Content-Type: application/json" \
  -H "verif-hash: CORRECT_HASH" \
  -d '{"event":"charge.completed","data":{"tx_ref":"WS-DEP-test","status":"successful"}}'
```

**Expected:** `200 OK` or `400` (if tx_ref not found), NOT `401`

---

### Phase 9: Production Readiness

#### 9.1 Environment Checklist
- [ ] `FLUTTERWAVE_SECRET_KEY` is production key (not test)
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET_HASH` matches production dashboard
- [ ] `NODE_ENV=production`
- [ ] MongoDB connection string is production cluster
- [ ] Admin backend URL is production

#### 9.2 Webhook URL Configuration
In Flutterwave Dashboard:
- [ ] Webhook URL set to `https://your-domain.com/api/deposit/webhook`
- [ ] "Charge Completed" event is enabled
- [ ] Secret hash is copied to env var

#### 9.3 Build Verification
```bash
npm run build
```

**Verify:**
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No ESLint errors

#### 9.4 Log Monitoring
Set up alerts for:
- [ ] Webhook signature verification failures
- [ ] Amount mismatch errors
- [ ] Flutterwave API errors (5xx)
- [ ] Duplicate webhook attempts
- [ ] Failed charge verifications

---

## Quick Reference: MongoDB Queries

```bash
# Find all Flutterwave deposits
mongosh "your-uri" --eval 'db.deposits.find({paymentProvider: "flutterwave"}).sort({createdAt: -1}).limit(5)'

# Find pending deposits
mongosh "your-uri" --eval 'db.deposits.find({status: "pending"})'

# Find deposits by reference
mongosh "your-uri" --eval 'db.deposits.findOne({flutterwaveReference: "WS-DEP-xxx"})'

# Count deposits by status
mongosh "your-uri" --eval 'db.deposits.aggregate([{$group: {_id: "$status", count: {$sum: 1}}}])'

# Find old GlobalPay deposits
mongosh "your-uri" --eval 'db.deposits.find({paymentProvider: "globalpay"}).limit(5)'
```

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| "Invalid webhook signature" | Wrong secret hash | Verify `FLUTTERWAVE_WEBHOOK_SECRET_HASH` matches dashboard |
| "Amount mismatch" | User paid different amount | Check tolerance in `webhook/route.ts` (currently ≤ 1.0) |
| "Only NGN and GHS supported" | Wrong currency | Frontend should only send NGN/GHS |
| "Only solana and ethereum supported" | Wrong network | Frontend should only send solana/ethereum |
| Checkout URL not working | Test vs production key | Ensure using correct environment key |
| Deposit not updating | Webhook not received | Check webhook URL in dashboard; verify route is accessible |
| "Unauthorized" on webhook | Middleware blocking | Verify `/api/deposit/webhook` in `isWebhookRoute` matcher |

---

## Sign-Off Checklist

- [ ] All Phase 1-6 tests pass
- [ ] All edge cases handled
- [ ] Security tests pass
- [ ] Production env vars configured
- [ ] Build succeeds
- [ ] Old GlobalPay deposits still visible in history
- [ ] New Flutterwave deposits work end-to-end
- [ ] Admin knows to manually send USDT after `payment_confirmed`
- [ ] Webhook URL configured in Flutterwave dashboard
- [ ] Monitoring/alerts set up

**Ready for production?** All boxes checked → Deploy 🚀
