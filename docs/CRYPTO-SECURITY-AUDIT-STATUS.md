# Crypto frontend security audit status

This is the frontend-side audit record for phases 5–11. It is intentionally explicit about controls that are implemented, controls that fail closed, and controls that still require backend/deployment signoff.

## Implemented in the dashboard

- Clerk remains the application-auth source; modern API calls use the same-origin `/api/crypto` proxy.
- Modern wallet state is isolated in `CryptoProvider`; the existing Privy `WalletProvider` and methods remain available.
- Modern client files do not import Privy or backend-only wallet dependencies.
- EVM and Solana private material is generated, encrypted, decrypted, and signed in the browser. Plaintext key material is not sent to the API or stored in IndexedDB.
- Balance reads retain exact base-unit strings and are scoped by Clerk user, account, and network.
- Transfer creation has explicit idempotency keys, backend review/simulation, local signing, one-shot submission, and no blind broadcast retry.
- Sign-out/user change clears React Query state and the in-memory DEK/authorization state.
- Rotation requires passkey PRF plus recovery secret, creates a fresh DEK, increases package/security versions, and persists the replacement only after commit succeeds.
- Session-key and delegated-authority paths are not exposed in the UI.

## EVM smart-account/session-key audit

The backend EVM adapter reports `smartAccounts: false` and `sessionKeys: false`; the authority registry has no registered audited EVM adapter. The dashboard therefore uses direct local EOA signing only for complete backend-provided transactions and never treats a policy bearer token as a smart-account authority. EVM signing fails closed when the intent lacks nonce/fee/type fields needed to bind the exact transaction.

Before enabling smart accounts or EVM session keys, add a chain-native audited implementation, bind policy to the deployed account/authority, add negative tests for target/value/calldata/chain/nonce limits, and complete independent review.

## Solana constrained-authority audit

The backend Solana adapter reports `smartAccounts: false` and `sessionKeys: false`. The frontend signs only the exact backend-returned versioned transaction, verifies the fee payer matches the local account, and submits the serialized signed transaction. No unrestricted delegated Solana key or custom authority protocol is implemented.

Before enabling constrained authority, select a protocol-specific design, enforce account/program/amount/expiry constraints on-chain or in the audited authority, and add replay, malicious-instruction, signer-set, and revocation tests.

## Operational controls

RPC fallback, MongoDB backup/restore, package rotation, recovery, device revocation, and staging soak are documented in the rollout runbook. The dashboard can exercise health/readiness and fail-closed UX, but actual provider outage, restore, WebAuthn origin, and reconciliation drills require a controlled staging environment with real provider credentials.

## Open release gates

- Deploy the updated backend EVM adapter that returns and validates complete transaction request fields before enabling EVM transfers.
- Configure WebAuthn RP ID/origin for the exact staging/production dashboard origin.
- Run real Clerk/passkey setup, recovery, rotation, and revoke tests on staging.
- Keep mainnet, smart-account, session-key, and Solana delegated-authority flags disabled until their audits pass.
