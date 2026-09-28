# Fiat ramp checklist: legacy (Flutterwave) → OnSwitch port + Bridge integration

Source of truth: `docs/fiat-frontend-integration-guide.md` ("guide").
Scope: dashboard integration plus the matching backend safety contract. The proxy
allowlist is only ever added to; existing legacy rails remain intact.
Tick items as you go. ⛔ means blocked on an answer from the backend team.

---

## 0. Setup + mock mode (CP1)

- [x] On branch `feature/fiat-ramp-frontend`
- [x] `.env.local` has `CRYPTO_API_URL=https://crypto-backend.worldstreetgold.com` (no `/v1`, no `NEXT_PUBLIC_`) (guide §2.1) — developer to verify locally; not edited by the checkpoint
- [x] `NEXT_PUBLIC_CRYPTO_ENABLED=true` and `NEXT_PUBLIC_CRYPTO_PROXY_ENABLED=true` — developer to verify locally
- [x] No OnSwitch or Bridge key anywhere in the dashboard repo or env (guide §2.2) — grep clean; the only provider secrets in `.env.local` are legacy Flutterwave (out of scope)
- [x] Mock mode: enabled only when `NODE_ENV === 'development'` AND `NEXT_PUBLIC_FIAT_MOCKS === 'true'` (`lib/fiat-mocks.ts`)
- [x] Fixtures are verbatim copies of the guide's example responses, each citing its section (`lib/crypto-backend/__fixtures__/fiat.ts`)
- [x] Existing mock system confirmed impossible to enable in production (double-gate in `lib/fiat-mocks.ts` + `lib/dev-auth-bypass.ts`)
- [x] **Tests:** fixtures match the guide shapes; mocks inert in production builds (`lib/crypto-backend/__tests__/fiat-fixtures.test.ts`, `lib/__tests__/fiat-mocks-gate.test.ts`)

## 1. Decisions and open questions

Confirmed:
- [x] Port existing buy/sell/fund to OnSwitch; integrate Bridge in the USD area; no new pages
- [x] Build locally with mocks (no Clerk); login still required when live
- [x] Flutterwave/legacy to be removed later; kept behind a rollback flag until OnSwitch is verified on prod
- [x] Network/asset come from `/fiat/config` (guide §5)
- [x] Bridge virtual account is not a fiat balance; funds arrive as USDC in the wallet (guide §10)

Check yourself (no need to ask):
- [ ] On prod, logged in, `/api/crypto/fiat/config` shows `environment: production` and `enabled`/`blockingReasons`
- [x] Where the wallet UI gets `walletId` (Claude Code finds it in CP2) — `useCryptoWallet()` / `useCryptoWalletState()` in `hooks/crypto/useCryptoWallet.ts:9-21` → `GET /wallets/me` → `CryptoWalletDetails.id`; used as `wallet.data.id` at `components/crypto/ModernWalletPage.tsx:922`. The buy-sell and fund clients don't read it today.
- [x] Whether the codebase has a canonical USDC address per network (Claude Code checks in CP2) — the backend's shared `src/swap/assets.ts` registry owns the canonical token for the Bridge virtual-account capability; the frontend never reads or copies token addresses.

Still open:
- [ ] ⛔ Bridge beneficiary (US bank account) create payload
- [x] Source of the canonical USDC contract address for Bridge withdrawals — backend resolves it from the shared `src/swap/assets.ts` registry; frontend sends only `asset: "USDC"`
- [x] OnSwitch profile policy resolved: local Buy/onramp does not require an approved customer/KYC profile; local Sell/offramp and beneficiary creation still require approved account-owner controls

## 2. Foundations (CP2), guide §3–6, §12

- [x] Types: `FiatCustomer`, `FiatKycLink(Result)`, `FiatBeneficiary`, `FiatInstitution` (defensive optional fields, guide §8)
- [x] Client methods: `getFiatCompliance`, `createFiatCustomer`, `createBridgeKycLink`, `syncBridgeCompliance`, `listFiatInstitutions`, `listFiatBeneficiaries`, `createFiatBeneficiary`, `deleteFiatBeneficiary`
- [x] Client method + typed hook: `listFiatBeneficiaryRequirements` / `GET /fiat/beneficiary-requirements`; provider requirement responses are normalized server-side before reaching the browser
- [x] Proxy allowlist **additions only** (existing entries untouched; diff is 13 insertions, 0 deletions):
  - GET: compliance, institutions, beneficiaries
  - POST: compliance/customer, compliance/bridge/kyc-link, compliance/bridge/sync, beneficiaries
  - DELETE key with anchored `^fiat/beneficiaries/[A-Za-z0-9_-]+$`
- [x] Idempotency manager (guide §3.3) — `lib/crypto-backend/fiat-idempotency.ts`:
  - fresh UUID per user action;
  - reused only for an exact retry;
  - released on a definitive response (`runIdempotentMutation`);
  - sessionStorage with an in-memory fallback;
  - separate key for `/confirm`;
  - no bank details stored
- [x] Order polling: 2s → 4s → 8s → 15s → 30s → 30–60s, stops at terminal states, refetch on focus and after tx submit (guide §11) — `hooks/crypto/useFiatOrderPoll.ts`
- [x] Virtual account/activity polling at 15–30s (guide §11) — `hooks/crypto/useFiatVirtualAccountPoll.ts`
- [x] Fiat reads retry only on guide §12.3 statuses (0/502/503/504) via `fiatReadRetry`
- [x] Capability gating requires: top-level `availability === "available"` + `enabled` + provider `status: available` + `readiness.providers[x].operationAvailable` + corridor enabled + asset route `walletReady` for the direction (guide §5). A `blocked`, `disabled` or `discovery_only` top-level availability blocks every money-moving action even when a provider's own fields look green.
- [x] `useFiatConfig` respects `cacheExpiresAt` and refetches after `FIAT_PROVIDER_NOT_READY` (`refetchOnProviderError`)
- [x] Error mapping on `status` + `code` only; `requestId` kept; `Retry-After` honoured on 429 (guide §12) — `CryptoBackendError.retryAfter` now populated by the client
- [x] **Tests:** idempotency lifecycle; polling ladder + terminal stop; every §5 capability status; every §12 error code; allowlist accepts only documented paths

## 3. Buy → OnSwitch onramp (CP3 mapping, CP5 build), guide §9.1–9.2, §11, §13

- [x] CP3: written mapping of every legacy `lib/crypto-api.ts` call in buy/sell/fund → new route (no edits) — `docs/FIAT_LEGACY_ROUTE_MAP.md`; Q1 answered (follow the guide), Q2 and Q5 answered by guide §5, Q3 and Q4 still open
- [x] Release/rollback flag (`legacy` | `onswitch`); the guide flow is now the default and legacy is kept as an explicit rollback — `NEXT_PUBLIC_FIAT_BUY_FLOW`; legacy kept as `LegacyBuySellClient`
- [x] Corridor + asset selectors derived from `/fiat/config` (nothing hardcoded)
- [x] Quote screen: `sourceAmount`, `destinationAmount`, `providerRate`, `providerFee`, `worldstreetFee`, expiry countdown
- [x] Local Buy checks the signed-in user's OnSwitch compliance record before quote/order; missing, pending, rejected, and suspended states show setup/review copy
- [x] Expired quote / `FIAT_QUOTE_NOT_ACTIVE` → re-quote with a new idempotency key
- [x] Order creation with an idempotency key; submit disabled while in flight
- [x] 201 is not treated as paid; a 200 replay renders as the same order (guide §11)
- [x] `providerDisplay.paymentInstructions` rendered as plain text, masked, copy buttons, expiry shown
- [x] Order polled to a terminal state; all §11 states handled (`refund_in_flight` keeps polling slowly; terminal list is open question 10)
- [x] Wallet balance + order history refreshed on `completed` (query invalidation in `OnswitchBuyFlow`; not unit-tested, the repo has no DOM test setup)
- [x] **Tests:** expired quote → re-quote; double-click → one order; 200 replay; every §11 state; rollback flag restores legacy

## 4. KYC / compliance (CP4) + Bridge USD onramp (CP6), guide §7, §10.1–10.2

KYC (CP4):
- [x] Compliance status from `GET /fiat/compliance`; provider customer IDs never displayed (`describeComplianceRecord` drops the id)
- [x] Bridge: collect legalName/email/country → `POST /fiat/compliance/bridge/kyc-link`
- [x] `kycLink.url` checked for `https:`, opened in a new tab with `noopener,noreferrer`; never logged
- [x] "I've finished" → `POST /fiat/compliance/bridge/sync` → refetch compliance
- [x] OnSwitch: customer profile form using exactly the documented `POST /fiat/compliance/customer` fields
- [x] OnSwitch profile submission obeys the single backend `FIAT_RAMP_ENABLED` kill switch and provider/compliance approvals
- [x] Bridge remains backend-authoritative: KYC need comes from `/fiat/config`, and the virtual-account request is refused safely when the user is not approved
- [x] **Tests:** pending → approved via sync; non-https URL rejected; idempotency key sent; OnSwitch UX approval guard; profile mutation mock transitions into the approved record; Bridge 403 refusal stops with verification guidance and isn't retried
- [x] Mount the panels: Bridge KYC above the USD account (collapsible); keep the OnSwitch profile form on local Sell/offramp only

Bridge USD onramp (CP6):
- [x] Gated on the Bridge virtual account route being available (USD tab shown only then; local currency is the default tab)
- [x] Approved → create/get virtual account (`asset: "USDC"`, never a contract address) — built and tested (`createBridgeUsdAccount`); the backend returns `supportedNetworks` + `defaultNetworkId` and the UI creates only with that value. Existing accounts are listed and polled. No frontend approval check (team decision)
- [x] Deposit instructions shown exactly as returned, masked, copy buttons, not in analytics
- [x] Activity polled; an empty list reads "no deposits yet", not failure
- [x] Balance refreshed after a completed activity item (only when an item newly shows `providerStatus: "completed"`)
- [x] Create CTA fails closed unless wallet id, capability, backend-supported network, owned wallet address, and canonical `USDC` route are all present
- [x] **Tests:** empty activity message; duplicate create returns the same account; balance refresh on completion

## 5. Sell → OnSwitch offramp (CP7), guide §8, §9.2–9.3

- [x] Released by default through `NEXT_PUBLIC_FIAT_SELL_FLOW`; setting it to `legacy` is the explicit rollback path
- [x] Institutions selector from `/fiat/institutions` plus provider-controlled typed requirements from `/fiat/beneficiary-requirements`
- [x] Beneficiary form keeps raw account values in memory only and stores only a fingerprint for exact retries
- [x] Only `status === 'verified' && ownershipStatus === 'verified'` selectable
- [x] Offramp quote → order with `beneficiaryId`, quote expiry and separate idempotency keys
- [x] `cryptoIntent` adopted and signed via existing wallet signing modules; deposit address/asset/amount/network are not editable
- [x] `/confirm` only after broadcast, with a separate idempotency key
- [x] Order polled to a terminal state
- [x] **Tests:** typed payload mapping, verified-beneficiary filter, expiry/signing state mapping, confirm helper, and explicit legacy rollback
- [ ] Controlled live bank/mobile-money payout, webhook, and reversal verification

## 6. Bridge USD withdrawal (CP8), guide §10.3

- [x] Routed from the existing OnSwitch sell entry when `NEXT_PUBLIC_FIAT_SELL_FLOW=onswitch`; backend `FIAT_RAMP_ENABLED` remains authoritative
- [x] Lists existing verified, user-owned Bridge beneficiaries only; beneficiary creation remains blocked pending the approved provider payload/ownership evidence
- [x] Sends literal `asset: "USDC"`; the backend resolves the canonical USDC address for the owned network
- [x] Channels derive from backend capability; `fednow` appears only when explicitly available
- [x] `cryptoIntent` signed; **no** `/confirm`; order polled and rehydrated on refresh
- [x] **Tests:** capability/network/beneficiary/request/state mapping coverage
- [ ] Controlled live USD payout, webhook, reversal, and ACH ownership verification

## 7. Order history (CP9)

- [x] `GET /fiat/orders` list, focus refresh, explicit refresh, no aggressive list polling
- [x] Expand an owned order for detail refresh and recover it through the existing pending-flow/signing path without a duplicate mutation
- [x] Safe normalized fields only; provider display blobs and unmasked bank/payment instructions are not rendered
- [ ] **Tests:** browser-level list rendering across every state and deployed authorization/recovery verification

## 8. Security review (CP9), guide §15

- [ ] Browser calls `/api/crypto` only, never OnSwitch or Bridge
- [ ] No provider keys in env, bundles, source maps, logs, analytics or error reports
- [ ] Only IDs returned for the signed-in user are used
- [ ] No browser-supplied user ID or ownership flag trusted
- [ ] Provider display fields rendered defensively (no `dangerouslySetInnerHTML`)
- [ ] Logs contain only status/code/requestId
- [ ] Mock mode unreachable in the production build
- [ ] Each item verified against code with file references

## 9. Live handoff tests (after CP10, on prod), guide §16

- [ ] Confirm `environment: production` before creating anything
- [ ] `/api/crypto/fiat/config` returns the expected environment and capabilities
- [ ] Every route used by the screens is allowlisted
- [ ] Missing session → 401 handled, no duplicate order
- [ ] Global switch off → unavailable state, no mutation attempted
- [ ] Expired quote → `FIAT_QUOTE_NOT_ACTIVE` → re-quote works
- [ ] Duplicate mutation → same resource rendered, not a second payment
- [ ] 502/503/timeout → bounded read retries; mutations retried with the same key only
- [ ] Unverified beneficiary → order blocked
- [ ] `requestId` captured for every failed request
- [ ] OnSwitch onramp completes end to end
- [ ] Bridge KYC → virtual account → deposit shows in activity
- [ ] Rollback flag flips back to legacy cleanly

## 10. Final (CP10)

- [x] Full test suite, typecheck, touched-source lint and production build pass
- [x] Summary of all changes, test coverage, TODOs and open questions recorded in `docs/FIAT_ONSWITCH_BRIDGE_PHASED_IMPLEMENTATION_PLAN.md`
- [ ] §9 live provider tests still require production credentials, provider approval, webhook verification, and an operational owner
- [x] Both repository changes committed and pushed to their default branches
- [x] Offramp/withdrawal UI released to authenticated users; backend capability and the single `FIAT_RAMP_ENABLED` switch remain authoritative and fail closed

