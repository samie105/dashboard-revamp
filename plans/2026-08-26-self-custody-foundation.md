# Self-Custody Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the dashboard's client foundation for the new self-custodial wallet backend — local backend running, SDK vendored and wrapped, networks rendered from server state, wallet + account creation working end-to-end on `/wallet` behind a feature flag — plus the envelope-format spec and questions doc that must go to Tom before Phase 2.

**Architecture:** The new `worldstreet-crypto-backend` (Express, port 3020, `/v1`) holds only ciphertext and public metadata; all key operations happen client-side. Phase 1 builds everything that requires **no cryptography**: HTTP plumbing, the wallet/account lifecycle up to `state=provisioning`, and the UI shell. Passkeys, key generation, and the package commit are Phase 2, gated on the envelope spec being agreed with Tom (which is why the spec draft is Task 2, not last). Everything new lives under `lib/crypto/`, `hooks/`, and `app/wallet/`, gated by `NEXT_PUBLIC_SELF_CUSTODY_ENABLED` — zero changes to any legacy Privy path.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, pnpm, Clerk (`@clerk/nextjs` v7), viem (already a dependency), vitest (added in Task 5), design system from `components/ui/system.tsx`.

**Spec:** `docs/self-custody/backend-docs/frontend-integration.md` (vendored from Tom's repo in Task 1; companions in the same folder). Read §1–§7 before Task 5 onward.

## Global Constraints

- Package manager is **pnpm** (`pnpm add`, `pnpm dev`, `pnpm typecheck`). Never npm/yarn in the dashboard repo. (The *backend* repo uses npm — that's Tom's convention, keep it there.)
- Path alias `@/*` maps to the repo root (existing convention, e.g. `@/lib/mongodb`).
- **Never touch** `lib/privy/*`, `lib/crypto-api.ts`, `lib/ensureUserWallet.ts`, `models/UserWallet.ts`, or any legacy flow. Phase 1 is purely additive.
- All new UI must use `components/ui/system.tsx` primitives (`PageHeader`, `CardShell`, `CardHeader`, `ListRow`, `EmptyState`, `Skel`) and design tokens — no hardcoded colors; gold (`primary`) only for brand, primary CTA, and active state.
- Base-unit amounts are **decimal strings**, formatted with `formatUnits(BigInt(x), decimals)` from viem. Never `Number()`/`parseFloat()` a base-unit amount (doc §8.5: values exceed `MAX_SAFE_INTEGER`).
- Backend binary fields are **base64url without padding** (`^[A-Za-z0-9_-]+$`) — relevant to the spec doc in Task 2; no code in this plan encodes binaries yet.
- New env vars: `NEXT_PUBLIC_CRYPTO_BACKEND_URL`, `NEXT_PUBLIC_SELF_CUSTODY_ENABLED` (`"1"` = on). Flag off ⇒ `/wallet` returns 404 and no new code runs.
- Only new dependency allowed in this plan: `vitest` (dev). Everything else uses what's already installed.
- Local backend: `http://localhost:3020`, `CLERK_AUTH_ENABLED=false` (every caller resolves to `dev_clerk_user` — development only, per backend `docs/api-contract.md`).
- Commit after every task (messages given per task). Branch: `feat/self-custody`.

---

### Task 1: Branch + vendored backend docs snapshot

The backend docs are the spec this plan argues from. Vendor a snapshot into the repo so executors and future sessions read the exact version this plan was written against.

**Files:**
- Create: `docs/self-custody/backend-docs/frontend-integration.md`
- Create: `docs/self-custody/backend-docs/api-contract.md`
- Create: `docs/self-custody/backend-docs/phase-3-5.md`
- Create: `docs/self-custody/backend-docs/phase-6-8.md`
- Create: `docs/self-custody/backend-docs/README.md` (provenance note, written by you)

**Interfaces:**
- Consumes: GitHub access to `tomurashigaraki22/worldstreet-crypto-backend` (already granted to the `Owen-Jz` account; `gh auth status` must show it).
- Produces: the spec files every later task cites.

- [ ] **Step 1: Create the branch**

```bash
cd /c/Users/owen/Downloads/Projects/worldstreet/dashboard-revamp
git checkout master && git pull
git checkout -b feat/self-custody
```

- [ ] **Step 2: Record the backend commit SHA**

```bash
gh api repos/tomurashigaraki22/worldstreet-crypto-backend/commits/main --jq .sha
```

Copy the output — it goes in the provenance README next and in the vendored client header in Task 4.

- [ ] **Step 3: Fetch the four docs**

```bash
mkdir -p docs/self-custody/backend-docs
for f in frontend-integration.md api-contract.md phase-3-5.md phase-6-8.md; do
  gh api "repos/tomurashigaraki22/worldstreet-crypto-backend/contents/docs/$f" --jq '.content' | base64 -d > "docs/self-custody/backend-docs/$f"
done
```

- [ ] **Step 4: Write the provenance README**

Create `docs/self-custody/backend-docs/README.md`:

```markdown
# Backend docs snapshot

Vendored from `tomurashigaraki22/worldstreet-crypto-backend` @ `<SHA from Step 2>`
on 2026-08-26. These are reference copies for the self-custody integration —
the backend repo is canonical. Re-vendor when Tom changes the wallet package
schema (§7) or the signed-transaction encoding (§8.3), per the integration
guide's own drift warning.
```

- [ ] **Step 5: Verify the files are non-empty and readable**

```bash
wc -l docs/self-custody/backend-docs/*.md
```

Expected: `frontend-integration.md` ≈ 546 lines, `api-contract.md` ≈ 72, `phase-3-5.md` ≈ 149, `phase-6-8.md` > 50, plus your README. If any file is 0 lines or contains `"message": "Not Found"`, the fetch failed — fix before committing.

- [ ] **Step 6: Commit**

```bash
git add docs/self-custody/backend-docs
git commit -m "docs(crypto): vendor backend integration docs snapshot"
```

---

### Task 2: Envelope-format spec draft + questions doc for Tom

This is the Phase 2 critical path — it needs Tom's agreement and human latency, so it ships first. Two documents: a concrete v1 crypto-format spec (the backend treats envelopes as opaque, so the frontend owns this format; a mistake here is permanently lost funds — hence written down and agreed before any code), and the open product/API questions.

**Files:**
- Create: `docs/self-custody/envelope-format-spec.md`
- Create: `docs/self-custody/questions-for-tom.md`

**Interfaces:**
- Consumes: backend docs from Task 1 (`phase-3-5.md` Phase 4/5 sections define the package fields this spec fills in).
- Produces: the format that Phase 2's key-generation and package-commit code implements verbatim. Field names below (`prfSaltVersion`, AAD strings, HKDF info labels) are normative once Tom agrees.

- [ ] **Step 1: Write `docs/self-custody/envelope-format-spec.md`**

Full content (this is the actual file, not an outline):

```markdown
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
```

- [ ] **Step 2: Write `docs/self-custody/questions-for-tom.md`**

Full content:

```markdown
# Open questions for the crypto backend — 2026-08-26

1. **Clerk audience.** Plain Clerk session tokens carry no `aud` claim. Can
   `CLERK_JWT_AUDIENCE` be left unset with an `azp`-against-CORS-origins check
   instead (our preference), or do you want a JWT template with a fixed
   audience? (`.env.example` ships `CLERK_JWT_AUDIENCE=worldstreet`, and
   `verify:production-config` may enforce it — needs a decision either way.)
2. **Envelope spec ack.** `envelope-format-spec.md` in this folder — please
   confirm the three "open items" at the bottom so Phase 2 can build it.
3. **PRF-unavailable stance.** We propose refusing wallet creation without
   WebAuthn PRF (v1) rather than a weaker fallback. Agree?
4. **Swaps / trading.** Phase 6–8 docs say swaps are "not enabled yet" and
   there's no Hyperliquid surface. What's the sequencing for spot/futures and
   fiat buy/sell — do they stay on crypto-api.worldstreetgold.com
   indefinitely, or move here in phase 9–11?
5. **TON / TRON / SUI.** The new model is evm + solana only. Legacy users hold
   TON/TRON/SUI balances — do those stay on Privy forever, or is there a
   migration destination?
6. **Sponsored fees.** EVM clients supply their own gas; Solana payloads carry
   `feePayer`. Is sponsor-as-feePayer co-signing planned, or is the sponsored
   fees concept dead in the new architecture?
7. **`ENABLE_LEGACY_PRIVY_BRIDGE`.** Your `.env.example` points it at our
   `user-account/userwallets` collection. What does the bridge do today, and
   should the frontend's legacy-vs-new detection build on it rather than on
   probing `GET /v1/wallets/me` for 404?
8. **Mainnet timeline.** Both gates (`ENABLE_MAINNET`,
   `MAINNET_RELEASE_APPROVED`) are off. Rough timeline, so we can stage the
   "move your funds" messaging?
```

- [ ] **Step 3: Verify both files render cleanly**

```bash
wc -l docs/self-custody/envelope-format-spec.md docs/self-custody/questions-for-tom.md
```

Expected: both non-empty (spec ≈ 100 lines, questions ≈ 40). Skim for broken markdown tables.

- [ ] **Step 4: Commit**

```bash
git add docs/self-custody
git commit -m "docs(crypto): draft envelope format spec and backend questions"
```

- [ ] **Step 5: Hand to Owen** — these two files go to Tom today (link or paste). Do not block on his reply; Phase 1 continues.

---

### Task 3: Local crypto backend running

Ops task, no TDD — deliverable is a verified running backend. Requires Docker Desktop running.

**Files:**
- Create (outside this repo): `C:\Users\owen\Downloads\Projects\worldstreet\worldstreet-crypto-backend\` (clone) and its `.env`

**Interfaces:**
- Produces: `http://localhost:3020` serving `/health`, `/ready`, and `/v1/*` with `CLERK_AUTH_ENABLED=false` (any non-empty Bearer token accepted; identity is `dev_clerk_user`). Tasks 7–8 point the dashboard here.

- [ ] **Step 1: Clone the backend as a sibling of the dashboard**

```bash
cd /c/Users/owen/Downloads/Projects/worldstreet
gh repo clone tomurashigaraki22/worldstreet-crypto-backend
cd worldstreet-crypto-backend
```

- [ ] **Step 2: Create `.env` from the example and disable Clerk for local dev**

```bash
cp .env.example .env
```

Then edit `.env` (three changes only):
- `CLERK_AUTH_ENABLED=false` (line reads `=true` in the example)
- `WALLET_AUTH_TOKEN_SECRET=` → any 32+ character random string
- `SESSION_TOKEN_SECRET=` → any 32+ character random string

Leave the Mongo credentials at their `change_me_*` defaults (local only), leave `NODE_ENV=development`, leave all RPC URLs as-is — nothing in Phase 1 touches a chain.

- [ ] **Step 3: Start Mongo, install, seed, run** (backend uses npm — its convention)

```bash
docker compose up -d mongodb
npm install
npm run db:indexes
npm run db:seed-networks
npm run dev
```

Expected: `db:seed-networks` reports seeded networks; `npm run dev` logs the server listening on 3020. Leave this terminal running.

- [ ] **Step 4: Verify health, readiness, and the dev-auth path** (new terminal)

```bash
curl -s http://localhost:3020/health
curl -s http://localhost:3020/ready
curl -s -H "Authorization: Bearer dev" http://localhost:3020/v1/auth/me
curl -s -H "Authorization: Bearer dev" http://localhost:3020/v1/networks
```

Expected: health `{"success":true,...,"status":"ok"}`; ready shows `"mongodb":"ready"`; auth/me returns a `dev_clerk_user` identity; networks returns `success:true` with exactly the three default-enabled networks (`ethereum-sepolia`, `base-sepolia`, `solana-devnet`). If networks is empty, re-run `npm run db:seed-networks`.

- [ ] **Step 5: Record the run steps** — append a "Local backend" section to `docs/self-custody/backend-docs/README.md` in the dashboard repo with the five commands above, then:

```bash
cd /c/Users/owen/Downloads/Projects/worldstreet/dashboard-revamp
git add docs/self-custody/backend-docs/README.md
git commit -m "docs(crypto): local backend run instructions"
```

---

### Task 4: Vendor the SDK client

**Files:**
- Create: `lib/crypto/client.ts` (verbatim copy of the backend's `sdk/src/index.ts` + provenance header)

**Interfaces:**
- Produces (all consumed by Tasks 5–8): `class WorldstreetCryptoClient` (constructor `{ baseUrl, getClerkToken, apiBasePath?, fetcher? }`; methods `createWallet()`, `createWalletWithAccounts(chainFamilies?)`, `getWallet(): Promise<WalletDetails>`, `listNetworks(): Promise<Network[]>`, `prepareAccount(input)`, `getWalletPackage()`, `commitWalletPackage(pkg, walletAuthorizationToken, rotate?)`, passkey ceremony methods, session methods, intent/balance methods), `class CryptoApiError { code: string; status: number; details?: unknown }`, and types `Wallet`, `WalletAccount`, `WalletDetails`, `Network`, `TransferInput`, `ClerkTokenProvider`.
- The file is Tom's code — do not "improve" it. Fixes go upstream, then re-vendor.

- [ ] **Step 1: Copy the file with provenance**

```bash
cd /c/Users/owen/Downloads/Projects/worldstreet/dashboard-revamp
mkdir -p lib/crypto
gh api repos/tomurashigaraki22/worldstreet-crypto-backend/contents/sdk/src/index.ts --jq '.content' | base64 -d > lib/crypto/client.ts
```

Then add one line to the top of the file's existing doc comment, using the SHA recorded in Task 1 Step 2:

```
 * vendored from worldstreet-crypto-backend @ <SHA>
```

(The header explicitly asks for this.)

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS with zero new errors. The file is self-contained (no imports), so failures here mean a bad copy — re-fetch rather than editing.

- [ ] **Step 3: Commit**

```bash
git add lib/crypto/client.ts
git commit -m "feat(crypto): vendor worldstreet-crypto-backend sdk client"
```

---

### Task 5: Wrapper — timeout fetcher, `CryptoApi`, `getAuthMe` (TDD; includes vitest setup)

The vendored client has no timeout and misses `GET /v1/auth/me` (integration guide §4). The wrapper adds both without modifying the vendored file: `createTimeoutFetcher` is injected via the client's `fetcher` option, and `CryptoApi` composes the client plus its own envelope-aware `request()` for routes the SDK lacks. Vitest lands here because this is the first test.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (test script, vitest devDependency)
- Create: `lib/crypto/api.ts`
- Test: `lib/crypto/__tests__/api.test.ts`

**Interfaces:**
- Consumes: `WorldstreetCryptoClient`, `CryptoApiError`, `ClerkTokenProvider` from `@/lib/crypto/client` (Task 4).
- Produces: `createTimeoutFetcher(timeoutMs: number, base?: typeof fetch): typeof fetch`; `type AuthMe = { userId: string; clerkUserId: string; sessionId?: string; claims: Record<string, unknown> }`; `type CryptoApiOptions = { baseUrl: string; getClerkToken: ClerkTokenProvider; timeoutMs?: number; fetcher?: typeof fetch }`; `class CryptoApi { readonly client: WorldstreetCryptoClient; getAuthMe(): Promise<AuthMe> }`. Tasks 7–8 construct `CryptoApi` and use both `api.getAuthMe()` and `api.client.*`.

- [ ] **Step 1: Install vitest and add the script**

```bash
pnpm add -D vitest
```

In `package.json` scripts add: `"test": "vitest run"`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  test: {
    include: ["lib/**/__tests__/**/*.test.ts", "hooks/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
})
```

- [ ] **Step 3: Write the failing test** — `lib/crypto/__tests__/api.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { CryptoApi, createTimeoutFetcher } from "@/lib/crypto/api"
import { CryptoApiError } from "@/lib/crypto/client"

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

describe("CryptoApi.getAuthMe", () => {
  it("calls /v1/auth/me with the Clerk bearer token and unwraps data", async () => {
    const fetcher = vi.fn(async () =>
      envelope({ userId: "u1", clerkUserId: "c1", claims: {} }),
    ) as unknown as typeof fetch
    const api = new CryptoApi({
      baseUrl: "http://localhost:3020",
      getClerkToken: () => "tok",
      fetcher,
    })
    const me = await api.getAuthMe()
    expect(me).toEqual({ userId: "u1", clerkUserId: "c1", claims: {} })
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe("http://localhost:3020/v1/auth/me")
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok")
  })

  it("throws CryptoApiError with the server's code on an error envelope", async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "AUTH_REQUIRED", message: "no" },
          requestId: "r1",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch
    const api = new CryptoApi({
      baseUrl: "http://localhost:3020",
      getClerkToken: () => "tok",
      fetcher,
    })
    const err = await api.getAuthMe().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CryptoApiError)
    expect((err as CryptoApiError).code).toBe("AUTH_REQUIRED")
    expect((err as CryptoApiError).status).toBe(401)
  })

  it("throws CLERK_TOKEN_MISSING when no token is available", async () => {
    const api = new CryptoApi({
      baseUrl: "http://localhost:3020",
      getClerkToken: () => undefined,
    })
    const err = await api.getAuthMe().catch((e: unknown) => e)
    expect((err as CryptoApiError).code).toBe("CLERK_TOKEN_MISSING")
  })
})

describe("createTimeoutFetcher", () => {
  it("aborts a request that exceeds the timeout", async () => {
    const hang: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))
      })
    const fetcher = createTimeoutFetcher(20, hang)
    await expect(fetcher("http://example.test/")).rejects.toMatchObject({
      name: "TimeoutError",
    })
  })

  it("passes fast responses through untouched", async () => {
    const fast: typeof fetch = async () => envelope({ ok: true })
    const fetcher = createTimeoutFetcher(1000, fast)
    const res = await fetcher("http://example.test/")
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 4: Run to verify it fails**

```bash
pnpm test
```

Expected: FAIL — `Cannot find module '@/lib/crypto/api'` (or equivalent). If it fails for a config reason instead (alias not resolving), fix the config before proceeding.

- [ ] **Step 5: Implement `lib/crypto/api.ts`**

```ts
import {
  CryptoApiError,
  WorldstreetCryptoClient,
  type ClerkTokenProvider,
} from "./client"

export type AuthMe = {
  userId: string
  clerkUserId: string
  sessionId?: string
  claims: Record<string, unknown>
}

export type CryptoApiOptions = {
  baseUrl: string
  getClerkToken: ClerkTokenProvider
  timeoutMs?: number
  fetcher?: typeof fetch
}

export function createTimeoutFetcher(
  timeoutMs: number,
  base: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs,
    )
    const signal = init?.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal
    try {
      return await base(input, { ...init, signal })
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Composition over the vendored client: `client` covers the 22 SDK routes,
 * this class adds the routes the SDK lacks (auth/me now; devices and
 * recovery arrive with Phase 2) and injects a timeout fetcher into both.
 */
export class CryptoApi {
  readonly client: WorldstreetCryptoClient
  private readonly baseUrl: string
  private readonly getClerkToken: ClerkTokenProvider
  private readonly fetcher: typeof fetch

  constructor(options: CryptoApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "")
    this.getClerkToken = options.getClerkToken
    this.fetcher = options.fetcher ?? createTimeoutFetcher(options.timeoutMs ?? 15_000)
    this.client = new WorldstreetCryptoClient({
      baseUrl: options.baseUrl,
      getClerkToken: options.getClerkToken,
      fetcher: this.fetcher,
    })
  }

  async getAuthMe(): Promise<AuthMe> {
    return this.request<AuthMe>("/v1/auth/me")
  }

  // Same envelope semantics as the vendored client's private request().
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getClerkToken()
    if (!token) {
      throw new CryptoApiError("CLERK_TOKEN_MISSING", "A Clerk token is required", 401)
    }
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${token}`)
    headers.set("accept", "application/json")
    if (init.body !== undefined) headers.set("content-type", "application/json")
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers })
    const body = (await response.json().catch(() => undefined)) as
      | {
          success?: boolean
          data?: T
          error?: { code?: string; message?: string; details?: unknown }
        }
      | undefined
    if (!response.ok || body?.success === false) {
      throw new CryptoApiError(
        body?.error?.code ?? "API_ERROR",
        body?.error?.message ?? `Crypto API request failed (${response.status})`,
        response.status,
        body?.error?.details,
      )
    }
    return body?.data as T
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test && pnpm typecheck
```

Expected: all 5 tests PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml lib/crypto/api.ts lib/crypto/__tests__/api.test.ts
git commit -m "feat(crypto): CryptoApi wrapper with timeout fetcher and auth/me (+vitest)"
```

---

### Task 6: Amount helpers (TDD)

Encodes the doc's two footguns once (§8.2/§8.5): balances arrive in base units as decimal strings that overflow `Number`; transfer inputs are display units. Every later phase formats and validates through these.

**Files:**
- Create: `lib/crypto/amounts.ts`
- Test: `lib/crypto/__tests__/amounts.test.ts`

**Interfaces:**
- Consumes: `formatUnits` from `viem` (installed).
- Produces: `type BalanceEntry = { asset: { kind: "native" | "token"; identifier: string }; amountBaseUnits: string; decimals: number; symbol: string }`; `formatBaseUnits(amountBaseUnits: string, decimals: number, maxFraction?: number): string`; `isValidDisplayAmount(input: string): boolean`.

- [ ] **Step 1: Write the failing test** — `lib/crypto/__tests__/amounts.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatBaseUnits, isValidDisplayAmount } from "@/lib/crypto/amounts"

describe("formatBaseUnits", () => {
  it("formats the doc's example without precision loss", () => {
    // 60217243958644222840 > Number.MAX_SAFE_INTEGER — the whole point.
    expect(formatBaseUnits("60217243958644222840", 18)).toBe("60.217243")
  })
  it("trims trailing zeros and bare points", () => {
    expect(formatBaseUnits("1000000000000000000", 18)).toBe("1")
    expect(formatBaseUnits("1500000000000000000", 18)).toBe("1.5")
  })
  it("handles zero and small dust", () => {
    expect(formatBaseUnits("0", 18)).toBe("0")
    expect(formatBaseUnits("1", 18)).toBe("0") // below 6-dp display resolution
    expect(formatBaseUnits("1", 18, 18)).toBe("0.000000000000000001")
  })
  it("respects non-18 decimals (USDC-style)", () => {
    expect(formatBaseUnits("1234567", 6)).toBe("1.234567")
  })
})

describe("isValidDisplayAmount", () => {
  it("accepts positive decimal strings", () => {
    expect(isValidDisplayAmount("0.0001")).toBe(true)
    expect(isValidDisplayAmount("1000")).toBe(true)
    expect(isValidDisplayAmount("1.5")).toBe(true)
  })
  it("rejects zero, negatives, exponents, and junk", () => {
    for (const bad of ["0", "0.000", "-1", "1e18", ".5", "1.", "abc", ""]) {
      expect(isValidDisplayAmount(bad)).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test
```

Expected: FAIL — module `@/lib/crypto/amounts` not found.

- [ ] **Step 3: Implement `lib/crypto/amounts.ts`**

```ts
import { formatUnits } from "viem"

/** Shape of one entry from GET .../balances (integration guide §8.5). */
export type BalanceEntry = {
  asset: { kind: "native" | "token"; identifier: string }
  amountBaseUnits: string
  decimals: number
  symbol: string
}

/**
 * Base-unit decimal string → display string. BigInt end to end; a JS number
 * would silently corrupt anything past MAX_SAFE_INTEGER (guide §8.5).
 */
export function formatBaseUnits(
  amountBaseUnits: string,
  decimals: number,
  maxFraction = 6,
): string {
  const full = formatUnits(BigInt(amountBaseUnits), decimals)
  const [whole, fraction = ""] = full.split(".")
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "")
  return trimmed ? `${whole}.${trimmed}` : whole
}

/**
 * Validates a user-typed DISPLAY-unit amount (what createTransferIntent
 * expects — guide §8.2). Positive plain decimals only: no exponents, no
 * leading/trailing dot, not zero.
 */
export function isValidDisplayAmount(input: string): boolean {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(input)) return false
  return /[1-9]/.test(input)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test && pnpm typecheck
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/crypto/amounts.ts lib/crypto/__tests__/amounts.test.ts
git commit -m "feat(crypto): base-unit formatting and display-amount validation"
```

---

### Task 7: Config, feature flag, and Clerk-bound hooks

**Files:**
- Create: `lib/crypto/config.ts`
- Test: `lib/crypto/__tests__/config.test.ts`
- Create: `hooks/useCryptoApi.ts`
- Create: `hooks/useNetworks.ts`
- Modify: `.env.local` (add two lines)
- Modify: `.env.example` (add two lines)

**Interfaces:**
- Consumes: `CryptoApi` (Task 5), `Network` type from `@/lib/crypto/client`, `useAuth` from `@clerk/nextjs`.
- Produces: `cryptoBackendUrl(): string`; `selfCustodyEnabled(): boolean`; `useCryptoApi(): CryptoApi`; `useNetworks(): { networks: Network[]; loading: boolean; error: string | null; refresh: () => void }`. Task 8 consumes all four.

- [ ] **Step 1: Write the failing config test** — `lib/crypto/__tests__/config.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { cryptoBackendUrl, selfCustodyEnabled } from "@/lib/crypto/config"

afterEach(() => vi.unstubAllEnvs())

describe("crypto config", () => {
  it("defaults to the production backend URL", () => {
    vi.stubEnv("NEXT_PUBLIC_CRYPTO_BACKEND_URL", "")
    expect(cryptoBackendUrl()).toBe("https://crypto-backend.worldstreetgold.com")
  })
  it("honors the env override", () => {
    vi.stubEnv("NEXT_PUBLIC_CRYPTO_BACKEND_URL", "http://localhost:3020")
    expect(cryptoBackendUrl()).toBe("http://localhost:3020")
  })
  it("flag is off unless the value is exactly '1'", () => {
    vi.stubEnv("NEXT_PUBLIC_SELF_CUSTODY_ENABLED", "")
    expect(selfCustodyEnabled()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_SELF_CUSTODY_ENABLED", "true")
    expect(selfCustodyEnabled()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_SELF_CUSTODY_ENABLED", "1")
    expect(selfCustodyEnabled()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm test` → FAIL, module not found.

- [ ] **Step 3: Implement `lib/crypto/config.ts`**

```ts
/**
 * Functions rather than constants so Next's build-time env inlining and
 * vitest's env stubbing both work. NEXT_PUBLIC_* only — this module is
 * imported from client components.
 */
export function cryptoBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CRYPTO_BACKEND_URL ||
    "https://crypto-backend.worldstreetgold.com"
  )
}

export function selfCustodyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SELF_CUSTODY_ENABLED === "1"
}
```

- [ ] **Step 4: Run tests to verify they pass** — `pnpm test` → PASS.

- [ ] **Step 5: Add env vars**

Append to `.env.local`:

```
NEXT_PUBLIC_CRYPTO_BACKEND_URL=http://localhost:3020
NEXT_PUBLIC_SELF_CUSTODY_ENABLED=1
```

Append to `.env.example`:

```
# Self-custody wallet backend (worldstreet-crypto-backend). Flag "1" enables /wallet.
NEXT_PUBLIC_CRYPTO_BACKEND_URL=https://crypto-backend.worldstreetgold.com
NEXT_PUBLIC_SELF_CUSTODY_ENABLED=0
```

- [ ] **Step 6: Create `hooks/useCryptoApi.ts`**

```ts
"use client"

import { useMemo } from "react"
import { useAuth } from "@clerk/nextjs"
import { CryptoApi } from "@/lib/crypto/api"
import { cryptoBackendUrl } from "@/lib/crypto/config"

/**
 * One CryptoApi per Clerk session. In local development the backend runs
 * with CLERK_AUTH_ENABLED=false and accepts any bearer token, so a missing
 * Clerk session falls back to a synthetic token instead of hard-failing —
 * production builds never take that branch.
 */
export function useCryptoApi(): CryptoApi {
  const { getToken } = useAuth()
  return useMemo(
    () =>
      new CryptoApi({
        baseUrl: cryptoBackendUrl(),
        getClerkToken: async () =>
          (await getToken()) ??
          (process.env.NODE_ENV === "development" ? "dev-local-token" : undefined),
      }),
    [getToken],
  )
}
```

- [ ] **Step 7: Create `hooks/useNetworks.ts`**

```ts
"use client"

import { useCallback, useEffect, useState } from "react"
import type { Network } from "@/lib/crypto/client"
import { useCryptoApi } from "./useCryptoApi"

/** Server-driven network list (guide §5: never hardcode the enabled set). */
export function useNetworks() {
  const api = useCryptoApi()
  const [networks, setNetworks] = useState<Network[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    api.client
      .listNetworks()
      .then(setNetworks)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load networks"),
      )
      .finally(() => setLoading(false))
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { networks, loading, error, refresh }
}
```

- [ ] **Step 8: Verify** — `pnpm test && pnpm typecheck` → PASS (hooks are exercised via the UI in Task 8; their logic is thin by design).

- [ ] **Step 9: Commit**

```bash
git add lib/crypto/config.ts lib/crypto/__tests__/config.test.ts hooks/useCryptoApi.ts hooks/useNetworks.ts .env.example
git commit -m "feat(crypto): config, feature flag, and Clerk-bound client hooks"
```

(`.env.local` is gitignored — do not force-add it.)

---

### Task 8: `/wallet` route — connection status, networks, wallet creation

The Phase 1 milestone screen: proves auth plumbing, renders server-driven networks, and drives `createWalletWithAccounts` to `state=provisioning`. Activation (passkeys + keys) is explicitly deferred to Phase 2 and the UI says so.

**Files:**
- Create: `app/wallet/page.tsx`
- Create: `components/wallet/wallet-setup.tsx`

**Interfaces:**
- Consumes: `selfCustodyEnabled` (Task 7), `useCryptoApi`/`useNetworks` (Task 7), `CryptoApiError`, `WalletDetails` from `@/lib/crypto/client` (Task 4), `AuthMe` (Task 5), system components (`PageHeader`, `CardShell`, `CardHeader`, `ListRow`, `EmptyState`, `Skel` from `@/components/ui/system`).
- Produces: the `/wallet` route. Phase 2 replaces the "activation pending" copy with the passkey ceremony entry point.

- [ ] **Step 1: Create `app/wallet/page.tsx`**

```tsx
import { notFound } from "next/navigation"
import { selfCustodyEnabled } from "@/lib/crypto/config"
import { WalletSetup } from "@/components/wallet/wallet-setup"

export default function WalletPage() {
  if (!selfCustodyEnabled()) notFound()
  return <WalletSetup />
}
```

Before writing the component, open `app/assets/page.tsx` and copy its outermost page chrome (container widths, padding, any shared shell component) so `/wallet` sits in the same frame as existing pages — the fragment below uses a plain container as a stand-in for whatever that chrome is.

- [ ] **Step 2: Create `components/wallet/wallet-setup.tsx`**

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import {
  CardHeader,
  CardShell,
  EmptyState,
  ListRow,
  PageHeader,
  Skel,
} from "@/components/ui/system"
import { CryptoApiError, type WalletDetails } from "@/lib/crypto/client"
import type { AuthMe } from "@/lib/crypto/api"
import { useCryptoApi } from "@/hooks/useCryptoApi"
import { useNetworks } from "@/hooks/useNetworks"

const WalletGlyph = (p: { className?: string }) => (
  <HugeiconsIcon icon={Wallet01Icon} {...p} />
)
const AddGlyph = (p: { className?: string }) => (
  <HugeiconsIcon icon={Add01Icon} {...p} />
)

export function WalletSetup() {
  const api = useCryptoApi()
  const { networks, loading: networksLoading, error: networksError } = useNetworks()
  const [identity, setIdentity] = useState<AuthMe | null>(null)
  const [wallet, setWallet] = useState<WalletDetails | null>(null)
  const [walletState, setWalletState] = useState<"loading" | "absent" | "ready">("loading")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setIdentity(await api.getAuthMe())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crypto backend unreachable")
      return
    }
    try {
      setWallet(await api.client.getWallet())
      setWalletState("ready")
    } catch (e) {
      // 404 NOT_FOUND before first creation is the documented normal state.
      if (e instanceof CryptoApiError && e.code === "NOT_FOUND") setWalletState("absent")
      else setError(e instanceof Error ? e.message : "Failed to load wallet")
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const createWallet = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await api.client.createWalletWithAccounts(["evm", "solana"])
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet creation failed")
    } finally {
      setBusy(false)
    }
  }, [api, load])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <PageHeader
        title="Wallet"
        subtitle={
          identity
            ? `Connected as ${identity.clerkUserId}`
            : "Connecting to the wallet service…"
        }
      />

      {error && (
        <div className="rounded-2xl bg-debit-chip px-4 py-3 text-[13px] text-debit">
          {error}
        </div>
      )}

      <CardShell>
        <CardHeader
          title="Your wallet"
          subtitle="Self-custodial — keys never leave this device"
        />
        {walletState === "loading" && !error && (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Skel className="h-12" />
            <Skel className="h-12" />
          </div>
        )}
        {walletState === "absent" && (
          <>
            <EmptyState
              icon={WalletGlyph}
              title="No wallet yet"
              description="Create your wallet to reserve accounts on every supported chain. Keys are generated and secured in the next step — nothing sensitive happens yet."
            />
            <div className="flex justify-center pb-6">
              <button
                onClick={createWallet}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                <AddGlyph className="h-3.5 w-3.5" />
                {busy ? "Creating…" : "Create wallet"}
              </button>
            </div>
          </>
        )}
        {walletState === "ready" && wallet && (
          <div className="flex flex-col pb-2">
            {wallet.accounts.map((account) => (
              <ListRow
                key={account.id}
                icon={WalletGlyph}
                title={account.chainFamily === "evm" ? "EVM account" : "Solana account"}
                subtitle={
                  account.canonicalAddress ??
                  "Reserved — awaiting activation (passkey + key generation, next release)"
                }
                right={
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {account.state}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </CardShell>

      <CardShell>
        <CardHeader
          title="Networks"
          subtitle="Enabled by the wallet service — testnets during rollout"
        />
        {networksLoading ? (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Skel className="h-12" />
            <Skel className="h-12" />
            <Skel className="h-12" />
          </div>
        ) : networksError ? (
          <p className="px-4 pb-4 text-[13px] text-muted-foreground">{networksError}</p>
        ) : (
          <div className="flex flex-col pb-2">
            {networks.map((network) => (
              <ListRow
                key={network.id}
                title={network.name}
                subtitle={`${network.family} · ${network.environment}`}
                right={
                  network.chainId !== undefined ? (
                    <span className="text-[12px] text-muted-foreground">
                      #{network.chainId}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </CardShell>
    </div>
  )
}
```

Adjust the wrapper `div` and any spacing to match the chrome you observed in `app/assets/page.tsx`. If `bg-debit-chip`/`text-debit` or `bg-surface-sunken` don't exist as tokens in `app/globals.css`, use the nearest existing error/muted tokens from there instead — do not invent hex values.

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 4: Manual verification against the local backend** (backend from Task 3 still running)

```bash
pnpm dev
```

In the browser at `http://localhost:3000/wallet`, signed in:
1. Header shows `Connected as dev_clerk_user` (local backend has Clerk off) or your real Clerk id.
2. Networks card lists exactly: Ethereum Sepolia, Base Sepolia, Solana Devnet.
3. Wallet card shows the empty state → click **Create wallet** → two `ListRow`s appear (EVM + Solana), each with a `provisioning` chip and "awaiting activation" subtitle.
4. Reload the page — the wallet persists (served from Mongo, not client state).
5. Stop the backend (`Ctrl+C` in its terminal) and reload — the error banner appears within the 15s timeout, page doesn't hang.
6. Set `NEXT_PUBLIC_SELF_CUSTODY_ENABLED=0` in `.env.local`, restart `pnpm dev` → `/wallet` returns 404. Set it back to `1`.

- [ ] **Step 5: Commit**

```bash
git add app/wallet components/wallet
git commit -m "feat(wallet): self-custody setup screen behind feature flag"
```

---

## Final verification (whole plan)

- [ ] `pnpm test` — all suites pass (api, amounts, config).
- [ ] `pnpm typecheck && pnpm lint` — clean.
- [ ] Manual flow from Task 8 Step 4 passes end to end.
- [ ] `git log --oneline master..feat/self-custody` shows one commit per task (≈7).
- [ ] `docs/self-custody/envelope-format-spec.md` + `questions-for-tom.md` have been sent to Tom (Owen's action — confirm before calling the phase done).

## Follow-up plans (not in this document)

- **Phase 2 — Activation:** passkey registration/authentication ceremonies (`navigator.credentials` + PRF detection), client key generation (viem + `@solana/web3.js`), DEK + envelope encryption per the agreed spec, package commit/rotate, recovery-secret UX. Gated on Tom acking `envelope-format-spec.md`. Adds the devices/recovery routes to `CryptoApi`.
- **Phase 3 — Money:** balances/portfolio on `/wallet`, transfer flow (intent → simulate → sign → submit → poll), EVM first (needs our own RPC for nonce/gas — provider decision) then Solana (prompt-signing due to the 60–90s blockhash window), using `formatBaseUnits`/`isValidDisplayAmount` from Task 6.
- **Phase 4 — Devices & recovery:** cross-device enrollment (old device wraps DEK for new), recovery execution flow, passkey management.
- **Phase 5 — Coexistence & migration:** legacy-vs-new discriminator (pending Tom's answer on `ENABLE_LEGACY_PRIVY_BRIDGE`), "move your funds" flow, trading sessions behind their feature flags — staged on the mainnet gates.
