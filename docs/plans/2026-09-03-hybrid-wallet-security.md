# Hybrid Wallet Security — Additive Implementation Plan

## Objective

Add a better signing experience without replacing, re-encrypting, or migrating existing user wallets.

The current encrypted wallet package remains the source of truth. Existing wallet IDs, account IDs, addresses, encrypted key material, and recovery passphrases remain valid throughout the rollout.

The new system adds three layers:

1. Long-lived local unlock sessions for normal use.
2. PIN and passkey/biometric unlock for convenient authentication.
3. Long-lived, restricted delegated trading permissions for spot and futures.

Passphrase recovery remains available at all times.

## Security invariants

- Never regenerate an existing wallet during migration.
- Never change an existing account address.
- Never store raw passphrases, PINs, private keys, or decrypted key packages in localStorage.
- A passkey authenticates or unwraps access to the existing encrypted wallet; it does not become the wallet private key.
- Trading permissions cannot withdraw, deposit, export keys, or change security settings.
- Sensitive actions require fresh passkey/biometric or passphrase confirmation.
- Every security-sensitive operation is idempotent and auditable.
- The backend independently enforces every permission and limit.

## Phase 0 — Inventory and threat model

### Work

- Document the current wallet package format and encryption flow.
- Identify where wallet unlock state, decrypted material, and signing calls live.
- Inventory all transaction types: swaps, sends, deposits, withdrawals, spot orders, futures orders, leverage changes, and wallet-management actions.
- Identify all existing users, wallet states, recovery paths, and legacy clients.
- Define threat scenarios: stolen browser session, lost phone, malicious browser extension, compromised delegated signer, replayed request, duplicated submission, and backend compromise.
- Define the security boundary between frontend, crypto backend, wallet package, and delegated trading service.

### Exit criteria

- Existing wallet package can be opened and signed with unchanged code paths.
- A written list exists of normal, sensitive, and delegated actions.
- No migration step can destroy or replace existing key material.

## Phase 1 — Additive security data model

### Work

Add security records without modifying the wallet record:

- `WalletSecurityProfile`
- `PasskeyCredential`
- `TrustedDevice`
- `LocalUnlockPolicy`
- `DelegatedTradingPermission`
- `SecurityEvent`

Store:

- Credential IDs and public keys for passkeys.
- PIN salt, KDF parameters, and encrypted key wrapper only.
- Device identifiers as revocable opaque IDs.
- Permission scopes, limits, creation time, last-used time, and revocation state.
- Security-event metadata without secrets.

### Compatibility

- All new records are optional.
- A user with no security profile follows the existing passphrase flow.
- Existing wallet documents receive no destructive schema change.

### Exit criteria

- Existing users can read balances, unlock, sign, and recover exactly as before.
- New security records can be created and deleted independently of wallet records.

## Phase 2 — Long-lived local unlock sessions

### Work

Replace the fixed five-minute behavior with a policy-based in-memory unlock session.

Suggested defaults:

- Normal session: 30–60 minutes of inactivity.
- Sensitive action: fresh confirmation required.
- Browser close: lock by default.
- Manual lock: immediate memory wipe.
- Tab inactivity: configurable timeout.

Implement:

- `unlock()`, `lock()`, `isUnlocked()`, and `withUnlockedWallet()` APIs.
- In-flight signing protection so a lock cannot clear material mid-signature.
- Cross-tab lock notification where supported.
- Clear failure and recovery states.

### Storage rules

- Keep decrypted key material memory-only.
- Never persist the passphrase or decrypted private key.
- If a resumable session handle is needed, persist only encrypted, non-secret state.

### Exit criteria

- Users do not re-enter the passphrase for every normal action.
- Manual lock clears all decrypted material.
- Reload and browser-close behavior is explicit and tested.

## Phase 3 — PIN unlock

### Enrollment

- Require one successful existing passphrase unlock.
- Generate a strong random wallet encryption key if the current package already uses one; otherwise wrap the current encrypted package without changing the wallet key.
- Derive a PIN key with Argon2id or scrypt.
- Store only salt, KDF parameters, and an encrypted wrapper.

### Runtime

- Rate-limit attempts.
- Add exponential delays after failures.
- Lock or require passphrase recovery after repeated failures.
- Keep PIN unlock device-aware where appropriate.
- Provide “Forgot PIN” recovery through the original passphrase.

### Exit criteria

- PIN unlock opens the same existing wallet and produces the same addresses.
- PIN reset does not create a new wallet.
- PIN data is unusable without the encrypted wallet package and correct PIN.

## Phase 4 — Passkey and biometric unlock

### Enrollment

- Register a WebAuthn discoverable credential on the production domain.
- Require the existing wallet unlock during enrollment.
- Store only the credential ID, public key, sign counter, and metadata.
- Bind the credential to the existing wallet security profile.

### Runtime

- Use platform authenticators such as Face ID, Touch ID, Android biometrics, Windows Hello, or security keys.
- Use passkey verification to authorize access to the existing encrypted wallet key wrapper.
- Keep a passphrase fallback.
- Support multiple passkeys per account.
- Provide passkey naming and revocation.

### Sensitive actions

Use fresh user verification for:

- Wallet export or recovery changes.
- Withdrawals.
- Hyperliquid deposits.
- Large swaps and transfers.
- Adding, changing, or revoking delegated trading permissions.

### Exit criteria

- Mobile web and desktop web enrollment work over HTTPS.
- Removing one passkey does not remove the wallet.
- Losing all passkeys still allows recovery with the original passphrase.

## Phase 5 — Security policy and action classification

### Work

Create one shared action-policy module used by both frontend and backend.

Classify actions:

### Normal actions

- View balances.
- View transactions.
- Read markets and positions.
- Normal trading while delegated permission is active.

### Sensitive actions

- Withdrawals.
- Hyperliquid deposits.
- Wallet export.
- Security setting changes.
- Permission changes.
- Large-value transfers and swaps.

### Delegated actions

- Spot order placement and cancellation.
- Futures order placement and cancellation.
- Allowed leverage changes.

### Exit criteria

- The backend rejects sensitive actions signed by a delegated trading key.
- The frontend cannot accidentally bypass a sensitive-action challenge.
- Policy decisions are covered by unit tests.

## Phase 6 — Delegated spot and futures trading

### Key lifecycle

- Generate a separate trading signer/key.
- Never use the master wallet private key as the delegated trading key.
- Register or approve the signer with the relevant venue.
- Store only the minimum metadata required to identify the signer.
- Support rotation and immediate revocation.

### Permission limits

Support limits for:

- Spot and futures scope.
- Allowed markets.
- Maximum order size.
- Maximum daily notional.
- Maximum leverage.
- Maximum position size.
- Permission expiry or renewal date.
- User-level emergency revocation.

### Hyperliquid

- Use a dedicated Hyperliquid API/agent wallet for trading actions.
- Keep deposits, withdrawals, and permission changes on the master-wallet confirmation path.
- Use separate signers for separate trading processes to avoid nonce collisions.
- Query account data using the actual master/subaccount address, not the agent address.

### Exit criteria

- Spot and futures trading work without repeated passphrase entry.
- Delegated permissions cannot move user funds out of the permitted trading scope.
- Revocation takes effect immediately at the backend.
- Nonce, replay, and duplicate-request tests pass.

## Phase 7 — Sensitive-action UX

### Work

Update the existing signing modal rather than creating a second competing flow.

Normal flow:

1. User unlocks with active session, PIN, or passkey.
2. User trades normally within the active permissions.
3. The application does not interrupt every action with a passphrase prompt.

Sensitive flow:

1. User starts a withdrawal, Hyperliquid deposit, export, or security change.
2. Backend prepares and validates the intent.
3. The existing modal opens the passkey/biometric challenge.
4. The user confirms the exact action and amount.
5. The wallet signs only the prepared intent.
6. The modal shows submitted, confirmed, failed, or unknown status.

### UX requirements

- Never tell the user to navigate to another wallet page just to unlock.
- Show the exact asset, network, amount, destination, fee, and action risk.
- Do not show `undefined` values in status messages.
- Keep retry idempotent.
- Preserve the current UI language and visual system.

### Exit criteria

- Sensitive actions open the existing unlock modal in context.
- Users can cancel without changing wallet state.
- Failed or interrupted actions can be safely resumed.

## Phase 8 — Recovery, device management, and revocation

### Work

Add Security settings for:

- Registered passkeys.
- Trusted devices.
- Active local sessions.
- Delegated trading permissions.
- Revoke one device.
- Revoke all devices.
- Revoke trading access.
- Rotate a trading signer.
- Disable PIN unlock.
- Recover with passphrase.

### Recovery rules

- Recovery never silently creates a new wallet.
- Recovery changes require fresh passkey or passphrase authentication.
- A lost device can be revoked remotely.
- A revoked delegated key cannot place new orders.
- Existing wallet addresses remain unchanged.

### Exit criteria

- A user can recover from lost phone, lost passkey, or forgotten PIN.
- Revocation is visible and takes effect across sessions.
- Recovery and revocation events are auditable.

## Phase 9 — Backend hardening and observability

### Work

- Enforce authorization server-side for every transaction type.
- Add idempotency keys to enrollment, revocation, permission, and signing operations.
- Bind prepared intents to wallet ID, account ID, signer, chain, amount, destination, and expiry.
- Reject stale, replayed, mismatched, or already-submitted intents.
- Add rate limits for PIN attempts, passkey enrollment, sensitive actions, and delegated orders.
- Add structured security-event logging.
- Redact passphrases, PINs, private keys, tokens, and raw signatures from logs.

### Exit criteria

- Security events can be investigated without exposing secrets.
- Replays and duplicate submissions are rejected safely.
- Backend policy enforcement does not depend on frontend flags.

## Phase 10 — Testing and migration validation

### Unit tests

- Existing wallet package remains readable.
- Existing addresses remain unchanged.
- PIN KDF and wrapper validation.
- Passkey credential registration and revocation.
- Session timeout and manual lock.
- Sensitive-action policy decisions.
- Delegated permission limits.
- Hyperliquid action scope.
- Idempotency and replay handling.

### Integration tests

- Existing user with no security profile uses the old passphrase flow.
- Existing user enrolls PIN without changing wallet identity.
- Existing user enrolls multiple passkeys.
- Passkey unlock signs the existing wallet’s transaction.
- Delegated spot order succeeds within limits.
- Delegated futures order succeeds within limits.
- Delegated withdrawal is rejected.
- Hyperliquid deposit requires fresh sensitive confirmation.
- Revoked signer cannot trade.

### Failure tests

- Wrong PIN.
- Too many PIN attempts.
- Lost passkey.
- Expired session.
- Browser reload during signing.
- Duplicate click.
- Network failure after intent creation.
- Backend restart during signing.
- Stale delegated permission.
- Replayed signed intent.

### Exit criteria

- Existing-user migration tests pass against production-like data.
- No wallet identity or balance changes occur during enrollment.
- Security and transaction flows pass on supported desktop and mobile browsers.

## Phase 11 — Feature-flagged rollout

### Flags

- `PIN_UNLOCK_ENABLED`
- `PASSKEY_UNLOCK_ENABLED`
- `LONG_LIVED_LOCAL_SESSIONS_ENABLED`
- `DELEGATED_TRADING_ENABLED`
- `SENSITIVE_ACTION_REAUTH_ENABLED`

### Rollout order

1. Internal accounts.
2. Opt-in existing users.
3. Small production cohort.
4. Expanded production cohort.
5. Default-on for new users.
6. Default-on enrollment prompt for existing users.

Keep the old passphrase flow available throughout the rollout.

## Phase 12 — Production readiness checklist

- HTTPS and WebAuthn RP IDs are correct for production domains.
- Passkey credentials are stored with correct sign counters.
- KMS/HSM/TEE secrets are configured where required.
- Backup and restore procedures are tested.
- Session revocation is tested across devices and tabs.
- Delegated trading permissions have documented limits.
- Sensitive actions require fresh confirmation.
- Existing-wallet recovery is verified from a clean browser.
- Monitoring and alerting are active.
- Incident-response and key-compromise procedures are documented.
- Security review and independent audit are completed before broad rollout.

## Definition of done

The implementation is complete when an existing user can:

1. Continue using their current wallet and passphrase without migration.
2. Set up a PIN without changing wallet addresses.
3. Set up one or more passkeys on mobile or desktop web.
4. Keep a secure long-lived local unlock session.
5. Trade spot and futures through restricted delegated permissions.
6. Deposit to Hyperliquid or withdraw only after fresh passkey/biometric confirmation.
7. Revoke devices and trading permissions immediately.
8. Recover access with the original passphrase.

No phase may delete, regenerate, or silently replace an existing wallet.
