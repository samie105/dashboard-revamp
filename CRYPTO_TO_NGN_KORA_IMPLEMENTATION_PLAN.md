# Crypto-to-NGN Off-Ramp with Kora — Implementation Plan

## Objective

Build a production-safe crypto-to-NGN off-ramp for WorldStreet. A signed-in user selects a supported asset from their **modern self-custody wallet**, enters a Nigerian bank account, reviews a time-limited quote, and signs an on-chain transfer to a configured WorldStreet treasury wallet. After the backend independently verifies final receipt of the exact asset and amount, it initiates an NGN payout through Kora.

The first release should be intentionally narrow: **Arbitrum USDC only**, subject to confirming Kora production access and treasury liquidity. Additional stablecoins and networks are introduced only after the first route is reconciled successfully in production. Volatile assets are out of scope for v1 because Kora's fiat conversion rate does not itself provide a reliable crypto/USD execution price.

## Non-negotiable invariants

1. Kora secret keys never reach browser code, browser logs, API responses, source control, or client-visible environment variables.
2. The Kora live secret already shared during development must be rotated before implementation or deployment.
3. Private wallet keys remain client-side. The backend may construct and validate an intent, but the browser unlocks and signs it.
4. A Kora payout must never start before the corresponding crypto transfer is independently verified and sufficiently confirmed.
5. The backend must verify transaction sender, recipient, network, asset contract, amount, success status, and finality. A user-supplied hash alone is not proof of payment.
6. Every quote, transaction, webhook, payout attempt, and state transition is persisted and auditable.
7. At-most-once payout behavior is enforced with database uniqueness, state transitions, and Kora references—not only application-memory locks.
8. Treasury destinations are allowlisted in code and configured in deployment secrets. The service fails closed if the two values disagree.
9. The UI discloses the exchange rate, service margin, network fee, expected NGN payout, quote expiry, and confirmation delay before signing.
10. The feature can be disabled globally or per network without disabling the rest of the wallet.

## Scope

### Included

- Modern wallet balances and frontend signing.
- Nigerian bank listing and account resolution through Kora.
- Server-generated, expiring crypto-to-NGN quotes.
- A configurable service margin expressed in basis points.
- On-chain transfer verification and chain-specific confirmation rules.
- Kora NGN payout creation, webhook handling, status requery, and reconciliation.
- A durable off-ramp ledger and a user-facing status timeline.
- Admin/operator diagnostics, limits, feature flags, and emergency controls.
- An additive migration path from the existing manual withdrawal flow.

### Not included in v1

- Legacy Privy wallet spending.
- Arbitrary destination addresses.
- Cash deposits, cards, peer-to-peer matching, or manual proof-of-payment uploads.
- Selling volatile assets such as ETH, SOL, TON, SUI, TRX, or BTC.
- Automatic refunds before a reviewed refund policy and signing path exist.
- Treating a Kora payout balance as if it were on-chain treasury liquidity. These are separate inventories.
- Directly converting received crypto through Kora unless the exact Kora product and settlement route are contractually enabled and tested.

## Recommended v1 product contract

| Item | v1 decision |
|---|---|
| Source wallet | Modern WorldStreet wallet only |
| Network | Arbitrum One |
| Asset | Native Arbitrum USDC |
| Minimum | USD 1.00, plus any higher provider/economic minimum |
| Maximum | Configurable conservative limit per transaction and per day |
| Signing | Browser-side with the existing modern-wallet unlock/signing flow |
| Destination | One allowlisted Arbitrum treasury address |
| Fiat destination | Verified Nigerian NGN bank account |
| Pricing | Stablecoin USD amount × Kora USD/NGN rate, less disclosed margin |
| Payout | Kora API from a pre-funded merchant NGN balance |
| Release | Feature flag plus initial user allowlist |

## System boundary

```text
Dashboard browser
  ├─ Clerk session
  ├─ modern wallet balance
  ├─ encrypted-wallet unlock
  └─ local transaction signing
          │ authenticated intent / signed transaction hash
          ▼
Crypto backend
  ├─ quote engine and treasury allowlist
  ├─ order state machine and ledger
  ├─ independent chain verification
  ├─ Kora server-side client
  ├─ payout worker and reconciler
  └─ webhook receiver
          │ payout API
          ▼
Kora ─────────────► Nigerian bank account
```

The frontend must not call Kora directly. The backend is the only payout authority. Kora payouts debit the merchant's funded Kora balance, so treasury crypto receipt and Kora fiat liquidity must be monitored separately.

## Decisions required before production

- Final service margin in basis points. Keep it configurable as `CRYPTO_NGN_MARGIN_BPS`; do not invent or hide the value.
- Initial transaction maximum, daily maximum, and per-user velocity limits.
- Exact Arbitrum USDC treasury address and a documented rotation process.
- Arbitrum confirmation/finality threshold.
- Whether the displayed amount is “you send” or “you receive”; v1 should support both calculations but make one canonical.
- Treatment of gas fees and transfers that arrive short, overpaid, late, duplicated, or from an unexpected sender.
- Refund policy, refund fees, approval authority, and support SLA.
- Required KYC/risk checks and whether the beneficiary name must match the verified WorldStreet identity.
- Kora production payout, account-resolution, exchange-rate, webhook, and balance capabilities enabled on the merchant account.

---

## Phase 0 — Provider, compliance, and commercial readiness

### Work

- Rotate the exposed Kora live secret and store the replacement only in the production secret manager/environment.
- Confirm Kora production payout access for Nigerian NGN bank accounts.
- Confirm the merchant NGN balance is funded and establish low-balance alert thresholds.
- Confirm the currently supported bank-list, account-resolution, payout, balance, currency-conversion, webhook, and payout-status contracts against Kora sandbox and production documentation.
- Confirm webhook signature verification and raw-body requirements from Kora's current specification.
- Agree on margin, limits, settlement ownership, compliance checks, refund policy, and customer support escalation.
- Assign treasury ownership and require controlled approval for treasury address changes.

### Acceptance gate

- A rotated credential succeeds in sandbox or an approved production test.
- One test account can be resolved and one minimal test payout can be reconciled.
- Product owner signs off on fee disclosure, limits, and refund rules.
- No live secret exists in git history or client build artifacts.

---

## Phase 1 — Configuration, secrets, and feature controls

### Backend configuration

Add validated server-only settings similar to:

```dotenv
CRYPTO_NGN_ENABLED=false
CRYPTO_NGN_ALLOWED_USERS=
CRYPTO_NGN_MIN_USD=1
CRYPTO_NGN_MAX_USD=100
CRYPTO_NGN_DAILY_MAX_USD=250
CRYPTO_NGN_MARGIN_BPS=
CRYPTO_NGN_QUOTE_TTL_SECONDS=60
CRYPTO_NGN_ARBITRUM_CONFIRMATIONS=
CRYPTO_NGN_KORA_PAYOUT_ENABLED=false
KORA_BASE_URL=https://api.korapay.com
KORA_PUBLIC_KEY=
KORA_SECRET_KEY=
CRYPTO_NGN_ARBITRUM_USDC_TREASURY=
```

No actual credential or treasury address belongs in this plan. `KORA_SECRET_KEY` must never use a `NEXT_PUBLIC_` prefix.

### Dual treasury validation

- Add an immutable `TREASURY_REGISTRY` entry containing network ID, asset contract, decimals, and expected destination address.
- Require the deployment environment value to equal the code allowlist value at startup.
- Normalize EVM addresses before comparison but preserve checksum form for display.
- Refuse to enable the feature when configuration is incomplete or mismatched.
- Address rotation requires an intentional code change, deployment configuration change, and operator checklist.

### Feature controls

- Global quote switch.
- Global payout switch independent of quote creation.
- Per-network and per-asset switches.
- Optional Clerk-user allowlist for staged rollout.
- Emergency “confirm deposits but do not create payouts” mode.

### Acceptance gate

- Production startup fails with a clear error on missing/mismatched critical configuration.
- Config endpoints expose capabilities and limits, never secrets.
- Disabling payouts leaves confirmed orders queued safely for later reconciliation.

---

## Phase 2 — Domain models and durable state machine

### `CryptoNgnQuote`

Persist the exact economics shown to the user:

- `quoteId`, `userId`, `walletId`, `networkId`, and `assetId`.
- Source amount in base units and display units.
- Stablecoin USD value.
- Raw Kora USD/NGN rate and provider timestamp/source.
- Margin basis points, effective customer rate, gross NGN, fee NGN, and net NGN.
- Treasury address and token contract captured immutably.
- `expiresAt`, creation timestamp, and quote version.

### `CryptoNgnOrder`

- Immutable quote snapshot.
- Clerk subject and modern wallet/account IDs.
- Expected sender, recipient, network, contract, and base-unit amount.
- Beneficiary bank code, masked account number, resolved account name, and encrypted/tokenized sensitive fields where required.
- Client idempotency key and server order reference.
- Source transaction hash, block/slot, confirmations, and verification evidence.
- Kora payout reference, Kora status, response identifiers, and last reconciliation timestamp.
- Current state, state version, timestamps, failure code, failure detail, and manual-review reason.
- Refund metadata without private signing material.

### State machine

```text
draft
  → quoted
  → bank_verified
  → awaiting_signature
  → transaction_submitted
  → confirming
  → crypto_confirmed
  → payout_queued
  → payout_processing
  → paid
```

Terminal or exception states:

```text
expired | cancelled | transaction_failed | underpaid | overpaid
wrong_asset | wrong_destination | payout_failed | manual_review
refund_required | refunded
```

### Database guarantees

- Unique order reference.
- Unique `(userId, clientIdempotencyKey)`.
- Unique source transaction hash per network.
- Unique Kora payout reference.
- Compare-and-set state transitions using a state version.
- Append-only state transition/audit events.

### Acceptance gate

- Invalid state transitions are rejected in unit tests.
- Concurrent payout workers cannot pay the same order twice.
- Restarting the backend cannot lose or duplicate an in-progress order.

---

## Phase 3 — Kora server adapter

### Work

Create one server-only Kora client with typed methods for:

- List Nigerian banks.
- Resolve a bank account.
- Retrieve the required conversion rate.
- Read merchant payout balance.
- Create an NGN bank payout.
- Requery payout status.
- Parse and verify webhooks.

The exact payload fields must follow the currently installed Kora API version. Account-resolution currency/country fields must be verified in sandbox rather than inferred.

### Reliability rules

- Short connect timeout and bounded total timeout.
- Retry read-only calls on transient network/5xx/429 errors with exponential backoff and jitter.
- Never blindly retry payout creation after an uncertain response. Requery using the same unique reference first.
- Attach an internal request ID and record Kora reference/status.
- Redact authorization headers, account numbers, API keys, and provider payloads containing personal information.
- Normalize provider errors into stable internal codes.

### Acceptance gate

- Contract tests cover success, validation error, timeout, 429, 5xx, malformed response, and unknown payout result.
- Logs contain correlation IDs and status codes but no credentials or full bank details.
- A simulated timeout after payout submission cannot create a duplicate payout.

---

## Phase 4 — Quote and rate engine

### Calculation

For v1 USDC:

```text
gross_ngn = usdc_amount × kora_usd_ngn_rate
fee_ngn   = gross_ngn × margin_bps / 10,000
net_ngn   = gross_ngn - fee_ngn
```

- Use integer/base-unit or decimal arithmetic; never JavaScript floating-point money calculations.
- Apply explicit rounding rules once, in the backend.
- Store the raw rate, effective customer rate, margin, and final amount in the quote.
- Reject amounts below USD 1.00 or below any higher Kora/economic minimum.
- Reject amounts over transaction/daily limits or beyond available wallet balance.
- Expire quotes quickly, recommended 60 seconds.
- The order retains the accepted quote even if the market/provider rate changes after the source transfer is submitted.

### Price policy

- V1 treats supported USDC as USD-equivalent subject to an explicit stablecoin policy.
- Before volatile assets are added, integrate a separate trusted crypto/USD price source, spread policy, price freshness guard, and slippage protection.
- Do not market the service margin as a network fee.

### Acceptance gate

- Golden tests cover minimum, maximum, basis-point margin, rounding, stale rate, unavailable rate, and insufficient Kora balance.
- The amount displayed in review exactly equals the persisted quote and eventual payout request.

---

## Phase 5 — Bank account collection and validation

### Backend routes

- `GET /v1/offramp/ngn/banks`
- `POST /v1/offramp/ngn/bank-accounts/resolve`

### Rules

- Require authenticated Clerk identity.
- Validate bank code and Nigerian account-number format server-side.
- Resolve through Kora and return only the bank name and resolved account name needed for confirmation.
- Do not consider an account verified merely because its local format is valid.
- Rate-limit resolution by user and IP.
- Cache the bank list, not user account-resolution results beyond a short safe TTL.
- Store masked account details in ordinary logs and views.

### Acceptance gate

- The UI cannot continue until Kora confirms the beneficiary.
- A user sees the resolved account name and explicitly confirms it.
- Failed or altered details invalidate the previous resolution.

---

## Phase 6 — Quote and order APIs

### Proposed routes

- `GET /v1/offramp/ngn/config` — enabled assets, networks, limits, and availability.
- `POST /v1/offramp/ngn/quotes` — create a short-lived quote.
- `POST /v1/offramp/ngn/orders` — accept quote and verified beneficiary with an idempotency key.
- `POST /v1/offramp/ngn/orders/:id/transaction-intent` — return the exact transfer intent.
- `POST /v1/offramp/ngn/orders/:id/transaction` — attach the broadcast transaction hash.
- `GET /v1/offramp/ngn/orders/:id` — retrieve durable status.
- `GET /v1/offramp/ngn/orders` — user history.
- `POST /v1/webhooks/kora` — provider callback, outside the normal user-auth middleware.

### Authorization

- Every user route resolves Clerk subject to the modern identity and checks order ownership.
- The source wallet/address comes from the authenticated modern-wallet record, never arbitrary request JSON.
- A user cannot replace the treasury destination, token contract, beneficiary, or amount after order creation.
- Webhooks use provider verification and replay protection, not Clerk authentication.

### Acceptance gate

- IDOR tests prove users cannot view or mutate other users' orders.
- Repeating a request with the same idempotency key returns the original result.
- Expired quotes cannot create orders.

---

## Phase 7 — Frontend off-ramp page

### Route and page structure

Add a dedicated route such as `/cash-out` with these steps:

1. Choose supported network and asset.
2. Enter crypto amount or desired NGN amount.
3. Select or enter Nigerian bank details.
4. Resolve and confirm account name.
5. Review rate, margin, source amount, expected NGN, gas estimate, destination, and expiry.
6. Unlock modern wallet and sign.
7. Show broadcast, confirmation, payout, and completion progress.

### UX requirements

- Use modern wallet balances only; never fall back to legacy Privy addresses.
- V1 preselects Arbitrum USDC and clearly labels unsupported assets.
- Refresh the quote without silently changing an already accepted amount.
- Disable double submission while signing or broadcasting.
- Persist the active order ID so refresh/reopen resumes status safely.
- Distinguish “crypto sent,” “crypto confirmed,” “payout processing,” and “paid.”
- Show a support reference for manual-review/failure states.
- Never claim the payout is complete from a submitted on-chain transaction alone.

### Acceptance gate

- Reloading, closing, or changing devices does not lose the order.
- Mobile layout supports signing and bank confirmation without obscured controls.
- The review screen exactly matches the backend quote.

---

## Phase 8 — Modern-wallet intent and frontend signing

### Work

- Reuse the current modern-wallet transaction-intent and encrypted-envelope unlock mechanisms.
- The backend builds a transfer intent containing the fixed network, USDC contract, treasury recipient, exact base-unit amount, quote/order IDs, nonce/expiry, and human-readable summary.
- The frontend independently checks that the intent matches the accepted order before signing.
- Sign locally and broadcast through the appropriate Arbitrum RPC path.
- Return only transaction metadata/hash to the backend; never return private keys or decrypted wallet packages.
- Prevent arbitrary calldata, recipient, token, or amount injection through the off-ramp route.

### Failure handling

- User rejection returns the order to a retryable `awaiting_signature` state.
- Broadcast uncertainty triggers transaction lookup before another transfer is allowed.
- A replacement transaction must be explicitly associated and reverified.
- Do not create a new order automatically after an expired quote if an on-chain transfer may already exist.

### Acceptance gate

- The signed transaction can only transfer the quoted USDC amount to the allowlisted treasury.
- Reject, timeout, duplicate click, stale nonce, insufficient gas, and RPC failover are tested.
- No decrypted signing material appears in network traffic or logs.

---

## Phase 9 — Independent on-chain verification

### Verification requirements

For the submitted Arbitrum transaction, verify:

- Correct chain ID/network.
- Successful receipt status.
- Expected source modern-wallet address.
- Exact allowlisted treasury recipient.
- Exact USDC contract.
- Exact transfer amount in base units.
- Transaction uniqueness.
- Required confirmation/finality threshold.

Do not depend only on historical-address APIs. Transaction receipt and decoded event verification should use reliable chain RPC/indexer providers with timeouts, provider rotation, and typed failure states.

### Reconciliation worker

- Poll pending transactions with bounded backoff.
- Resume after process restart.
- Detect dropped/replaced transactions.
- Handle reorgs before payout release.
- Route underpayment, overpayment, wrong token, wrong destination, and sender mismatch to explicit states.
- Never “round up” an on-chain amount to satisfy an order.

### Acceptance gate

- A forged hash, unrelated transfer, wrong token, wrong amount, reverted transaction, and duplicate hash cannot unlock a payout.
- A confirmed valid transfer advances exactly once to `crypto_confirmed`.

---

## Phase 10 — Payout orchestration

### Worker behavior

- Claim one `payout_queued` order atomically.
- Recheck feature flag, limits, compliance state, beneficiary snapshot, and Kora balance.
- Generate a deterministic unique Kora reference from the order.
- Submit the exact quoted net NGN amount.
- Persist the provider response before releasing the worker lock.
- On uncertain submission, requery by reference before any retry.
- Advance to `paid` only from a verified terminal-success provider state.
- Send failures that may have debited funds to reconciliation/manual review, not automatic resubmission.

### Liquidity guard

- Maintain a configurable NGN reserve floor.
- Stop accepting or clearly mark quotes unavailable when the merchant balance cannot safely cover the payout plus reserve.
- Alert before the balance reaches the hard stop.

### Acceptance gate

- Concurrent workers and repeated webhooks cannot produce two payouts.
- Payout amount and beneficiary equal the immutable order snapshot.
- Insufficient merchant balance fails safely before payout submission.

---

## Phase 11 — Webhooks and reconciliation

### Webhook handler

- Preserve raw request bytes if required by Kora signature verification.
- Verify the documented signature/authentication mechanism before parsing as trusted input.
- Reject stale, invalid, malformed, or replayed events.
- Store a deduplicated provider event ID/hash and minimal redacted payload.
- Return promptly; process state updates asynchronously.
- Treat webhook data as a hint and requery Kora when status or amount is ambiguous.

### Scheduled reconciliation

- Requery non-terminal payouts on a controlled schedule.
- Identify Kora-success/local-pending and Kora-failed/local-processing mismatches.
- Identify crypto-confirmed orders stuck before payout.
- Produce an operator report and alert for aged orders.

### Acceptance gate

- Out-of-order and duplicate webhook tests preserve correct state.
- Temporary webhook loss is healed by reconciliation.
- No webhook can alter a different order by changing a reference in its body.

---

## Phase 12 — Ledger and transaction history integration

### Work

- Record the on-chain outgoing USDC transfer as a modern-wallet transaction.
- Record the linked NGN payout as an off-ramp settlement event, not another crypto transfer.
- Link both records with the order ID.
- Store money-in/out USD and NGN valuations from the accepted quote, not a later live-price flash.
- Prevent duplicate ingestion when the normal transaction-history synchronizer later discovers the same hash.
- Keep legacy wallet transaction rules separate.
- Add filterable user history and an operator view by user, hash, order reference, Kora reference, state, and date.

### Acceptance gate

- The transaction page renders stable values immediately from persisted records.
- The same source transaction appears once.
- Historical synchronization cannot rewrite the accepted payout valuation.

---

## Phase 13 — Security, fraud, and operational controls

### Controls

- Clerk authentication and modern-identity ownership checks on every user action.
- Step-up wallet unlock immediately before signing.
- Per-user/IP rate limits and payout velocity limits.
- Transaction and daily caps, with lower limits during rollout.
- Beneficiary-change cooling period if risk policy requires it.
- KYC/status checks before accepting an order.
- Optional account-name/identity-name review without silently rejecting legitimate naming variations.
- Deny known blocked banks/accounts/addresses where required.
- Structured audit events for configuration and manual interventions.
- Encryption for sensitive bank data at rest and strict retention/deletion policy.
- Secret scanning in CI and explicit log redaction tests.
- Separate operator permissions for reviewing and retrying; no generic endpoint that can force `paid`.

### Acceptance gate

- Threat-model review covers replay, IDOR, quote tampering, hash reuse, destination substitution, webhook forgery, payout duplication, insider changes, and leaked credentials.
- Security tests prove secrets and full account numbers never appear client-side.

---

## Phase 14 — Testing strategy

### Unit tests

- Quote arithmetic and rounding.
- Margin and limit rules.
- Treasury normalization/allowlist.
- State transitions and idempotency.
- Kora error normalization.
- Transaction-event decoding.

### Integration tests

- Kora bank list, account resolution, rate, balance, payout, requery, and webhook contracts using sandbox/mocks.
- MongoDB unique constraints and worker races.
- Arbitrum transaction verification against fixture receipts and a test network where practical.
- Existing modern-wallet intent/signing interfaces.

### End-to-end scenarios

- Happy path from quote to paid.
- Quote expiry before signing.
- User rejects signature.
- Insufficient USDC or ETH gas.
- RPC timeout before/after broadcast.
- Wrong token/address/amount/hash.
- Underpayment and overpayment.
- Confirmation delay and chain reorg.
- Kora timeout, 429, 5xx, declined payout, and unknown result.
- Duplicate click, duplicate API request, duplicate webhook, and worker restart.
- Page refresh and cross-device status recovery.
- Global pause after crypto receipt but before payout.

### Regression tests

- Existing wallet transfers, balances, transactions, Hyperliquid funding, and legacy-wallet pages remain unchanged.
- The off-ramp never reads legacy Privy balances or addresses.

### Acceptance gate

- All automated tests pass.
- Sandbox reconciliation produces zero duplicate payouts and zero unexplained state mismatches.

---

## Phase 15 — Observability and operator tooling

### Metrics

- Quotes created/expired/accepted.
- Orders by state and age.
- Crypto-confirmation latency.
- Payout latency and success/failure rate.
- Kora/RPC latency, timeout, 429, and 5xx rates.
- Available Kora NGN balance and treasury inventory.
- Manual-review and reconciliation mismatch counts.

### Alerts

- Crypto-confirmed order not queued promptly.
- Payout processing beyond SLA.
- Unknown payout result.
- Kora balance below warning/hard threshold.
- Repeated provider failures or webhook verification failures.
- Treasury configuration mismatch.
- Elevated rejection, duplicate, or fraud signals.

### Operator actions

- Inspect evidence and timeline.
- Requery chain/Kora status.
- Retry only an explicitly retryable, proven-not-paid payout.
- Move an order to manual review with reason.
- Initiate an approved refund workflow when implemented.
- Pause quotes or payouts without changing source code.

### Acceptance gate

- Every production order can be traced end to end using one order/reference ID.
- Operators can diagnose failures without accessing private keys or raw secrets.

---

## Phase 16 — Deployment and rollout

### Deployment order

1. Rotate Kora credentials and configure secret storage.
2. Deploy database indexes/models with feature disabled.
3. Deploy backend configuration, Kora adapter, APIs, workers, and webhook route.
4. Register and verify the production webhook URL.
5. Deploy the frontend page hidden behind the feature flag.
6. Run sandbox/end-to-end tests.
7. Enable quotes for an internal allowlist with payouts disabled and verify signing/confirmation.
8. Enable tiny real payouts for internal users.
9. Reconcile treasury and Kora balances manually after every initial test.
10. Expand limits/users gradually based on observed success.

### Recommended rollout stages

- Stage A: local mocks only.
- Stage B: Kora sandbox and test-chain fixtures.
- Stage C: mainnet Arbitrum USDC transfer with payout held for operator review.
- Stage D: automated minimal-value payout for internal allowlist.
- Stage E: limited beta with conservative caps.
- Stage F: general availability after reconciliation and support sign-off.

### Acceptance gate

- A production canary completes and reconciles exactly across wallet ledger, treasury receipt, order ledger, Kora payout, and bank result.
- Alerts and emergency controls are tested before broader release.

---

## Phase 17 — Rollback and incident handling

### Controls

- `CRYPTO_NGN_ENABLED=false`: stop new quotes/orders.
- `CRYPTO_NGN_KORA_PAYOUT_ENABLED=false`: continue verification but hold payouts safely.
- Per-network/asset disable switch.
- Worker concurrency set to zero without deleting queued work.
- Credential rotation without frontend deployment.

### Incident rules

- Never delete pending order records to “retry.”
- Never change a transaction hash or beneficiary after crypto confirmation.
- Requery before retrying any uncertain Kora submission.
- Reconcile on-chain treasury inflows and Kora outflows independently.
- Preserve audit evidence and communicate using the order support reference.

### Acceptance gate

- A rollback drill proves new activity stops while existing orders remain recoverable.
- Restarting after the incident resumes only safe, non-terminal work.

---

## Expansion after v1

Add routes one at a time in this order, each with its own treasury and verifier:

1. Ethereum USDC.
2. Arbitrum USDT.
3. Ethereum USDT.
4. Solana USDC/USDT.
5. Tron USDT.
6. Other stablecoins/networks after provider-history and confirmation reliability is proven.
7. Volatile assets only after a separate crypto/USD execution and hedging design is approved.

Each expansion requires contract/mint validation, decimals, confirmation policy, gas handling, history/receipt provider support, treasury inventory, end-to-end tests, and an independent feature flag. Sui and TON should not be declared supported merely because the modern wallet can hold or send them.

## Expected code areas

### Dashboard repository

- New off-ramp page and step components.
- API client/types for quotes, banks, orders, and statuses.
- Modern-wallet intent validation and signing integration.
- Active-order persistence and status polling with request deduplication/backoff.
- Transaction-history display integration.
- Feature navigation and user-facing disclosures.

### Crypto backend repository

- Environment schema and treasury registry.
- Kora client with redaction, retries, and idempotency behavior.
- Quote engine.
- Off-ramp models, indexes, service, controller, and routes.
- Chain-verification worker.
- Payout worker and reconciliation scheduler.
- Kora webhook verification/handler.
- Ledger integration, metrics, alerts, and admin diagnostics.
- Unit, integration, and end-to-end tests.

## Definition of done

- A user can cash out supported Arbitrum USDC from the modern wallet without copying an address or transaction hash manually.
- Bank details are verified by Kora and explicitly confirmed by the user.
- The user signs locally; no private key leaves the browser.
- The backend proves exact final crypto receipt before requesting payout.
- The Kora payout is idempotent, reconciled, and visible through a durable timeline.
- Rate, margin, and expected NGN are transparent and immutable after acceptance.
- Transaction history shows stable persisted valuations without duplicate or legacy-address contamination.
- Secrets are rotated, server-only, redacted, and absent from repository history/build output.
- Feature flags, limits, monitoring, alerts, rollback, and operator procedures are tested.
- At least one production canary reconciles across all systems before public rollout.

## External implementation references

- [Kora payouts](https://developers.korapay.com/docs/payout-via-api)
- [Kora API keys](https://developers.korapay.com/docs/api-keys)
- [Kora balance API](https://developers.korapay.com/docs/balance-api)
- [Kora currency conversion](https://developers.korapay.com/docs/convert-currency)
- [Kora integration testing](https://developers.korapay.com/docs/testing-your-integration)

These references must be rechecked immediately before implementation because provider payloads, authentication requirements, limits, and webhook behavior can change.
