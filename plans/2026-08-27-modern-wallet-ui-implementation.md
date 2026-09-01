# Modern Wallet UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the merged `modern-wallet-arch` crypto wallet frontend into full compliance with the Modern Wallet Frontend Integration Guide — functionally (wallet modes, migration messaging, deposit/transfer/trade flows, error handling) and aesthetically (WorldStreet Design System v2), with every known edge case handled.

**Architecture:** A global wallet-mode context becomes the single source of truth for modern-vs-legacy, gating Privy provisioning for new users and steering every balance/order surface. All crypto UI is rebuilt on the existing design-system kits (`components/ui/system.tsx`, `components/ui/flow.tsx`, `ResponsiveModal`, `AlertDialog`) — no new UI framework, no toasts. Pure decision logic (mode resolution, validation, error taxonomy, order building, explorer mapping) is extracted into `lib/` modules with vitest coverage; components stay thin.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 (`@theme inline` tokens) · Base UI (`@base-ui/react`) · TanStack Query v5 · viem/bs58 (already installed) · `qrcode` · vitest (node env, pure-unit only — no testing-library).

**Spec:** `docs/MODERN-WALLET-FRONTEND-INTEGRATION-GUIDE.md` (vendored copy of the guide shared with the merge). Companion gap analysis: `plans/2026-08-27-modern-wallet-frontend-changes.md`.

## Global Constraints

- **Never** send private keys, passphrases, recovery secrets, or seed phrases in an API request, and never log them (spec §4, §14).
- New Clerk users must **not** be provisioned a legacy Privy wallet (spec §1).
- Legacy Privy UI and flows must keep working unchanged for existing users (spec §1).
- Migration copy is verbatim: *"Your legacy wallet is still available. For the new Worldstreet self-custodial experience, move your funds to your Worldstreet embedded wallet. You control the keys, and signing happens locally on your device."* (spec §2). Never imply Worldstreet can recover or access keys.
- Balance refresh only on: initial load, explicit user refresh, after a confirmed transaction, wallet/network context change (spec §5). Preserve the last snapshot while refreshing; show its timestamp.
- No hardcoded market catalogue for modern wallets; `id` from the backend registry is the React key and internal identity (spec §8).
- Sponsorship is displayed only when the backend explicitly reports it available (spec §11).
- Every backend error code maps to an actionable message; never label distinct failures "backend unreachable" (spec §13).
- **Design System v2 rules** (from `components/ui/system.tsx:3-16` and `design-system/`): gold = brand/primary action only; emerald/red = money direction only; cards are `CardShell` (`rounded-2xl`, separated by fill); the one tab system is `Segmented` (never gold); every live figure is `tabular-nums`; hero figures are `Balance` (Poppins `font-display font-light`); addresses/hashes are `font-mono`; modals are `ResponsiveModal`, destructive confirms are `AlertDialog`; feedback is `InlineNotice`/`ErrorDetail`/`StatusScreen`/`AnnouncementBanner` — **no toast library**; skeletons (`Skel`, `SkeletonRows`, `FlowSkeleton`), never the word "Loading" in a display face; spacing via `flex flex-col gap-*`, not `space-y-*`; no raw palette colors (`amber-500` etc.) — tokens only (`bg-warning-chip text-warning`, `bg-debit-chip text-debit`, `bg-credit-chip text-credit`, `bg-surface-sunken`, `text-subtle`).
- Tests: vitest node environment, `describe/it/expect` imported explicitly, files under `lib/**/__tests__/**/*.test.ts` or `hooks/**/__tests__/**/*.test.ts`. Component render tests are **out of scope** (no jsdom/testing-library installed) — UI tasks verify via `pnpm typecheck` + manual walkthrough.
- Every task ends with `pnpm typecheck` green and a commit. Run `pnpm test` whenever the task touches `lib/` or `hooks/`.

## File Structure (what gets created/modified, by responsibility)

**New pure-logic modules (all vitest-covered):**
- `lib/wallet-mode.ts` — mode resolution + provisioning decision (one function each)
- `lib/crypto-backend/error-messages.ts` — error-code → user-message taxonomy
- `lib/crypto-backend/network-meta.ts` — backend networkId → display registry + explorer tx URLs
- `lib/crypto-wallet/address-validation.ts` — per-family address checks, amount/decimal/base-unit math
- `lib/crypto-backend/spot-order.ts` — registry-row → order-intent input builder (EVM + Solana)

**New UI:**
- `components/wallet-mode-provider.tsx` — global mode context
- `components/crypto/primitives.tsx` — `ModeBadge`, `AddressPill`, `SectionMessage`, `KeyReveal`
- `components/crypto/ModernReceiveModal.tsx` — deposit flow (QR, selectors, warnings)
- `components/crypto/MigrationNotice.tsx` — spec §2 banner (+ notification mirror)
- `components/crypto/send/SendFlow.tsx` + `app/wallet/modern/send/page.tsx` — the transfer flow rebuilt on `flow.tsx`

**Rebuilt in place:** `ModernWalletPage`, `WalletSetupFlow`, `WalletUnlockDialog`, `CryptoSecurityPanel`, `RecoveryPanel`, `WalletKeyExportPanel`, `WalletChainProvisioningPanel`, `modern-funding-panel`, relevant parts of `trade-client.tsx` / `markets-rail.tsx`. **Deleted:** `ModernTransferFlow.tsx`, `TransactionReview.tsx` (absorbed into SendFlow).

**Modified plumbing:** `components/wallet-provider.tsx`, `lib/wallet-actions.ts`, `hooks/crypto/useCryptoBalances.ts`, `hooks/useWalletBalances.ts`, `hooks/use-unified-transactions.ts`, `lib/crypto-wallet/wallet-security.ts`, `lib/crypto-backend/client.ts`, `lib/networks.ts`, `lib/crypto-backend/query-keys.ts`, `components/navbar-actions.tsx`, `app/layout.tsx`, `components/ui/receive-panel.tsx`, `.env.example`.

## Copy Deck (exact user-facing strings)

| Key | String |
|---|---|
| migration.body | *(the verbatim spec copy in Global Constraints)* |
| migration.cta | `Move funds` |
| migration.confirm | `I've finished migrating` |
| selfCustody.receiveNote | `This address belongs to your Worldstreet self-custodial wallet. Only you control its keys.` |
| mode.modern | `Worldstreet wallet` |
| mode.legacy | `Legacy wallet` |
| sponsor.paid | `Worldstreet pays the network fee` |
| sponsor.selfPaid | `You pay the network fee` |
| sponsor.unavailable | `Fee sponsorship isn't available for this transfer — you'll pay the network fee.` |
| funding.notInstant | `Bridge deposits are not instant — they usually take a few minutes to arrive.` |
| export.warning | `Anyone with this key controls the funds on this account. Never share it, never paste it into a website, and don't keep it in a screenshot.` |
| expired.quote | `This quote expired before signing. Request a fresh one — nothing was sent.` |

---

# Phase 0 — Contract & guardrails

### Task 1: Vendor the spec, fix the leaking feature flag

**Files:**
- Create: `docs/MODERN-WALLET-FRONTEND-INTEGRATION-GUIDE.md` (already copied — commit it)
- Modify: `.env.example` (the `NEXT_PUBLIC_CRYPTO_ENABLED` line)

**Interfaces:**
- Consumes: nothing
- Produces: the spec path every later task cites; a safe `.env.example`

- [ ] **Step 1: Flip the example flag off.** In `.env.example`, change `NEXT_PUBLIC_CRYPTO_ENABLED=true` to:

```bash
# Modern self-custodial wallet UI. Off by default — see docs/CRYPTO-ROLLOUT-AND-SOAK.md
# before enabling anywhere user-facing.
NEXT_PUBLIC_CRYPTO_ENABLED=false
```

- [ ] **Step 2: Verify no other example var contradicts the rollout doc** — `NEXT_PUBLIC_CRYPTO_PROXY_ENABLED` may stay defaulted-on (it's the kill switch, spec'd that way), `NEXT_PUBLIC_LEGACY_PRIVY_ENABLED` stays `true`.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add docs/MODERN-WALLET-FRONTEND-INTEGRATION-GUIDE.md .env.example plans/
git commit -m "docs(crypto): vendor wallet integration guide; default crypto flag off in env example"
```

---

### Task 2: Stop provisioning Privy wallets for new users

**Files:**
- Modify: `lib/wallet-actions.ts` (add `getExistingWallets`; add `notFound` marker to the not-found return at `lib/wallet-actions.ts:306`)
- Modify: `components/wallet-provider.tsx:90-144` (`fetchWallets`) and the context type at `:46-58`
- Test: `lib/__tests__/wallet-provisioning.test.ts` (covers the pure decision helper, which lives in `lib/wallet-mode.ts` created here)
- Create: `lib/wallet-mode.ts` (decision helpers only in this task; the provider comes in Task 3)

**Interfaces:**
- Consumes: existing `refreshWallet(email)` (`lib/wallet-actions.ts:285`) — lookup-only, returns `"User not found in Privy. Please create wallets first."` when absent (`:306`)
- Produces:
  - `getExistingWallets(email: string): Promise<{ success: true; exists: boolean; wallets?: WalletResult["wallets"]; tradingWallet?: TradingWallet | null; privy_type?: number } | { success: false; error: string }>`
  - `shouldProvisionLegacy(input: { modernEnabled: boolean; legacyWalletExists: boolean | null }): boolean` in `lib/wallet-mode.ts`
  - `useWallet()` gains `legacyWalletExists: boolean | null` (null = lookup pending/failed)

- [ ] **Step 1: Write the failing test** — `lib/__tests__/wallet-provisioning.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { shouldProvisionLegacy } from "@/lib/wallet-mode"

describe("shouldProvisionLegacy", () => {
  // Spec §1: newly created Clerk users must not be provisioned a legacy Privy wallet.
  it("never provisions when the user has no existing legacy wallet", () => {
    expect(shouldProvisionLegacy({ modernEnabled: true, legacyWalletExists: false })).toBe(false)
  })
  it("keeps provisioning for users who already own a legacy wallet", () => {
    expect(shouldProvisionLegacy({ modernEnabled: true, legacyWalletExists: true })).toBe(true)
  })
  // Fail-safe: an inconclusive lookup must not create a wallet as a side effect.
  it("does not provision when the lookup was inconclusive", () => {
    expect(shouldProvisionLegacy({ modernEnabled: true, legacyWalletExists: null })).toBe(false)
  })
  // Kill switch: with the modern wallet disabled, signup must not brick — old behavior stands.
  it("falls back to legacy provisioning when the modern wallet is disabled", () => {
    expect(shouldProvisionLegacy({ modernEnabled: false, legacyWalletExists: null })).toBe(true)
  })
})
```

- [ ] **Step 2: Run it, confirm it fails** — `pnpm test lib/__tests__/wallet-provisioning.test.ts` → FAIL ("Cannot find module @/lib/wallet-mode").

- [ ] **Step 3: Create `lib/wallet-mode.ts`** with the decision helpers (mode resolution included now, used by Task 3):

```ts
export type WalletMode = "modern" | "legacy"

export const WALLET_MODE_STORAGE_PREFIX = "ws:wallet-mode:"

export function shouldProvisionLegacy(input: {
  modernEnabled: boolean
  legacyWalletExists: boolean | null
}): boolean {
  if (!input.modernEnabled) return true
  return input.legacyWalletExists === true
}

export function resolveWalletMode(input: {
  modernEnabled: boolean
  legacyEnabled: boolean
  legacyWalletExists: boolean | null
  stored: WalletMode | null
}): WalletMode {
  if (!input.modernEnabled) return "legacy"
  if (!input.legacyEnabled) return "modern"
  // Spec §1: a user without a legacy wallet has nothing to select — modern only.
  if (input.legacyWalletExists === false) return "modern"
  return input.stored ?? "modern"
}

export function canChooseWalletMode(input: {
  modernEnabled: boolean
  legacyEnabled: boolean
  legacyWalletExists: boolean | null
}): boolean {
  return input.modernEnabled && input.legacyEnabled && input.legacyWalletExists === true
}
```

- [ ] **Step 4: Run the test, confirm it passes.** Add `resolveWalletMode`/`canChooseWalletMode` cases to the same file while here (modern default when nothing stored; legacy when flag off; stored preference honored only when the user actually has a legacy wallet).

- [ ] **Step 5: Add the lookup-only server action.** In `lib/wallet-actions.ts`, first make the not-found case structured — at `:306`, change the return to `return { success: false, error: "User not found in Privy. Please create wallets first.", notFound: true }` and add `notFound?: boolean` to `WalletResult`. Then append:

```ts
/**
 * Lookup-only: reports whether this email already owns legacy Privy wallets.
 * MUST NOT create anything — this is the spec §1 gate that keeps new users
 * from being provisioned a legacy wallet.
 */
export async function getExistingWallets(email: string): Promise<
  | { success: true; exists: boolean; wallets?: WalletResult["wallets"]; tradingWallet?: TradingWallet | null; privy_type?: number }
  | { success: false; error: string }
> {
  try {
    const result = await refreshWallet(email)
    if (result.success && result.wallets) {
      return { success: true, exists: true, wallets: result.wallets, tradingWallet: result.tradingWallet ?? null, privy_type: result.privy_type }
    }
    if (result.notFound) return { success: true, exists: false }
    return { success: false, error: result.error ?? "Wallet lookup failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Wallet lookup failed" }
  }
}
```

- [ ] **Step 6: Gate the provider.** In `components/wallet-provider.tsx`, add state `const [legacyWalletExists, setLegacyWalletExists] = React.useState<boolean | null>(null)` and rework `fetchWallets` (`:90-144`) to check-first:

```tsx
import { isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { shouldProvisionLegacy } from "@/lib/wallet-mode"
import { getExistingWallets, pregenerateWallet, /* … */ } from "@/lib/wallet-actions"

const fetchWallets = React.useCallback(async () => {
  if (!user?.email) { setIsLoading(false); return }
  setIsLoading(true)
  setError(null)

  let exists: boolean | null = null
  if (isCryptoBackendEnabled) {
    setSetupStatus("Checking wallet status…")
    const lookup = await getExistingWallets(user.email)
    if (lookup.success) {
      exists = lookup.exists
      setLegacyWalletExists(lookup.exists)
      if (lookup.exists && lookup.wallets) {
        // The lookup already returned the wallets — no create call needed at all.
        setWallets(lookup.wallets as unknown as PrivyWallets)
        setAddresses({
          ethereum: lookup.wallets.ethereum?.address ?? "",
          solana: lookup.wallets.solana?.address ?? "",
          sui: lookup.wallets.sui?.address ?? "",
          ton: lookup.wallets.ton?.address ?? "",
          tron: lookup.wallets.tron?.address ?? "",
        })
        if (lookup.tradingWallet) setTradingWallet(lookup.tradingWallet)
        setPrivyType(lookup.privy_type ?? null)
        setWalletsGenerated(true)
        setSetupStatus(null)
        setIsLoading(false)
        return
      }
    } else {
      setLegacyWalletExists(null)
    }
  }

  if (!shouldProvisionLegacy({ modernEnabled: isCryptoBackendEnabled, legacyWalletExists: exists })) {
    // Modern-only user (or inconclusive lookup): never create a Privy wallet.
    setSetupStatus(null)
    setIsLoading(false)
    return
  }

  /* …existing pregenerateWallet retry loop, unchanged, runs only for
     legacy owners / kill-switch mode… */
}, [user?.email])
```

Keep the existing retry loop body verbatim below the gate. Add `legacyWalletExists` to `WalletContextType` and the memoized `value`.

**Edge cases handled here:** inconclusive lookup never creates (retry surfaces via the existing error state); kill-switch (`NEXT_PUBLIC_CRYPTO_ENABLED=false`) preserves today's signup behavior exactly; existing users now skip the create call entirely on the happy path (faster login, same result).

- [ ] **Step 7: Typecheck, run tests, commit**

```bash
pnpm typecheck && pnpm test
git add lib/wallet-mode.ts lib/__tests__/wallet-provisioning.test.ts lib/wallet-actions.ts components/wallet-provider.tsx
git commit -m "feat(wallet): gate legacy Privy provisioning — new users are modern-only (spec §1)"
```

---

### Task 3: Global wallet-mode context + selector

**Files:**
- Create: `components/wallet-mode-provider.tsx`
- Modify: `app/layout.tsx` (mount inside `WalletProvider`, outside `CryptoProvider`)
- Modify: `components/trade/trade-client.tsx:140-141` (consume context instead of local state) and `:785-795` (toggle writes to context; fix `order-5` collision; add `vividPrefix`)
- Modify: `components/navbar-actions.tsx` wallet section (~L344-387) — add the mode `Segmented` under the header
- Test: covered by Task 2's `resolveWalletMode` tests (pure logic); provider is thin

**Interfaces:**
- Consumes: `useWallet().legacyWalletExists` (Task 2), `resolveWalletMode`/`canChooseWalletMode` (Task 2), `isCryptoBackendEnabled`/`isLegacyPrivyEnabled` from `@/lib/crypto-backend`
- Produces: `useWalletMode(): { mode: WalletMode; canChoose: boolean; setMode: (m: WalletMode) => void }` — **every later task branches on this, never on the raw flag**

- [ ] **Step 1: Write the provider** — `components/wallet-mode-provider.tsx`:

```tsx
"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { isCryptoBackendEnabled, isLegacyPrivyEnabled } from "@/lib/crypto-backend"
import {
  WALLET_MODE_STORAGE_PREFIX,
  canChooseWalletMode,
  resolveWalletMode,
  type WalletMode,
} from "@/lib/wallet-mode"

type WalletModeContextValue = {
  mode: WalletMode
  canChoose: boolean
  setMode: (mode: WalletMode) => void
}

const WalletModeContext = React.createContext<WalletModeContextValue | null>(null)

export function WalletModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { legacyWalletExists } = useWallet()
  const storageKey = `${WALLET_MODE_STORAGE_PREFIX}${user?.userId ?? "anonymous"}`
  const [stored, setStored] = React.useState<WalletMode | null>(null)

  // ?wallet= deep-links (from /trade share URLs) win over the saved preference,
  // then become the saved preference. localStorage can throw in private modes.
  React.useEffect(() => {
    try {
      const url = new URLSearchParams(window.location.search).get("wallet")
      const saved = window.localStorage.getItem(storageKey)
      if (url === "legacy" || url === "modern") setStored(url)
      else if (saved === "legacy" || saved === "modern") setStored(saved)
      else setStored(null)
    } catch { setStored(null) }
  }, [storageKey])

  const setMode = React.useCallback((mode: WalletMode) => {
    setStored(mode)
    try { window.localStorage.setItem(storageKey, mode) } catch {}
  }, [storageKey])

  const flags = { modernEnabled: isCryptoBackendEnabled, legacyEnabled: isLegacyPrivyEnabled, legacyWalletExists }
  const value = React.useMemo<WalletModeContextValue>(() => ({
    mode: resolveWalletMode({ ...flags, stored }),
    canChoose: canChooseWalletMode(flags),
    setMode,
  }), [stored, legacyWalletExists, setMode])

  return <WalletModeContext.Provider value={value}>{children}</WalletModeContext.Provider>
}

export function useWalletMode() {
  const context = React.useContext(WalletModeContext)
  if (!context) throw new Error("useWalletMode must be used inside WalletModeProvider")
  return context
}
```

- [ ] **Step 2: Mount it.** In `app/layout.tsx`, wrap the tree directly inside `WalletProvider` (mode needs `legacyWalletExists`) and outside `CryptoProvider` so crypto surfaces can consume it.

- [ ] **Step 3: Migrate trade-client.** At `trade-client.tsx:140-141` replace the local state with `const { mode: walletSource, setMode: setWalletSource, canChoose } = useWalletMode()`. The Segmented at `:786-795`: render only when `canChoose` (a modern-only user gets no toggle — spec §1), keep the `router.replace` URL sync, change labels to the Copy Deck (`Worldstreet wallet` / `Legacy wallet`), add `vividPrefix="wallet-tab"`, and change `className="order-5 shrink-0 lg:order-none"` to `order-4` (it currently collides with the balances group's `order-5` at `:835`).

- [ ] **Step 4: Navbar selector.** In `components/navbar-actions.tsx`, inside the wallet dropdown body (below the Est. Value block, ~L344-387), add — only when `canChoose`:

```tsx
<Segmented
  size="sm"
  grow
  value={mode}
  onChange={setMode}
  options={[
    { key: "modern", label: "Worldstreet wallet" },
    { key: "legacy", label: "Legacy wallet" },
  ]}
/>
```

Also change the dropdown's `Modern Wallet` `<a>` at `:378-380` to a `next/link` `<Link>` labeled `Worldstreet Wallet` (currently a raw `<a>` → full page reload).

**Edge cases handled here:** user switch re-keys storage per userId (no cross-account leakage); pre-hydration renders resolve to `modern` for one frame — acceptable because every consumer also waits on auth/wallet loading; localStorage unavailable → session-scoped mode (state only); deep link `?wallet=legacy` for a modern-only user is overridden by `resolveWalletMode` (legacyWalletExists === false → modern).

- [ ] **Step 5: Typecheck + manual check** — `pnpm typecheck`; run the app, confirm the toggle appears in navbar + trade for a legacy-owning user and is absent for a fresh account.

- [ ] **Step 6: Commit** — `git commit -m "feat(wallet): global wallet-mode context with navbar and trade selectors"`

---

### Task 4: Error taxonomy + honest unlock errors + session retry

**Files:**
- Create: `lib/crypto-backend/error-messages.ts`
- Test: `lib/crypto-backend/__tests__/error-messages.test.ts`
- Modify: `lib/crypto-backend/client.ts:352+` (the private `request`) — one 401 retry after a forced Clerk token refresh
- Modify: `lib/crypto-wallet/wallet-security.ts:131` area — stop collapsing every unlock failure into "passphrase is incorrect"
- Modify: `lib/crypto-backend/index.ts` — export the new module

**Interfaces:**
- Consumes: `CryptoBackendError` (`lib/crypto-backend/errors.ts` — `status`, `code`, `details`, `requestId`)
- Produces:
  - `describeCryptoError(error: unknown): { title: string; message: string; action: "retry" | "setup-wallet" | "unlock" | "refresh-session" | "new-intent" | "view-existing" | "pay-gas" | "none"; requestId?: string }`
  - `WalletUnlockError extends Error { reason: "wrong-passphrase" | "malformed-package" | "unlock-failed" }` exported from `lib/crypto-wallet/wallet-security.ts`

- [ ] **Step 1: Write the failing tests** — `lib/crypto-backend/__tests__/error-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import { describeCryptoError } from "@/lib/crypto-backend/error-messages"

const err = (code: string, status = 400, details?: unknown) =>
  new CryptoBackendError("boom", status, code, details, "req-123")

describe("describeCryptoError", () => {
  it("maps WALLET_NOT_FOUND to a setup action, not a network error", () => {
    const d = describeCryptoError(err("WALLET_NOT_FOUND", 404))
    expect(d.action).toBe("setup-wallet")
    expect(d.requestId).toBe("req-123")
  })
  it("maps INTENT_EXPIRED to requesting a fresh intent", () => {
    expect(describeCryptoError(err("INTENT_EXPIRED")).action).toBe("new-intent")
  })
  it("surfaces available vs requested for INSUFFICIENT_FUNDS when details carry them", () => {
    const d = describeCryptoError(err("INSUFFICIENT_FUNDS", 400, { available: "1.2 SOL", requested: "5 SOL" }))
    expect(d.message).toContain("1.2 SOL")
    expect(d.message).toContain("5 SOL")
  })
  it("offers user-paid gas for SPONSORSHIP_UNAVAILABLE", () => {
    expect(describeCryptoError(err("SPONSORSHIP_UNAVAILABLE")).action).toBe("pay-gas")
  })
  it("keeps last data and offers retry for RPC_UNAVAILABLE", () => {
    expect(describeCryptoError(err("RPC_UNAVAILABLE", 502)).action).toBe("retry")
  })
  it("shows the existing operation for DUPLICATE_REQUEST", () => {
    expect(describeCryptoError(err("DUPLICATE_REQUEST", 409)).action).toBe("view-existing")
  })
  it("never emits the phrase 'backend unreachable' for coded errors", () => {
    for (const code of ["AUTH_REQUIRED", "WALLET_NOT_FOUND", "RPC_UNAVAILABLE", "INTENT_EXPIRED"]) {
      expect(describeCryptoError(err(code)).message.toLowerCase()).not.toContain("backend unreachable")
    }
  })
  it("falls back to a generic retry with the requestId for unknown codes", () => {
    const d = describeCryptoError(err("SOMETHING_NEW", 500))
    expect(d.action).toBe("retry")
    expect(d.requestId).toBe("req-123")
  })
})
```

- [ ] **Step 2: Run → FAIL**, then implement `lib/crypto-backend/error-messages.ts`:

```ts
import { CryptoBackendError } from "./errors"

export type CryptoErrorAction =
  | "retry" | "setup-wallet" | "unlock" | "refresh-session"
  | "new-intent" | "view-existing" | "pay-gas" | "none"

export type CryptoErrorDescription = {
  title: string
  message: string
  action: CryptoErrorAction
  requestId?: string
}

export function describeCryptoError(error: unknown): CryptoErrorDescription {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { title: "You're offline", message: "Check your connection and try again.", action: "retry" }
  }
  if (error instanceof CryptoBackendError) {
    const requestId = error.requestId
    switch (error.code) {
      case "AUTH_REQUIRED":
      case "UNAUTHORIZED":
        return { title: "Session expired", message: "Your sign-in session needs a refresh.", action: "refresh-session", requestId }
      case "WALLET_NOT_FOUND":
        return { title: "No wallet yet", message: "Create your Worldstreet wallet to continue.", action: "setup-wallet", requestId }
      case "USER_VERIFICATION_REQUIRED":
        return { title: "Verification needed", message: "Unlock your wallet on this device (or complete recovery) to authorize this step.", action: "unlock", requestId }
      case "INSUFFICIENT_FUNDS": {
        const d = error.details as { available?: string; requested?: string } | undefined
        const extra = d?.available && d?.requested ? ` Available: ${d.available}. Requested: ${d.requested}.` : ""
        return { title: "Not enough funds", message: `The amount exceeds what this account can spend.${extra}`, action: "none", requestId }
      }
      case "SPONSORSHIP_UNAVAILABLE":
        return { title: "Fee sponsorship unavailable", message: "Worldstreet can't cover this network fee right now. You can pay the fee yourself instead.", action: "pay-gas", requestId }
      case "RPC_UNAVAILABLE":
        return { title: "Network provider unavailable", message: "The network isn't responding. Your data is unchanged — try again shortly.", action: "retry", requestId }
      case "INTENT_EXPIRED":
        return { title: "Quote expired", message: "This quote expired before signing. Request a fresh one — nothing was sent.", action: "new-intent", requestId }
      case "DUPLICATE_REQUEST":
        return { title: "Already in progress", message: "This request was already submitted — showing the existing operation.", action: "view-existing", requestId }
      case "PROXY_DISABLED":
        return { title: "Wallet service disabled", message: "The modern wallet is switched off right now. Try again later.", action: "none", requestId }
    }
    if (error.status === 429) return { title: "Too many requests", message: "Give it a moment, then try again.", action: "retry", requestId }
    if (error.status >= 500) return { title: "Wallet service issue", message: "The wallet service hit a problem. Try again shortly.", action: "retry", requestId }
    return { title: "Something went wrong", message: error.message, action: "retry", requestId }
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { title: "Cancelled", message: "The request was cancelled.", action: "none" }
  }
  return { title: "Something went wrong", message: error instanceof Error ? error.message : "Unexpected error.", action: "retry" }
}
```

- [ ] **Step 3: Run tests → PASS.** Export from `lib/crypto-backend/index.ts`.

- [ ] **Step 4: 401 retry-once in the client.** In `client.ts`'s private `request`, wrap the fetch: on a 401 response and `!options._retried`, force a Clerk token refresh (which also refreshes the session cookie the proxy reads) and retry exactly once:

```ts
// Inside request(), where the non-OK response becomes a CryptoBackendError:
if (response.status === 401 && !options._retried) {
  // clerk-js refreshes the session cookie as a side effect of getToken().
  try { await (window as { Clerk?: { session?: { getToken?: (o?: { skipCache?: boolean }) => Promise<string | null> } } }).Clerk?.session?.getToken?.({ skipCache: true }) } catch {}
  return this.request<T>(path, init, { ...options, _retried: true })
}
```

Add `_retried?: boolean` to the client's `RequestOptions` type. Guard `typeof window !== "undefined"` so server-side callers skip the retry.

- [ ] **Step 5: Honest unlock errors.** In `lib/crypto-wallet/wallet-security.ts`, add near the top:

```ts
export class WalletUnlockError extends Error {
  constructor(message: string, public readonly reason: "wrong-passphrase" | "malformed-package" | "unlock-failed") {
    super(message)
    this.name = "WalletUnlockError"
  }
}
```

Then in `unlockWalletWithPassphrase` (the catch that currently returns "Wallet passphrase is incorrect" for everything, around `:131`): an AES-GCM decrypt failure (`error instanceof DOMException && error.name === "OperationError"`) → `WalletUnlockError("Wallet passphrase is incorrect.", "wrong-passphrase")`; a missing/malformed envelope (the function's own pre-decrypt `throw`s) → rethrow wrapped as `"malformed-package"` with the original message; anything else → `"unlock-failed"` with the original message. Apply the same split to `unlockWalletWithRecoverySecret`.

- [ ] **Step 6: Typecheck, test, commit** — `pnpm typecheck && pnpm test`, then `git commit -m "feat(crypto): error taxonomy, honest unlock errors, 401 refresh-and-retry (spec §13)"`

---

### Task 5: Network bridge + explorer transaction URLs

**Files:**
- Modify: `lib/networks.ts` (add `txUrl` per network)
- Create: `lib/crypto-backend/network-meta.ts`
- Test: `lib/crypto-backend/__tests__/network-meta.test.ts`

**Interfaces:**
- Consumes: `NETWORKS`/`NetworkMeta` (`lib/networks.ts`), `CryptoNetwork` (`lib/crypto-backend/types.ts:31`)
- Produces:
  - `NetworkMeta.txUrl: (hash: string) => string`
  - `networkMetaFor(backendNetworkId: string, networks?: CryptoNetwork[]): NetworkMeta | null`
  - `explorerTxUrl(backendNetworkId: string, txHash: string, networks?: CryptoNetwork[]): string | null`

- [ ] **Step 1: Failing test** — `lib/crypto-backend/__tests__/network-meta.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { explorerTxUrl, networkMetaFor } from "@/lib/crypto-backend/network-meta"

describe("network-meta", () => {
  it("maps known backend ids to the display registry", () => {
    expect(networkMetaFor("arbitrum-one")?.key).toBe("arbitrum")
    expect(networkMetaFor("solana-mainnet-beta")?.key).toBe("solana")
  })
  it("builds explorer tx links", () => {
    expect(explorerTxUrl("ethereum-mainnet", "0xabc")).toBe("https://etherscan.io/tx/0xabc")
    expect(explorerTxUrl("solana-mainnet-beta", "sig")).toBe("https://solscan.io/tx/sig")
  })
  it("returns null (omit the link) for unknown networks instead of guessing", () => {
    expect(networkMetaFor("base-mainnet")).toBeNull()
    expect(explorerTxUrl("base-mainnet", "0xabc")).toBeNull()
  })
  it("falls back to matching by family + chainId from the live network list", () => {
    const live = [{ id: "eth-main", family: "evm", name: "Ethereum", environment: "mainnet", chainId: 1, nativeAsset: "ETH", capabilities: {} }]
    expect(networkMetaFor("eth-main", live)?.key).toBe("ethereum")
  })
})
```

- [ ] **Step 2: Run → FAIL. Extend `lib/networks.ts`** — add to `NetworkMeta`: `txUrl: (hash: string) => string`, and per entry: Ethereum `https://etherscan.io/tx/${h}` · Arbitrum `https://arbiscan.io/tx/${h}` · Solana `https://solscan.io/tx/${h}` · Sui `https://suiscan.xyz/mainnet/tx/${h}` · TON `https://tonviewer.com/transaction/${h}` · Tron `https://tronscan.org/#/transaction/${h}`.

- [ ] **Step 3: Implement `lib/crypto-backend/network-meta.ts`:**

```ts
import { NETWORKS, type NetworkMeta } from "@/lib/networks"
import type { CryptoNetwork } from "./types"

/** Known backend network ids → display registry keys. Unknown ids stay unknown
 *  (render no explorer link) rather than guessing a wrong chain. */
const BACKEND_NETWORK_KEY: Record<string, string> = {
  "ethereum-mainnet": "ethereum",
  "arbitrum-one": "arbitrum",
  "solana-mainnet-beta": "solana",
  "sui-mainnet": "sui",
  "ton-mainnet": "ton",
  "tron-mainnet": "tron",
}

const CHAIN_ID_KEY: Record<number, string> = { 1: "ethereum", 42161: "arbitrum" }

export function networkMetaFor(backendNetworkId: string, networks?: CryptoNetwork[]): NetworkMeta | null {
  let key: string | undefined = BACKEND_NETWORK_KEY[backendNetworkId]
  if (!key && networks) {
    const live = networks.find((n) => n.id === backendNetworkId)
    if (live?.family === "evm" && live.chainId != null) key = CHAIN_ID_KEY[live.chainId]
    else if (live?.family === "solana") key = "solana"
    else if (live?.family === "sui") key = "sui"
    else if (live?.family === "ton") key = "ton"
    else if (live?.family === "tron") key = "tron"
  }
  return key ? NETWORKS.find((n) => n.key === key) ?? null : null
}

export function explorerTxUrl(backendNetworkId: string, txHash: string, networks?: CryptoNetwork[]): string | null {
  const meta = networkMetaFor(backendNetworkId, networks)
  return meta ? meta.txUrl(txHash) : null
}
```

- [ ] **Step 4: Run tests → PASS. Typecheck. Commit** — `git commit -m "feat(crypto): backend network → explorer bridge with tx links"`

---

### Task 6: Address & amount validation module

**Files:**
- Create: `lib/crypto-wallet/address-validation.ts`
- Test: `lib/crypto-wallet/__tests__/address-validation.test.ts`

**Interfaces:**
- Consumes: `viem` `isAddress`, `bs58` (both installed)
- Produces (used by SendFlow, Task 13):
  - `validateAddress(family: string, address: string): { ok: true } | { ok: false; problem: string }`
  - `toBaseUnits(amount: string, decimals: number): string | null` — exact string math, no floats; null on malformed input
  - `validateAmount(input: { amount: string; decimals: number; availableBaseUnits?: string }): { ok: true; baseUnits: string } | { ok: false; problem: string }`

- [ ] **Step 1: Failing tests** (representative set — write all of these):

```ts
import { describe, expect, it } from "vitest"
import { toBaseUnits, validateAddress, validateAmount } from "@/lib/crypto-wallet/address-validation"

describe("validateAddress", () => {
  it("accepts a checksummed EVM address and rejects a truncated one", () => {
    expect(validateAddress("evm", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831").ok).toBe(true)
    expect(validateAddress("evm", "0xaf88d065").ok).toBe(false)
  })
  it("rejects a Solana address pasted into an EVM field", () => {
    expect(validateAddress("evm", "11111111111111111111111111111112").ok).toBe(false)
  })
  it("accepts 32-byte base58 for Solana and rejects other lengths", () => {
    expect(validateAddress("solana", "11111111111111111111111111111112").ok).toBe(true)
    expect(validateAddress("solana", "abc").ok).toBe(false)
  })
  it("trims surrounding whitespace before validating", () => {
    expect(validateAddress("evm", "  0xaf88d065e77c8cC2239327C5EDb3A432268e5831  ").ok).toBe(true)
  })
  it("requires a value", () => {
    expect(validateAddress("evm", "").ok).toBe(false)
  })
})

describe("toBaseUnits", () => {
  it("converts without float drift", () => {
    expect(toBaseUnits("1.000000000000000001", 18)).toBe("1000000000000000001")
    expect(toBaseUnits("0.1", 6)).toBe("100000")
  })
  it("rejects more fraction digits than the asset has", () => {
    expect(toBaseUnits("0.1234567", 6)).toBeNull()
  })
  it("rejects malformed input", () => {
    for (const bad of ["", ".", "1.", "1..2", "1e5", "-1", "abc"]) expect(toBaseUnits(bad, 6)).toBeNull()
  })
})

describe("validateAmount", () => {
  it("rejects zero", () => {
    expect(validateAmount({ amount: "0", decimals: 6 }).ok).toBe(false)
  })
  it("rejects amounts above the available balance via BigInt compare", () => {
    expect(validateAmount({ amount: "2", decimals: 6, availableBaseUnits: "1500000" }).ok).toBe(false)
    expect(validateAmount({ amount: "1.5", decimals: 6, availableBaseUnits: "1500000" }).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run → FAIL. Implement:**

```ts
import { isAddress } from "viem"
import bs58 from "bs58"

export type AddressCheck = { ok: true } | { ok: false; problem: string }

export function validateAddress(family: string, address: string): AddressCheck {
  const trimmed = address.trim()
  if (!trimmed) return { ok: false, problem: "Enter a destination address." }
  switch (family) {
    case "evm":
      return isAddress(trimmed, { strict: false })
        ? { ok: true }
        : { ok: false, problem: "That doesn't look like a valid Ethereum-style address." }
    case "solana": {
      try {
        return bs58.decode(trimmed).length === 32
          ? { ok: true }
          : { ok: false, problem: "That doesn't look like a valid Solana address." }
      } catch {
        return { ok: false, problem: "That doesn't look like a valid Solana address." }
      }
    }
    case "sui":
      return /^0x[0-9a-fA-F]{64}$/.test(trimmed)
        ? { ok: true }
        : { ok: false, problem: "Sui addresses are 0x followed by 64 hex characters." }
    case "ton":
      return /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/.test(trimmed)
        ? { ok: true }
        : { ok: false, problem: "That doesn't look like a valid TON address." }
    case "tron":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)
        ? { ok: true }
        : { ok: false, problem: "Tron addresses start with T and are 34 characters." }
    default:
      // Unknown family: be permissive locally, let the backend's validation rule.
      return trimmed.length >= 16 ? { ok: true } : { ok: false, problem: "Unrecognized address format." }
  }
}

export function toBaseUnits(amount: string, decimals: number): string | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim())
  if (!match || decimals < 0) return null
  const [, whole, fraction = ""] = match
  if (fraction.length > decimals) return null
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0")).toString()
}

export function validateAmount(input: { amount: string; decimals: number; availableBaseUnits?: string }):
  | { ok: true; baseUnits: string }
  | { ok: false; problem: string } {
  const baseUnits = toBaseUnits(input.amount, input.decimals)
  if (baseUnits === null) {
    return { ok: false, problem: input.amount.trim() ? `Use at most ${input.decimals} decimal places.` : "Enter an amount." }
  }
  if (BigInt(baseUnits) === 0n) return { ok: false, problem: "Amount must be more than zero." }
  if (input.availableBaseUnits !== undefined && BigInt(baseUnits) > BigInt(input.availableBaseUnits)) {
    return { ok: false, problem: "Amount exceeds your available balance." }
  }
  return { ok: true, baseUnits }
}
```

- [ ] **Step 3: Run → PASS. Typecheck. Commit** — `git commit -m "feat(crypto): local address and amount validation (spec §7)"`

---

# Phase 1 — Shared crypto UI primitives

### Task 7: Crypto primitives — ModeBadge, AddressPill, SectionMessage, KeyReveal

**Files:**
- Create: `components/crypto/primitives.tsx`
- Test: none (presentational; verified by typecheck + walkthrough)

**Interfaces:**
- Consumes: `describeCryptoError` (Task 4), copy-flip pattern from `receive-panel.tsx:115-119`
- Produces:
  - `ModeBadge({ mode }: { mode: "modern" | "legacy" })` — neutral chip, **not** credit green
  - `AddressPill({ address, mono?: boolean, className? })` — truncated `font-mono` address, click-to-copy with the 1600ms flip
  - `SectionMessage({ error?: unknown, success?: string | null, onAction?: (action: CryptoErrorAction) => void })` — the one replacement for every untinted `<p className="text-sm">{message}</p>`
  - `KeyReveal({ label, value, network }: { label: string; value: string; network: string })` — blur-until-reveal secret display (used by Task 18)

- [ ] **Step 1: Implement the file:**

```tsx
"use client"

import * as React from "react"

import { InlineNotice } from "@/components/ui/flow"
import { describeCryptoError, type CryptoErrorAction } from "@/lib/crypto-backend"

/** Neutral wallet-mode chip. Deliberately NOT credit green — emerald is reserved
 *  for money direction (system.tsx house rule #1). */
export function ModeBadge({ mode }: { mode: "modern" | "legacy" }) {
  return (
    <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {mode === "modern" ? "Self-custody" : "Legacy"}
    </span>
  )
}

function truncateMiddle(value: string, keep = 6) {
  return value.length <= keep * 2 + 3 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`
}

export function AddressPill({ address, className }: { address: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(address).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
      title={address}
      className={`ws-microswap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] transition-colors ${copied ? "bg-credit-chip text-credit" : "bg-surface-sunken text-muted-foreground hover:bg-accent"} ${className ?? ""}`}
    >
      {truncateMiddle(address)}
      <span className="shrink-0 font-sans text-[10px] font-semibold">{copied ? "Copied" : "Copy"}</span>
    </button>
  )
}

/** Tone-tinted outcome line. Errors run through the spec §13 taxonomy so the
 *  message is actionable; success is a quiet credit-tinted sentence. */
export function SectionMessage({ error, success, onAction }: {
  error?: unknown
  success?: string | null
  onAction?: (action: CryptoErrorAction) => void
}) {
  if (error) {
    const described = describeCryptoError(error)
    return (
      <InlineNotice tone="error">
        <span className="font-semibold">{described.title}.</span> {described.message}
        {described.requestId ? <span className="ml-1 font-mono text-[10.5px] opacity-70">({described.requestId})</span> : null}
        {onAction && described.action !== "none" ? (
          <button type="button" onClick={() => onAction(described.action)} className="ml-2 font-semibold underline underline-offset-2">
            {described.action === "retry" ? "Try again"
              : described.action === "setup-wallet" ? "Set up wallet"
              : described.action === "unlock" ? "Unlock"
              : described.action === "new-intent" ? "Get a fresh quote"
              : described.action === "view-existing" ? "View status"
              : described.action === "pay-gas" ? "Pay the fee myself"
              : "Refresh session"}
          </button>
        ) : null}
      </InlineNotice>
    )
  }
  if (success) {
    return <p className="rounded-xl bg-credit-chip px-3.5 py-2.5 text-[13px] leading-relaxed text-credit">{success}</p>
  }
  return null
}

/** Secret display: blurred until deliberately revealed, auto re-blurs. */
export function KeyReveal({ label, value, network }: { label: string; value: string; network: string }) {
  const [revealed, setRevealed] = React.useState(false)
  React.useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), 45_000)
    return () => clearTimeout(timer)
  }, [revealed])
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken/70 p-3 ring-1 ring-border/25">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{network}</span>
      </div>
      <code
        aria-hidden={!revealed}
        className={`block max-h-32 select-all break-all rounded-lg bg-card/60 p-2 font-mono text-xs transition-[filter] ${revealed ? "" : "select-none blur-sm"}`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        className="self-start rounded-full bg-surface-sunken px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-accent"
      >
        {revealed ? "Hide" : "Reveal"}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit** — `git commit -m "feat(crypto): shared DS-conformant primitives (ModeBadge, AddressPill, SectionMessage, KeyReveal)"`

---

### Task 8: WalletUnlockDialog — a real modal with honest states

**Files:**
- Rewrite: `components/crypto/WalletUnlockDialog.tsx` (currently an inline `rounded-lg border` div masquerading as a dialog — `:65`)
- Test: none (thin UI; unlock logic already lives in `wallet-security.ts`)

**Interfaces:**
- Consumes: `ResponsiveModal*` (`components/ui/responsive-modal.tsx`), `SectionMessage` (Task 7), `useCryptoContext().security` (passphrase/recovery unlock + set-passphrase migration), `WalletUnlockError` (Task 4), `Segmented`
- Produces: `WalletUnlockDialog({ open, onOpenChange, onUnlocked }: { open: boolean; onOpenChange: (open: boolean) => void; onUnlocked?: () => void })` — **the** unlock surface; every later flow opens this when the DEK is locked/expired and continues via `onUnlocked`

- [ ] **Step 1: Rebuild the component.** Structure:
  - `ResponsiveModal open onOpenChange` → `ResponsiveModalContent className="sm:max-w-md"` → `ResponsiveModalHeader` with `ResponsiveModalTitle` "Unlock your wallet" and `ResponsiveModalDescription` "Your keys are decrypted locally and stay on this device."
  - A `Segmented` (`size="sm"`, `grow`) switching `passphrase | recovery` tabs (replaces the current unlabeled dual forms).
  - Passphrase tab: `Input` (`components/ui/input.tsx`) `type="password"` `autoComplete="current-password"`, submit on Enter; CTA is a full-width pill button (`"flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"`) whose label states its blocker: `Enter your passphrase` when empty, `Unlocking…` while pending, `Unlock` otherwise.
  - Recovery tab: same shape for the recovery secret, plus the existing add-a-passphrase migration path for passphrase-less wallets (keep its logic, restyle inputs).
  - Outcome: `SectionMessage error={unlockError}` — a `WalletUnlockError` with reason `wrong-passphrase` renders as-is; `malformed-package` gets an extra line: `Your local wallet data looks damaged — restore from an encrypted backup under Security.`
  - On success: call `onUnlocked?.()`, then `onOpenChange(false)`.

- [ ] **Step 2: Update call sites** — `ModernWalletPage` currently renders it inline; switch to state-controlled modal (`const [unlockOpen, setUnlockOpen] = useState(false)` + a `Locked` chip/button in the wallet card that opens it). Search: `grep -r "WalletUnlockDialog" components/`.

**Edge cases handled here:** Escape/outside-click/focus-trap come free from `ResponsiveModal` (the hand-rolled version had none); wrong passphrase vs corrupted package are now different messages; pending unlocks resume the caller's action via `onUnlocked` instead of forcing the user to re-trigger.

- [ ] **Step 3: Typecheck + walkthrough (unlock with wrong passphrase → specific message; correct passphrase → modal closes) + commit** — `git commit -m "feat(crypto): rebuild wallet unlock as a ResponsiveModal with honest error states"`

---

# Phase 2 — Wallet home

### Task 9: Balance refresh policy (spec §5)

**Files:**
- Rewrite: `hooks/crypto/useCryptoBalances.ts` (currently hand-rolled state + `refresh=true` on every mount — `:23-49`)
- Modify: `lib/crypto-backend/query-keys.ts` (add `balanceSnapshot` key)
- Modify: `hooks/crypto/useTransactionIntent.ts:122-126` (`submit.onSuccess` invalidates the snapshot key — the "after a confirmed transaction" trigger)
- Test: `hooks/crypto/__tests__/balance-policy.test.ts` (pure helpers)

**Interfaces:**
- Consumes: `cryptoBackendClient.listBalanceSnapshot(refresh, signal)`, `CryptoBalanceSnapshot` (`generatedAt`, `results[].status === "unavailable"`), `keepPreviousData` from `@tanstack/react-query`
- Produces: `useCryptoBalances(): { balances: CryptoBalanceResult[]; unavailableNetworks: CryptoBalanceSnapshotItem[]; snapshot; generatedAt: string | null; isLoading: boolean; isRefreshing: boolean; error: unknown; refresh: () => Promise<void> }` — same `CryptoBalanceResult` shape as today, plus `generatedAt`/`isRefreshing`; `refetch` renamed `refresh`

- [ ] **Step 1: Extract + test the flatten helper.** Move the `results → balances` flatten (`useCryptoBalances.ts:53-59`) into an exported pure function `flattenSnapshot(snapshot: CryptoBalanceSnapshot | null | undefined): CryptoBalanceResult[]` and write `hooks/crypto/__tests__/balance-policy.test.ts` asserting: incomplete payloads (missing `results`) yield `[]`; unavailable networks are excluded from `balances` but reported by `unavailableNetworksOf(snapshot)`; balances keep exact `amountBaseUnits` strings. Run → FAIL → implement → PASS.

- [ ] **Step 2: Rewrite the hook on React Query:**

```ts
export function useCryptoBalances() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: cryptoQueryKeys.balanceSnapshot(userId),
    // Spec §5: reads hit the backend cache; refresh=true is reserved for the
    // explicit triggers (user refresh, post-transaction invalidation).
    queryFn: ({ signal }) => cryptoBackendClient.listBalanceSnapshot(false, signal),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      failureCount < 2 && !(error instanceof CryptoBackendError && error.status < 500),
  })

  const refresh = React.useCallback(async () => {
    const fresh = await cryptoBackendClient.listBalanceSnapshot(true)
    queryClient.setQueryData(cryptoQueryKeys.balanceSnapshot(userId), fresh)
  }, [queryClient, userId])

  return {
    balances: flattenSnapshot(query.data),
    unavailableNetworks: unavailableNetworksOf(query.data),
    snapshot: query.data ?? null,
    generatedAt: query.data?.generatedAt ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
  }
}
```

Add `balanceSnapshot: (userId: string) => ["crypto", "balance-snapshot", userId]` to `query-keys.ts`. In `useTransactionIntent.ts` `submit.onSuccess`, add `await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })`.

- [ ] **Step 3: Fix call sites** of the renamed `refetch → refresh` (`grep -rn "useCryptoBalances" components/ hooks/`).

**Edge cases handled here:** refresh failure keeps the previous snapshot on screen (`setQueryData` only on success; the thrown error surfaces via the caller's `SectionMessage`); user switch is isolated by the userId-scoped key + the existing `queryClient.clear()` in `query-provider`; a provider outage marks networks `unavailable` without zeroing the rest.

- [ ] **Step 4: Typecheck, test, commit** — `git commit -m "feat(crypto): spec-compliant balance refresh policy with preserved snapshots (spec §5)"`

---

### Task 10: ModernWalletPage rebuild

**Files:**
- Rewrite: `components/crypto/ModernWalletPage.tsx`
- Test: none (screen composition)

**Interfaces:**
- Consumes: `PageHeader`, `Eyebrow`, `Balance`, `CardShell`, `CardHeader`, `ListRow`, `ActionPill`, `EmptyState`, `Skel`, `SkeletonRows`, `IconAction`, `Rise` (system.tsx) · `CoinAvatar` · `ModeBadge`/`AddressPill`/`SectionMessage` (Task 7) · `useCryptoBalances` (Task 9) · `networkMetaFor` (Task 5) · `formatCryptoAmount` · `useWalletMode` (Task 3)
- Produces: the `/wallet/modern` screen other tasks link into: `#security` anchor section; opens `ModernReceiveModal` (Task 11) and links to `/wallet/modern/send` (Task 13)

- [ ] **Step 1: Page skeleton per the house anatomy** (`wallet-setup.tsx:82-148` is the template):
  - Wrapper: `"flex flex-col gap-6 p-4 md:p-6 lg:p-8"` (drop the current `mx-auto max-w-5xl` deviation at `:39`).
  - `PageHeader title="Wallet" subtitle="Self-custodial — keys never leave this device" actions={<ModeBadge mode="modern" />}` — fixes the "Assets" title collision at `:40` and both credit-green badge misuses (`:40`, `:54`).
  - Action row: `ActionPill` ×3 — `Deposit` (opens `ModernReceiveModal`), `Send` (`href="/wallet/modern/send"`), `Security` (`href="#security"`). Fixes the dead `/assets` links at `:43-45`.
  - Hero: `Eyebrow` "Est. Total Value" + `Balance` (`className="text-[clamp(2rem,4vw,3rem)]"`) + `"text-[13px] text-muted-foreground"` line: `As of {new Date(generatedAt).toLocaleTimeString()}` with an `IconAction` refresh (spins via `isRefreshing`). While loading: `Skel className="my-1.5 h-[clamp(2rem,4vw,3rem)] w-[clamp(11rem,22vw,17rem)] rounded-lg"` — never the word "Loading".
  - USD total: join `balances` to the price source `assets-client.tsx` already uses for its backend-balance catalogue merge (open `components/assets/assets-client.tsx`, reuse the same hook/action it imports for prices; extract the join into `hooks/crypto/useUsdIndex.ts` returning `Record<string /* symbol */, number>`). Sum `Number(formatCryptoAmount(raw, decimals)) * price` per balance with a known price; balances without a price are excluded from the total and footnoted `Some assets have no live price`.
  - Accounts card: `CardShell` + `CardHeader title="Accounts" subtitle="One address per chain family"` + `"flex flex-col pb-2"` of `ListRow`s — icon via `CoinAvatar symbol={networkMetaFor(...)?.nativeSymbol ?? family}`, title = family label, subtitle = network name, `right={<AddressPill address={account.canonicalAddress ?? ""} />}`. Account rows replace the hand-rolled `rounded-xl bg-surface-sunken/70 p-3` tiles at `:57`.
  - Balances card: `CardShell` + `CardHeader title="Balances" right={refresh IconAction}`; body `ListRow` per balance (icon `CoinAvatar src={balance.logo}`, title `symbol`, subtitle `networkName`, right = `"text-[14px] font-semibold tabular-nums"` amount via `formatCryptoAmount` + a `"text-[12px] text-muted-foreground tabular-nums"` USD line). Empty → `EmptyState illustration="noCrypto" title="No balances yet" description="Deposit crypto to get started." ctas={[{ label: "Deposit", href: "#" }]}`. Loading → `SkeletonRows rows={4}`. Per-network outage → one `InlineNotice tone="warning"` per unavailable network above the list: `{networkName} balances are temporarily unavailable — showing your last snapshot.` (replaces the `text-amber-500` string inside the 1,100-char line at `:85`).
  - Errors: `SectionMessage error={error}` (replaces the raw `border-destructive` card at `:49`).
  - `#security` section: `<div id="security" className="flex flex-col gap-6">` containing the (restyled in later tasks) `CryptoSecurityPanel`, `RecoveryPanel`, `WalletKeyExportPanel`, `WalletChainProvisioningPanel`.
  - **Delete** the dev `<details>` JSON dump at `:86` (debug leak; also uses undefined token `bg-surface`).
  - Wrap top-level sections in `Rise` with 40ms stagger (`delay={0}`, `40`, `80` …) for the house entrance.

- [ ] **Step 2: Feature-flag / setup states.** Flag off → `UnavailablePanel title="The Worldstreet wallet isn't enabled" tone="muted"` (replaces plain text). `wallet.needsSetup` → render `WalletSetupFlow` (Task 21 polishes it). Wallet exists but package missing (partial setup) → the resume state from Task 21.

- [ ] **Step 3: Typecheck + walkthrough** (dark and light, mobile width for `ActionPill` wrap) + commit — `git commit -m "feat(crypto): rebuild wallet home on the design system (spec §5)"`

---

### Task 11: Deposit flow — ModernReceiveModal (spec §6)

**Files:**
- Modify: `components/ui/receive-panel.tsx` (add optional `addresses` + `note` props)
- Create: `components/crypto/ModernReceiveModal.tsx`
- Modify: `components/crypto/ModernWalletPage.tsx` (wire the Deposit pill)
- Test: none (QR panel is existing, proven UI)

**Interfaces:**
- Consumes: `ReceivePanel` (QR via `qrcode` `toDataURL`, network chips, copy, mismatch warning — `receive-panel.tsx:56-68, 101-110`), `ResponsiveModal*`, `CryptoWalletDetails.accounts[].canonicalAddress`, `NETWORKS` (`chain` field maps EVM L2s to the ethereum address)
- Produces: `ModernReceiveModal({ open, onOpenChange, asset? }: { open: boolean; onOpenChange: (open: boolean) => void; asset?: string | null })`

- [ ] **Step 1: Make ReceivePanel source-agnostic.** Add props:

```tsx
export function ReceivePanel({ only, asset = "USDT", className, addresses: addressesProp, note }: {
  only?: string[]
  asset?: string | null
  className?: string
  /** Override the legacy wallet-provider addresses (modern wallet passes its own). */
  addresses?: Partial<Record<WalletChain, string>> | null
  /** Extra confirmation line under the warning (e.g. the self-custody note). */
  note?: string
}) {
  const legacy = useWallet()
  const addresses = addressesProp ?? legacy.addresses
  /* …rest unchanged; render `note` as:
     <p className="text-[12px] leading-relaxed text-muted-foreground">{note}</p> */
}
```

Keep `useWallet()` unconditionally called (hooks rules) — only the value selection changes. Legacy `ReceiveModal` callers pass nothing and behave identically.

- [ ] **Step 2: Build the modal:**

```tsx
"use client"

import * as React from "react"

import { ReceivePanel } from "@/components/ui/receive-panel"
import {
  ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader,
  ResponsiveModalTitle, ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { useCryptoContext } from "@/components/crypto/CryptoProvider"
import type { WalletChain } from "@/lib/networks"

const FAMILY_TO_CHAIN: Record<string, WalletChain> = {
  evm: "ethereum", solana: "solana", sui: "sui", ton: "ton", tron: "tron",
}

export function ModernReceiveModal({ open, onOpenChange, asset = null }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset?: string | null
}) {
  const { wallet } = useCryptoContext()
  const addresses = React.useMemo(() => {
    const map: Partial<Record<WalletChain, string>> = {}
    for (const account of wallet.data?.accounts ?? []) {
      const chain = FAMILY_TO_CHAIN[account.chainFamily]
      if (chain && account.canonicalAddress) map[chain] = account.canonicalAddress
    }
    return map
  }, [wallet.data])

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Deposit crypto</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Choose the network first — funds sent on the wrong network can be lost.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="max-h-[70dvh] overflow-y-auto">
          <ReceivePanel
            asset={asset}
            addresses={addresses}
            only={Object.keys(addresses).length ? undefined : []}
            note="This address belongs to your Worldstreet self-custodial wallet. Only you control its keys."
          />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
```

- [ ] **Step 3: Wire it** — in `ModernWalletPage`, `Deposit` `ActionPill` opens it; in the Balances card, tapping an asset row's deposit affordance passes `asset={symbol}` so the mismatch warning names the token.

**Edge cases handled here:** wallet family not yet provisioned (older wallet, missing sui/ton) → that network simply has no address; add below the panel, when `wallet.data` has fewer families than `FAMILY_TO_CHAIN`: `InlineNotice tone="warning"` → `Some networks aren't set up on this wallet yet — add them under Security.` linking `#security` (Task 19's provisioning panel); QR generation failure → existing pulse placeholder stays (already handled in `receive-panel.tsx:103`); clipboard API missing → the copy button's promise rejection is swallowed (wrap in try/catch), address remains selectable `font-mono` text.

- [ ] **Step 4: Typecheck + walkthrough (each network shows the right address; EVM L2s reuse the ethereum address via the `chain` field) + commit** — `git commit -m "feat(crypto): modern deposit flow with QR and self-custody confirmation (spec §6)"`

---

### Task 12: Migration notice (spec §2)

**Files:**
- Create: `components/crypto/MigrationNotice.tsx`
- Modify: `app/page.tsx` (top of the dashboard column — the post-login landing)
- Modify: `components/navbar-actions.tsx` (notifications section — pinned entry)
- Test: `lib/__tests__/migration-notice.test.ts` (visibility predicate)

**Interfaces:**
- Consumes: `useWallet().legacyWalletExists` (Task 2), `useWalletMode()` flags, `useAuth().user.userId`
- Produces: `shouldShowMigrationNotice(input: { modernEnabled: boolean; legacyEnabled: boolean; legacyWalletExists: boolean | null; dismissed: boolean }): boolean` in `lib/wallet-mode.ts`; `MigrationNotice({ variant }: { variant: "banner" | "notification" })`

- [ ] **Step 1: Failing test** (in `lib/__tests__/migration-notice.test.ts`): shows only when all of — modern enabled, legacy enabled, `legacyWalletExists === true`, not dismissed; **never** for `legacyWalletExists: false` (new users) or `null` (unknown — don't nag users we can't classify). Implement `shouldShowMigrationNotice` in `lib/wallet-mode.ts`. Run → PASS.

- [ ] **Step 2: Build the component.** Banner variant (dashboard):

```tsx
const MIGRATION_COPY =
  "Your legacy wallet is still available. For the new Worldstreet self-custodial experience, " +
  "move your funds to your Worldstreet embedded wallet. You control the keys, and signing " +
  "happens locally on your device."
```

- Shell: `"flex items-start gap-3 rounded-2xl bg-surface-sunken/70 px-4 py-3.5 ring-1 ring-border/25"` — a brand moment, so the leading 32px icon chip may be gold (`"flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.12] text-primary"`); body text `"text-[13px] leading-relaxed text-muted-foreground"` with a `"font-semibold text-foreground"` first sentence.
- Actions: `Move funds` → outline-gold CTA (`"inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"`) linking `/wallet/modern` · `I've finished migrating` → quiet text button · dismiss `×` `IconAction`.
- Dismissal state: `localStorage` key `ws:migration-dismissed:{userId}`, values `"dismissed"` (via ×) or `"confirmed"` (via the confirm button) — both hide it everywhere, wrapped in try/catch.
- Notification variant: same copy in the notifications panel's row idiom (reuse the surrounding rows' classes in `navbar-actions.tsx`), pinned above fetched notifications while `shouldShowMigrationNotice` holds.

- [ ] **Step 3: Mount both variants.** Dashboard: first child above the fold in `app/page.tsx`'s main column. Notifications: inside the `notifications` section of the grouped dropdown in `navbar-actions.tsx`.

**Edge cases handled here:** never rendered for modern-only users (spec §2's explicit exclusion) — the predicate, not the component, owns this; `legacyWalletExists` arriving late (lookup async) → notice pops in on resolve, acceptable; localStorage cleared → notice returns, harmless; copy never claims Worldstreet can recover keys (verbatim spec text only).

- [ ] **Step 4: Typecheck, test, walkthrough (legacy user sees both surfaces; dismiss hides both; fresh account sees neither), commit** — `git commit -m "feat(crypto): legacy-to-modern migration notice on dashboard and notifications (spec §2)"`

---

# Phase 3 — The send flow

### Task 13: SendFlow — the transfer rebuilt on the flow kit (spec §4, §7)

**Files:**
- Create: `components/crypto/send/SendFlow.tsx`, `app/wallet/modern/send/page.tsx`
- Delete: `components/crypto/ModernTransferFlow.tsx`, `components/crypto/TransactionReview.tsx` (both absorbed; remove their render sites in the old ModernWalletPage if any remain)
- Test: reuses Task 6's validation tests; add `lib/crypto-wallet/__tests__/send-stages.test.ts` for the stage mapper

**Interfaces:**
- Consumes: `FlowShell`, `FlowHeader`, `ChoiceRow`, `AmountField`, `RouteStrip`, `DetailPanel`, `InlineNotice`, `FlowCta`, `StatusScreen`, `StageList`, `useStageProgress`, `ErrorDetail`, `UnavailablePanel`, `FlowSkeleton` (flow.tsx) · `useTransactionIntent` (create/simulate/submit/reset) · `validateAddress`/`validateAmount` (Task 6) · `explorerTxUrl` (Task 5) · `describeCryptoError` (Task 4) · `WalletUnlockDialog` (Task 8) · `useCryptoBalances` (Task 9)
- Produces: the `/wallet/modern/send` route; exported pure helper `sendStageIndex(status: string): number`

- [ ] **Step 1: Stage mapper test first** — `lib/crypto-wallet/__tests__/send-stages.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { SEND_STAGES, sendStageIndex } from "@/lib/crypto-wallet/send-stages"

describe("sendStageIndex", () => {
  it("orders backend statuses onto the visual stages", () => {
    expect(sendStageIndex("created")).toBe(0)      // Signing locally
    expect(sendStageIndex("submitted")).toBe(1)    // Submitted to the network
    expect(sendStageIndex("pending")).toBe(1)
    expect(sendStageIndex("confirmed")).toBe(SEND_STAGES.length) // all done
  })
  it("treats unknown statuses as still-submitting rather than crashing", () => {
    expect(sendStageIndex("weird-new-status")).toBe(1)
  })
})
```

Implement `lib/crypto-wallet/send-stages.ts`:

```ts
export const SEND_STAGES = [
  { key: "sign", label: "Signed on this device" },
  { key: "submit", label: "Submitted to the network" },
  { key: "confirm", label: "Confirmed on-chain" },
] as const

export function sendStageIndex(status: string): number {
  switch (status) {
    case "created": case "simulated": case "validated": return 0
    case "signed": case "submitted": case "pending": case "unknown": return 1
    case "confirmed": return SEND_STAGES.length
    case "failed": case "expired": return 1
    default: return 1
  }
}
```

- [ ] **Step 2: Build `SendFlow.tsx`.** One component, four screens driven by `step: "form" | "review" | "status"` plus the unlock modal. Anatomy:

  **Form screen** (inside `FlowShell` + `FlowHeader direction="out" title="Send crypto" subtitle="Signed locally on this device"`):
  - Network `ChoiceRow` — options from wallet accounts × enabled networks (`useCryptoContext().networks`), each `{ key: networkId, label: networkMetaFor(id)?.label ?? name, icon: NETWORK_ICON[key] }`; selecting resolves `accountId` from the account whose family matches.
  - Asset `ChoiceRow columns={2}` — balances on that account+network from `useCryptoBalances` (`sub` = available amount via `formatCryptoAmount`); zero-balance assets excluded; empty → `UnavailablePanel title="Nothing to send on this network" tone="muted"`.
  - Address field — `Input` restyled to the flow idiom: `"w-full rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 font-mono text-[13px] outline-none ring-1 ring-border/25 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 placeholder:font-sans"` with the validation problem as `"text-[12px] text-debit"` below (validate on blur + before advancing, using the account's `chainFamily`). Self-send (address equals the source account's address) → `InlineNotice tone="warning"`: `You're sending to this wallet's own address.` (allowed, warned).
  - `AmountField` — `unit={symbol}`, `maxDecimals={decimals}`, `maxSpend` from the balance, `problem` from `validateAmount`, `approx` = USD estimate when a price is known. Native-asset full-balance sends get `hint`: `Keep a little ${symbol} for the network fee.` (the backend's INSUFFICIENT_FUNDS remains authoritative).
  - Fee `ChoiceRow columns={2}` — only when the sponsorship config (from `cryptoBackendClient.getSponsorshipConfig`, cached via React Query) allows this network + operation: `{ key: "self", label: "You pay the network fee" }` / `{ key: "sponsored", label: "Worldstreet pays", sub: "When available" }`. Config disallows → the row is not rendered at all (spec §11: never assume from a checkbox).
  - `FlowCta` states its blocker: `Choose a network` → `Choose an asset` → `Enter a destination address` → `Fix the address` → `Enter an amount` → the amount problem verbatim → `Review transfer`. On press: `createIntent({ accountId, networkId, asset, to, amount, sponsorFees })` then `step = "review"`; failures render `SectionMessage` inline with `new-intent`/`retry` actions.

  **Review screen** — `RouteStrip from={{ label: "Your Worldstreet wallet", sub: truncatedFrom }} to={{ label: truncatedTo }} direction="out"`, then `DetailPanel` rows:
  - `Network` → meta label; `Asset` → symbol, plus for tokens a second row `Token contract` → `<AddressPill address={asset.identifier} />` (spec §7: identify the exact contract/mint)
  - `To` → `<AddressPill address={to} />`
  - `Amount` → `strong`, `tabular-nums`, exact display amount + symbol
  - `Network fee` → sponsored+prepared → `Worldstreet pays the network fee` (+ `≈ $x` from `estimatedCostUsd` when present); self-paid → `You pay the network fee` + simulation `gasEstimate` when present
  - `Expires` → live countdown `mm:ss` from `intent.expiresAt` (tick with `useElapsed`); at zero the CTA flips to `Quote expired — get a fresh one`, which calls `reset()` + re-creates from the kept form values (spec §13 INTENT_EXPIRED: never reuse).
  - Simulation policy: auto-run `simulateIntent()` on entering review. `simulationResult.ok === false` → `ErrorDetail message={"Simulation failed — this transfer would not succeed."} raw={simulationResult.error}` and the CTA stays disabled. Simulation *call* failing (RPC down) → `InlineNotice tone="warning"`: `Couldn't pre-check this transfer — the network provider is unavailable. You can still sign, but it may fail on-chain.` and the CTA remains enabled (fail-open with warning; validation errors from `validationResult.errors` are fail-closed).
  - `FlowCta label="Approve and sign locally"`; if the DEK is locked/expired at press time → open `WalletUnlockDialog` with `onUnlocked={() => submitIntent()}` (resume, don't restart).

  **Status screen** — `StatusScreen`:
  - `state` from intent status (`confirmed → "success"`, `failed`/`expired → "failure"`, else `"processing"`), `direction="out"`, `figure` = `-{amount} {symbol}`, `stages={[...SEND_STAGES]}` with `activeIndex` from `sendStageIndex` through `useStageProgress` (monotonic — no backwards jumps on odd poll orders), `txHash` from the transaction record, `reference` = intent id.
  - `primary` = success → `{ label: "View on " + meta.explorerName, href: explorerTxUrl(networkId, txHash) }` when the link resolves, else `{ label: "Done", onClick: resetToForm }`; failure → `{ label: "Try again", onClick: backToReviewOrForm }`. `secondary` = `{ label: "Back to wallet", href: "/wallet/modern" }`. Unknown network → simply omit the explorer primary (Task 5 returns null).
  - Sponsored path: `txHash` arrives via `sponsorship` polling (`getSponsorshipStatus`) — read it from `sponsorshipQuery.data?.txHash ?? record.txHash`.

- [ ] **Step 3: The route** — `app/wallet/modern/send/page.tsx` mirrors `app/wallet/modern/page.tsx` (11 lines, renders `<SendFlow />`; flag-off state comes from the component).

- [ ] **Step 4: Delete the old components**, fix imports (`grep -rn "ModernTransferFlow\|TransactionReview" components/ app/`).

**Edge cases handled here:** intent expiry pre-sign (countdown + fresh-quote CTA) · DEK expiring between review and sign (unlock modal resumes the submit) · double-submit (CTA `busy` during `isSubmitting`; `idempotencyKey` already sent by `useTransactionIntent:59`; DUPLICATE_REQUEST → `view-existing` shows the status screen for the existing intent) · pasted address with whitespace (trim in validation) · wrong-chain paste (per-family validators reject) · token with 0 decimals (`maxDecimals={0}`, `toBaseUnits` handles) · navigating away mid-poll (intent id in component state is lost, but the transaction lands in `/transactions` history via `use-unified-transactions` — acceptable; note in the status caption: `You can safely leave — this transfer continues in the background.`) · offline at any press (describeCryptoError's navigator.onLine gate).

- [ ] **Step 5: Typecheck, test, walkthrough (happy path on a testnet/devnet if available; expired-quote path by letting the countdown lapse), commit** — `git commit -m "feat(crypto): send flow on the flow kit — validation, review, local signing, staged status (spec §4, §7)"`

---

### Task 14: Sponsorship truth & messaging (spec §11)

**Files:**
- Modify: `components/crypto/send/SendFlow.tsx` (review-screen fee row logic)
- Modify: `hooks/crypto/useTransactionIntent.ts:56-78` (quote failure must not kill the transfer)
- Test: `hooks/crypto/__tests__/sponsorship-fallback.test.ts` (pure decision fn)

**Interfaces:**
- Consumes: `SponsorshipOperation` (`status`, `estimatedCostUsd`, `providerError`, `expiresAt`), `SPONSORSHIP_UNAVAILABLE` taxonomy entry (Task 4)
- Produces: `resolveFeePresentation(input: { requested: boolean; operation: SponsorshipOperation | null; quoteError: unknown }): { kind: "sponsored"; costUsd?: number } | { kind: "self-paid" } | { kind: "self-paid-fallback"; reason: string }` in `lib/crypto-backend/sponsorship.ts`

- [ ] **Step 1: Failing test:** requested + prepared operation → `sponsored` with cost; requested + quote threw `SPONSORSHIP_UNAVAILABLE` → `self-paid-fallback` with the taxonomy reason; requested + operation `expired` → `self-paid-fallback` (`The sponsorship offer expired — you'll pay the network fee.`); not requested → `self-paid`. Implement in `lib/crypto-backend/sponsorship.ts`. PASS.

- [ ] **Step 2: Make the quote non-fatal.** In `useTransactionIntent.create` (`:56-71`), wrap the `quoteSponsorship`/`prepareSponsorship` calls in try/catch: on failure return `{ intent, sponsorship: undefined, sponsorshipError: error }` instead of failing the whole mutation (today a sponsorship outage kills the transfer the user could have paid for). Thread `sponsorshipError` through the hook's return.

- [ ] **Step 3: Render truth in review.** Fee row value from `resolveFeePresentation`; `self-paid-fallback` also renders `InlineNotice tone="warning"` with the reason (Copy Deck `sponsor.unavailable` as the default). Sponsored countdown uses `min(intent.expiresAt, sponsorship.expiresAt)`.

**Edge cases handled here:** quote ok → prepare fails (caught by the same fallback) · sponsorship expiring before the intent (min-expiry countdown) · daily limit reached (backend returns SPONSORSHIP_UNAVAILABLE with its own message in `details` — surface it) · user un-checks sponsorship after a quote exists (simply ignore the operation; sign the direct path — `submitIntent` already branches on presence, make it branch on the user's final choice instead: pass `useSponsorship: boolean` into submit).

- [ ] **Step 4: Typecheck, test, commit** — `git commit -m "feat(crypto): sponsorship presentation from backend truth with self-paid fallback (spec §11)"`

---

# Phase 4 — Trading surfaces

### Task 15: Registry-driven modern spot (spec §8)

**Files:**
- Create: `lib/crypto-backend/spot-order.ts`
- Test: `lib/crypto-backend/__tests__/spot-order.test.ts`
- Modify: `components/trade/trade-client.tsx:163` (retain registry fields), `:278-281` + `:754-755` (remove the dead `modernSpotUnavailable`), `:315-320` (replace hardcoded order building)
- Modify: `components/trade/markets-rail.tsx:94-96` (quote label), `:69-71` (skeleton note)
- Modify: `components/trade/modern-jupiter-panel.tsx` (registry mints instead of fixed SOL/USDC)

**Interfaces:**
- Consumes: `getModernSpotMarkets` row shape (`client.ts:330-332`: `{ id, symbol, quote, networkId, venue, chartSymbol, chartSupported, price?, icon?, sellToken?, buyToken?, inputMint?, outputMint? }`), `createModernSpotIntent` (`:316`), `createModernSolanaSpotIntent` (`:334`), `toBaseUnits` (Task 6)
- Produces:
  - `type SpotOrderPlan = { kind: "evm"; input: Parameters<typeof cryptoBackendClient.createModernSpotIntent>[0] } | { kind: "solana"; input: Parameters<typeof cryptoBackendClient.createModernSolanaSpotIntent>[0] } | { kind: "unavailable"; reason: string }`
  - `buildSpotOrderPlan(row: ModernSpotMarketRow, side: "buy" | "sell", amountUsd: number, price: number): SpotOrderPlan`

- [ ] **Step 1: Failing tests** — build a plan for a 0x row (Arbitrum WETH: sellToken/buyToken present → correct orientation per side, `sellAmountBaseUnits` derived through `toBaseUnits` with the **known-token decimals table**, `slippagePercentage: 0.01`, an `idempotencyKey`); a Jupiter row (inputMint/outputMint → `slippageBps: 100`); a 0x row whose token is missing from the decimals table → `{ kind: "unavailable", reason: /precision/ }`; a row missing token identifiers → `unavailable`.

- [ ] **Step 2: Implement.** Known-decimals table (extensible; unknown = refuse, never guess):

```ts
/** Until the registry carries decimals (backend request filed — see Backend
 *  Asks below), refuse pairs whose token precision we don't know. */
const TOKEN_DECIMALS: Record<string, number> = {
  // networkId:address (lowercased) → decimals
  "arbitrum-one:0xaf88d065e77c8cc2239327c5edb3a432268e5831": 6,   // USDC
  "arbitrum-one:0x82af49447d8a07e3bd95bd0d56f35241523fbab1": 18,  // WETH
  "ethereum-mainnet:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 6, // USDC
  "ethereum-mainnet:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": 18, // WETH
}
```

Orientation: `side === "buy"` sells the quote token (the `quote` field names it) and buys the base; `sell` reverses. Amount: buys are quoted in USD → base-units of the quote token; sells convert `amountUsd / price` → base-units of the base token via `toBaseUnits((amountUsd / price).toFixed(baseDecimals), baseDecimals)`.

- [ ] **Step 3: Rewire trade-client.** At `:163`, keep `quote`, `sellToken`, `buyToken`, `inputMint`, `outputMint`, `chartSymbol` on the mapped row (they're currently dropped). Replace `:315-320` with:

```tsx
const plan = buildSpotOrderPlan(current, side, amt, price)
if (plan.kind === "unavailable") { setSubmitError(plan.reason); return }
const intent = plan.kind === "evm"
  ? await cryptoBackendClient.createModernSpotIntent(plan.input)
  : await cryptoBackendClient.createModernSolanaSpotIntent(plan.input)
```

Delete `modernSpotUnavailable` (`:278`) and its `canSubmit` term (`:279-281`) and dead label branch (`:754-755`). **Pre-submit gating replaces the submit-time throw:** compute `const spotPlan = market === "spot" && current ? buildSpotOrderPlan(current, side, Math.max(amt, minOrder), price) : null` and when `spotPlan?.kind === "unavailable"`, render `AnnouncementBanner tone="warning" title="This pair isn't available on the Worldstreet wallet yet" detail={spotPlan.reason} action={canChoose ? { label: "Use legacy wallet", onClick: () => setWalletSource("legacy") } : undefined}` above the ticket, and the submit label becomes `Pair unavailable` (disabled). The `includes("ETH")` guard and both Arbitrum addresses are gone.

- [ ] **Step 4: Rail correctness.** `markets-rail.tsx:94-96`: quote suffix `market === "futures" ? "PERP" : (("quote" in m && m.quote) ? String(m.quote).toUpperCase() : "USDC")`. A quote is not a fill (spec §8): after submit, the order's terminal state comes only from the intent status polling — audit that the modern spot path pipes the created intent into the same status handling the transfer uses (`useTransactionIntent`-style polling or the trade client's own; whichever exists, the "filled/complete" UI state must key off `confirmed`).

- [ ] **Step 5: Jupiter panel** — `modern-jupiter-panel.tsx` takes a registry row prop (`inputMint`/`outputMint` from the selected market) instead of its fixed SOL/USDC mints; keep `slippageBps: 100` as the default but read it from one shared constant in `spot-order.ts`.

**Edge cases handled here:** empty registry → the rail's existing empty rendering + ticket `AnnouncementBanner` (`Markets are unavailable right now`) · selected market vanishing on refresh → `list.find(byId)` misses → same banner, selection preserved · `price ?? 0` rows → `chartSupported` filter already drops chartless rows (`:163`); a zero price with `sell` side → `buildSpotOrderPlan` returns `unavailable` (`division by zero` guard) · icon 404 → `CoinAvatar` monogram (already) · decimals unknown → refuse with honest copy, never a mis-scaled order (the catastrophic failure mode this task exists to prevent).

- [ ] **Step 6: Typecheck, test, walkthrough (ETH pair still works; a non-ETH registry pair now works or banners honestly), commit** — `git commit -m "feat(trade): registry-driven modern spot with pre-submit gating (spec §8)"`

---

### Task 16: Perp funding — staged, idempotent, resumable (spec §6, §10)

**Files:**
- Rewrite: `components/trade/modern-funding-panel.tsx`
- Test: `lib/crypto-backend/__tests__/funding-stages.test.ts`

**Interfaces:**
- Consumes: `createHyperliquidDepositIntents` (`client.ts:346` — returns `{ networkId, amount, intents: CryptoTransactionIntent[] }`), `getHyperliquidAccount`, `createHyperliquidIntent`/`submitHyperliquidIntent`, `StatusScreen`/`StageList`, `sendStageIndex` (Task 13)
- Produces: `lib/crypto-backend/funding-stages.ts` — `FUNDING_STAGES` (`["USDC sent from your wallet", "Bridge transfer confirmed", "Trading account credited"]`) + `fundingStageIndex(input: { intentStatuses: string[]; accountCredited: boolean }): number`; localStorage resume record `ws:funding-pending:{userId}` `{ intentIds: string[]; amount: number; startedAt: number }`

- [ ] **Step 1: Failing test for `fundingStageIndex`:** all intents `created/submitted` → 0; all `confirmed`, not credited → 1; credited → `FUNDING_STAGES.length`; any `failed` → the index where it failed (the StageList shows progress honestly; the StatusScreen state goes `failure`). Implement. PASS.

- [ ] **Step 2: Rebuild the panel** as three **separate** `ResponsiveModal` flows behind three distinct triggers (spec §10: deposit/bridge · fund/transfer · withdraw — never one blended form):
  - **Deposit (bridge):** `AmountField unit="USDC"` + `InlineNotice tone="warning"`: Copy Deck `funding.notInstant` → `FlowCta` → sign each returned intent (existing signing code) → `StatusScreen` with `FUNDING_STAGES`, `activeIndex` from polling intent statuses (5s) + `getHyperliquidAccount` until `accountCredited` (balance delta ≥ amount or `ready` flips). Persist the resume record on create; clear on terminal state.
  - **Fund/transfer (spot↔perps):** its own modal, `AmountField` + direction `Segmented` (`Spot → Perps` / `Perps → Spot`), sign+submit via the Hyperliquid intent, single-stage `StatusScreen`.
  - **Withdraw:** own modal, destination display (the wallet's own EVM address — state it), amount, review `DetailPanel`, sign, `StatusScreen`.
  - Idempotency: generate the `idempotencyKey` **when the modal opens**, keep it for every retry of that attempt (so a retry after a network blip can't double-deposit), regenerate only on explicit new attempt. CTA `busy` during submission blocks double-click.
  - Resume: on panel mount, read the pending record; if present, render the deposit `StatusScreen` immediately (re-poll the intent ids via `getIntent`) with `secondary: { label: "Dismiss", onClick: clearRecord }`.

**Edge cases handled here:** stage 1 confirmed / stage 2 pending across a page reload (resume record) · duplicate submission (sticky idempotency key + DUPLICATE_REQUEST → `view-existing` renders the same status screen) · account never crediting (after 10 min of polling, `notice`: `The bridge is taking longer than usual. Your funds are safe — the deposit continues in the background.` and `autoUpdating` stays on) · partial multi-intent failure (one intent fails → `failure` state naming the failed stage, retry re-signs only unconfirmed intents).

- [ ] **Step 3: Typecheck, test, commit** — `git commit -m "feat(trade): staged, idempotent, resumable perp funding flows (spec §10)"`

---

### Task 17: Futures parity + venue-label scrub (spec §9)

**Files:**
- Modify: `components/trade/trade-client.tsx` (modern futures ticket), `components/trade/modern-funding-panel.tsx` (labels), any file matching the grep below
- Test: manual parity checklist (this task is an audit-and-fill)

**Interfaces:**
- Consumes: `HyperliquidMarket` (`maxLeverage`, `szDecimals`, `onlyIsolated`), `HyperliquidAccount` (`positions`, `openOrders`, `balances`), `createHyperliquidIntent` (intent types per `docs/CRYPTO-BACKEND-FRONTEND-INTEGRATION-PLAN.md` — confirm the exact `intentType` strings there before wiring)
- Produces: modern-mode futures ticket at parity with the spec §9 checklist

- [ ] **Step 1: Audit.** In the modern path (`usingModern` branches of trade-client), check off each spec §9 item and list gaps: market selection ✓ (rail) · buy/sell ✓ · market/limit where supported · quantity+price · leverage control (cap at the market's `maxLeverage`; hide for `onlyIsolated` markets if cross-margin UI exists) · reduce-only toggle · estimated fees + liquidation warning (render the backend's numbers only — no client-side liquidation math; if the intent summary lacks them, show `InlineNotice tone="warning"`: `Check your liquidation price before confirming — high leverage can be liquidated by small moves.`) · review→sign→submit ✓ (intents) · open orders, fills, positions, cancel (from `getHyperliquidAccount` polling; cancel = its own intent, signed like orders).

- [ ] **Step 2: Fill the gaps found**, smallest-first, each behind the existing `usingModern` guard so the legacy ticket is untouched (Global Constraint).

- [ ] **Step 3: Venue scrub.** `grep -rn "Hyperliquid" components/ --include=*.tsx` — every **user-visible string** (not identifiers/comments) becomes venue-neutral: `Hyperliquid deposit` → `Fund trading account`, `Hyperliquid account` → `Trading account`, etc. The `venue` field may still render in *data* positions (a provider chip in market rows is metadata, not an implementation assumption).

- [ ] **Step 4: Typecheck + walkthrough (place/cancel a testnet order both modes) + commit** — `git commit -m "feat(trade): modern futures parity and venue-neutral labels (spec §9)"`

---

# Phase 5 — Security surfaces

### Task 18: Key export hardening (spec §12)

**Files:**
- Rewrite: `components/crypto/WalletKeyExportPanel.tsx`
- Test: none (uses Task 7's KeyReveal; logic unchanged)

**Interfaces:**
- Consumes: `AlertDialog` (`components/ui/alert-dialog.tsx` — currently unused), `KeyReveal` (Task 7), `CardShell`/`CardHeader`, `InlineNotice`, existing per-chain export decryption
- Produces: export gated behind an explicit confirmation; keys never rendered un-blurred by default

- [ ] **Step 1: Restructure:** `CardShell` + `CardHeader title="Export private keys" subtitle="A local operation — keys are decrypted on this device only"`. Body: permanent `InlineNotice tone="warning"` with Copy Deck `export.warning`. Per-account rows (`ListRow` shape) with a `Reveal key` pill.
- [ ] **Step 2: Confirmation gate:** pressing `Reveal key` opens `AlertDialog`: title `Reveal your {network} private key?`, description = the warning copy + `Worldstreet will never ask you for this key.`, destructive-styled confirm `I understand — reveal it`. Only on confirm does the panel decrypt (existing code) and render `KeyReveal label={symbol} value={key} network={networkLabel}` — blurred until its own Reveal, auto-re-blur at 45s (Task 7).
- [ ] **Step 3: Hygiene:** wipe decrypted key material from component state on panel unmount and on the DEK lock event; keep the a11y-honest structure (no fake `aria-modal` on inline divs — the old `:63` lie disappears with the rewrite); keys rendered in `font-mono` explicitly.

**Edge cases handled here:** DEK TTL expiring before decrypt → `WalletUnlockDialog` with `onUnlocked` resuming the reveal · clipboard copy allowed but flagged (`Copied — clear your clipboard when you're done` flip-label) · screen-share safety via blur-by-default.

- [ ] **Step 4: Typecheck + walkthrough + commit** — `git commit -m "feat(crypto): confirmation-gated, blur-by-default key export (spec §12)"`

---

### Task 19: Security, recovery & provisioning panels — DS restyle + safe destructive actions

**Files:**
- Rewrite: `components/crypto/CryptoSecurityPanel.tsx`, `components/crypto/RecoveryPanel.tsx`, `components/crypto/WalletChainProvisioningPanel.tsx`
- Test: none (logic untouched; presentation + confirmations only)

**Interfaces:**
- Consumes: `CardShell`/`CardHeader`/`ListRow`/`Skel`, `SectionMessage` (Task 7), `AlertDialog`, `AnnouncementBanner`, `StageList`, existing `useWalletSecurity` operations
- Produces: DS-conformant `#security` section for the wallet home (Task 10)

- [ ] **Step 1: CryptoSecurityPanel:** `CardShell` + `CardHeader title="Security" badge={<span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">v{securityVersion}</span>}`. Inputs → the flow input idiom (`"rounded-xl bg-surface-sunken/70 ring-1 ring-border/25 …"`, from Task 13). Rotation requires passphrase + recovery secret (unchanged) but adds an `AlertDialog` confirm: `Rotate your wallet encryption? Every account key is re-encrypted with a fresh key. Your addresses don't change.` Devices: `ListRow` per device (title = label, subtitle = platform + last seen, right = `Revoke` in `text-debit`), revoke behind `AlertDialog` (`Revoke {label}? It will no longer be able to unlock this wallet.`) — replaces the bare-text revoke at `:93`. All `{message}` `<p>`s → `SectionMessage`. Recovery-secret inputs get a standing `InlineNotice tone="warning"`: `Only enter your recovery secret for security changes you started yourself.` (the honest middle ground for the spec's keep-it-offline tension).
- [ ] **Step 2: RecoveryPanel:** same card treatment; the recovery ceremony renders as a `StageList` (`["Verify recovery secret", "Re-wrap wallet key", "Confirm with the service"]`) instead of a flat button + message.
- [ ] **Step 3: WalletChainProvisioningPanel:** replace the raw `amber-500` section (`:38`) with `AnnouncementBanner tone="warning" title="New networks are available for your wallet" detail="Add them to start using ${missingFamilies.join(", ")}." action={{ label: "Add networks", onClick: openForm }}`; the form itself in the flow input idiom, completion → `SectionMessage success`.
- [ ] **Step 4: Typecheck + walkthrough (light + dark; confirm both AlertDialogs) + commit** — `git commit -m "feat(crypto): DS-conformant security panels with confirmed destructive actions"`

---

### Task 20: Backup restore validation (spec §12)

**Files:**
- Modify: `lib/crypto-wallet/local-storage.ts` (backup export gains a checksum; restore validates)
- Modify: `components/crypto/CryptoSecurityPanel.tsx` (restore confirmation)
- Test: `lib/crypto-wallet/__tests__/backup-validation.test.ts`

**Interfaces:**
- Consumes: the `worldstreet-encrypted-wallet-backup-v1` format, Web Crypto `crypto.subtle.digest`
- Produces: `validateBackup(input: { backup: unknown; expectedWalletId: string; expectedUserId: string }): Promise<{ ok: true; warnings: string[] } | { ok: false; problem: string }>`

- [ ] **Step 1: Failing tests:** rejects wrong `format` string · rejects a backup whose `walletId` ≠ current (`This backup belongs to a different wallet.`) · rejects userId mismatch · rejects empty `accounts`/`envelopes` · rejects a tampered payload when a `checksum` field is present (SHA-256 over the canonical JSON of the package body) · accepts a legacy checksum-less backup **with** a warning (`This backup predates integrity checks.`). Implement `validateBackup` + add checksum computation to the export path. PASS.
- [ ] **Step 2: Restore UX:** file-picked JSON → `validateBackup` → problems render `SectionMessage` (no partial state written) → on ok, `AlertDialog`: `Replace the wallet package on this device? Your current local package is overwritten. Your funds and addresses are unaffected — this only changes the encrypted copy stored in this browser.` → confirm writes to IndexedDB (existing code) → success `SectionMessage` + prompt to unlock.

**Edge cases handled here:** corrupted/truncated JSON (parse failure → `That file isn't a Worldstreet backup.`) · newer format version (`format` mismatch names the version and says to update the app) · restoring while unlocked (lock the DEK first — force re-unlock against the restored package so a stale in-memory key can't sign against mismatched ciphertext).

- [ ] **Step 3: Typecheck, test, commit** — `git commit -m "feat(crypto): integrity-validated, confirmed backup restore (spec §12)"`

---

### Task 21: Guided setup flow + partial-setup resume (spec §3)

**Files:**
- Rewrite: `components/crypto/WalletSetupFlow.tsx`
- Test: `lib/crypto-wallet/__tests__/passphrase-strength.test.ts`

**Interfaces:**
- Consumes: `createSelfCustodialWallet` (get-or-creates the backend wallet — safe to re-run after a partial failure), `StageList`, `ResponsiveModal` (recovery modal), `AddressPill`, `WeightBar` (strength meter fill), `FlowCta`
- Produces: `passphraseStrength(passphrase: string): { score: 0 | 1 | 2 | 3; label: "Too short" | "Weak" | "Good" | "Strong" }` in `lib/crypto-wallet/passphrase-strength.ts`; a 4-step setup: Intro → Passphrase → Creating → Done(addresses)

- [ ] **Step 1: Strength helper, test-first:** score 0 under 12 chars (hard floor — spec/setup requirement); +1 at ≥12, +1 for 3 of 4 character classes or ≥20 chars, +1 for ≥16 chars with classes. No zxcvbn dependency. PASS.
- [ ] **Step 2: Rebuild as steps** inside the existing card slot:
  - **Intro:** `EmptyState`-style explainer (icon, `title="Create your Worldstreet wallet"`, three `"text-[13px] text-muted-foreground"` bullets: keys are generated on this device · Worldstreet stores only encrypted data · your passphrase + recovery secret are the only ways in) + `FlowCta label="Get started"`.
  - **Passphrase:** two password `Input`s (flow idiom), strength meter (`WeightBar pct={score / 3 * 100}` + label), mismatch line `"text-[12px] text-debit"`, CTA states blocker (`At least 12 characters` / `Passphrases don't match` / `Create wallet`).
  - **Creating:** `StageList stages={[{key:"keys",label:"Generating keys on this device"},{key:"account",label:"Provisioning wallet accounts"},{key:"encrypt",label:"Encrypting your wallet package"},{key:"commit",label:"Storing the encrypted package"}]}` driven by a progress callback threaded through `createSelfCustodialWallet` (add an optional `onStage?: (key: string) => void` parameter to `wallet-setup.ts:38`'s options). `beforeunload` warning while committing.
  - **Recovery modal:** keep the existing blocking modal exactly (it's spec-compliant) but port its shell to `ResponsiveModal` with `showCloseButton={false}` and no dismiss-on-outside (the hand-rolled overlay at `:12-13` goes away); copy + download + mandatory checkbox unchanged; replace `text-amber-600` (`:114`) with `text-warning`.
  - **Done:** `CardHeader title="Your wallet is ready"` + one `ListRow` per chain (network label + `AddressPill`) — spec §3.8's addresses screen — and `FlowCta label="Open your wallet"`.
- [ ] **Step 3: Partial-setup resume.** In `ModernWalletPage`'s state resolution: wallet exists (`wallet.data`) but `getWalletPackage` 404s → render the setup flow at the Passphrase step with an `InlineNotice tone="warning"`: `Your wallet was created but setup didn't finish. Pick a passphrase to finish securing it.` (`createSelfCustodialWallet` get-or-creates, so re-running completes cleanly with fresh keys — verify that behavior in `wallet-setup.ts` and note it in a comment at the resume site).

**Edge cases handled here:** tab closed after backend wallet creation but before commit (resume path) · clipboard-only recovery-secret capture (download offered as well) · commit failure mid-stage (`SectionMessage` + the same resume state on retry) · insecure context (existing `wallet-setup.ts` guard) surfaced as `UnavailablePanel title="A secure connection is required" reason="Open this page over HTTPS to create a wallet."`.

- [ ] **Step 4: Typecheck, test, walkthrough (fresh setup end-to-end on staging), commit** — `git commit -m "feat(crypto): guided wallet setup with strength meter, staged progress, and resume (spec §3)"`

---

# Phase 6 — Mode-aware data & final hygiene

### Task 22: Every consumer branches on the selected mode (spec §1, §5)

**Files:**
- Modify: `hooks/useWalletBalances.ts:86-105` · `hooks/use-unified-transactions.ts` (the backend-flag gate) · verify consumers: `components/navbar-actions.tsx`, `components/assets/assets-client.tsx`, `components/swap/swap-client.tsx`, `components/dashboard/user-card.tsx`
- Test: extend `lib/__tests__/wallet-provisioning.test.ts` with the gate predicate

**Interfaces:**
- Consumes: `useWalletMode()` (Task 3)
- Produces: `modernDataEnabled(input: { modernEnabled: boolean; mode: WalletMode }): boolean` in `lib/wallet-mode.ts` (trivial, but it's the single named gate every hook shares)

- [ ] **Step 1:** Add + test `modernDataEnabled` (`modernEnabled && mode === "modern"`).
- [ ] **Step 2:** In `useWalletBalances` replace `const backendEnabled = isCryptoBackendEnabled && isLoaded && isSignedIn` (`:89`) with `const { mode } = useWalletMode()` + `const backendEnabled = modernDataEnabled({ modernEnabled: isCryptoBackendEnabled, mode }) && isLoaded && isSignedIn`. The legacy branch (`fetchLegacyBalances`, `/api/wallet/balances`) is now reachable again for legacy-mode users — the spec §5 requirement the flag-only gate broke. Same change in `use-unified-transactions.ts`.
- [ ] **Step 3:** Walk the four consumers in legacy mode (balances come from the legacy endpoint; assets page uses its existing source) and modern mode (crypto snapshot). Confirm the navbar Est. Value follows the selector live.
- [ ] **Step 4: Typecheck, test, commit** — `git commit -m "feat(wallet): balance and history sources follow the selected wallet mode (spec §1, §5)"`

---

### Task 23: Final sweep — hygiene, verification, acceptance

**Files:**
- Modify: leftovers surfaced by the greps below
- Test: full suite + the spec §14 acceptance checklist

- [ ] **Step 1: Grep sweep** — each must come back clean (or justified):

```bash
grep -rn "amber-500\|amber-600\|text-amber" components/crypto/            # tokens only
grep -rn "space-y-" components/crypto/                                     # gap-* idiom
grep -rn "rounded-md\|rounded-lg border\b" components/crypto/              # DS radii
grep -rn "bg-surface\b" components/crypto/                                 # undefined token
grep -rn "console.log\|console.debug" components/crypto/ lib/crypto-wallet/ # no key/secret logging
grep -rn "Hyperliquid" components/ --include=*.tsx                         # venue labels (data positions only)
grep -rn "ModernTransferFlow\|TransactionReview" .                         # deleted components
```

- [ ] **Step 2: Run the machine checks:**

```bash
pnpm typecheck && pnpm test && pnpm verify:crypto && pnpm build
```

`verify:crypto` also enforces the Privy import boundary across all crypto modules — it must stay green after every phase, but this is the final gate.

- [ ] **Step 3: Walk the spec §14 acceptance checklist** (all 12 items) on staging with three personas: a fresh Clerk account (modern-only — no Privy wallet created, no migration notice, no mode toggle), a legacy-owning account (toggle + notice + both data sources), and a legacy account with the crypto flag off (today's behavior, byte-for-byte).

- [ ] **Step 4: Commit any sweep fixes** — `git commit -m "chore(crypto): design-token and label sweep; acceptance checklist pass"`

---

# Edge-Case Register (cross-task; each row names its owner)

| # | Edge case | Handling | Task |
|---|---|---|---|
| 1 | New user must get no Privy wallet, even on a flaky lookup | Check-first provisioning; inconclusive → don't create | 2 |
| 2 | Kill switch (`CRYPTO_ENABLED=false`) mustn't brick signup | `shouldProvisionLegacy` falls back to legacy provisioning | 2 |
| 3 | `?wallet=legacy` deep link for a modern-only user | `resolveWalletMode` overrides to modern | 3 |
| 4 | localStorage blocked (private mode) | All storage reads/writes in try/catch; session-scoped fallback | 3, 12 |
| 5 | Clerk session expiry mid-flow | 401 → forced token refresh → one retry → taxonomy message | 4 |
| 6 | Wrong passphrase vs corrupted package | `WalletUnlockError` reasons; different copy + backup hint | 4, 8 |
| 7 | Offline | `navigator.onLine` gate in the taxonomy; CTA blockers | 4, 13 |
| 8 | Unknown backend network id | No explorer link rather than a wrong one; family/chainId fallback | 5 |
| 9 | Cross-chain address paste | Per-family validators reject with plain-language copy | 6, 13 |
| 10 | Float drift on amounts | BigInt-only `toBaseUnits`; display via `formatCryptoAmount` | 6 |
| 11 | Balance refresh failure zeroing the UI | `keepPreviousData` + setQueryData-on-success only | 9 |
| 12 | One network's provider down | Per-network `unavailable` notice; rest render; last snapshot kept | 9, 10 |
| 13 | Asset without a live USD price | Excluded from hero total with footnote, never NaN | 10 |
| 14 | Wallet family not provisioned (older wallet) | Receive hides the network + points to provisioning; panel backfills | 11, 19 |
| 15 | Migration notice for unclassifiable users | `legacyWalletExists === null` → no notice | 12 |
| 16 | Intent expires before signing | Live countdown; expired → fresh-intent CTA; never reuse | 13 |
| 17 | DEK TTL expires mid-flow | Unlock modal with `onUnlocked` resume | 8, 13, 18 |
| 18 | Double submit | Sticky idempotency keys + busy CTAs + DUPLICATE_REQUEST → view existing | 13, 16 |
| 19 | Simulation service down vs simulation failed | Fail-open with warning vs fail-closed with `ErrorDetail` | 13 |
| 20 | Sponsorship quote/prepare failure | Non-fatal fallback to self-paid with reason | 14 |
| 21 | Sponsorship expiring before the intent | Countdown on `min(expiries)` | 14 |
| 22 | Token decimals unknown to the client | Refuse the pair honestly — never guess a scale | 15 |
| 23 | Selected market vanishing from the registry | Banner + preserved selection; no crash on `find` miss | 15 |
| 24 | Sell at price 0 | `buildSpotOrderPlan` → unavailable (no division blowup) | 15 |
| 25 | Bridge deposit interrupted by reload | localStorage resume record re-opens the status screen | 16 |
| 26 | Bridge slower than expected | 10-min notice, polling continues, funds-are-safe copy | 16 |
| 27 | Backup from another wallet/user, or tampered | `validateBackup` rejects; checksum on new exports | 20 |
| 28 | Restore while unlocked | DEK locked first; re-unlock against restored package | 20 |
| 29 | Setup dies between wallet create and package commit | Resume state re-runs get-or-create setup | 21 |
| 30 | Multi-tab package rotation | Commit conflict (409) → refetch package + re-unlock prompt; document in `useWalletSecurity` error path via taxonomy `retry` | 4, 19 |
| 31 | Insecure context / IndexedDB unavailable | `UnavailablePanel` with actionable copy | 10, 21 |
| 32 | Legacy user in legacy mode after the flag flips on | Mode-aware gates restore the legacy data path | 22 |

# Backend Asks (file with Tom — none block Phase 0–2)

1. **Registry decimals:** add `sellTokenDecimals`/`buyTokenDecimals` (and Solana mint decimals) to `/trading/spot/markets` rows so the client-side `TOKEN_DECIMALS` table (Task 15) can be deleted.
2. **USD values:** per-balance `usdValue` on the balance snapshot would remove the client-side price join (Task 10).
3. **Error details contract:** confirm `INSUFFICIENT_FUNDS` carries `{ available, requested }` in `details` (Task 4 renders them when present).
4. **Explorer URLs:** confirm the canonical backend network-id strings for sui/ton/tron mainnets (Task 5's map currently covers the ids visible in the client types).

# Self-Review (performed while writing)

- **Spec coverage:** §1→T2/T3/T22 · §2→T12 · §3→T21 · §4→T13 (+T8 unlock) · §5→T9/T10/T22 · §6→T11/T16 · §7→T6/T13 · §8→T15 · §9→T17 · §10→T16 · §11→T14 · §12→T18/T20 (+device changes T19) · §13→T4 (+SectionMessage T7) · §14→T23. No orphaned requirements found.
- **Type consistency:** `legacyWalletExists: boolean | null` (T2) is the name consumed in T3/T12/T22; `useWalletMode()` returns `{ mode, canChoose, setMode }` everywhere; `describeCryptoError` actions match `SectionMessage`'s switch; `CryptoBalanceResult` retains its T9 shape for T10; `buildSpotOrderPlan`'s `SpotOrderPlan` kinds match T15's trade-client branch.
- **Placeholder scan:** the two deliberately open-ended points are named as such with a concrete discovery step (T10's price-source extraction points at the exact file to read; T17 is an audit task by nature with its checklist enumerated). No "TBD"/"handle errors appropriately" anywhere.
