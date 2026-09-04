# Intertrain Mainnet Integration Plan

## Objective

Add Intertrain mainnet to the WorldStreet crypto dashboard as an additive wallet capability without changing, migrating, re-encrypting, or invalidating any existing user wallet accounts.

Users with an existing modern wallet will see a clear, dismissible prompt when the dashboard loads. They can add an Intertrain account to their existing wallet package. Users who do not opt in continue using Ethereum, Arbitrum, Solana, Sui, TON, and TRON exactly as before.

Intertrain mainnet values currently supplied by the chain repository:

| Field | Value |
|---|---|
| Network ID | `intertrain-mainnet` in WorldStreet’s backend registry |
| Protocol chain ID | `intertrain-1` |
| EVM chain ID | `4683` |
| RPC | `https://rpc.intertrain.online/rpc` |
| Explorer | `https://explorer.intertrain.online` |
| Native asset | WorldStreet Kash (`WSK`) |
| Native decimals | `6` (verified from live mainnet `chain_info`) |
| Address format | Intertrain `mna1...` address |
| Environment | `mainnet` |

The checked-out chain repository still contains older MANNA/MNA terminology in protocol and devnet documents. The updated mainnet asset specification is authoritative for the dashboard integration: user-facing name and symbol are WorldStreet Kash (`WSK`). Mainnet and devnet must remain separate network records, chain IDs, RPCs, and explorer URLs. Existing protocol identifiers such as the `mna1...` address prefix must only be changed if the updated chain specification explicitly changes them.

## Safety principles

1. Existing wallet packages are immutable inputs. We append one account and its address records; we never rewrite existing account key material.
2. Existing account IDs, addresses, derivation metadata, encrypted key ciphertext, envelopes, wallet version history, and recovery path remain unchanged.
3. Intertrain private key material is generated and encrypted in the browser before the package is committed. The backend receives only the encrypted account material and public metadata.
4. Intertrain mainnet must never silently fall back to the old devnet RPC or use a devnet chain ID.
5. The add-chain flow must be idempotent. Reopening the prompt or retrying after a network failure must not create duplicate Intertrain accounts.
6. Balance display can ship before transfers, but the UI must label any capability that is not production-ready instead of presenting a dead action.
7. No mainnet bridge, swap, EVM compatibility, or sponsored transaction capability is enabled merely by adding the network to the wallet list.

## Phase 0 — Mainnet facts and integration contract

### Work

- Confirm the live mainnet health response and record the returned protocol chain ID.
- Confirm `chain_info`, `account_get`, `asset_list`, and `transaction_status` response shapes against the mainnet RPC.
- Confirm the canonical WorldStreet Kash decimals on mainnet from the live RPC. The current mainnet value is `6`; do not infer it from unrelated EVM metadata.
- Confirm the canonical address derivation and address encoding used by the mainnet node.
- Confirm whether mainnet uses the native transaction format already implemented by the local SDK or a versioned production format.
- Confirm the explorer’s address and transaction URL formats.
- Document the distinction between Intertrain mainnet and the existing WorldStreet/Intertrain devnet.

### Acceptance criteria

- A read-only probe succeeds against `https://rpc.intertrain.online/rpc`.
- The probe confirms `intertrain-1` and does not report `worldstreet-devnet-1`.
- A known valid `mna1...` address can be queried without exposing private material.
- The integration contract is checked into source control before application code is changed.

## Phase 1 — Backend network registry and configuration

### Work

- Extend the backend network-family type to accept `intertrain`.
- Add an `intertrain-mainnet` `NetworkSeed` with:
  - `family: intertrain`
  - `environment: mainnet`
  - protocol chain ID metadata `intertrain-1`
  - EVM chain ID metadata `4683` if the backend model supports it
  - native asset `WSK`
  - native decimals metadata `6`
  - balance and native-transfer capabilities only until the adapter is complete
  - an RPC provider key such as `INTERTRAIN_MAINNET_RPC_URLS`
- Add the mainnet RPC configuration to the environment schema with a safe production default only if the deployment policy allows compiled public endpoints. Prefer an environment value in production.
- Keep `NETWORK_MODE=mainnet` behavior explicit. Intertrain must not be enabled in development/testnet mode accidentally.
- Update production configuration validation so an enabled Intertrain network without a usable RPC fails clearly.
- Update network seeding so the new network is inserted without deleting historical wallet accounts or address records.
- Add network metadata to the backend’s network-list response.

### Acceptance criteria

- `npm run typecheck` passes.
- `npm run db:seed-networks` creates or updates only the Intertrain network record and preserves existing records.
- `GET /v1/wallets/me/networks` includes Intertrain mainnet when mainnet mode is enabled.
- Development/testnet deployments do not expose Intertrain mainnet.
- Configuration errors identify Intertrain specifically.

## Phase 2 — Backend RPC client and read-only adapter

### Work

- Add an Intertrain JSON-RPC client to the backend RPC manager.
- Reuse the existing provider rotation/failover mechanism where appropriate, while preserving provider-specific error details only in server logs.
- Implement an `IntertrainAdapter` registered under `intertrain`.
- Implement read-only balance support using `account_get`.
- Convert the RPC’s base-unit balance to the configured mainnet decimals without floating-point arithmetic.
- Return a normalized balance:
  - asset `{ kind: native, identifier: WSK }`
  - base-unit amount as a string
  - decimals from the verified mainnet asset metadata
  - symbol `WSK`
  - name `WorldStreet Kash`
- Implement transaction-status reads if the RPC exposes a stable status method.
- Return a typed `INTERTRAIN_RPC_ERROR` or `INTERTRAIN_RPC_NOT_CONFIGURED` rather than a generic internal error.
- Add timeouts, bounded retries, and provider cooldown behavior consistent with the existing backend RPC layer.

### Acceptance criteria

- A valid Intertrain account appears in the balance snapshot as `ready`.
- A bad RPC response produces a controlled unavailable result and does not crash the balance request.
- A timeout does not block balances from other chains.
- No Intertrain private key is accepted by the backend RPC client.

## Phase 3 — Backend transfer transaction support

### Work

- Confirm the canonical mainnet signed transaction schema from the chain implementation.
- Add address validation for `mna1...` addresses, including checksum and network-prefix validation.
- Add exact decimal-to-base-unit conversion using six WSK mainnet decimals.
- Add `buildTransfer` to construct an unsigned transaction containing:
  - `intertrain-1`
  - sender address
  - recipient address
  - nonce
  - amount
  - fee
  - public key
  - memo if supported
- Add validation that the reviewed intent, signed payload, sender, recipient, amount, nonce, chain ID, and fee all match.
- Add simulation/preflight support if mainnet provides it. If it does not, return a positive structural validation result with a clear “network execution occurs on broadcast” warning.
- Add broadcast support for signed transactions.
- Normalize insufficient balance, invalid nonce, invalid signature, fee failure, and rejected transaction errors.
- Add transaction reconciliation and explorer metadata.

### Acceptance criteria

- A valid signed transfer can be prepared, reviewed, signed locally, broadcast, and tracked.
- A transfer that exceeds balance plus fee is rejected before signing when the RPC can determine it.
- A malformed or wrong-chain signed payload is rejected by the backend.
- Existing EVM, Solana, Sui, TON, and TRON adapter tests remain unchanged and pass.

## Phase 4 — Frontend chain metadata and display

### Work

- Add Intertrain to the frontend network metadata registry.
- Add a dedicated `intertrain` wallet-chain type; do not alias it to EVM, Ethereum, or any existing account family.
- Add display metadata:
  - label `Intertrain`
  - native symbol `WSK`
  - explorer name `Intertrain Explorer`
  - address URL `https://explorer.intertrain.online/address/{address}` after verifying the route
  - transaction URL `https://explorer.intertrain.online/tx/{hash}` after verifying the route
  - icon from the chain repository or a local approved asset, not a remote untrusted image
- Update wallet cards, balances, receiving addresses, portfolio network filters, and network counters to render Intertrain only when the account exists.
- Ensure zero-balance Intertrain does not distort totals when no price feed exists; show `—` rather than inventing a USD value.
- Add `WSK` to asset formatting and precision rules using the decimals returned by the updated mainnet specification.
- Add a visible mainnet label where the UI distinguishes chain environments.

### Acceptance criteria

- Existing wallets render exactly as before when Intertrain is absent.
- An Intertrain account renders with the correct `mna1...` address and verified WSK precision.
- Unsupported price data is represented honestly.
- Intertrain does not appear as Ethereum or as an EVM account.

## Phase 5 — Additive encrypted account provisioning

### Work

- Extend the existing additive chain-provisioning mechanism to support `intertrain` as a separate family.
- Add an Intertrain key generator in the frontend using the canonical mainnet-compatible Ed25519/address derivation algorithm.
- Never derive Intertrain addresses by reusing an Ethereum private key or by converting an EVM address.
- Generate the Intertrain secret locally.
- Encrypt it with the existing wallet DEK and the same account AAD convention used by existing accounts.
- Create the backend account record through the existing `prepareAccount` endpoint.
- Add one address record for `intertrain-mainnet`.
- Commit a new wallet package version containing all old accounts byte-for-byte plus the new Intertrain account.
- Preserve all existing envelopes. No recovery secret rotation is needed for this append operation.
- Make the operation idempotent by checking both:
  - the package for an existing `family: intertrain` account; and
  - the wallet’s backend account records for an existing Intertrain account.
- If the commit fails, discard the new in-memory key and leave the saved local package untouched.
- If the commit succeeds but local storage fails, reload the committed package before retrying.

### Acceptance criteria

- Existing users can add Intertrain without exporting or restoring their wallet.
- Existing account IDs and encrypted material are unchanged after provisioning.
- Repeated clicks create at most one Intertrain account.
- Recovery, passphrase, PIN, passkey, and backup flows continue to recognize the appended package.
- A fresh wallet may optionally include Intertrain at creation, but the default path remains backward-compatible.

## Phase 6 — Dashboard onboarding modal

### Work

- Add a reusable `IntertrainAddModal` using the dashboard’s existing modal primitives and visual language.
- Trigger it after authenticated dashboard load when:
  - the modern wallet exists;
  - the package is loaded;
  - the wallet has no Intertrain account;
  - the user has not permanently dismissed the announcement.
- Do not show the prompt before authentication or while wallet setup is still unresolved.
- Explain plainly:
  - Intertrain is a separate mainnet account added to this wallet;
  - existing accounts will not be changed;
  - the user keeps control of the new key;
- WSK balances and transfers are available only after setup succeeds.
- Actions:
  - `Add Intertrain` opens the existing secure wallet unlock flow, then provisions the account.
  - `Not now` dismisses for the current session or for a defined cooldown.
  - `Learn more` opens the official Intertrain link in a new tab.
- Reuse the existing passphrase/PIN/passkey/recovery authorization UX. Do not create a second secret prompt.
- Show progress states: preparing, securing locally, saving wallet, confirming, complete.
- Show a success state with the new Intertrain address and a link to the wallet/receive view.
- Show actionable failures, including RPC unavailable, wrong authorization, and package conflict.
- Make the prompt responsive and accessible on mobile.

### Acceptance criteria

- The prompt appears on dashboard load only for eligible users.
- It does not repeatedly interrupt a user who selected “Not now.”
- Successful setup updates balances and network counts without a hard refresh.
- The modal never displays private keys, recovery secrets, or internal database IDs.

## Phase 7 — Send, receive, and transaction status UX

### Work

- Add Intertrain to the receive-chain selector only after the account is provisioned.
- Add copy-address and explorer actions.
- Add Intertrain to the send flow with exact WSK amount validation.
- Display available balance, estimated fee, total debit, and remaining balance where the RPC supports fee estimation.
- Prevent sends that leave insufficient funds for the fee.
- Use the existing unlock modal for signing, then the existing transaction-status modal for submitted/pending/confirmed/failed states.
- Poll with bounded backoff and stop polling after terminal state or timeout.
- Display mainnet explorer links only for confirmed/submitted hashes that are valid for the Intertrain explorer.

### Acceptance criteria

- User can receive WSK using a correctly formatted address.
- User can send WSK after local unlock and signing.
- Insufficient funds is shown before signing whenever possible.
- A rejected or failed transaction is not shown as confirmed.
- Existing send flows are not changed for other chains.

## Phase 8 — USDC bridge gate (Ethereum/Arbitrum → Intertrain)

This phase is deliberately separate from adding Intertrain as a wallet chain.

### Work

- Do not route LI.FI, Jupiter, 0x, Hyperliquid, or existing swap flows to Intertrain automatically.
- Do not add an Intertrain EVM wallet layer: Ethereum and Arbitrum remain the existing EVM source accounts.
- Keep the intended lane limited to USDC on Ethereum/Arbitrum credited as USDC on native Intertrain.
- Confirm chain ID 4683, RPC method coverage, gas semantics, token standards, and wallet-provider behavior.
- Obtain explicit bridge contract addresses, token addresses, trust assumptions, reserve controls, finality requirements, and incident procedures.
- Add bridge support only behind separate capability flags and feature gates.
- Add route-specific simulation and slippage protections.
- Keep the Intertrain native account family separate from any future Intertrain-EVM account representation unless the chain specification explicitly guarantees identity equivalence.

### Acceptance criteria

- No swap or bridge button appears merely because the network is present.
- A future bridge rollout can be disabled independently from transfers and balances.
- Mainnet funds cannot enter an unverified or devnet bridge lane.

## Phase 9 — Test strategy

### Unit tests

- Mainnet network seed and environment gating.
- Intertrain address encoding/decoding and checksum rejection.
- Mainnet chain ID rejection for `worldstreet-devnet-1` payloads.
- WSK decimal conversion using six mainnet decimals, including zero, tiny, maximum safe UI values, and invalid precision.
- RPC response parsing and error normalization.
- Provider timeout/failover behavior.
- Additive wallet package merge:
  - old accounts preserved exactly;
  - one Intertrain account appended;
  - envelopes preserved;
  - repeated provisioning is a no-op;
  - failed commit does not overwrite local storage.
- UI eligibility and dismissal behavior.

### Integration tests

- Seed a test database with existing five-family wallets and add Intertrain.
- Verify the balance snapshot contains all previous networks plus Intertrain.
- Verify an existing package can still unlock with passphrase, PIN, recovery secret, and passkey.
- Verify a mainnet account cannot be used against a devnet network record.
- Verify backend rejects an account-family/network-family mismatch.

### Live smoke tests

Use a funded, disposable Intertrain mainnet account only:

1. `healthz` and `chain_info` return `intertrain-1`.
2. `account_get` returns a valid response.
3. Dashboard displays the account and balance.
4. A tiny native transfer is prepared and reviewed.
5. User confirms the transaction hash in the official explorer.
6. Reconciliation reaches a terminal state.

Never use production user keys or a valuable balance for the first smoke test.

## Phase 10 — Observability and operational readiness

### Work

- Add structured logs with network ID, account ID, request ID, provider index, and operation type; never log secrets or full signed payloads.
- Add metrics for:
  - Intertrain RPC latency and errors;
  - balance availability;
  - provisioning attempts/success/failure;
  - transaction simulation/broadcast failures;
  - confirmation latency.
- Add health checks for the Intertrain RPC without making dashboard load depend on the check.
- Add alerts for sustained RPC failures and confirmation lag.
- Document RPC rotation and emergency disable procedures.
- Add a feature flag that can disable Intertrain independently while preserving account records.

### Acceptance criteria

- Intertrain can be disabled without deleting accounts or package data.
- Operators can distinguish RPC outage, invalid wallet data, rejected transaction, and explorer delay.
- Logs contain enough context to debug a failed transaction without revealing wallet secrets.

## Phase 11 — Staged rollout

### Rollout order

1. Backend registry and read-only support disabled from UI.
2. Internal account provisioning with disposable wallets.
3. Staff-only dashboard prompt.
4. Small opt-in user cohort.
5. General opt-in rollout.
6. Transfer enablement after live smoke tests and monitoring soak.
7. Separate review for bridges, swaps, and EVM compatibility.

### Rollback

- Disable the Intertrain feature flag and network capability.
- Keep all created Intertrain accounts and encrypted package versions intact.
- Stop creating new intents while allowing status reconciliation for already-submitted transactions.
- Do not run destructive database cleanup as part of rollback.
- Re-enable only after the incident cause and recovery test are documented.

## Phase 12 — Definition of done

The integration is complete only when:

- Mainnet identity and RPC values are verified and documented.
- Backend network seed, configuration, adapter, balance service, and tests are complete.
- Frontend metadata, account provisioning, modal, balances, receive, send, signing, and status UX are complete.
- Existing wallets have been tested before and after Intertrain is appended.
- Passphrase, PIN, passkey, recovery, backup, and package versioning remain compatible.
- Mainnet/devnet separation is tested.
- Feature flags, logs, metrics, health checks, and rollback are in place.
- A disposable funded smoke test succeeds.
- Bridges, swaps, and EVM compatibility remain separately reviewed and are not accidentally enabled.
