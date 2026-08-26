# Frontend Integration Guide

How to build a multi-chain wallet UI against this backend. Written for the team
implementing the client, not for the team that wrote the server.

Companion documents: [api-contract.md](api-contract.md) (Phase 0 auth/response
shape), [phase-3-5.md](phase-3-5.md) (packages, passkeys, devices, recovery),
[phase-6-8.md](phase-6-8.md) (chain adapters and transaction lifecycle),
[phase-9-11.md](phase-9-11.md) (trading sessions and rollout gates).

---

## 1. The custody model, and what it means for you

Read this section before writing any code. It determines the shape of the whole
frontend.

**The backend never holds a private key.** It stores ciphertext and public
metadata. It builds and validates transactions but cannot sign them. Every
private operation happens in your client:

| Responsibility | Owner |
| --- | --- |
| Key generation (EVM + Solana) | **Frontend** |
| Data-encryption key (DEK) generation | **Frontend** |
| Encrypting the wallet package | **Frontend** |
| WebAuthn ceremonies (`navigator.credentials`) | **Frontend** |
| Decrypting the package to recover keys | **Frontend** |
| Signing transactions | **Frontend** |
| Persisting ciphertext + public addresses | Backend |
| Building unsigned transactions | Backend |
| Validating and broadcasting signed transactions | Backend |
| Balances, history, reconciliation | Backend |
| Policy: sessions, limits, mainnet gates | Backend |

The practical consequence: **if your client loses the DEK and every unwrap
envelope, the funds are gone.** The backend cannot help. Recovery envelopes are
the only backstop, and they are also client-generated.

---

## 2. Base URL and the three tokens

```
https://crypto-backend.worldstreetgold.com
```

All user routes are under `/v1`. `/health` and `/ready` are unauthenticated.
`/internal/*` is service-to-service and blocked at the edge.

Three different credentials travel on different requests. Confusing them is the
most common integration error.

| Token | Header | Obtained from | Lifetime | Guards |
| --- | --- | --- | --- | --- |
| Clerk JWT | `Authorization: Bearer <jwt>` | Your existing Clerk session | Clerk's | **Every** `/v1` route |
| Wallet authorization | `x-wallet-authorization` | Passkey authentication verify | `WALLET_AUTH_TOKEN_TTL_SECONDS`, default **300s** | Package commit/rotate, session create/revoke, device + recovery writes |
| Wallet session | `x-wallet-session-token` | Trading session create | Up to `SESSION_MAX_TTL_SECONDS`, default 86400 | Session-bound transaction intents |

The Clerk JWT is always required — the wallet tokens are *additional*, never
substitutes. A request with a valid wallet authorization but no Clerk JWT is
rejected.

The 300-second wallet authorization window is short by design. Do not fetch one
at app start and hold it; fetch it immediately before the operation that needs
it, and expect to re-run the passkey ceremony if the user hesitates.

---

## 3. Response envelope

Success:

```json
{ "success": true, "data": { } }
```

Error:

```json
{ "success": false, "error": { "code": "ACCOUNT_NOT_READY", "message": "…" }, "requestId": "…" }
```

`POST /v1/transactions/intents` additionally returns a top-level `existing`
boolean for idempotent replays — see §8.4.

---

## 4. The client

`sdk/src/index.ts` is a typed client for this API. **It is not a published
package** — no npm scope is claimed for it, and `private: true` prevents
publishing. It is vendored: copy the file into your app.

```bash
cp sdk/src/index.ts ../your-frontend/src/lib/cryptoClient.ts
```

It is self-contained — one file, no runtime dependencies, and it imports
nothing from the backend — so a single file copy is the whole install.

```ts
import { WorldstreetCryptoClient } from '@/lib/cryptoClient'

const crypto = new WorldstreetCryptoClient({
  baseUrl: 'https://crypto-backend.worldstreetgold.com',
  getClerkToken: () => clerk.session?.getToken(),
})
```

Record the source commit in the file header when you copy it. A vendored client
can drift from the server, and the two places that will bite you are the ones
the server validates strictly and rejects outright: the wallet package schema
(§7) and the per-family signed-transaction encoding (§8.3). If you change either
on the backend, re-vendor.

`npm run build:sdk` type-checks the client in this repo; its `dist/` output is a
build artifact, not the delivery mechanism.

**What it does not cover.** It wraps 22 of the 30 user-facing routes. Missing
entirely — add these yourself, which is straightforward now that the file is
yours:

- **Devices**: `GET /v1/devices`, `POST /v1/devices/enrollment/start`,
  `POST /v1/devices/enrollment/complete`, `POST /v1/devices/:deviceId/revoke`
- **Recovery**: `GET /v1/recovery/status`, `POST /v1/recovery/start`,
  `POST /v1/recovery/complete`
- `GET /v1/auth/me`

It also has no timeout, retry, or `AbortSignal` support, and several return
types are `Record<string, unknown>` (`Balance`, `TransactionIntent`,
`TransactionRecord`, `WalletSession`, `PasskeyOptions`) — you will be casting.

---

## 5. The multi-chain data model

Four concepts. Get these straight and the rest follows.

```
User (Clerk sub)
 └── Wallet                     one per user
      └── WalletAccount         one per chain FAMILY  ("evm", "solana")
           └── WalletAddress    one per NETWORK
```

**A chain family is not a network.** One EVM account — one keypair, one address
— serves Ethereum Sepolia, Base Sepolia, Arbitrum, Polygon and BNB alike,
because they share secp256k1 and the same address derivation. One Solana account
serves devnet and mainnet-beta. So a two-chain-family wallet covers every
supported network.

This is enforced: `wallet_accounts` has a unique index on
`{ walletId, chainFamily }`. A second `evm` account for the same wallet is
impossible by construction. Do not build UI that implies a per-network keypair.

**Networks.** `GET /v1/networks` returns only enabled networks. Seeded set:

| Network | `networkId` | Family | Enabled by default |
| --- | --- | --- | --- |
| Ethereum Sepolia | `ethereum-sepolia` | evm | ✅ |
| Base Sepolia | `base-sepolia` | evm | ✅ |
| Solana Devnet | `solana-devnet` | solana | ✅ |
| Ethereum | `ethereum-mainnet` | evm | ❌ |
| Base, Arbitrum One, Polygon, BNB Smart Chain | … | evm | ❌ |
| Solana Mainnet-Beta | `solana-mainnet-beta` | solana | ❌ |

Mainnets stay dark until both `ENABLE_MAINNET=true` **and**
`MAINNET_RELEASE_APPROVED=true`. A request against a disabled network returns
`400 NETWORK_DISABLED`. Never hardcode the enabled list — read it from
`/v1/networks` so the UI follows the rollout automatically.

Note the two id spaces: API request bodies take the **Mongo ObjectId** of the
network document (`networkId` field in `TransferInput`), while intents and
transaction records echo the **slug** (`ethereum-sepolia`). Both appear in
responses; do not compare one to the other.

---

## 6. Wallet lifecycle

```
  createWallet ──► prepareAccount(evm) ──► prepareAccount(solana)
                            │
                   [accounts: state=provisioning, no address]
                            │
   client generates keypairs + DEK, encrypts key material
                            │
              passkey registration ceremony (WebAuthn)
                            │
              passkey authentication ceremony ──► wallet authorization token
                            │
                   commitWalletPackage(package, token)
                            │
              [accounts: state=active, canonicalAddress set]
                            │
               balances ✔   transaction intents ✔   sessions ✔
```

Nothing that touches money works before the package commit. Until then, balances
return `409 ACCOUNT_NOT_READY` ("Wallet account has no canonical address") and
intents return `409 ACCOUNT_NOT_READY` ("has not committed an address yet").

**Build the passkey ceremony first.** It gates key generation, package commit,
address commit, sessions, and every transaction. No other feature can be
demonstrated end-to-end until it works.

### 6.1 Create the wallet and prepare accounts

```ts
const { wallet, accounts } = await crypto.createWalletWithAccounts(['evm', 'solana'])
```

`prepareAccount` reserves the account row and returns its `accountId`. You need
those ids for the package in §7 — they are the join key between what the client
encrypts and what the server stores.

---

## 7. The wallet package

The package is the single document carrying every encrypted secret. It is
committed to `POST /v1/wallets/me/package` (first write) or
`POST /v1/wallets/me/rotate` (subsequent, requires a higher `securityVersion`).
Both need `x-wallet-authorization`.

Schema is `.strict()` — unknown fields are rejected, not ignored. Every binary
field is **base64url without padding** (`^[A-Za-z0-9_-]+$`). A standard base64
string with `+`, `/` or `=` fails validation.

```ts
{
  format: 'worldstreet-wallet-package',   // literal
  version: 1,                              // must equal baseVersion + 1
  baseVersion: 0,                          // the version you read; 0 on first commit
  walletId: '<24-hex ObjectId>',
  securityVersion: 1,                      // must increase on /rotate
  accounts: [{
    accountId: '<from prepareAccount>',
    family: 'evm',
    algorithm: 'secp256k1',
    keyType: 'private-key',                // | 'seed' | 'extended-private-key' | 'opaque'
    publicKey: '0x…',                      // optional
    canonicalAddress: '0xabc…',            // ← this is what unlocks the account
    addresses: [                           // at least one
      { networkId: 'ethereum-sepolia', address: '0xabc…', isCanonical: true },
      { networkId: 'base-sepolia',     address: '0xabc…', isCanonical: false },
    ],
    encryptedKeyMaterial: {
      ciphertext: '<base64url>',
      iv: '<base64url>',
      authTag: '<base64url>',              // optional if your AEAD appends it
      aad: 'wallet:<walletId>:account:<accountId>:v1',
      dekVersion: 1,
      encoding: 'base64url',               // literal
    },
  }],
  envelopes: [{                            // at least one
    envelopeId: 'passkey-<credentialId>',
    purpose: 'passkey',                    // | 'recovery' | 'device'
    methodVersion: 1,
    credentialId: '<webauthn credential id>',
    wrappedDek: '<base64url>',
    iv: '<base64url>',
    aad: 'wallet:<walletId>:envelope:passkey:v1',
    keyDerivationMetadata: { /* your KDF params — free-form */ },
  }],
  packageHash: '<optional integrity hash>',
}
```

Rules that will bite you:

- **`canonicalAddress` is required on every account.** Committing the package is
  what flips accounts from `provisioning` to usable. There is no separate
  "commit address" endpoint.
- **Optimistic concurrency.** `baseVersion` must match the stored `version`. A
  stale value is rejected — re-read `GET /v1/wallets/me/package` and retry.
- **`accountId` values must be unique**, likewise `envelopeId`.
- **Ship more than one envelope.** One passkey envelope means one lost
  authenticator equals permanently lost funds. Add a recovery envelope at
  onboarding, not later.
- **Size cap** `WALLET_PACKAGE_MAX_BYTES` = 1 MiB → `413 WALLET_PACKAGE_TOO_LARGE`.
- `GET /v1/wallets/me/package` returns `404 NOT_FOUND` before the first commit.
  That is normal — catch it, do not treat it as an error state.

---

## 8. Transactions

### 8.1 The flow

```
createTransferIntent ──► (backend builds unsigned tx from live chain state)
        │
   simulateIntent  (optional but recommended — show the user the result)
        │
   client signs the unsigned payload locally
        │
   submitIntent(intentId, signedTransaction)
        │
   backend re-validates the signature binding, then broadcasts
        │
   poll getTransaction(id) until reconciliation confirms
```

Intents expire after `TRANSACTION_INTENT_TTL_SECONDS` (default **900s**).
Submitting after that returns `409 INTENT_EXPIRED`.

### 8.2 Amounts are in display units

```ts
await crypto.createTransferIntent({
  accountId, networkId,
  asset: { kind: 'native', identifier: 'ETH' },
  to: '0x…',
  amount: '0.0001',      // ETH, not wei. '1000' means 1000 ETH.
})
```

The backend calls `parseUnits(amount, decimals)`, reading `decimals` from the
ERC-20 contract for token transfers. Sending base units here silently requests a
transfer ~10^18 times too large; you will get `400 SIMULATION_FAILED` with
`EVM error: OutOfFunds`. Balances, by contrast, are returned in **base units**
(`amountBaseUnits`) — the asymmetry is real, mind it.

### 8.3 Signing — the two families differ significantly

**EVM.** The unsigned payload is:

```json
{ "kind": "evm-native-transfer", "chainId": 11155111,
  "from": "0x…", "to": "0x…", "value": "0x5af3107a4000" }
```

ERC-20 transfers instead carry `kind: "erc20-transfer"`, `to` = token contract,
plus `recipient`, `token`, `amount`, `decimals`, `data`, `value: "0x0"`.

**The payload contains no nonce and no gas parameters.** Your client must fetch
the nonce and fee data from its own RPC provider and supply them when signing.
The frontend therefore needs EVM RPC access of its own — the backend will not
provide it.

Submit `signedTransaction` as the `0x`-prefixed raw RLP hex (viem's
`serializeTransaction` / `signTransaction` output).

On submit the backend recovers the sender and checks `chainId`, `to`, `value`
and calldata against the intent. **It does not check nonce or gas** — those are
outside the reviewed envelope, so a compromised client could alter them. Treat
the EVM "reviewed intent" guarantee as covering destination, amount and calldata
only.

**Solana.** The backend builds the entire `VersionedTransaction`, including
`recentBlockhash`, and hands it over already serialized:

```json
{ "kind": "solana-native-transfer",
  "serializedTransaction": "<base64>", "recentBlockhash": "…",
  "lastValidBlockHeight": 123456, "feePayer": "…", "recipient": "…" }
```

Deserialize, sign the message, re-serialize, and submit as **base64**. Do not
rebuild the transaction: the backend compares `message.serialize()` byte-for-byte
against the intent and rejects any difference. It also verifies every required
signature with ed25519 before broadcasting.

Solana's guarantee is strictly stronger than EVM's — the whole message is bound.

> **Blockhash vs intent TTL.** A Solana blockhash expires in roughly 60–90
> seconds, but intents live 900. An intent can therefore be well within its TTL
> and still fail to broadcast on a stale blockhash. Sign and submit Solana
> intents promptly, and on failure create a fresh intent rather than retrying
> the old one.

### 8.4 Idempotency

Send an `Idempotency-Key` header (or `idempotencyKey` in the body) on intent
creation. A replay returns `200` with top-level `existing: true` instead of
`201`. Note that `WorldstreetCryptoClient.createTransferIntent` returns
`result.data` and **discards `existing`** — if you need to distinguish a replay
from a fresh intent, call the route directly.

### 8.5 Balances

```ts
await crypto.getBalances(accountId, networkId)                 // native only
await crypto.getBalances(accountId, networkId, [tokenAddress]) // + tokens
```

```json
[{ "asset": { "kind": "native", "identifier": "ETH" },
   "amountBaseUnits": "60217243958644222840", "decimals": 18, "symbol": "ETH" }]
```

Base units as a decimal string. Format with `formatUnits(BigInt(x), decimals)`.
Never parse into a JS `number` — 60217243958644222840 exceeds `MAX_SAFE_INTEGER`
and will silently lose precision.

To show a portfolio, iterate accounts × their family's enabled networks — one
call each. There is no aggregate endpoint.

---

## 9. Trading sessions

Sessions let a scoped token authorize transfers without a passkey ceremony per
transaction. Creating one requires `x-wallet-authorization`; using one means
passing `x-wallet-session-token` on both intent creation and submit.

```ts
const { session, token } = await crypto.createTradingSession({
  accountId, chainFamily: 'evm', networkIds: [sepoliaId],
  allowedTargets: ['0x…'], maxTransactionValue: '0.1',
  maxDailyValue: '1.0', maxRequestsPerMinute: 10, ttlSeconds: 3600,
}, walletAuthorizationToken)
```

An intent created under a session is bound to it: submitting without the same
session token returns `401 SESSION_REQUIRED`.

**Both flags are off by default** (`ENABLE_EVM_SESSIONS`,
`ENABLE_SOLANA_SESSIONS`). Gate the UI on capability rather than assuming.

Be honest with users about what this is: a **server-side policy layer**, not an
on-chain delegation. It is not an audited EVM smart-account or a Solana
constrained authority. Anyone who can reach the backend with a valid session
token is inside the policy, so do not describe it in-product as an on-chain
spending limit.

---

## 10. Error codes

| Code | HTTP | Meaning / action |
| --- | --- | --- |
| `AUTH_REQUIRED` | 401 | Missing/invalid Clerk JWT, or a wallet token is required |
| `SESSION_REQUIRED` | 401 | Intent is session-bound; resend with `x-wallet-session-token` |
| `NOT_FOUND` | 404 | No wallet/package/intent — expected before first commit |
| `ACCOUNT_NOT_READY` | 409 | No `canonicalAddress` yet — commit the package |
| `INTENT_NOT_SUBMITTABLE` | 409 | Intent is not `awaiting_signature` |
| `INTENT_EXPIRED` | 409 | Past TTL — create a new intent |
| `NETWORK_DISABLED` | 400 | Network off, or mainnet gate closed |
| `SIGNED_TRANSACTION_MISMATCH` | 400 | Signature does not bind the intent; `details` lists why |
| `SIMULATION_FAILED` | 400 | Chain rejected the dry run (often insufficient funds) |
| `INVALID_AMOUNT` | 400 | Amount ≤ 0 |
| `INVALID_TOKEN_ADDRESS` | 400 | Malformed ERC-20 address |
| `WALLET_PACKAGE_TOO_LARGE` | 413 | Over 1 MiB |
| `INVALID_REQUEST` | 400 | Zod validation failed |

Surface `requestId` in your error UI — it is the only way to correlate a user
report with a server log line.

There is also a global pause switch (`WALLET_OPERATIONS_PAUSED`, and a
database-backed control toggled via `/internal/v1/control/pause`). When it is on,
wallet operations fail service-wide. Render that as planned maintenance, not as
a user error.

---

## 11. Browser and deployment configuration

### CORS — done

`cors` is wired in `src/app.ts` with an explicit allowlist, and helmet's
`Cross-Origin-Resource-Policy` is set to `cross-origin` (its `same-origin`
default blocked the browser from reading responses at all). Allowed origins come
from `CORS_ALLOWED_ORIGINS`, defaulting to:

```
https://worldstreetgold.com
https://www.worldstreetgold.com
http://localhost:3000
http://localhost:3001
```

Preflight permits `authorization`, `content-type`, `accept`,
`x-wallet-authorization`, `x-wallet-session-token` and `idempotency-key`, and
`x-request-id` is exposed so your error UI can read it. An origin outside the
list gets no `Access-Control-Allow-Origin` header and the browser blocks it.

Adding an origin is a config change, not a code change — extend
`CORS_ALLOWED_ORIGINS` and restart.

### Rate limiting — removed

The blanket 120-requests-per-minute limiter is gone. Nothing throttles the API
now, so a wallet flow that fans out (balances across families × networks) will
not trip anything.

Worth revisiting before real funds: `app.set('trust proxy', 1)` is now set, so
`req.ip` is the real client rather than nginx, and a limiter scoped to the
passkey and authorization routes would work correctly if you want one. That is a
small, additive change — the reason the old one had to go is that it was global,
blunt, and (before `trust proxy`) shared across every user at once.

### WebAuthn — multi-origin

Both local development and production are handled at the same time.

| Origin | RP ID |
| --- | --- |
| `http://localhost:3000` | `localhost` |
| `http://localhost:3001` | `localhost` |
| `https://worldstreetgold.com` | `worldstreetgold.com` |
| `https://www.worldstreetgold.com` | `worldstreetgold.com` |

Configured by `WEBAUTHN_ORIGINS` and `WEBAUTHN_RP_IDS`. At options-generation
time the RP ID is chosen per request from the caller's `Origin` header, using the
longest configured RP ID that is a registrable domain suffix of the origin's
host; verification accepts the whole configured set. `WEBAUTHN_RP_ID` remains
the fallback when a request carries no usable `Origin`.

Note that apex and `www` deliberately share the RP ID `worldstreetgold.com`, so
one passkey works on both.

> **`localhost` and `worldstreetgold.com` are separate credential namespaces.**
> A passkey enrolled in local development cannot authenticate against
> production, and vice versa. That is WebAuthn behaving correctly — credentials
> are bound to their RP ID — not a misconfiguration. Expect to enrol separately
> in each environment, and never treat a dev passkey as a production test.
>
> The same rule means changing an RP ID later invalidates every credential
> registered under the old one. Pick the production RP ID once.

### Clerk — still required

`CLERK_AUTH_ENABLED=false` must not reach a public host. With auth off, every
caller resolves to the same synthetic `dev_clerk_user`, so anyone who finds the
URL owns that wallet. The backend refuses `false` outside
`NODE_ENV=development|test`; set `NODE_ENV=production`, supply
`CLERK_ISSUER_URL` / `CLERK_JWT_AUDIENCE` / `CLERK_JWKS_URL`, and confirm with
`npm run verify:production-config`.

---

## 12. Suggested build order

1. Clerk token plumbing → `GET /v1/auth/me` returns your user.
2. `GET /v1/networks` → render available chains from server state.
3. Wallet + account creation (`createWalletWithAccounts`).
4. **Passkey registration and authentication** — the gate on everything below.
5. Key generation, package encryption, commit. Accounts go `active`.
6. Balances across families → the portfolio view.
7. Transfer intent → sign → submit → poll, EVM first, then Solana.
8. Recovery envelopes and device management (raw `fetch`; not in the SDK).
9. Trading sessions, behind their feature flags.
