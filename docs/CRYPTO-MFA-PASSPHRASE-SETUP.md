# Modern wallet passphrase + recovery-secret model

The modern wallet now uses two separate protections:

1. The existing signed-in Clerk session authorizes the one-time initial wallet package creation.
2. A local wallet passphrase unwraps the encrypted wallet DEK in the browser for normal unlock and signing.
3. The recovery secret signs a short-lived backend challenge for passphrase changes, rotation, device revocation, and other protected package writes.

The recovery secret remains the emergency local unlock and recovery path. Neither the passphrase, recovery secret, DEK, nor private keys are sent to the dashboard server or crypto backend.

## Clerk setup

No Clerk Pro or Clerk MFA setup is required for this wallet model. The user must simply be signed in. Clerk authorizes the initial package creation; after that, the recovery secret is required for protected wallet changes.

## Wallet setup

1. Sign in with the development Clerk user.
2. Open Assets and choose Create modern wallet.
3. Enter and confirm a wallet passphrase of at least 12 characters.
4. Save the displayed recovery secret somewhere secure.

The package contains a PBKDF2-SHA-256 passphrase envelope and a recovery envelope. Passkey/WebAuthn code remains only as a compatibility path for older wallets and device-management callers; it is not required for new setup or normal unlock.

## Local test

From `C:\Users\HP\Desktop\Projects\worldstreet-crypto-backend`:

```powershell
npm run typecheck
npm test -- --run
docker compose up -d --build --force-recreate crypto-backend
```

From `C:\Users\HP\Desktop\dashboard-revamp`:

```powershell
pnpm exec tsc --noEmit
pnpm run verify:crypto
pnpm dev
```

If the frontend still targets `https://crypto-backend.worldstreetgold.com`, deploy/rebuild the backend first. For a fully local backend, point the server-only `CRYPTO_API_URL` to `http://localhost:3020` and restart Next.js.
