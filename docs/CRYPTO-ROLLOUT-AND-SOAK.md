# Crypto backend rollout and staging soak

This runbook covers the modern self-custodial wallet path while the existing Privy wallet remains available. Clerk remains the only application-auth system. No `worldstreet-agent` calls are part of this flow.

## Environment

Use the dashboard proxy with:

```env
CRYPTO_API_URL=https://crypto-backend.worldstreetgold.com
NEXT_PUBLIC_CRYPTO_ENABLED=true
NEXT_PUBLIC_CRYPTO_PROXY_ENABLED=true
NEXT_PUBLIC_LEGACY_PRIVY_ENABLED=true
```

Keep `CRYPTO_API_URL`, Clerk secrets, Privy secrets, MongoDB credentials, and RPC provider keys server-only. The public flags are rollout controls only.

## Staging gates

1. Confirm `GET https://crypto-backend.worldstreetgold.com/health` and `/ready` are healthy.
2. Confirm the dashboard `/api/crypto/health` and `/api/crypto/ready` proxy responses preserve status and request IDs.
3. With a real Clerk test user, create wallet metadata and EVM/Solana prepared accounts.
4. Register and authenticate a passkey. Verify the WebAuthn RP ID/origin matches the dashboard origin.
5. Confirm package commit sends ciphertext only and that IndexedDB contains no plaintext key, recovery secret, or DEK.
6. Reload the browser, unlock locally, and verify canonical addresses.
7. Read balances for every enabled account/network pair. Test a backend/RPC failure and verify the UI shows unavailable/stale state.
8. Create a duplicate transfer intent with the same idempotency key and verify the backend returns the existing intent.
9. Simulate, review, locally sign, submit, and reconcile a Solana devnet transfer.
10. For EVM, first verify the backend intent includes nonce and fee/type fields. The frontend fails closed when they are absent.
11. Rotate package security with passkey plus recovery secret; verify package and security versions increase and old device/session authorization is invalidated.
12. Revoke a device, sign out, change Clerk user, and confirm query cache, authorization token, DEK, and session state are cleared.
13. Verify the existing Privy wallet screens and sends still work when `NEXT_PUBLIC_LEGACY_PRIVY_ENABLED=true`.

## Failure drills

- Disable the crypto feature flag and verify legacy wallet screens remain visible.
- Stop or pause the backend and verify modern reads show a typed error while legacy routes remain independent.
- Block the primary RPC and verify backend failover/reconciliation behavior.
- Expire a passkey authorization token and confirm the UI asks for a new ceremony.
- Expire an intent and verify no signed payload is submitted.
- Reload during wallet setup and confirm the flow resumes from server/package state.
- Submit the same idempotency key twice and verify only one intent/broadcast is created.
- Make the browser offline and verify reads may show cached data but mutations are blocked.
- Tamper with an IndexedDB package and verify AES-GCM decryption fails without a signing attempt.

## Rollout and rollback

Start with internal Clerk users, then a small cohort. Monitor proxy 4xx/5xx rates, passkey ceremony failures, package commit failures, balance latency, intent creation/simulation/submission, unknown transaction reconciliation, and RPC fallback. Roll back by setting `NEXT_PUBLIC_CRYPTO_ENABLED=false`; do not delete modern packages or alter legacy Privy records during rollback.

## Known external gates

- Production WebAuthn configuration must permit the deployed dashboard origin.
- Deploy the updated backend EVM adapter before enabling EVM signing; the local backend now returns and validates the complete transaction request.
- Session-key UI remains disabled until a registered, audited EVM/Solana authority adapter exists.
- Mainnet and unsupported chains remain disabled until backend policy, RPC, and security signoff are complete.
