# Worldstreet wallet envelope format — v1 (DRAFT, awaiting backend ack)

Status: proposed by frontend, 2026-08-26. The backend stores these structures
opaquely (phase-3-5.md, Phase 4) and never decrypts them, so this document —
not backend code — is the source of truth for what the ciphertext contains.
Any change requires a new `methodVersion`, never a silent format change.

## Primitives

- Randomness: `crypto.getRandomValues` only.
- Symmetric encryption: AES-256-GCM via WebCrypto (`crypto.subtle`), 12-byte
  random IV per encryption, tag appended to ciphertext (so the package's
  optional `authTag` field is omitted).
- KDF: HKDF-SHA-256 via WebCrypto.
- All binary fields: base64url, no padding (`^[A-Za-z0-9_-]+$`), matching the
  backend's strict schema.

## DEK

One 32-byte data-encryption key per wallet, generated at wallet activation.
It encrypts every account's key material and is itself wrapped once per
envelope. `dekVersion` starts at 1 and increments on DEK rotation (which
rewraps every envelope and re-encrypts every account via `/v1/wallets/me/rotate`).

## Account key material (`encryptedKeyMaterial`)

Plaintext is UTF-8 JSON, one of:

    { "v": 1, "family": "evm",    "algorithm": "secp256k1", "privateKey": "0x<64 hex chars>" }
    { "v": 1, "family": "solana", "algorithm": "ed25519",   "secretKey": "<base64url of the 64-byte @solana/web3.js secretKey>" }

Encrypted with the DEK, AAD = `wallet:<walletId>:account:<accountId>:v1`
(exactly the string the integration guide §7 shows). `encoding: "base64url"`.

## Passkey envelope (`purpose: "passkey"`, methodVersion 1)

Requires the WebAuthn PRF extension. A plain WebAuthn assertion signature is
NEVER used as key material (backend phase-3-5.md says the same).

- PRF input (`prf.eval.first`): `SHA-256("worldstreet-prf-salt:v1:" + walletId)`.
  Deterministic so any future ceremony reproduces it. `prfSaltVersion: 1`.
- Wrapping key: `HKDF-SHA-256(ikm = 32-byte PRF output,
  salt = UTF-8 "worldstreet-dek-wrap",
  info = UTF-8 "wallet:<walletId>:envelope:passkey:v1")` → 32 bytes → AES-256-GCM key.
- `wrappedDek` = AES-256-GCM(DEK bytes), AAD = `wallet:<walletId>:envelope:passkey:v1`.
- `envelopeId` = `passkey-<credentialId>`.
- `keyDerivationMetadata` = `{ "kdf": "HKDF-SHA-256", "prf": "webauthn-prf", "prfSaltVersion": 1 }`.

PRF-unavailable policy (v1): wallet creation is REFUSED with an explanatory
screen, and the capability result is logged for telemetry. A password-based
envelope (Argon2id) is reserved as methodVersion 2 and is not built until
telemetry shows real users blocked. Rationale: shipping a weaker fallback
silently downgrades everyone an attacker can phish.

## Recovery envelope (`purpose: "recovery"`, methodVersion 1)

- Recovery secret: 32 random bytes, shown to the user exactly once as
  base64url (43 chars) plus a downloadable `.txt`. Never sent to the backend,
  never stored by the client.
- Two keys derived from it with HKDF-SHA-256 (salt = UTF-8 "worldstreet-recovery"):
  - info `"worldstreet-recovery-ed25519:v1"` → 32-byte seed → Ed25519 keypair.
    The SPKI public key (base64url) goes to the backend at enrollment and
    signs the one-time recovery challenge (phase-3-5.md, Phase 5).
  - info `"wallet:<walletId>:envelope:recovery:v1"` → 32-byte AES-256-GCM key
    that wraps the DEK. AAD = `wallet:<walletId>:envelope:recovery:v1`.
- `keyDerivationMetadata` = `{ "kdf": "HKDF-SHA-256", "source": "recovery-secret", "saltLabel": "worldstreet-recovery" }`.
- Created AT onboarding, in the same package commit as the first passkey
  envelope (integration guide §7: "Add a recovery envelope at onboarding,
  not later").

## Device envelope (`purpose: "device"`, methodVersion 1)

Same dual-derivation shape as recovery, from a per-device 32-byte secret held
in that device's IndexedDB: Ed25519 key (info
`"worldstreet-device-ed25519:v1"`) signs the enrollment challenge; wrap key
(info `"wallet:<walletId>:envelope:device:<deviceId>:v1"`) wraps the DEK. An
already-enrolled device performs the wrap during `/v1/devices` enrollment and
adds the envelope via the next package commit.

## methodVersion registry

| purpose  | methodVersion | meaning                          |
| -------- | ------------- | -------------------------------- |
| passkey  | 1             | WebAuthn PRF + HKDF + AES-GCM    |
| recovery | 1             | recovery-secret HKDF + AES-GCM   |
| device   | 1             | device-secret HKDF + AES-GCM     |
| passkey  | 2 (reserved)  | Argon2id password fallback       |

## Open items for backend ack

1. Confirm the backend stores per-credential PRF support (phase-3-5.md says
   "PRF support is recorded") and exposes it to the client, so the client can
   warn before an authenticator without PRF is enrolled.
2. Confirm AAD strings above match what the backend echoes back untouched
   (they are stored, not validated, per Phase 4 — we just need them stable).
3. Confirm `authTag` may be omitted when the AEAD appends the tag (§7 says
   "optional if your AEAD appends it" — we rely on that).
