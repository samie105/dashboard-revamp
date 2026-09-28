# OnSwitch + Bridge Fiat Ramp: Phased Implementation Plan

**Audit date:** 2026-09-29  
**Repositories reviewed:** `dashboard-revamp` and `worldstreet-crypto-backend`  
**Scope:** OnSwitch African fiat rails and Bridge USD rails  
**Security model:** authenticated users may operate only on their own WorldStreet wallet, customer profile, beneficiary, external account, and virtual account  
**Operational control:** `FIAT_RAMP_ENABLED` remains the single backend kill switch for every fiat lane

This plan describes what is implemented and released in code, what still depends
on live provider configuration, and the order in which the remaining operational
work should be completed.

It does not cover the unrelated Intertrain crypto bridge, spot trading, derivatives, or the legacy Flutterwave implementation except where the legacy Buy/Sell flow is retained as a rollback path.

## 1. Executive status

The backend is ahead of the frontend, but the core frontend surfaces are now wired. The provider-neutral backend foundation and guarded OnSwitch/Bridge money-movement paths are present. The dashboard consumes capability, compliance, OnSwitch Buy/Sell, Bridge USD deposit-account APIs, Bridge USD withdrawal orders, and user-scoped fiat order history. Live provider approval, beneficiary onboarding evidence, and controlled production verification remain operational gates.

| Area | Backend state | Frontend state | Remaining work |
|---|---|---|---|
| Global readiness and kill switch | Implemented and fail-closed | Capability response consumed | Configure and verify the live provider runtime |
| OnSwitch coverage/assets | Implemented with runtime discovery and wallet compatibility mapping | Dynamic corridor/asset/channel selectors implemented | Provider account approval, live coverage verification, and end-to-end tests |
| Bridge USD capabilities | Implemented in `/fiat/config`, including supported wallet networks/default and explicit withdrawal channels | USD rail is rendered when capability is available | Verify capability-cache expiry and a controlled live account |
| Durable domain/idempotency | Implemented | Client sends idempotency keys and tests retry behavior | Controlled provider fixtures, webhook registration, operational reconciliation checks |
| Compliance/KYC | Bridge KYC link/sync and OnSwitch local profile routes implemented | Bridge KYC panel is scoped to USD; OnSwitch profile form is scoped to local payout/offramp | Verify actual provider onboarding and retain off-ramp account-owner approval |
| OnSwitch African onramp | Quote, order, provider instructions, status, webhooks, and wallet destination intent implemented | Buy flow released by default; no Bridge-style KYC/profile gate; explicit `legacy` remains the rollback | Complete live corridor and payment canary |
| Bridge USD onramp | Virtual account create/list/get/activity and reconciliation implemented; capability exposes supported networks/default | Account display/activity polling and owned-address/canonical-USDC readiness gate implemented | Test a real deposit path and verify Bridge sandbox settlement/reconciliation |
| OnSwitch African offramp | Quote, order, beneficiary, crypto intent, confirm, status, and webhook paths implemented | Sell flow released by default; explicit `legacy` remains the rollback | Provider approval and controlled live payout verification |
| Bridge USD withdrawal | Provider transfer, own-account checks, crypto intent, status, and webhook paths implemented | Capability-driven USD sell/sign/poll flow implemented; beneficiary creation remains intentionally out of scope | Resolve/approve beneficiary schema and ownership evidence, then run controlled payout verification |
| Fiat order history | Backend list/detail routes implemented | Dedicated user-scoped history, detail refresh, and recovery actions implemented | Verify deployed list/detail authorization, terminal-state copy, and controlled recovery cases |
| Production controls | Readiness, allowlist, corridor denylist, audit, redaction, and reconciler code exists | Security checks and release defaults committed | Live secret-manager configuration, observability, canary, rollback drill, final approval |

### Current frontend routing reality

- `BuySellClient` renders `FiatBuyFlow` for Buy by default; `NEXT_PUBLIC_FIAT_BUY_FLOW=legacy` is the explicit rollback.
- `BuySellClient` renders `FiatSellRouter` for Sell by default; `NEXT_PUBLIC_FIAT_SELL_FLOW=legacy` is the explicit rollback.
- The guide flows are build-time frontend defaults, not a replacement for the backend kill switch.
- `BridgeUsdBuy` displays existing accounts/activity and consumes the backend's Bridge `supportedNetworks` + `defaultNetworkId`; it never hardcodes a chain or token address.
- The checklist mentions a future `FIAT_OFFRAMP_UI_ENABLED`, but the current `lib/fiat-flags.ts` does not implement that flag. It must not be treated as an existing operational control.

### Current backend route surface

The backend already mounts these authenticated routes under `/v1`:

```text
GET    /fiat/config
GET    /fiat/compliance
POST   /fiat/compliance/customer
POST   /fiat/compliance/bridge/kyc-link
POST   /fiat/compliance/bridge/sync
GET    /fiat/institutions
GET    /fiat/beneficiary-requirements
GET    /fiat/beneficiaries
POST   /fiat/beneficiaries
DELETE /fiat/beneficiaries/:beneficiaryId
POST   /fiat/quotes
GET    /fiat/quotes/:quoteId
POST   /fiat/orders
GET    /fiat/orders
GET    /fiat/orders/:orderId
POST   /fiat/orders/:orderId/confirm
POST   /fiat/bridge/virtual-accounts
GET    /fiat/bridge/virtual-accounts
GET    /fiat/bridge/virtual-accounts/:accountId
GET    /fiat/bridge/virtual-accounts/:accountId/activity
```

Provider callbacks remain outside the authenticated `/v1` surface:

```text
POST /webhooks/fiat/onswitch
POST /webhooks/fiat/bridge
```

## 2. Architecture and non-negotiable rules

The production path is:

```text
Browser dashboard
  -> /api/crypto/*
  -> Next.js proxy attaches Clerk identity
  -> crypto backend /v1/fiat/*
  -> OnSwitch or Bridge server-side adapter
  -> provider webhook/reconciliation
  -> authenticated user reads normalized local state
```

The browser must never call OnSwitch or Bridge directly. Provider credentials, webhook secrets, raw provider payloads, raw bank details, and provider customer IDs remain server-side.

The backend must continue to enforce:

- authenticated Clerk-to-WorldStreet user ownership;
- wallet/account ownership for crypto destinations and sources;
- customer-profile and endorsement eligibility;
- beneficiary `status === "verified"` and `ownershipStatus === "verified"` before payout;
- exact provider/network/asset compatibility;
- idempotency for every mutation;
- signature verification and replay protection for webhooks;
- monotonic state transitions and durable reconciliation;
- the single master switch `FIAT_RAMP_ENABLED`.

Frontend rollout flags may temporarily control which screen is rendered while a migration is in progress, but they are not safety controls. If `FIAT_RAMP_ENABLED=false`, the backend must reject or disable every OnSwitch and Bridge money-movement lane regardless of frontend state.

## 3. Contract blockers to resolve before finishing the remaining UI

These are the highest-priority issues found by comparing the current frontend and backend code. They should be closed before implementing withdrawal screens.

### 3.1 Bridge virtual-account network selection — resolved for Phase 0/1

The backend requires:

```json
{
  "walletId": "<owned-wallet-id>",
  "networkId": "<owned-wallet-network>",
  "asset": "USDC"
}
```

It then:

- resolves the owned wallet address for that network;
- maps the network to a Bridge payment rail;
- requires a configured canonical WorldStreet USDC token for that network;
- creates the Bridge virtual account for that exact destination.

The frontend now receives `supportedNetworks`, `defaultNetworkId`, and `defaultNetworkSource` from `/fiat/config`. The backend derives that response from the deployment's enabled wallet networks, the shared canonical USDC registry, and the single Bridge payment-rail mapping. `FIAT_RAMP_DEFAULT_NETWORK` is an optional backend-only override; when blank, the first supported network is selected; an invalid explicit value fails closed.

The frontend never hardcodes Ethereum, a provider payment rail, or a token address. It prefers the backend default only when that network exists in the user's wallet, otherwise it selects the first supported network the wallet owns. The request sends that backend-supported `networkId` and the literal asset symbol `USDC`; the backend still resolves the owned wallet address, canonical token, and Bridge payment rail.

**Remaining verification:** an approved user must create an account on a
wallet-owned supported network and complete a controlled live Bridge
deposit/reconciliation test.

### 3.2 OnSwitch customer-profile requirement — resolved

The current backend contract requires an owned OnSwitch customer with
`status: "approved"` before both quote and order creation. The dashboard now
matches that contract: local Buy reads the signed-in user's compliance record,
shows the profile form for missing/pending/rejected/suspended states, and keeps
the quote/order CTA unavailable until approval is reflected. The backend
repeats the check, so the browser guard is not an authorization boundary.

OnSwitch profile writes also pass through `requireFiatProviderComplianceMutation`
and therefore obey the single `FIAT_RAMP_ENABLED` kill switch and provider /
compliance approvals. The dev fixture transitions from no OnSwitch record to an
approved record after the profile mutation so the complete local sandbox path
is testable.

**Remaining verification:** complete operator approval for a disposable
sandbox user and run the real quote/order path with the provider account.

### 3.3 Bridge beneficiary creation and US ACH ownership

The backend accepts a provider-neutral beneficiary envelope with a free-form `providerPayload`. The provider-specific external-account payload is not yet documented well enough for the frontend to construct safely. The backend also recognizes that Bridge US ACH does not expose the same ownership-verification endpoint available for some other account types; an ACH beneficiary can remain `pending/manual_review` and cannot be paid.

**Required decision:** document the exact Bridge external-account create payload and the actual account-ownership evidence available for the target USD bank-account types.

The preferred design is:

- frontend submits typed bank-account fields only;
- backend constructs the Bridge-specific payload;
- backend stores only redacted snapshots and hashes;
- beneficiary becomes selectable only after verified ownership;
- if Bridge cannot verify US ACH ownership automatically, keep the beneficiary pending and do not offer withdrawal until an approved independent control/manual-review policy exists.

Do not ship a UI that asks a user to paste an undocumented `providerPayload` JSON object.

**Exit criteria:** the product can demonstrate how a US bank account becomes `verified`, why it belongs to the signed-in user, and what happens when verification is unavailable or mismatched.

### 3.4 Canonical USDC asset and fee policy

Bridge withdrawal has no quote endpoint in the current adapter. The backend accepts a bounded USDC amount and creates the provider transfer. The frontend therefore needs:

- the backend-authoritative network and canonical USDC asset;
- the source amount semantics;
- Bridge/provider fee treatment;
- minimum/maximum/daily limits;
- whether the amount entered is gross USDC, net USD, or another value;
- user-facing copy for a withdrawal with no quote reservation.

The frontend must not reuse a spot `KNOWN_TOKENS` entry as an unverified Bridge contract source.

**Exit criteria:** a withdrawal review screen can display amount, network, asset, channel, fees/limits if applicable, and the exact crypto amount that will be signed.

## 4. Phase plan

### Phase 0 — Freeze scope, decisions, and ownership

**Status:** Scope and Bridge network decision implemented; provider/compliance/product approvals remain.

### Objective

Confirm the product and operational boundaries before more money-movement UI is built.

### Already done

- OnSwitch is the African local-fiat rail.
- Bridge is the USD rail.
- Funds settle into the user's existing self-custodial WorldStreet wallet as USDC.
- Bridge virtual accounts are deposit instructions, not a fiat wallet balance.
- Users may use only accounts and beneficiaries they own.
- The browser uses `/api/crypto`; providers are server-only.
- The backend owns provider capability, compliance, pricing, order state, and reconciliation.
- The Intertrain bridge routes are explicitly out of scope.
- Legacy Buy/Sell remains available as a rollback path.

### Remaining work

Record written answers for:

1. ANSWERED (2026-09-29): OnSwitch onramp quote/order does not require an approved customer/KYC profile; offramps and beneficiary creation still require approved account-owner controls.
2. Bridge beneficiary create schema and US ACH ownership evidence.
3. Bridge withdrawal amount/fee semantics.
4. Terminal state/reason copy for `manual_review`, `blocked`, `reversed`, `refund_in_flight`, `refunded`, and `refund_failed`.
5. Whether the dashboard Deposit door should expose the new Buy rail in addition to `/buy` and the money modal.
6. The controlled test countries, currencies, channels, limits, and users.

### Exit criteria

- The answers are recorded in the integration guide/context.
- Product, backend, compliance, and operations owners are assigned.
- No developer is required to guess a provider payload or network identifier.

### Phase 1 — Provider configuration and one master switch

**Status:** Backend implementation complete, including the network/default contract; deployment configuration and provider approval remain.

### Objective

Make the runtime safe to deploy and prove that one switch stops every fiat mutation.

### Already done in backend

- `FIAT_RAMP_ENVIRONMENT` supports sandbox/production.
- `FIAT_RAMP_ENABLED` is the master switch.
- readiness checks validate approved provider hosts, key/environment pairing, provider account approval, compliance approval, webhook configuration, and operation capability.
- `FIAT_RAMP_ALLOWED_USERS` supports a server-side canary allowlist.
- `FIAT_RAMP_DISABLED_CORRIDORS` supports defense-in-depth corridor denial.
- provider secrets are read from backend runtime configuration only.
- `npm run verify:fiat-config` reports redacted readiness metadata.

### Work remaining

Configure the backend secret manager/runtime in this order:

1. Start with `FIAT_RAMP_ENABLED=false`.
2. Configure the approved live OnSwitch service key and live host.
3. Configure the approved live Bridge key against `https://api.bridge.xyz`.
4. Configure the Bridge webhook public key separately from the API key.
5. Set provider account-approval and webhook-configuration flags only after the live provider setup is confirmed.
6. Set compliance and production approval only after the live operational gate passes.
7. Leave `FIAT_RAMP_ALLOWED_USERS` empty when the intended audience is everyone.
8. Run `npm run verify:fiat-config` in the production deployment environment.
9. Set `FIAT_RAMP_DEFAULT_NETWORK` only when the deployment wants a specific supported wallet network; otherwise leave it blank and verify the reported first-supported default.
10. Confirm that no key, webhook secret, or bank detail appears in `/fiat/config`, logs, source maps, or frontend bundles.

### Required kill-switch tests

- With `FIAT_RAMP_ENABLED=false`, `/fiat/config` reports a disabled/unavailable state.
- Quote, order, beneficiary, virtual-account, and withdrawal mutation routes cannot move money.
- Existing order reads and provider reconciliation remain safe and do not create new payouts.
- Flipping the switch back on does not manufacture provider approval or bypass account/ownership gates.

### Exit criteria

- Configuration verifier passes against the production environment.
- The kill switch has been exercised against every mutation family.
- A documented rollback procedure sets `FIAT_RAMP_ENABLED=false` without redeploying frontend code.

### Phase 2 — Capability and network contract

**Status:** Implemented in the backend contract and dashboard predicates; live provider capability verification remains.

### Objective

Ensure every screen is driven by live provider capability and wallet compatibility.

### Already done

- Backend fetches OnSwitch coverage for OnSwitch and OffSwitch directions and normalizes assets.
- Backend maps provider chains/assets to enabled WorldStreet networks.
- Backend emits Bridge USD routes, KYC requirements, external-account requirements, and readiness metadata.
- Backend emits explicit `withdrawalChannels` entries with `channel`, `routeId`, `paymentRail`, `status`, and `requiresOwnedExternalAccount`; the frontend filters to `status: "available"` instead of guessing from provider documentation.
- `/v1/fiat/config` is exposed through `/api/crypto/fiat/config`.
- Dashboard has `getFiatConfig`, `useFiatConfig`, capability predicates, dynamic corridors, route selection, and provider error refetching.
- Dashboard exposes `bridgeWithdrawalChannels` and derives FedNow availability from the backend capability response. During a rolling deployment, an older response without `withdrawalChannels` falls back to explicit route metadata and fails closed for unknown rails.
- No African country/currency table is hardcoded as the production source of truth.
- Unsupported networks are marked non-wallet-ready.

### Work remaining

- Confirm that the deployed dashboard receives `withdrawalChannels` from the deployed backend during the rolling release; an absent or unknown channel remains unavailable.
- Confirm whether `FIAT_RAMP_ALLOWED_USERS` should be surfaced as a generic blocked state only; never expose the allowlist itself. The current contract exposes only `rollout.allowlisted` and top-level `blocked` availability.
- Verify capability-cache expiry and provider-failure refetch behavior against a live sandbox account. Existing frontend tests cover expiry, malformed expiry, provider-error invalidation, and the safe retry policy.

### Exit criteria

- A fresh authenticated user can see only available rails, corridors, channels, assets, and networks.
- The UI never renders a money-moving action for `disabled`, `blocked`, `discovery_only`, `unsupported_network`, or non-wallet-ready routes.
- The Bridge account-create CTA becomes enabled only when the backend-authoritative network is known.

### Phase 3 — Durable provider plumbing, webhooks, and reconciliation

**Status:** Runtime durability and scheduled read/repair reconciliation implemented; provider endpoint registration and production observability verification remain.

### Objective

Make provider callbacks and asynchronous settlement reliable before enabling real money movement.

### Already done

- Durable provider customer, beneficiary, quote, order, webhook-event, and ledger models exist.
- Local idempotency reserves and fingerprints mutations.
- OnSwitch and Bridge adapters normalize provider calls and errors.
- Provider payloads/errors are redacted before persistence/logging.
- Raw webhook bodies are preserved for signature verification.
- OnSwitch HMAC and Bridge webhook signature verification exist.
- Timestamp/replay checks and webhook deduplication exist.
- Webhook processing now atomically claims an event before order mutation, supports retrying failed events, and reclaims stale processing claims after a crash. This makes concurrent provider retries safe without relying on process-local locks.
- Status normalization and monotonic transitions exist.
- Order refresh/reconciliation can requery provider and Bridge virtual-account history.
- A backend `fiatRampReconciler` worker is scheduled from `src/index.ts` and uses `FIAT_RAMP_RECONCILE_INTERVAL_SECONDS` for cadence. `FIAT_RAMP_ENABLED` remains the only fiat-ramp kill switch; when false, the worker performs no provider reads.
- Reconciliation emits structured counts for checked orders, state updates, provider errors, stale webhook rows reprocessed, webhook errors, virtual-account history errors, and completed orders repaired when their completion ledger entry was missing.
- Reconciliation is read/repair-only: it calls provider status/history reads and local idempotent order/ledger updates; it never creates a provider transfer, payout, virtual account, or second crypto intent.
- Local signed OnSwitch HMAC and Bridge ECDSA fixtures cover terminal events and provide a repeatable path for sandbox states that cannot be emitted on demand.

### Work remaining

- Register and verify provider webhook endpoints in the sandbox account.
- Confirm the exact production webhook signing/public-key configuration.
- Replay the signed local fixtures for provider events that cannot be emitted in sandbox, including delayed/duplicate/out-of-order terminal and refund states.
- Exercise duplicate, delayed, out-of-order, unknown-order, invalid-signature, stale-timestamp, and concurrent webhook deliveries against a disposable MongoDB database; verify only one event claimant applies the order update.
- Verify the reconciler is scheduled in the deployed backend and route its structured logs to metrics/alerts.
- Add dashboards/alerts for webhook failures, stale `processing`/stuck orders, `completedWithoutLedger`, blockchain-confirmed-without-order, and refund failures. The worker now emits the provider/order counters required for log-based alerts; the external dashboard wiring is deployment work.
- Register alert ownership and a runbook for setting `FIAT_RAMP_ENABLED=false` before investigating a provider or ledger mismatch.

### Exit criteria

- Every provider webhook route rejects unsigned/stale/replayed events.
- Duplicate events are safe and idempotent.
- Sandbox/local fixtures cover every non-terminal and terminal state.
- A reconciler run produces auditable counts and no duplicate mutation.

### Phase 4 — Identity, KYC, and own-account enforcement

**Status:** Backend ownership/compliance enforcement and frontend OnSwitch
profile prerequisite are implemented; provider approvals and unresolved
Bridge ownership payloads remain external validation work.

### Objective

Ensure compliance and payout destinations are owned by the signed-in user before money movement.

### Already done

- Bridge hosted KYC-link and sync routes exist.
- Direct provider-customer route exists for approved server-controlled workflows.
- OnSwitch local compliance/customer profile route exists.
- Institution discovery exists for OnSwitch.
- Beneficiary list/create/deactivate/review routes exist.
- Backend checks customer status, Bridge base endorsement, legal-name hash, provider references, and user ownership.
- Frontend has `BridgeKycPanel`, `OnswitchProfileForm`, `useFiatCompliance`, safe HTTPS KYC-link handling, and display-only compliance status.
- Local Buy mirrors the backend's OnSwitch `status: "approved"` prerequisite as a UX guard; the backend repeats the check for every quote/order.
- Bridge virtual-account UI remains backend-authoritative and does not invent a per-user approval predicate from global capability data.

### Work remaining

- Complete the OnSwitch operator approval path for test users.
- Complete Bridge KYC sandbox onboarding and sync tests through approved/denied/pending states.
- Define the Bridge external-account payload and ownership verification for US ACH.
- Keep unsupported/unverifiable beneficiaries in `pending/manual_review`; do not let the frontend treat them as usable.
- Add frontend beneficiary hooks/forms only after the payload and ownership contract is approved.
- Verify cross-user IDs, deleted beneficiaries, disabled external accounts, and name mismatch behavior.

### Exit criteria

- A user cannot select or submit another user's beneficiary/external account.
- An unverified or name-mismatched destination cannot reach `POST /fiat/orders`.
- The UI explains pending/manual-review states without promising a payout date.
- Provider approval and KYC states are shown accurately but enforced by the backend.

### Phase 5 — OnSwitch African onramp

**Status:** Backend complete; frontend profile-gated flow, local contract
fixtures, error mapping, polling, and terminal-state handling are implemented
and tested. The guide flow is released by default; the explicit legacy value is
the rollback path while the live canary is completed.

### Objective

Move one controlled African local-fiat Buy corridor from capability discovery to a reconciled USDC deposit.

### Already done

Backend:

- `POST /fiat/quotes` creates expiring OnSwitch quotes.
- Quote validation is capability- and wallet-route-driven.
- `POST /fiat/orders` creates idempotent OnSwitch orders.
- OnSwitch bank/mobile-money payment instructions are sanitized for the resource owner.
- Order status can be refreshed, normalized, reconciled, and received via webhook.
- Onramp destination is the authenticated user's owned wallet address.
- Order history and terminal/refund/manual-review states are modeled.

Frontend:

- `FiatBuyFlow` is mounted from `BuySellClient` by default; `NEXT_PUBLIC_FIAT_BUY_FLOW=legacy` is the rollback.
- Corridors, channels, assets, and networks come from `/fiat/config`.
- Quote display includes amount/rate/fees/expiry.
- Quote expiry causes a new quote/key rather than reusing an old quote.
- Order mutation is idempotent and protected against double submission.
- Payment instructions are rendered defensively, masked, copyable, and not sent to analytics.
- `useFiatOrderPoll` implements the backoff ladder and stops at terminal/manual-review states.
- Balance/history refresh is tied to completion.
- Development-only fixtures/mocks and tests exist.
- OnSwitch customer approval is checked before the local quote/order UX; pending or rejected profiles are actionable setup/review states, not quote failures.

### Work remaining

1. Complete one real production bank onramp with live provider credentials and a provider response; the local fixture path is already covered.
2. Verify the selected provider asset/network is one the WorldStreet wallet can actually receive in the deployed environment.
3. Run the deployed production matrix: expired quotes, provider 4xx/5xx/429, duplicate create, browser refresh during payment, webhook delay, manual review, and refund states.
4. Keep `FIAT_RAMP_ALLOWED_USERS` empty when releasing to everyone.
5. Keep the explicit legacy rollback path available until the production canary is reconciled.
6. Add the Buy entry point to the Deposit door only if product confirms that routing.

### Exit criteria

- One approved test user completes a local-fiat bank onramp into their own wallet.
- Provider status, webhook, on-chain delivery, order history, and wallet balance agree.
- A duplicate or lost response never creates a second order.
- The legacy Buy flow can be restored without changing backend safety controls.

### Phase 6 — Bridge USD virtual-account onramp

**Status:** Backend and frontend contract complete; controlled deposit verification remains.

### Objective

Let an approved user obtain reusable USD bank instructions and receive USDC in an existing WorldStreet wallet.

### Already done

Backend:

- Bridge virtual-account create/list/get/activity routes exist.
- The backend binds the virtual account to an owned wallet destination.
- `asset` is constrained to `USDC`.
- Bridge rail is derived from the selected network.
- Canonical USDC mapping is checked server-side.
- Provider customer/base endorsement is required.
- Existing accounts are returned only to the owning user.
- Bridge history is reconciled into redacted activity records.

Frontend:

- USD rail tab is shown from `/fiat/config` capability.
- Bridge KYC is offered when the backend says the route requires it.
- KYC URL is HTTPS-validated and opened safely.
- Existing account instructions are masked/copyable.
- Account and activity are polled at a slower cadence.
- Empty activity is rendered as “no deposits yet,” not as a failure.
- Wallet balance refreshes only after a newly observed completed activity item.
- Development fixtures/tests cover duplicate create, empty activity, and completion refresh.

### Remaining verification

1. Execute live Bridge KYC → virtual account → deposit/activity verification.
2. Verify delayed, duplicate, reversed, and failed activity handling against the provider payloads.
3. Confirm the deployed backend response contains only the deposit instructions safe for that user.
4. Verify the single kill switch disables the account CTA and provider reads together.

### Exit criteria

- An approved test user creates or retrieves exactly one account per wallet/network/USDC tuple.
- Deposit instructions reach only that user.
- A completed deposit produces the expected on-chain USDC and refreshes wallet state once.
- The flow remains safe when a provider response is delayed, reversed, or
  otherwise incomplete; it never fabricates settlement.

### Phase 7 — OnSwitch African offramp

**Status:** Released by default through `NEXT_PUBLIC_FIAT_SELL_FLOW`; setting
`legacy` is the explicit rollback path. The live provider canary remains.

### Objective

Let a user sell USDC from their own wallet to an owned African bank/mobile-money destination through OnSwitch.

### Backend contract already available

1. Capability response supplies enabled OnSwitch offramp corridors and wallet-ready assets.
2. `GET /fiat/institutions` provides provider-controlled institution data and `GET /fiat/beneficiary-requirements` provides safe typed validation metadata.
3. `GET/POST/DELETE /fiat/beneficiaries` manages user-owned payout destinations.
4. `POST /fiat/quotes` accepts `provider: "onswitch"`, `direction: "offramp"`, corridor, channel, asset, network, and amount.
5. `POST /fiat/orders` accepts the quote ID, owned wallet ID, and verified OnSwitch beneficiary.
6. The backend returns a `cryptoIntent` when OnSwitch provides a deposit address.
7. The user signs/submits the normal WorldStreet transaction intent.
8. `POST /fiat/orders/:orderId/confirm` must be called after broadcast with the transaction hash and a separate idempotency key.
9. The order is then polled/reconciled to a terminal provider state.

### Frontend implementation delivered

#### 7.1 Add the Sell route selection

- Keep legacy Sell available as the explicit rollback path.
- Add a temporary UI rollout choice only if needed; do not create a second backend kill switch.
- Once enabled, render the OnSwitch offramp only when `/fiat/config` says the selected corridor, asset route, and direction are available.
- Never let the user choose a network or asset not returned by the backend.

#### 7.2 Build institution and beneficiary UX

- Load institutions for the selected country/currency/channel from `/fiat/institutions`.
- Render known fields defensively because provider institution shape can evolve.
- Use a typed beneficiary form, not a JSON editor.
- Keep raw account numbers in memory only for the mutation; do not persist, log, send to analytics, or include in error reports.
- Use a separate idempotency key for create/deactivate.
- Display only masked account data from the backend after creation.
- Allow selection only when both `status` and `ownershipStatus` are `verified`.
- Show pending/manual-review/mismatch/rejected states with no payout CTA.

#### 7.3 Build quote and order review

- Amount entry must use the selected corridor currency and asset/network returned by capability.
- Display quote expiry, source/destination amounts, provider rate, provider fee, and WorldStreet fee.
- Clear the quote whenever amount, corridor, channel, asset, network, or beneficiary changes.
- On quote expiry, mint a new quote idempotency key.
- Create the order with a new key only after the review state is unchanged.

#### 7.4 Sign and confirm the crypto deposit

- Treat `order.cryptoIntent` as the backend-authoritative transaction.
- Do not let the user edit the provider deposit address, token, amount, or network.
- Use the existing EVM/Solana signing modules and generic transaction-intent submission route.
- After broadcast returns a transaction hash, call `/fiat/orders/:orderId/confirm` with a different idempotency key from order creation.
- Never call `/confirm` before broadcast and never call it for a Bridge withdrawal.
- Poll the fiat order and normal transaction intent together when necessary.

#### 7.5 Test and release

- unverified beneficiary blocked;
- account-name mismatch blocked;
- duplicate beneficiary create safe;
- duplicate order create safe;
- quote expiry re-quotes;
- crypto intent cannot be replaced with a browser-supplied address;
- confirm is impossible before broadcast;
- confirm key differs from order key;
- provider webhook/status transitions do not regress;
- refund/manual-review states remain visible and recoverable.

Implementation locations:

- `components/fiat/sell/FiatSellFlow.tsx` owns the page/modal flow and reuses the wallet unlock/signing machinery.
- `lib/crypto-backend/fiat-offramp.ts` owns capability-derived options, typed beneficiary payloads, idempotency, quote/order state mapping, and separate confirmation keys.
- `hooks/crypto/useFiatBeneficiaryRequirements.ts` and `hooks/crypto/useFiatBeneficiaries.ts` own reads/mutations.
- The backend rehydrates the owned `cryptoIntent` on `GET /fiat/orders/:orderId` so refresh/resume can still sign.

### Exit criteria

- One bank offramp completes in controlled production testing.
- The returned crypto transaction is signed from the authenticated user's wallet and reconciles to the OnSwitch payout.
- No raw bank data or provider credentials leaves the intended boundary.
- The flow is still disabled by backend capability/approval until the canary is approved.

### Phase 8 — Bridge USD withdrawal

**Status:** Backend provider flow and frontend withdrawal/signing surface implemented; Bridge beneficiary creation and provider ownership evidence remain an external approval gate.

### Objective

Let a user sell USDC from their own wallet to their own verified USD bank account through Bridge.

### Backend contract already available

- `POST /fiat/orders` with `provider: "bridge"` starts the withdrawal.
- Supported channels are `ach`, `ach_same_day`, `wire`, and `fednow` when the backend/account capability allows it.
- The backend checks the user's Bridge customer/base endorsement.
- The backend checks that the beneficiary belongs to the user and is verified.
- The backend checks the wallet destination and canonical USDC token for the selected network.
- Bridge returns a crypto deposit address and the backend creates a normal WorldStreet crypto intent.
- The frontend signs/submits the crypto intent.
- No `/confirm` route is used for Bridge withdrawal.
- Provider status, webhooks, and reconciliation determine completion/reversal/refund state.

### Frontend implementation steps

#### 8.1 Resolve the beneficiary contract first

- The withdrawal UI intentionally does not build a Bridge bank-account form until the exact provider payload and ownership evidence are approved.
- The backend remains responsible for constructing the Bridge payload and proving ownership.
- The dashboard lists only verified, user-owned Bridge USD beneficiaries returned by `GET /fiat/beneficiaries`.
- Hide or disable `fednow` unless the capability response explicitly advertises it; the frontend derives channels from capability and fails closed.
- The dashboard never lets a user enter or edit an external-account/provider ID.

#### 8.2 Build withdrawal review

- Select a backend-supported wallet network that the signed-in wallet actually owns; submit the literal `asset: "USDC"` symbol and let the backend resolve the canonical token address.
- Enter a bounded USDC source amount.
- Show USD destination, channel, fees/limits, expected settlement language, and the beneficiary mask.
- Explain that Bridge currently has no quote endpoint and that the submitted amount is the source amount accepted by the backend.
- Require explicit review before creating the order.

#### 8.3 Create, sign, and poll

- Create the order with one idempotency key; the helper fingerprints the exact request and reuses the same key for a retry.
- Read `cryptoIntent` from the response.
- Sign the exact backend intent locally.
- Submit using the existing transaction-intent endpoint.
- Do not call OnSwitch `/confirm` or any Bridge confirmation route.
- Poll the fiat order to `completed`, `failed`, `reversed`, `manual_review`, `refunded`, or other backend-defined terminal state. The order detail route rehydrates the owned crypto intent after refresh so signing can resume.
- Reconcile uncertain submit timeouts by reading the existing order/intent before retrying.

#### 8.4 Test and release

- verified beneficiary required;
- unverified/pending/mismatch beneficiary blocked;
- ownership is user-scoped;
- unsupported network or USDC rejected;
- `fednow` hidden unless capability allows it;
- no quote endpoint is called;
- no `/confirm` call occurs;
- duplicate withdrawal does not create a second provider transfer;
- returned/refunded/undeliverable/manual-review states are visible;
- wallet balance/history refreshes only after the crypto transfer is submitted and the backend reports the appropriate reconciliation state.

### Exit criteria

- A verified test user withdraws to a verified own USD bank account in a controlled environment.
- The provider transfer, crypto deposit, local transaction intent, order, webhook, and user history reconcile.
- The product has an approved response for ACH ownership limitations before enabling US ACH at scale.

### Phase 9 — Fiat order history and recovery UX

**Status:** Backend list/detail routes and dashboard history/recovery surface implemented; deployed authorization, copy, and controlled recovery verification remain.

### Objective

Give users a durable place to recover and understand OnSwitch/Bridge orders after leaving a Buy/Sell screen.

### Implemented work

- `useFiatOrders` reads the signed-in user's `GET /fiat/orders` list with read retry policy and focus refresh.
- `FiatOrderHistory` is rendered on the Transactions page with explicit refresh, newest-first rows, expandable owned-order detail refresh, safe state/reason fields, and no provider-display blob rendering.
- Recovery actions write the existing pending-flow reference and route back to Buy/Sell; no history action creates a second order.
- Bridge USD withdrawal recovery uses the dedicated `fiat-bridge-sell` pending-flow key and existing wallet signing flow.
- Terminal, manual-review, blocked, reversal, refund, and in-flight states use distinct state labels/colors and suppress unsafe automatic retry CTAs.
- The local development mock includes OnSwitch and Bridge order rows plus a verified Bridge beneficiary so the history and USD withdrawal surfaces can be exercised without provider calls.

### Contract cleanup needed

Confirm which backend fields carry safe user-facing reasons for each state:

- `failureReason`;
- `reviewReason`;
- `refundReason`.

### Exit criteria

- A user can leave the screen and recover every order without creating a duplicate mutation.
- History does not poll continuously while idle.
- All error/support views retain `requestId` and public reference without exposing provider secrets.

### Phase 10 — Security, test, and release hardening

**Status:** Complete for the code release. Cross-repository tests, typechecks,
touched-source lint, production builds, proxy verification, and release-default
checks passed locally. Live provider activation remains fail-closed until the
production secret manager, provider approvals, webhooks, and compliance sign-off
are configured.

### Backend verification

Run in `worldstreet-crypto-backend`:

```powershell
npm run typecheck
npm test
npm run verify:fiat-config
npm run build
```

Release evidence from this implementation:

- Backend: 40 test files / 136 tests passed; typecheck and production TypeScript
  build passed.
- Frontend: 57 test files / 846 tests passed; typecheck passed; touched-source
  ESLint passed; production build and `pnpm verify:crypto` passed.
- The deployed crypto host returned HTTP 200 for both `/health` and `/ready`.
- The default frontend flags are now OnSwitch/Bridge; setting either flag to
  `legacy` is an explicit rollback.

Verify specifically:

- provider keys are server-only;
- provider host/key environment pairing is enforced;
- internal compliance/reconciliation routes require internal authorization;
- webhooks use raw-body signature verification;
- user ownership filters are present on every read/mutation;
- beneficiary ownership is required before payout;
- no raw provider/bank/KYC payload is stored in audit metadata;
- idempotency body fingerprints reject key reuse with a different request;
- state transitions cannot move backwards;
- reconciler does not create duplicate payouts;
- `FIAT_RAMP_ENABLED=false` blocks every new money-moving path.

### Frontend verification

Run in `dashboard-revamp`:

```powershell
pnpm typecheck
pnpm test
pnpm exec eslint "app/api/crypto/[...path]/route.ts" components/buy-sell components/fiat hooks/crypto lib/crypto-backend lib/fiat-flags.ts
pnpm build
```

The repository-wide lint command currently traverses generated `.next` artifacts in a `.claude` worktree, so source-directory lint is the release check until the ignore configuration is corrected.

Verify specifically:

- browser calls use `/api/crypto` only;
- every frontend fiat route is in the proxy allowlist;
- no provider key appears in source, `.env`, bundles, source maps, telemetry, or errors;
- no raw account number or full deposit instruction is logged;
- provider display fields are rendered as text, never injected HTML;
- all mutation retries reuse the exact same idempotency key;
- an expired quote creates a new key;
- a 401 does not create a duplicate order;
- the mock gate cannot activate in a production build;
- local/Bridge/OnSwitch unavailable states cannot be bypassed by manually invoking a CTA.

### Test matrix

| Scenario | Expected result |
|---|---|
| Master switch off | Capability disabled; no mutation attempted |
| Provider credential missing | Readiness blocked; safe unavailable UI |
| Provider account not approved | Discovery or operation blocked according to backend readiness |
| Expired quote | `FIAT_QUOTE_NOT_ACTIVE`; new quote/key required |
| Same mutation retried | Existing quote/order/account returned; no duplicate provider resource |
| Different body with same key | Idempotency conflict; no second mutation |
| Missing session | 401; session recovery only, no mutation replay with a new key |
| Foreign order/beneficiary/account ID | 404/403; no data disclosure |
| Pending beneficiary | Cannot submit payout |
| Name mismatch | Cannot save/activate beneficiary |
| Unsupported network/asset | Safe 422-style unavailable state |
| Provider timeout | Read retry/backoff; mutation reconciliation before retry |
| Invalid webhook signature | 401/400 and no state change |
| Duplicate webhook | Idempotent acknowledgement; no duplicate ledger transition |
| Out-of-order webhook | Monotonic transition protection |
| Bridge sandbox no settlement | Fixture/reconciliation path proves state handling without pretending funds arrived |
| Wallet signing rejected | Order remains recoverable; no false completion |
| Transaction submit timeout | Read existing intent/order before retry |
| Provider reversal/refund | Visible non-success state; no silent balance credit |

### Phase 11 — Production release handoff

**Status:** Both repositories are ready to push to their default branches and the
frontend release default is committed. The code push is the requested Phase 11
action. Runtime activation is intentionally not claimed until the live provider
configuration is present on the deployment hosts.

This release does not promote or depend on sandbox credentials. Production
activation requires all of the following in the backend deployment's secret
manager, never in Git or `NEXT_PUBLIC_*` variables:

- `FIAT_RAMP_ENVIRONMENT=production`;
- `FIAT_RAMP_ENABLED=true`;
- `FIAT_RAMP_PRODUCTION_APPROVED=true` and `FIAT_COMPLIANCE_APPROVED=true`;
- approved live OnSwitch and Bridge credentials;
- verified provider webhook configuration/public key;
- provider account/corridor approval and an operational reconciliation owner;
- no user allowlist if the intended audience is everyone.

Until those values are set and verified, `/fiat/config` must remain unavailable
and all money-moving mutations must fail closed. No sandbox key is a substitute.

### Rollout order

1. Push and deploy the backend/frontend commits with money movement fail-closed.
2. Configure and verify the live provider secret-manager values and webhooks.
3. Validate `/fiat/config` read-only discovery on the live deployment.
4. Complete one approved low-limit OnSwitch African bank onramp with an owned wallet.
5. Complete OnSwitch offramp with one verified owned bank beneficiary.
6. Complete Bridge KYC, virtual-account deposit, and reconciliation.
7. Complete Bridge withdrawal only after external-account ownership is verified.
8. Verify observability, reconciliation, support lookup, and the kill-switch drill.
9. Expand to all approved corridors/users according to provider coverage and compliance approval.

### Canary gate

Before increasing exposure, confirm:

- correct environment (`production`);
- live provider credentials match the production endpoints;
- `GET /api/crypto/fiat/config` reports expected capabilities and no secret fields;
- provider webhooks arrive and verify;
- provider status and local status agree;
- blockchain transaction and provider reference are linked;
- user balance/history updates once and only once;
- duplicate/retry tests pass;
- support can search by request ID, public reference, order ID, provider status, and transaction hash;
- rollback has been rehearsed.

### Rollback

For an incident:

1. Set `FIAT_RAMP_ENABLED=false` in the backend runtime environment.
2. Confirm `/fiat/config` reports disabled/unavailable.
3. Stop new quote/order/beneficiary/virtual-account/withdrawal mutations.
4. Continue safe reads, webhook intake, reconciliation, and customer support investigation as designed.
5. Do not mark pending orders failed merely because the switch is off.
6. Reconcile all in-flight provider and blockchain states before re-enabling.

The frontend must not be the only place where rollback occurs.

## 5. Ownership of the remaining work

### Backend owner

- close network/asset capability contract;
- resolve OnSwitch customer eligibility policy;
- document Bridge beneficiary/external-account schema and ownership evidence;
- verify provider API/webhook contracts and production limitations;
- schedule/monitor reconciliation;
- expose safe reason/status fields;
- maintain the single backend kill switch.

### Frontend owner

- keep Buy and Sell on the released default while preserving the explicit `legacy` rollback path;
- verify the Bridge network selection contract against the deployed backend;
- complete the OnSwitch offramp live canary and controlled payout verification;
- verify the Bridge withdrawal UI/signing flow against the deployed backend;
- verify fiat order history/recovery across refresh, focus, terminal, and manual-review states;
- add cross-flow error/retry/telemetry behavior;
- finish source lint/build/security gate.

### Product/compliance/operations owner

- approve supported countries/corridors/channels and limits;
- approve OnSwitch off-ramp account-owner/compliance controls;
- approve Bridge USD user eligibility and withdrawal countries;
- approve own-account evidence for US ACH and mobile money;
- approve fees, settlement copy, refund policy, and manual-review SLAs;
- approve production canary and rollback criteria.

## 6. Definition of done

The OnSwitch and Bridge integration is complete only when all of the following are true:

- The backend capability response is the source of truth for rails, corridors, assets, networks, channels, and readiness.
- `FIAT_RAMP_ENABLED` stops every new fiat money-movement lane.
- No provider key or raw provider/bank/KYC data reaches the browser.
- All user-owned resources are scoped to the authenticated user.
- OnSwitch onramp works end-to-end for an approved African bank corridor.
- OnSwitch offramp works end-to-end for a verified own payout account and confirms the signed crypto deposit exactly once.
- Bridge USD virtual-account funding works for a backend-supported network and credits USDC to the owned wallet.
- Bridge USD withdrawal works only for a verified own USD bank account, with no fake quote and no OnSwitch confirm call.
- Unsupported/unverifiable beneficiary types remain blocked rather than being treated as verified.
- Webhooks are signature-verified, replay-protected, deduplicated, normalized, and reconciled.
- Every mutation is idempotent and uncertain responses are reconciled before retry.
- Fiat order history can recover pending and completed flows without duplicate mutations.
- Sandbox limitations are covered by fixtures and controlled tests.
- Backend typecheck/tests/config verification, frontend typecheck/tests/lint/build, security review, observability, and canary tests pass.
- The production canary reconciles provider records, blockchain records, user history, and balances exactly.

## 7. Existing source references

### Dashboard

```text
app/api/crypto/[...path]/route.ts
components/buy-sell/buy-sell-client.tsx
components/fiat/buy/FiatBuyFlow.tsx
components/fiat/sell/FiatSellFlow.tsx
components/fiat/sell/FiatSellRouter.tsx
components/fiat/sell/BridgeUsdSell.tsx
components/fiat/history/FiatOrderHistory.tsx
components/fiat/bridge/BridgeUsdBuy.tsx
components/fiat/compliance/BridgeKycPanel.tsx
components/fiat/compliance/OnswitchProfileForm.tsx
hooks/crypto/useFiatConfig.ts
hooks/crypto/useFiatCompliance.ts
hooks/crypto/useFiatOrderPoll.ts
hooks/crypto/useFiatVirtualAccounts.ts
hooks/crypto/useFiatVirtualAccountPoll.ts
hooks/crypto/useFiatBeneficiaries.ts
hooks/crypto/useFiatBeneficiaryRequirements.ts
hooks/crypto/useFiatOrders.ts
lib/crypto-backend/client.ts
lib/crypto-backend/fiat-capabilities.ts
lib/crypto-backend/fiat-errors.ts
lib/crypto-backend/fiat-onramp.ts
lib/crypto-backend/fiat-offramp.ts
lib/crypto-backend/fiat-bridge-onramp.ts
lib/crypto-backend/fiat-bridge-withdrawal.ts
lib/fiat-flags.ts
docs/FIAT_RAMP_CONTEXT.md
docs/FIAT_RAMP_CHECKLIST.md
docs/fiat-frontend-integration-guide.md
```

### Crypto backend

```text
src/api/routes/fiat.ts
src/api/routes/fiatWebhooks.ts
src/fiat-ramp/readiness.ts
src/fiat-ramp/catalog.ts
src/fiat-ramp/service.ts
src/fiat-ramp/gates.ts
src/fiat-ramp/compliance.ts
src/fiat-ramp/beneficiaries.ts
src/fiat-ramp/quotes.ts
src/fiat-ramp/orders.ts
src/fiat-ramp/virtualAccounts.ts
src/fiat-ramp/reconciliation.ts
src/fiat-ramp/providers/OnswitchClient.ts
src/fiat-ramp/providers/OnswitchAdapter.ts
src/fiat-ramp/providers/BridgeClient.ts
src/fiat-ramp/providers/BridgeAdapter.ts
src/fiat-ramp/webhooks/signature.ts
src/fiat-ramp/webhooks/service.ts
src/fiat-ramp/domain/state.ts
src/scripts/verifyFiatRampConfig.ts
docs/runbooks/fiat-ramp-phase-0-1.md
```

This plan is intentionally additive. It records the implementation delivered in phases 0–9 and the remaining provider, security, and canary verification path; it does not enable provider money movement by itself.
