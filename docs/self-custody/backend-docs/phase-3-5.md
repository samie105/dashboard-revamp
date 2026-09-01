# Phases 3–5 Implementation Notes

## Phase 3 — Normalized wallet persistence

Implemented collections:

```text
users
user_identities
wallets
wallet_accounts
wallet_addresses
networks
wallet_packages
wallet_key_envelopes
```

The first wallet is created with package `version=0`. A client prepares an account first:

```http
POST /v1/wallets/me/accounts/prepare
Authorization: Bearer <Clerk JWT>
```

```json
{
  "chainFamily": "evm",
  "keyAlgorithm": "secp256k1",
  "keyType": "private-key"
}
```

The response gives the client an `accountId`. The client then generates the account and commits the encrypted package in Phase 4.

## Phase 4 — Encrypted wallet package

The backend accepts ciphertext-only packages:

```http
POST /v1/wallets/me/package
Authorization: Bearer <Clerk JWT>
x-wallet-authorization: <short-lived wallet authorization token>
```

```json
{
  "format": "worldstreet-wallet-package",
  "version": 1,
  "baseVersion": 0,
  "walletId": "...",
  "securityVersion": 1,
  "accounts": [
    {
      "accountId": "...",
      "family": "evm",
      "algorithm": "secp256k1",
      "keyType": "private-key",
      "canonicalAddress": "0x...",
      "addresses": [
        {
          "networkId": "ethereum-sepolia",
          "address": "0x...",
          "isCanonical": true
        }
      ],
      "encryptedKeyMaterial": {
        "ciphertext": "base64url-ciphertext",
        "iv": "base64url-iv",
        "aad": "worldstreet/wallet/.../account/...",
        "dekVersion": 1,
        "encoding": "base64url"
      }
    }
  ],
  "envelopes": [
    {
      "envelopeId": "passkey-envelope-1",
      "purpose": "passkey",
      "methodVersion": 1,
      "credentialId": "...",
      "wrappedDek": "base64url-wrapped-dek",
      "iv": "base64url-iv",
      "aad": "worldstreet/wallet/.../passkey",
      "keyDerivationMetadata": {
        "kdf": "HKDF-SHA-256",
        "prf": "webauthn-prf"
      }
    }
  ]
}
```

The backend enforces:

- Wallet/package ownership.
- Strict package schema and size limit.
- Unique account and envelope IDs.
- Known network IDs.
- Optimistic `baseVersion → version` progression.
- Ciphertext, IV, AAD, and encoding metadata presence.

The backend does not decrypt `encryptedKeyMaterial` or `wrappedDek`.

Package commits and rotation require the short-lived wallet authorization token returned by successful passkey authentication. Clerk authentication alone is sufficient for public wallet metadata, account preparation, and encrypted package retrieval, but not for replacing the active package.

Retrieve the active package with:

```http
GET /v1/wallets/me/package
Authorization: Bearer <Clerk JWT>
```

`POST /v1/wallets/me/rotate` uses the same versioned package commit contract and is reserved for package/DEK rotation workflows.

## Phase 5 — Passkeys, devices, and recovery

### Passkeys

```text
POST /v1/passkeys/registration/options
POST /v1/passkeys/registration/verify
POST /v1/passkeys/authentication/options
POST /v1/passkeys/authentication/verify
```

The backend verifies origin, RP ID, challenge, user verification, credential public key, and signature counter. Successful authentication returns a short-lived wallet authorization token in `x-wallet-authorization` format for subsequent wallet-security operations.

The token does not contain a DEK or private key. PRF support is recorded from WebAuthn extension results; the client must derive the wrapping key locally and must not use a normal WebAuthn signature as an encryption key.

### Devices

```text
GET  /v1/devices
POST /v1/devices/enrollment/start
POST /v1/devices/enrollment/complete
POST /v1/devices/:deviceId/revoke
```

Device enrollment expects a client-generated Ed25519 SPKI public key encoded as base64url. The new device signs the enrollment challenge locally. Its DEK envelope is added through the next wallet package commit.

### Recovery

```text
GET  /v1/recovery/status
POST /v1/recovery/start
POST /v1/recovery/complete
```

Recovery expects a recovery envelope containing an Ed25519 SPKI public key. The client signs the one-time recovery challenge with the recovery private key, unwraps the wallet DEK locally, creates a replacement package, and submits that package. The raw recovery secret, private key, and DEK never reach the backend.
