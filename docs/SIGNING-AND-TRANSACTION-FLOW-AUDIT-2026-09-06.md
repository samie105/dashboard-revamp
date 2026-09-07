# Wallet, trading, swap, and bridge signing audit

Date: 2026-09-06

## Scope and evidence

This is a source audit of the current implementation, not a production transaction certification. No wallet secrets were accessed, no transactions were signed or broadcast, and no production data was changed. Application fixes are intentionally not part of this first report.

Audited frontend: `2f3656c5f0b85d567048adb005bb40e270e81d38`, `C:/Users/HP/Desktop/dashboard-revamp` (F).

Audited backend: `8ea8833ed846258546c1fe930682f1f6d9341961`, `C:/Users/HP/Desktop/Projects/worldstreet-crypto-backend` (B). A pre-existing local change in `src/wallet/chains/solana/SolanaAdapter.ts` was present; observations of that file refer to the working tree and are not proof of deployed behavior.

Paths below are relative to F or B. Line references identify the audited revision. Findings marked **confirmed** follow directly from the implementation. **Conditional** findings identify a concrete unsafe branch whose occurrence depends on concurrency, browser behavior, or provider responses. **Verification required** items must not be represented as demonstrated production failures.

Prior compiler/test success did not establish end-to-end support. In particular, the previous statement that Bitcoin swaps were complete was incorrect: the current Bitcoin swap payload cannot pass its own validator. Bitcoin tests currently cover invalid addresses and unsupported assets, not a successful signing/broadcast round trip.

## Priority overview

| ID | Priority | Flow | Principal problem |
| --- | --- | --- | --- |
| A01 | P1 | Bitcoin swaps | Required amount missing; validation always rejects the generated payload |
| A02 | P1 | Bitcoin signing | Signed transaction comparison does not protect all outputs/change |
| A03 | P1 | Bridge | Deposit nonce skips the next usable nonce |
| A04 | P1 | EVM swaps | ERC-20 allowance/approval execution is absent |
| A05 | P1 | Shared submission | Broadcast happens before durable submission state |
| A06 | P1 | Shared intents | Expired intent reused as a fresh intent |
| A07 | P1 | Shared intents | Read-then-insert races and missing request binding |
| A08 | P1 | Wallet security | Fresh verification policy is bypassed by an existing unlock |
| A09 | P1 | Swaps | A new unreviewed quote is fetched at execution |
| A10 | P1 | Swap retries | Idempotency key survives changed trade details |
| A11 | P1 | Bridge | Approval uses a timer; progress and retries are not durable |
| A12 | P1 | Bridge | Destination/settlement promise is not verified |
| A13 | P1 | TON transfers | First-send deployment state omitted |
| A14 | P1 | TON status | Message hash compared with transaction hash |
| A15 | P1 | Futures delegation | Revocation/limits not rechecked when submitting |
| A16 | P1 | Futures results | Nested order errors can be stored as submitted |
| A17 | P2 | Bitcoin fees | Dust, output-size estimates, and UTXO conflicts incomplete |
| A18 | P2 | Bitcoin wallet UX | Receive address maps omit Bitcoin |
| A19 | P2 | Provisioning | Adding one chain attempts every missing family |
| A20 | P2 | Errors | Normalization is not universal and loses provider causes |
| A21 | P2 | Swap quote UX | Error object reaches string state; stale quote remains on fetch failure |
| A22 | P2 | Transfers | Signing unnecessarily depends on a second intent fetch |
| A23 | P2 | Funding | Cached approval/deposit pair has incomplete recovery semantics |
| A24 | P2 | Confirmation | Source transaction confirmation is not cross-chain settlement |

P1 means a release-blocking functional or transaction-integrity defect in the affected path; it does not assert an observed exploit or loss. P2 means a significant reliability/UX defect or incomplete handling.

## Confirmed findings and remediation

### A01 — Bitcoin swaps fail their own intent validation

**Confirmed.** B `src/api/routes/spot.ts:321` builds a Bitcoin LI.FI payload containing `sellAmountBaseUnits`, but no `amountSatoshis`. B `src/wallet/chains/bitcoin/BitcoinAdapter.ts:84` requires `amountSatoshis` for both native transfers and `lifi-swap`.

Any Bitcoin-source quote that reaches this branch returns `TRANSACTION_POLICY_REJECTED: Invalid Bitcoin amount` before signing. Even adding that field would not finish the integration: signed validation searches for `unsigned.to` among Bitcoin outputs, although the swap sets `unsigned.to` to the destination-chain wallet address. An Ethereum or Solana destination is not a Bitcoin output address.

Fix: define separate transfer and swap intent schemas; bind the Bitcoin funding outputs, change, fee, input ownership, and destination-route metadata independently. Verify the actual LI.FI transaction request format instead of guessing between `psbt`, `data`, and `transaction`.

Regression: a real-format provider fixture must pass quote → intent → browser sign → backend signed validation for BTC→EVM and BTC→Solana. Tampered funding outputs must fail. Separately exercise inbound BTC routes.

### A02 — Bitcoin signed validation accepts changes outside the recipient output

**Confirmed validation gap.** B `src/wallet/chains/bitcoin/BitcoinAdapter.ts:89` compares sorted input identifiers and finds one matching recipient output. It does not compare every output, change destination/value, input sequence, transaction version, or locktime against the PSBT. `expectedFrom` is explicitly unused. F `lib/crypto-wallet/bitcoin-signing.ts:8` checks the derived sender address and signs the PSBT without reviewing its outputs against the presented intent.

A signed transaction with the expected recipient and inputs but redirected change can pass this application check. The chain still requires valid signatures; this is a failure to enforce the reviewed intent, not a claim that an attacker can spend without a key.

Fix: compare the complete unsigned transaction commitment and enforce ownership, allowed sighash modes, output/change policy, and maximum fees locally before signing. Verify signed input witnesses as appropriate.

Regression: independently mutate change, add an output, reorder inputs, change sequence/locktime, alter fees, and submit invalid signatures. None should pass under an unchanged reviewed intent.

### A03 — Intertrain bridge deposits use an incorrect nonce

**Confirmed.** B `src/api/routes/intertrainBridge.ts:58` reads the current pending nonce. `make` then uses `nonce + step`; deposits are always step `1`.

Example: after approval at nonce 7 confirms, the next request reads nonce 8 and creates the deposit at 9. Nonce 8 is missing. A user with existing allowance also gets an unnecessary gap immediately. The transaction may remain queued until another transaction fills the gap.

Fix: use the current pending nonce for the single transaction prepared by that request. Workflow step identifiers must not be reused as nonce offsets after a fresh nonce lookup.

Regression: zero-allowance approval followed by deposit, pre-existing allowance, and another transaction between steps. Every newly prepared deposit must use the next valid nonce.

### A04 — EVM token swaps have no approval step

**Confirmed.** B `src/api/routes/spot.ts:257` prepares a single LI.FI swap transaction. The EVM branch estimates/simulates it immediately. F `components/swap/swap-client.tsx:703` creates, signs, and submits only that intent.

There is no allowance lookup or approval transaction using the quote's approval spender in this path. A new wallet selling USDC/USDT with zero allowance fails before signing or reverts at execution. A successful native-ETH swap does not validate ERC-20 swap support.

Fix: implement approval-required → approval confirmation → fresh executable swap intent. Bind the approval spender and amount to the reviewed route. Do not treat an allowance error message as implementation of approval.

Regression: native input, sufficient allowance, zero allowance, insufficient allowance, approval rejection, approval revert, and a route whose spender changes after approval.

### A05 — Broadcast succeeds before submission state is durable

**Confirmed ordering; conditional failure.** B `src/wallet/transactions/IntentService.ts:113` checks `awaiting_signature`, broadcasts, creates a transaction record, then updates intent status at line 164. There is no atomic submission claim before broadcasting.

Two requests can both pass the status check. A timeout after broadcast, database failure, or response loss can leave the user seeing failure even though the chain received the transaction. Retrying then conflicts with a nonce/UTXO or produces an already-known error. The status UI must not conclude “nothing sent” from this uncertainty.

Fix: persist an atomic submission claim and deterministic signed-transaction hash before sending; make resubmission return/reconcile the same operation. Represent uncertain broadcast separately from definite rejection.

Regression: concurrent submit, RPC response loss after acceptance, database failure after broadcast, and client reload. One logical operation must remain traceable.

### A06 — Refreshing an expired intent can return the same expired intent

**Confirmed.** B `IntentService.ts:39` returns any matching idempotency key without checking expiry or status. F `hooks/crypto/useTransactionIntent.ts:70` retains a key for unchanged transfer inputs. F `components/crypto/send/SendFlow.tsx:450` refreshes by creating the same transfer without resetting that key.

The user requests a fresh quote, receives the old expired intent, and cannot sign successfully. Similar unconditional lookups exist in spot and Hyperliquid intent creation.

Fix: define operation identity separately from intent revisions. Refresh must produce a new reviewed transaction when the old intent is expired and definitely unsubmitted, while preserving uncertain/submitted operations.

Regression: expire an intent, refresh without changing amount, and verify a new valid revision; verify a submitted transaction is never recreated by refresh.

### A07 — Idempotency is neither consistently atomic nor bound to request contents

**Confirmed.** B `IntentService.ts:39,71`, `src/api/routes/spot.ts` LI.FI intent lookup/create, and `src/api/routes/hyperliquid.ts:340,345` use read-then-create without uniformly recovering unique-key races. The bridge only retrieves approval keys in selected states; it does not equivalently retrieve deposit keys before insertion. The unique index in `src/models/TransactionIntent.ts` prevents duplicates but does not make those request paths return a useful result.

Concurrent requests can produce E11000/500. Reusing a key with a different amount, route, or account can return an unrelated intent because the existing record is not compared with the request. A random server default prevents null collisions but does not deduplicate retries from clients that omit a key.

Fix: common idempotency service with request fingerprint, atomic creation/conflict recovery, lifecycle-aware responses, and explicit conflict errors for changed requests.

Regression: identical concurrent requests converge; different requests sharing a key return conflict; expired/failed/submitted states are handled deliberately.

### A08 — Sensitive-action freshness is declared but not enforced

**Confirmed.** F `lib/crypto-wallet/action-policy.ts` classifies send, swap, withdrawal, and HL deposit as requiring fresh verification. `SendFlow.tsx:492`, `swap-client.tsx:710`, bridge `submit`, and funding handlers open verification only if `getUnlockedWalletState` is absent. `lib/crypto-wallet/account-secrets.ts:11` checks only that unlock state exists.

An already unlocked session skips the fresh verification promised by the sensitive-action policy. The unlock dialog's action-specific text does not enforce freshness by itself.

Fix: one action authorization gate with explicit verification time and action binding, called immediately before sensitive signing. Preserve the intended longer-lived ordinary unlock separately.

Regression: unlocked-but-stale sessions must step up for sensitive actions; delegated trading must follow its separate permission policy.

### A09 — Execution signs a newly fetched quote without a new review

**Confirmed.** F swap execution sends amount/token/network fields, not the reviewed route identifier or minimum-output commitment. B `src/api/routes/spot.ts:287` fetches `/quote` again and builds the transaction from that new response. F immediately signs the returned intent.

The route, spender, fee, or output may change after the displayed quote. Slippage on the new quote does not prove compliance with the minimum output shown on the previous quote.

Fix: bind the reviewed quote and its limits to intent creation, or show and approve material changes in the final intent before signing.

Regression: change provider output/spender between preview and execution; a changed transaction must require a new review or fail the original limits.

### A10 — Swap retry keys survive valid changes to the trade

**Confirmed.** F `components/swap/swap-client.tsx:608,720,741` clears the key for invalid/empty inputs or successful submission. It does not bind/reset it for every valid amount/token/chain change after a failed attempt.

With A07, changing a failed trade from A to B may return and sign intent A while the screen describes B.

Fix: key by immutable reviewed trade fingerprint and reconcile previous submission before abandoning its key.

Regression: fail submission, change amount or destination chain, and retry; the signed intent must match the new review.

### A11 — Bridge approval progression is timer-based and non-durable

**Confirmed.** F `components/bridge/intertrain-usdc-bridge-client.tsx:28` generates a new key per submit invocation, runs at most two iterations, and waits four seconds after approval. It does not poll the approval receipt or persist intent IDs and progress across reloads.

An ordinary slow confirmation produces an error. Retrying starts another logical operation rather than reliably resuming the original. A disconnect after deposit submission can lead users into a duplicate attempt.

Fix: persistent bridge operation with approval/deposit states, receipt-driven progression, and resumable idempotency.

Regression: confirmation after 30 seconds, reload between steps, rejected signature, and a lost submit response.

### A12 — Bridge destination and settlement are not verified

**Confirmed integration gap; actual destination mapping requires chain/contract verification.** The bridge signs `depositForWSK(amount)` from the EVM account. Neither request nor payload binds the native Intertrain account. F labels the destination “Your Intertrain wallet,” while native Intertrain keys are independently generated. No explicit EVM-to-native-account mapping is verified by this flow.

The status endpoint checks configuration and `paused()`, but not a live Intertrain `bridge_status`. The frontend announces that WSK will appear without tracking the deposit event through consensus minting.

Fix: verify the deployed contract/relayer destination mapping, explicitly display/bind the credited account, and track source receipt/deposit ID through destination mint. Recheck runtime lane status during intent preparation.

Regression: different EVM and native account identities, paused lane, offline relayer, source revert, delayed mint, and completed mint with destination evidence.

### A13 — TON first send omits wallet deployment state

**Confirmed omission; affects undeployed wallets.** B `src/wallet/chains/ton/TonAdapter.ts:57` and F `lib/crypto-wallet/ton-signing.ts` construct the external message with destination and body only, omitting wallet init. A newly generated wallet can receive funds before its contract is deployed; sending requires the appropriate deployment state.

Fix: detect deployment and include the matching wallet StateInit on first send. Also review unconditional `bounce: true` when sending to undeployed recipient accounts.

Regression: funded undeployed sender, already deployed sender, and undeployed recipient; verify actual receipt outcome.

### A14 — TON confirmation compares different hash types

**Confirmed.** B `TonAdapter.ts:130` returns the external message root hash after `sendFile`. `getTransactionStatus` compares it with `transaction.hash()` from account history.

A message hash is not the transaction hash. A successful transfer can remain pending indefinitely. The current branch also does not inspect execution/bounce outcome before reporting confirmation.

Fix: resolve the inbound message to its transaction, inspect execution result, and store message and transaction hashes separately.

Regression: known incoming external-message hash resolves to confirmed, failed, or bounced execution correctly.

### A15 — Delegated permission checks occur at creation, not submission

**Confirmed.** B `src/api/routes/hyperliquid.ts:324` validates agent status and limits during intent creation. The submit route at line 349 verifies the saved signer signature but does not re-read agent status or reapply current permissions. Revocation updates a local agent record; the shown revoke endpoint does not itself revoke the venue authority.

A prepared intent can still be submitted after local revocation. Daily limits also use already submitted/partial intents and do not reserve pending notional atomically, so simultaneous preparations can exceed the configured budget.

Fix: revalidate permissions at submission, reserve budget atomically, invalidate outstanding agent intents on revocation, and reconcile venue-level revocation.

Regression: revoke between prepare/sign/submit; reduce limits after prepare; submit concurrent orders at the daily boundary.

### A16 — Hyperliquid nested order failures are not normalized by the backend

**Confirmed response-handling gap.** B `src/lib/hyperliquid/client.ts:44` rejects only top-level `status: err`. B `src/api/routes/hyperliquid.ts:369` records every returned result as submitted. An otherwise successful response envelope containing a per-order error is not classified here.

Fix: interpret per-action statuses, preserve mixed/partial outcomes, and report venue rejection separately from successful order placement. Audit each frontend consumer rather than assuming every one interprets raw nested responses.

Regression: fixture with top-level success and nested order error; filled, resting, partial, and mixed results. A rejected order must not count as accepted trading success.

### A17 — Bitcoin fee and UTXO policy is incomplete

**Confirmed.** B `BitcoinAdapter.ts:52` selects UTXOs without reservations/revalidation. `estimateFee` assumes 31 bytes per output for every allowed destination script. Dust handling only drops small change; it does not reject a dust recipient output. `simulateTransaction` repeats structure checks and reports success without checking spendability with the node.

Parallel intents can select identical UTXOs. Some output types have different sizes; fees can be underestimated. Small outputs can reach broadcast and be rejected despite a successful preflight.

Fix: script-aware size/fee and dust policy, input reservation/revalidation, bounded fee estimates, and explicit structural versus node preflight results. Bitcoin Core `listunspent` also requires the node wallet to know these generated addresses; it is not general address discovery.

Regression: dust, P2WPKH/P2TR/legacy recipient sizes, multiple inputs, provider fee failure, two intents spending the same UTXO, and a spent input at submit.

### A18 — Bitcoin receive address mapping is missing

**Confirmed.** F `components/crypto/ModernReceiveModal.tsx:25` and `components/flows/crypto-doors.tsx:35` omit Bitcoin from `FAMILY_TO_CHAIN`, although `lib/networks.ts` includes it.

The modern Bitcoin account is not mapped into those receive interfaces. Registering an adapter alone does not complete the wallet deposit UX.

Fix: share a complete family/network presentation registry and test receive QR/address rendering for each supported family.

### A19 — Provisioning attempts unrelated missing networks

**Confirmed.** F `lib/crypto-wallet/wallet-security.ts:312` builds every missing family in a fixed list, without filtering by enabled networks or the caller's requested subset. It throws if any such family has no network. UI `familiesToAdd` does not enter that function's signature.

Adding Bitcoin can fail because another missing network is disabled. Default new-wallet creation also requests Bitcoin even in environments where no Bitcoin network is enabled.

Fix: pass the requested families explicitly, intersect them with enabled network capabilities, and preserve all existing encrypted accounts/envelopes.

Regression: Bitcoin-only addition with Intertrain disabled, production mainnet setup, and development setup with no Bitcoin mainnet enabled.

### A20 — Error normalization is not universal

**Confirmed.** B transfer creation catches unexpected builder failures, but spot/bridge/funding call RPC estimation directly. `src/api/middleware/errorHandler.ts` turns uncaught non-AppError exceptions into `INTERNAL_ERROR`. `RpcManager` wraps provider failures as `RPC_ALL_PROVIDERS_FAILED`; shared submission then classifies only the outer message and loses nested provider details.

Allowance, fee, signature, expiry, and provider failures can still appear as generic server/simulation errors depending on the endpoint.

Fix: normalize structured causes at the shared provider boundary; preserve safe underlying details and request IDs; distinguish definite rejection from uncertain broadcast. Apply consistently to prepare, simulate, and submit.

Regression: identical provider error fixtures must yield the same actionable classification through transfer, swap, bridge, and funding endpoints.

### A21 — Swap error and quote state can break the UI

**Confirmed.** F `swap-client.tsx:637` assigns `data.error` directly to string-typed state, although backend errors are objects. Pro rendering can attempt to render an object. The fetch catch clears the timestamp but not the previous quote; execution gating does not explicitly require absence of quote errors. Aborted older requests also run a shared `finally` that can clear loading for a newer request.

Fix: normalize API errors; associate quote responses/loading with request identity; invalidate executable quotes on request failure or mismatched inputs; enforce quote age at signing.

Regression: structured 400/502 responses in Simple/Pro, failed refresh, rapid chain switching, and stale response arrival.

### A22 — Transfer signing depends on a redundant successful fetch

**Confirmed.** F `useTransactionIntent.ts:101` stores the new intent ID but does not seed the intent query cache. Submission at line 126 requires `intentQuery.data`, even though the mutation already holds the returned intent and the exposed hook falls back to that value for display.

If the follow-up GET fails or lags, a valid displayed intent cannot be signed and the user receives a misleading instruction to create/unlock again.

Fix: seed the exact returned intent in cache, guard identity matching, and use one canonical current-intent value throughout review and signing.

Regression: successful POST followed by delayed/failed GET must not create inconsistent displayed-versus-signable state.

### A23 — Hyperliquid funding pair recovery remains incomplete

**Confirmed design gap.** B `hyperliquid.ts:234` always prepares approval and deposit, assigns sequential nonces, and returns any cached intent with the same key irrespective of lifecycle. Deposit simulation is explicitly deferred but represented as `ok: true`. A consumed approval nonce with an expired or missing deposit needs a fresh deposit revision, not blind reuse of the original pair.

Fix: durable funding workflow that resumes from observed allowance/receipts, renews only definitely unsubmitted expired steps, distinguishes deferred preflight, and does not re-sign completed steps. Preserve the existing $5 minimum and USDC/ETH balance checks.

Regression: approval accepted then reload, deposit expiry after approval, another transaction consuming a nonce, insufficient balance after preparation, and RPC failure after send.

### A24 — Cross-chain completion is reduced to source-chain confirmation

**Confirmed integration gap.** B `IntentService.ts:258` reconciles through the source-chain adapter and marks the whole intent confirmed on its receipt. F swap execution records `PENDING`, while the path inspected has no destination route settlement reconciliation. Bridge similarly stops after deposit submission.

Source receipt success proves neither destination asset delivery nor successful final routing. Users may see a confirmed history item while destination funds are delayed, refunded, or require recovery.

Fix: separate source transaction status from route status; persist provider route/deposit identifiers and destination transaction evidence, including refund/failure states.

Regression: source confirmed/destination pending, destination success, bridge failure/refund, and reloading while settlement continues.

## Additional verification required

1. **Bitcoin browser Buffer:** `lib/crypto-wallet/bitcoin-signing.ts:16` uses global `Buffer` without importing it. Node tests and builds do not prove the browser has that global. Exercise the production bundle in a clean browser; use explicit browser-safe decoding if absent.
2. **Bitcoin LI.FI payload:** the current implementation guesses a PSBT field/encoding and hardcodes `BTC` as token identity. Validate against current official API documentation and captured real responses. This audit makes no live router availability claim.
3. **TON signature domain:** both client and backend use `domainSign`/`domainSignVerify` around a Wallet V4 payload. Matching each other is not proof that the deployed wallet contract accepts the signature format. Compare against the installed wallet SDK's native signer and contract vectors before declaring TON signing healthy.
4. **TRON LI.FI shape and resource budget:** the adapter assumes `raw_data` and only checks that signatures exist, not their cryptographic validity. Confirm provider request format, TRC-20 approval/resource requirements, and transaction expiry using fixtures and a controlled chain test. Native transfer receipt handling also relies on `receipt.result`; verify successful receipt variants with a block number but no such field.
5. **Solana validity window:** intents outlive typical recent-blockhash validity, and the inspected submit path has no blockhash renewal. Test delayed signing and renewal that requires re-signing; retain strict message/signature verification.
6. **EVM native-fee sufficiency:** simulation calls do not explicitly use the complete signed fee fields or compare native balance to value plus maximum fee. Test providers that accept the call but reject broadcast for fee insufficiency.
7. **Hyperliquid environment and nonce allocation:** `hyperliquidIsTestnet()` is hardcoded false and nonce allocation is process-local. Verify intended environment behavior and multi-process concurrency before claiming testnet or horizontally scaled correctness.
8. **Passkey/PIN migration:** action freshness was audited here; credential registration, PRF support, envelope adoption, recovery proof interoperability, and migration need their own focused browser/device matrix. Prior screenshots do not prove the current revision still has each historical error.

## What currently provides useful protection

- EVM signed validation compares recovered sender, chain, nonce, gas, fees, value, and calldata. Extend its destination check to reject a missing `to` rather than only comparing when `parsed.to` exists.
- Solana validation compares message bytes and verifies required signatures in the inspected working tree.
- Sui compares transaction bytes, signer address, and signature.
- Local key access requires an unlocked wallet and encrypted account material; Bitcoin is appended as a new account family rather than replacing existing keys.
- HL funding checks minimum amount and token/native balances. Bridge status checks `paused()` for its read endpoint.

These controls are worth preserving, but do not resolve the workflow defects above.

## Recommended repair order

1. Transaction integrity: A02, A05, A07, A08, A15. Establish complete intent commitments, durable submission, request-bound idempotency, and action authorization.
2. Deterministic execution blockers: A01, A03, A04, A06, A13, A14. Repair Bitcoin swap schema, bridge nonce, approvals, renewal, and TON first-send/status handling.
3. Review and recovery: A09–A12, A21–A24. Bind quotes, persist operation progress, normalize errors, and reconcile destination settlement.
4. Wallet completeness: A17–A19. Fee/UTXO policy, receive maps, and scoped provisioning.
5. Validate provider formats and browser/device signing from the verification list before asserting full production support.

## Required regression coverage before declaring completion

| Layer | Required evidence |
| --- | --- |
| Adapter round trips | Build a valid intent, sign through the actual frontend signer, validate on backend; negative tampering cases |
| Intents | Request fingerprint conflicts, concurrent creation/submission, expiry renewal, completed retry |
| Recovery | RPC timeout after acceptance, database failure, reload between approval and deposit, old nonce/UTXO |
| Wallet UX | Existing wallet gains BTC without key/envelope changes; enabled-network subset; receive address/QR; locked and stale-unlock sessions |
| Swaps | Native/token approval cases; reviewed minimum preserved; valid BTC source/destination provider fixtures; no TON swap entry |
| Bridge | Correct nonce, approval receipt progression, real destination mapping, paused/relayer outage, destination mint evidence |
| Futures | Revoked agent, atomic limits, nested venue errors, partial steps, retries without duplicate accepted actions |
| Browser | Production bundle on desktop and mobile, Buffer decoding, local key use, cancellation, slow unlock |

Run meaningful tests against these failures, not only registry membership and malformed inputs. Controlled live tests require explicit transaction amounts and destinations; none were performed for this audit.

## Audit deliverable status

Report created only. No implementation fixes or production changes are claimed. This is a prioritized source audit, not an exhaustive cryptographic audit of every protocol, smart contract, or dependency.
