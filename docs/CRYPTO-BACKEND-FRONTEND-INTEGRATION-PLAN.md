# Worldstreet Crypto Backend → Dashboard Integration Plan

## 0. Goal and integration boundary

This document defines the step-by-step plan for integrating `worldstreet-crypto-backend` into `dashboard-revamp`.

The dashboard remains a Next.js application with Clerk authentication already installed. Clerk continues to own sign-in, sign-up, sessions, and identity. The crypto backend owns wallet metadata, encrypted wallet packages, passkey authorization, recovery envelopes, account addresses, transaction construction, transaction validation, RPC access, balances, transaction history, and operational controls.

There will be no `worldstreet-agent` changes and no agent-side wiring. The browser/dashboard talks to the crypto backend through the dashboard's server-side proxy during the first cutover. The dashboard must not receive backend secrets, MongoDB credentials, Privy secrets, internal service keys, or RPC provider keys.

The frontend owns only client-side wallet responsibilities:

- local key generation;
- local wallet-package encryption/decryption;
- passkey ceremony UI and PRF handling where supported;
- secure local storage of encrypted package metadata and ephemeral unlocked state;
- local EVM/Solana signing;
- rendering reviewed transaction summaries;
- sending signed payloads back to the crypto backend.

The frontend must never send plaintext private keys, seed phrases, wallet DEKs, recovery secrets, or unrestricted signing requests to the backend.

### Implementation status

Phases 0–2 are implemented in this dashboard behind `NEXT_PUBLIC_CRYPTO_ENABLED=false`:

- Phase 0: environment flags, backend contract pin (`b00e793`), public health/readiness boundary, and a reversible kill switch.
- Phase 1: Clerk-authenticated `/api/crypto/*` proxy, `/v1` path forwarding, strict route allowlist, timeout, safe header forwarding, typed errors, and typed `fetch` client.
- Phase 2: TanStack Query provider, user-scoped cache keys, sign-out/user-change cache clearing, offline-first read behavior, cancellation support, and feature-flagged wallet/transaction data hooks.

Phases 3–4 are now implemented as an opt-in modern surface alongside the legacy methods:

- Phase 3: browser-local EVM/Solana key generation, AES-GCM account encryption, passkey-authorization package commit, recovery envelope creation, IndexedDB ciphertext storage, and resumable wallet setup.
- Phase 4: native WebAuthn registration/authentication, optional PRF-based local unlock, recovery proof/package rotation, device enrollment/revocation helpers, and explicit wallet unlock UI.

Phases 5–11 are implemented as a dual-run frontend integration:

- Phase 5: `CryptoProvider` and explicit modern wallet surface alongside the unchanged legacy Privy provider.
- Phase 6: normalized account/network balances with exact base-unit retention and RPC-unavailable states.
- Phase 7: idempotent reviewed intents, simulation, local EVM/Solana signing, one-shot submission, and status polling.
- Phase 8: encrypted backup/restore, fresh-DEK package rotation, recovery, and passkey-authorized device revocation.
- Phase 9: legacy Privy coexistence boundary; no Privy code was removed.
- Phase 10: modern wallet custody remains separate from existing market/trading clients.
- Phase 11: rollout/soak runbook and `pnpm verify:crypto` health/boundary verification script.

The legacy Privy provider remains active during and after phase 5. The modern path is a dual-run surface; existing Privy methods are not removed or silently redirected. The remaining runtime gate is to exercise the modern flow with a real Clerk session and passkey against `https://crypto-backend.worldstreetgold.com`.

## 1. Current frontend facts to preserve

The current project is a Next.js dashboard, not an Expo app. Existing authentication and UI state must be reused rather than replaced.

| Current area | Current behavior | Integration action |
|---|---|---|
| `components/auth-provider.tsx` | Wraps Clerk user state | Keep; expose a Clerk token provider only where the browser client needs one |
| `components/wallet-provider.tsx` | Existing legacy Privy wallet methods | Keep intact for legacy users; modern state is exposed separately by `CryptoProvider` |
| `lib/wallet-actions.ts` | Server-side Privy user/wallet creation and Mongo writes | Keep for legacy methods; never use it as an implementation detail of the modern path |
| `lib/ensureUserWallet.ts` | Creates/fetches legacy Privy users and wallets | Keep for legacy methods; do not silently migrate Privy keys |
| `lib/privy/*` | Server-side Privy signing and wallet operations | Keep until a separately approved Privy deprecation; modern client code must not import it |
| `lib/crypto-api.ts` | Mixed legacy API client and market/trading methods | Split into a crypto-backend client and separate market-data client where needed |
| `app/api/[...path]/route.ts` | Same-origin proxy currently forwards `/api/*` to a service using `/api/*` paths | Add a version-correct crypto proxy for `/v1/*`; do not assume the current upstream path matches the new backend |
| `hooks/useWalletBalances.ts` | Calls one legacy aggregate balance endpoint | Replace with account/network balance queries |
| `components/assets/send-modal.tsx` | Calls legacy Privy send endpoints | Replace with intent → review → local sign → submit flow |
| `components/assets/assets-client.tsx` | Displays legacy multi-chain wallet shape | Read normalized accounts and server-enabled networks |
| `components/receive-panel.tsx` and receive UI | Displays wallet addresses | Read canonical addresses from the normalized wallet response |
| `components/buy-sell/*` and Hyperliquid UI | Existing crypto product surfaces | Migrate only where their endpoint is part of the new crypto service contract; keep unrelated product services separate |

## 2. Important prerequisites before frontend cutover

### 2.1 Fix the API version boundary

The new backend exposes protected routes under `/v1`, for example:

```text
GET  /v1/wallets/me
POST /v1/wallets
POST /v1/wallets/me/accounts/prepare
GET  /v1/wallets/me/package
POST /v1/wallets/me/package
POST /v1/passkeys/registration/options
POST /v1/passkeys/authentication/verify
POST /v1/transactions/intents
```

The current dashboard catch-all proxy forwards to `${CRYPTO_API}/api/${path}`. It must not be reused unchanged for this backend. Implement one of these two explicit patterns:

1. **Recommended first cutover:** add `app/api/crypto/[...path]/route.ts`, authenticate with Clerk using `auth()`, obtain a Clerk JWT with `getToken()`, allowlist only the new crypto paths, and forward to `${CRYPTO_API_URL}/v1/${path}`.
2. **Later direct mode:** make the browser client call an absolute `EXPO_PUBLIC_`-style equivalent for Next (`NEXT_PUBLIC_CRYPTO_API_URL`) with a Clerk bearer token and configure CORS. This should happen only after the proxy path is stable and secrets have been removed from the dashboard server environment.

For this Next.js dashboard, use the first pattern initially. Do not expose `CRYPTO_API_URL` as a public variable and do not put an internal service key in any `NEXT_PUBLIC_*` variable.

### 2.2 Resolve the EVM signing contract gap (implemented locally)

The backend EVM adapter now returns a complete, reviewable transaction request with nonce, gas, transaction type, and fee fields. The frontend requires those fields before signing. Deploy this backend change before enabling EVM transfers against the remote service.

The backend must validate the signed transaction against every security-sensitive reviewed field. The frontend must never invent or silently change destination, calldata, value, chain ID, account, or transaction type after the review screen.

Solana intents already contain a serialized versioned transaction/message and can be signed locally once the client verifies the displayed summary matches the payload.

### 2.3 Decide the existing-user posture

The new backend is self-custodial and its wallet package is not equivalent to an existing Privy wallet. Existing users must see an explicit “create/upgrade self-custodial wallet” flow. Do not silently substitute a newly generated EVM/Solana account for a legacy Privy address, and do not copy legacy private keys into the new package.

If legacy data is displayed for migration context, it must be read-only and clearly labeled as legacy. It is not a dependency for new wallet creation.

### 2.4 Rotate dashboard credentials before removing old code

The current dashboard environment example contains Privy/admin-looking credentials. Treat them as compromised because they are present in repository history. Rotate them in the provider dashboards, then remove the values and old variable names from the frontend repository. Never move these values into the new SDK or `NEXT_PUBLIC_*` variables.

## 3. Target frontend structure

Create a dedicated crypto frontend boundary rather than expanding the existing mixed `lib/crypto-api.ts` indefinitely:

```text
dashboard-revamp/
├── app/api/crypto/[...path]/route.ts       # temporary same-origin Clerk proxy
├── components/
│   └── crypto/
│       ├── CryptoProvider.tsx
│       ├── WalletSetupFlow.tsx
│       ├── PasskeyButton.tsx
│       ├── WalletUnlockDialog.tsx
│       ├── TransactionReview.tsx
│       └── TransactionStatus.tsx
├── hooks/crypto/
│   ├── useCryptoWallet.ts
│   ├── useCryptoNetworks.ts
│   ├── useCryptoBalances.ts
│   ├── useTransactionIntent.ts
│   └── useWalletSecurity.ts
├── lib/crypto-backend/
│   ├── client.ts                           # typed request client
│   ├── errors.ts                           # typed API/network errors
│   ├── types.ts                            # backend contract types
│   ├── query-keys.ts                        # React Query keys
│   └── index.ts
├── lib/crypto-wallet/
│   ├── key-generation.ts                   # browser-local EVM/Solana keys
│   ├── package-crypto.ts                   # Web Crypto AES-GCM package operations
│   ├── passkey-prf.ts                      # PRF-derived wrapping key support
│   ├── local-storage.ts                    # IndexedDB/Secure Context boundary
│   ├── evm-signing.ts                      # local EVM transaction signing
│   ├── solana-signing.ts                   # local Solana transaction signing
│   └── index.ts
├── lib/crypto-market-data/
│   └── hyperliquid.ts                      # unrelated public market-data calls
└── docs/
    └── CRYPTO-BACKEND-INTEGRATION-PLAN.md
```

Install only browser-compatible dependencies. The frontend must not import `@privy-io/node`, backend Mongoose models, backend secrets, or Node-only crypto modules into client bundles.

Recommended data layer: TanStack Query for server state, with explicit invalidation after wallet/package/transaction mutations. Keep unlocked DEK/private-key material outside React Query and outside persistent browser state.

## 4. Phase-by-phase implementation

### Phase 0 — establish the contract and branch safety

1. Create a frontend feature branch from the current dashboard main branch.
2. Record the crypto backend commit/tag and API contract version in this document or a small `lib/crypto-backend/version.ts` file.
3. Add an environment matrix:

   ```env
   CRYPTO_API_URL=https://crypto-backend.worldstreetgold.com
   NEXT_PUBLIC_CRYPTO_ENABLED=false
   NEXT_PUBLIC_CRYPTO_PROXY_ENABLED=true
   ```

   `CRYPTO_API_URL` stays server-only. The public flags are feature flags, not credentials.

4. Add a development-only kill switch so existing wallet UI can remain visible while new wallet screens are tested behind a flag.
5. Confirm the new backend is reachable at `/health` and `/ready` from the Next.js runtime.
6. Confirm Clerk JWT audience/issuer configuration matches the backend verifier.
7. Add a decision log for existing Privy users: no automatic key migration and no agent dependency.

**Exit gate:** the dashboard can reach the backend health endpoint from the server runtime, and the Clerk session/token contract is verified without exposing secrets to the browser.

### Phase 1 — implement the versioned crypto proxy and typed client

1. Add `app/api/crypto/[...path]/route.ts`.
2. Allowlist only these initial paths:

   ```text
   GET  /wallets/me
   POST /wallets
   GET  /networks
   POST /wallets/me/accounts/prepare
   GET  /wallets/me/package
   POST /wallets/me/package
   POST /wallets/me/rotate
   POST /passkeys/registration/options
   POST /passkeys/registration/verify
   POST /passkeys/authentication/options
   POST /passkeys/authentication/verify
   GET  /recovery/status
   GET  /devices
   GET  /transactions
   POST /transactions/intents
   POST /transactions/intents/:intentId/simulate
   POST /transactions/intents/:intentId/submit
   GET  /transactions/intents/:intentId
   GET  /transactions/:transactionId
   GET  /wallets/me/accounts/:accountId/balances
   ```

3. Forward the browser's Clerk session as a short-lived bearer token obtained by the Next.js server with `getToken()`.
4. Preserve upstream status, JSON error code, message, details, and request ID.
5. Reject all paths not explicitly allowlisted. Never proxy internal control routes or internal service routes to the browser.
6. Add timeout and structured logging without logging authorization headers or request bodies containing package material.
7. Create `lib/crypto-backend/client.ts` using `fetch`, not axios. It must normalize `{ success, data, error, requestId }` and expose a typed `CryptoApiError`.
8. Add request cancellation with `AbortController` and bounded retries only for safe GET/read operations. Do not automatically retry package commits, passkey verification, intent creation, or transaction submission unless idempotency behavior is explicit.

**Exit gate:** a test Clerk-authenticated request reaches `/v1/auth/me` and `/v1/wallets/me` through the proxy, and unauthenticated requests return a typed 401 instead of an HTML redirect.

### Phase 2 — add the frontend crypto data layer

1. Add `QueryClientProvider` near the existing application providers in `app/layout.tsx` or a client-side provider component.
2. Configure conservative defaults:

   - wallet metadata: stale for 1–5 minutes;
   - enabled networks: stale for 5 minutes;
   - balances: refresh on focus and on a controlled interval, not on every render;
   - transaction intent: no automatic refetch after expiry;
   - transaction history: invalidate after submission and poll only submitted/unknown records.

3. Add query keys scoped by Clerk user, wallet, account, network, and intent ID. Never use a global wallet cache key that could survive sign-out.
4. Clear the Query Client, in-memory wallet key state, and wallet authorization token on Clerk sign-out or user change.
5. Add offline handling:

   - show cached read-only wallet metadata with an offline indicator;
   - do not create, rotate, recover, or submit transactions offline;
   - cancel stale balance requests;
   - do not queue financial mutations for background replay.

6. Replace direct `fetch` loops in `hooks/useWalletBalances.ts` and `hooks/use-unified-transactions.ts` with the typed client/query hooks while preserving their current component-facing shapes during migration.

**Exit gate:** existing dashboard cards can read normalized wallet/network data without importing Privy or calling legacy aggregate balance routes.

### Phase 3 — implement self-custodial wallet creation

The wallet creation flow must be idempotent and resumable. A refresh halfway through must continue from the server's current wallet/package state.

1. Call `POST /wallets` after Clerk is loaded.
2. Call `POST /wallets/me/accounts/prepare` for `evm` and `solana` as required by the product configuration.
3. Generate account key material locally:

   - EVM: generate a secp256k1 private key and derive the checksum address;
   - Solana: generate an Ed25519 keypair and derive the base58 public address.

4. Verify the generated address and family locally before constructing the package.
5. Register a passkey through the backend options/verify ceremony. Request required user verification. Do not treat an ordinary WebAuthn assertion signature as an encryption key.
6. Authenticate the passkey and retain the short-lived wallet authorization token only in memory or an appropriate secure session boundary.
7. Create a random wallet DEK locally using Web Crypto.
8. Encrypt each account's private key/seed locally with AES-GCM and produce only the ciphertext, IV, AAD, encoding, and DEK version required by the backend package schema.
9. Wrap the DEK for the passkey using a PRF-derived key when browser support is confirmed. If PRF is unavailable, use the supported device/recovery envelope flow; do not downgrade to hashing an assertion signature.
10. Build package version `1`, base version `0`, security version `1`, account metadata, addresses, and envelopes.
11. Commit the package through `POST /wallets/me/package` using `x-wallet-authorization`.
12. Fetch `GET /wallets/me` and verify that accounts are active and canonical addresses match the locally generated package.
13. Keep only the encrypted package in persistence. Keep the unwrapped DEK/private key in memory for the shortest possible interaction and clear it after lock, sign-out, tab close, or inactivity timeout.

The existing `WalletSetupLoader` can be reused for status presentation, but its labels must reflect real states such as “Creating wallet metadata”, “Registering passkey”, “Encrypting wallet locally”, “Saving encrypted package”, and “Wallet ready”.

**Exit gate:** a new Clerk user can create EVM/Solana wallet metadata, register/authenticate a passkey, commit an encrypted package, refresh the page, and see addresses without any plaintext key reaching the network or persistent browser storage.

### Phase 4 — integrate passkey unlock, recovery, and device security

1. Add browser passkey helpers around the backend registration/authentication option endpoints.
2. Pass the backend-provided challenge/options through the browser WebAuthn implementation without mutating challenge, RP ID, origin, or user verification requirements.
3. On authentication, return both the backend wallet authorization token and the local PRF output when the browser supports PRF.
4. Use the PRF output only to derive/unwrap the wallet DEK locally.
5. Add a `WalletUnlockDialog` that clearly distinguishes:

   - Clerk application sign-in;
   - passkey wallet authorization;
   - local wallet unlock;
   - transaction signing approval.

6. Add recovery setup/status and recovery-complete UI only after the local package/recovery cryptography is implemented and tested.
7. Add device enrollment/revocation UI only for the normalized device endpoints. Revoking a device must clear local unlocked state and invalidate any local session token.
8. Handle expired wallet authorization tokens by restarting passkey authentication, never by silently reusing a stale token.

**Exit gate:** revoked passkeys/devices cannot unlock or authorize a wallet, expired ceremonies are surfaced clearly, and the frontend never presents a recovery secret or DEK to the backend.

### Phase 5 — add the modern provider and dual-mode onboarding

1. Introduce `CryptoProvider` alongside the existing `WalletProvider`; do not replace or remove the legacy provider.
2. Expose normalized modern state without changing the legacy context:

   ```ts
   type CryptoWalletState = {
     wallet: Wallet | null
     accounts: WalletAccount[]
     networks: Network[]
     packageStatus: "missing" | "active" | "stale" | "locked"
     isLoading: boolean
     error: CryptoApiError | null
   }
   ```

3. Keep `components/wallet-provider.tsx`, its server actions, and its legacy send/balance call sites available to existing users.
4. Add an explicit modern onboarding entry point and label the two modes (`Legacy wallet` and `Modern self-custodial wallet`). Do not silently replace a Privy address.
5. Update modern surfaces to use canonical addresses from normalized accounts while allowing legacy surfaces to continue using their existing contract.
6. Remove assumptions that one Privy Ethereum wallet automatically represents Ethereum, Arbitrum, Sui, TON, and Tron in modern UI. Render only networks returned as enabled by the crypto backend.
7. Preserve the current loading/error/empty visual language and use `WalletSetupLoader` for the new real states.

**Exit gate:** modern wallet surfaces use normalized backend wallet/account models, legacy surfaces remain usable, and the mode boundary is explicit.

### Phase 6 — balances and asset display

1. Fetch enabled networks from `GET /v1/networks`.
2. For every active account/network pair, call the normalized balance endpoint with the account ID and network ID.
3. Add a `useCryptoBalances` hook that combines server balances with existing price data only at the presentation layer.
4. Keep raw base-unit strings in the data model. Convert to display decimals with explicit asset decimals; never parse large balances through JavaScript `number` when precision matters.
5. Map server network IDs to UI metadata in `lib/networks.ts`, but do not display a UI network that the server marks disabled.
6. Keep public market data such as Hyperliquid order books/candles in a separate client. It is not wallet custody data and should not be coupled to wallet package state.
7. Add empty states for an account that is prepared but has no committed package/address and for RPC unavailable responses.

**Exit gate:** dashboard balances are derived from normalized account/network endpoints, refresh safely, show stale/offline state honestly, and do not call legacy `/api/wallet/balances`.

### Phase 7 — send flow with reviewed transaction intents

Replace `sendAsset` and direct Privy sends with a chain-neutral reviewed flow:

1. User selects an active account, enabled network, asset, recipient, and decimal amount.
2. Validate address and amount in the UI for fast feedback; treat backend validation as authoritative.
3. Call `POST /v1/transactions/intents` with an idempotency key.
4. Render the backend's normalized review summary, including chain family, network, sender, recipient, asset, amount, fees/limits, and expiry.
5. Require an explicit user confirmation before local signing.
6. Unlock the local package only in memory.
7. Sign the exact backend-reviewed payload locally:

   - EVM with the account derived from the locally decrypted key and the complete backend transaction request;
   - Solana by deserializing the returned versioned transaction and signing the reviewed message.

8. Call `POST /v1/transactions/intents/:intentId/submit` with the serialized signed transaction. Include `x-wallet-session-token` only for a supported, audited session authority; currently sessions must remain unavailable in the UI because the backend has no registered authority adapter.
9. Poll `GET /v1/transactions/intents/:intentId` and transaction history until confirmed, failed, expired, or unknown.
10. Invalidate balances and history after submission/confirmation.
11. Never retry a broadcast blindly. If the outcome is unknown, show the transaction ID and let reconciliation resolve it.

Add the modern transfer surface beside existing `components/assets/send-modal.tsx`. Keep legacy send mutations and history renderable, but do not mix legacy send mutations with the new intent flow.

**Exit gate:** a testnet user can review, locally sign, submit, and reconcile EVM/Solana transfers; wrong-network, wrong-recipient, modified-calldata, expired-intent, duplicate, and offline cases are handled safely.

### Phase 8 — package rotation and security controls

1. Add a “Rotate wallet security” flow that authenticates the root wallet with a passkey.
2. Decrypt the current package locally, generate/re-wrap material locally, increment package `version` and `securityVersion`, and commit through `/v1/wallets/me/rotate`.
3. Expect active trading sessions to be revoked by the backend after rotation.
4. Verify the new package can be decrypted locally before clearing the old in-memory state.
5. Do not delete the old encrypted package from the client until the new package is confirmed active.
6. Never present or upload a plaintext key during rotation.
7. Add recovery and device-revocation actions to the security settings surface only after their end-to-end tests pass.

**Exit gate:** stale package versions are rejected, rotation requires a security-version increase, active sessions are invalidated, and the user can unlock/sign with the new package on testnet.

### Phase 9 — legacy Privy coexistence and deprecation-ready dual-run

The current product requirement is to retain Privy. This phase therefore hardens the boundary instead of deleting the legacy wallet:

1. Keep `components/wallet-provider.tsx`, `lib/wallet-actions.ts`, `lib/ensureUserWallet.ts`, `lib/privy/*`, `@privy-io/node`, and their existing callers intact.
2. Keep modern wallet code free of Privy imports and server-side custody dependencies.
3. Use `NEXT_PUBLIC_LEGACY_PRIVY_ENABLED` as a reversible UI control; turning it off is a deliberate product migration decision, not part of this implementation.
4. Keep explicit legacy labels and preserve existing Privy wallet addresses/methods for current users.
5. Do not copy, export, or migrate Privy private keys into the modern encrypted package.
6. Keep no agent-side integration. The new crypto backend is the complete crypto-side backend for modern crypto flows in this dashboard.
7. Retain legacy historical transaction rendering and explicit dual-mode messaging.
8. Rotate any exposed legacy provider credentials externally; do not move them into the modern SDK or public environment variables.

**Exit gate:** both modes build and run together, modern client files have no Privy imports, legacy Privy paths remain available, and no address/key migration occurs implicitly.

### Phase 10 — market/trading surface alignment

This phase is separate from self-custodial wallet creation:

1. Inventory every function in `lib/crypto-api.ts` and classify it as normalized wallet backend, Hyperliquid public market data, Dollar Account service, or unrelated dashboard functionality.
2. Keep Hyperliquid public order-book/candle calls separate from wallet custody.
3. Move wallet funding/withdrawal/send actions to the normalized intent API or a separately documented service endpoint.
4. Do not route unsupported UI chains (Sui, TON, Tron, arbitrary Ethereum mainnet) into a testnet-only backend.
5. Hide unsupported actions rather than mapping them to a different network.
6. Preserve existing buy/sell/trade UI only where the current service contract and custody model are explicitly compatible.

**Exit gate:** each crypto UI action has one named backend owner and one typed contract; no action silently falls through to a legacy or wrong-chain endpoint.

### Phase 11 — staging rollout and cleanup

1. Deploy the backend and dashboard to staging with mainnet disabled.
2. Seed only testnet/devnet networks and configure explicit RPC providers.
3. Run the complete onboarding, passkey, package, balance, send, rotation, recovery, revoke, and sign-out scenarios.
4. Exercise network failure, backend pause, expired token, expired intent, duplicate intent, refresh during setup, and browser reload after unlock.
5. Compare server security events with UI-visible state.
6. Monitor error rate, latency, RPC fallback, intent reconciliation, and failed package commits.
7. Enable the frontend feature flag for an internal cohort first.
8. Roll out to a small user cohort after staging signoff.
9. Keep mainnet/session authority feature flags disabled until the separate external security and chain-authority audits are complete.
10. Remove the temporary proxy only after direct/proxy behavior is contract-tested and rollback is documented.

## 5. Required test matrix

### Unit tests

- API response/error parsing and request ID propagation.
- Clerk token absence/refresh behavior.
- Wallet package AES-GCM encrypt/decrypt round trip.
- Package tamper detection and version handling.
- EVM address derivation and checksum normalization.
- Solana keypair derivation and serialization.
- PRF-supported and PRF-unavailable passkey paths.
- Exact EVM transaction payload signing/binding.
- Exact Solana message signing/binding and invalid-signature rejection.
- Query-key isolation on Clerk user change.
- No private key/DEK values in logs or serialized error objects.

### Integration tests

- Clerk-authenticated proxy request to `/v1/auth/me`.
- Create wallet idempotency.
- Prepare account idempotency.
- Registration/authentication ceremony lifecycle.
- Initial package commit and stale version rejection.
- Rotation security-version enforcement and session invalidation.
- Balance reads across enabled EVM/Solana test networks.
- Intent creation, simulation, signed submission, reconciliation, and history.
- Pause control blocks wallet mutations.
- RPC primary failure uses configured fallback.

### Browser/E2E tests

- New user wallet setup from a clean Clerk account.
- Reload at every setup step.
- Passkey authentication on supported browser/device.
- Unsupported PRF browser receives a safe recovery/device path.
- Receive address copy and network selection.
- EVM testnet send.
- Solana devnet send.
- Wrong-chain and wrong-recipient review rejection.
- Sign-out clears in-memory wallet state and cached queries.
- Existing legacy user sees an explicit migration state, not a silent address replacement.

## 6. Security acceptance checklist

- [ ] No `@privy-io/node` import exists in the modern client crypto path; the isolated legacy Privy server path remains intentionally retained.
- [ ] No private key, seed phrase, DEK, passkey PRF output, Clerk secret, RPC key, or internal service key is logged.
- [ ] No sensitive wallet material is stored in `localStorage`.
- [ ] `NEXT_PUBLIC_*` variables contain only public URLs/feature flags.
- [ ] Clerk is the only application-auth source.
- [ ] The proxy allowlist excludes internal routes and control operations.
- [ ] Backend response errors are typed and do not leak upstream secrets.
- [ ] Transaction review happens before local signing.
- [ ] Signed payloads are bound to the reviewed intent.
- [ ] No blind broadcast retry exists.
- [ ] Mainnet networks are hidden/disabled unless backend and release controls enable them.
- [ ] Session UI is disabled until an audited chain-native authority adapter exists.
- [ ] Existing Privy keys are never migrated implicitly.
- [ ] Wallet rotation invalidates active sessions and requires a security-version increase.
- [ ] Sign-out clears wallet authorization, session tokens, unlocked keys, and query cache.

## 7. What is intentionally not part of this frontend integration

- No `worldstreet-agent` code changes.
- No agent-side API calls.
- Legacy Privy wallet creation/signing remains available for existing product flows; modern crypto code never imports or depends on it.
- No custom smart-account/session-key protocol.
- No Solana unrestricted delegated key.
- No private key generation on the backend.
- No mainnet enablement as part of the frontend cutover.

## 8. Final implementation order

```text
contract/version audit
        ↓
versioned Clerk proxy
        ↓
typed client + query layer
        ↓
local key/package cryptography
        ↓
passkey registration + unlock
        ↓
wallet provider/onboarding cutover
        ↓
balances + address surfaces
        ↓
reviewed send intents + local signing
        ↓
rotation/recovery/device security
        ↓
dual-mode Privy coexistence boundary
        ↓
staging soak + cohort rollout
```

The modern implementation is complete when the dashboard can create and unlock its own self-custodial wallet package, sign supported testnet transactions locally, submit them through reviewed backend intents, and recover safely without any dependency on `worldstreet-agent`. Legacy Privy wallet methods remain available until a separate deprecation decision is approved.
