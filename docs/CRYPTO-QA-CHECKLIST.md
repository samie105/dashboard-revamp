# Crypto Wallet — Manual QA Checklist

**Status:** Not yet executed. This checklist substitutes for the Task 23 spec
§14 staging walkthrough, which could not be run in the implementation
environment (no live Clerk session, no staging backend reachable
interactively). It consolidates:

1. The 12 acceptance items from `docs/MODERN-WALLET-FRONTEND-INTEGRATION-GUIDE.md`
   §14, organized by the three personas the controller specified.
2. The live-verification items deferred by earlier tasks (Tasks 4, 8, 9, 11,
   13, 14, 15, 16, 18, 21, 22) that only a running app can confirm.

Run this on staging with a real Clerk session before sign-off. Check every
box; do not check a box on inference — only on observed behavior.

## Setup — how to reach each persona

Wallet mode/visibility is driven by three flags/values, all read in
`lib/crypto-backend/config.ts` and `lib/wallet-mode.ts`:

- `NEXT_PUBLIC_CRYPTO_ENABLED` — the kill switch. `false`/unset = Persona C
  (today's legacy behavior, byte-for-byte). `true` = modern wallet system is
  live for Personas A/B.
- `NEXT_PUBLIC_LEGACY_PRIVY_ENABLED` — defaults to enabled; leave it on for
  A/B so the dual-run logic (`resolveWalletMode`, `shouldShowMigrationNotice`)
  is actually exercised.
- `legacyWalletExists` (backend-reported, per user) — `false`/unset for a
  fresh Clerk account with no prior Privy wallet (Persona A); `true` for an
  account with an existing Privy wallet (Persona B). A `null` (inconclusive
  lookup) should behave like Persona A for provisioning and migration-notice
  purposes — worth a spot-check but not its own persona.

| Persona | `CRYPTO_ENABLED` | Clerk account | Expect |
|---|---|---|---|
| A — Fresh | `true` | New signup, never had Privy | Modern-only. No mode toggle, no migration notice, no Privy wallet ever provisioned. |
| B — Legacy-owning | `true` | Existing account with a Privy wallet | Mode toggle visible; migration notice visible until dismissed; both data sources reachable. |
| C — Flag off | `false` (or unset) | Any account | Today's legacy behavior, unchanged. No modern UI surfaces reachable. |

---

## Persona A — Fresh Clerk account (modern-only)

No Privy wallet exists or is ever created; no toggle; no migration notice.

- [ ] **[§14-1]** Signup provisions only a modern Worldstreet wallet — confirm
      no Privy wallet is created (check the account's wallet list / backend
      record, not just the UI).
- [ ] **[§14-4]** No migration notice appears anywhere (login banner or
      notifications) — there is nothing to migrate from.
- [ ] No wallet-mode toggle is rendered in the navbar or on `/trade` — a
      user with nothing to select gets no selector (`canChooseWalletMode`
      false).
- [ ] **[§14-5]** Wallet setup: recovery secret is shown once in a blocking
      modal, with copy/download controls and a confirmation checkbox; the
      flow cannot be completed without checking it. (Deferred item: setup
      Creating → recovery-modal → Done, see below.)
- [ ] **[§14-6]** Modern balances render native assets and tokens with icons
      and network labels for every provisioned chain.
- [ ] **[§14-7]** Modern spot market list is populated from the backend
      registry (no hardcoded catalogue), shows provider icons with monogram
      fallback, and only chart-supported markets are chartable.
- [ ] **[§14-8]** A transfer of a native asset and of a supported token both
      work end to end (see the send-flow deferred items below).
- [ ] **[§14-9]** A spot order and a futures order both go
      review → local sign → submit → status, with no "complete" shown before
      backend confirmation.
- [ ] **[§14-10]** Perpetual-account deposit, funding transfer, and withdrawal
      are three visibly distinct flows/screens, not one collapsed action.
- [ ] **[§14-11]** Sponsorship is only shown when the backend intent says
      it's available; when unavailable, the reason and user-paid fallback are
      shown, not a bare failure.
- [ ] **[§14-12]** Open devtools/network tab during setup, unlock, export,
      and a signed transaction — confirm no plaintext key, passphrase,
      recovery secret, or provider secret appears in any request body or
      browser console log.

## Persona B — Legacy-owning account (toggle + notice + both sources)

- [ ] **[§14-2]** Wallet-mode toggle is visible (navbar and `/trade`) and
      switches between modern and legacy.
- [ ] **[§14-3]** Legacy Privy wallet is fully functional and visually
      unchanged from its pre-modern-wallet behavior — balances, transfers,
      trading all still work under legacy mode.
- [ ] **[§14-4]** Migration notice appears on login and in notifications;
      copy is the plain-language rewrite approved 2026-08-29 ("You have a
      new Worldstreet wallet. …not even Worldstreet can open it") — it
      deliberately replaces the spec §2 verbatim wording, but must still
      never imply Worldstreet can recover or access private keys;
      dismissing it in one surface suppresses it in the other (see
      deferred item below).
- [ ] Items **§14-5 through §14-12** (setup, balances, markets, transfers,
      orders, funding stages, sponsorship, secret hygiene) all re-verified
      under modern mode for this account, same as Persona A.
- [ ] Switching mode does not leak state across modes — e.g. a modern-mode
      balance refresh does not overwrite what legacy mode is showing, and
      vice versa (spec §5: "must not use the legacy Privy balance hook").
- [ ] All requests (balance, deposit, withdrawal, transfer, order) carry the
      selected wallet mode, so a modern action cannot silently hit the
      legacy wallet or vice versa (spec §1).

## Persona C — Legacy account, crypto flag off (today's behavior, unchanged)

- [ ] With `NEXT_PUBLIC_CRYPTO_ENABLED=false`, no wallet-mode toggle, no
      migration notice, and no modern wallet route/panel is reachable by
      URL or navigation.
- [ ] Legacy wallet flows (balances, deposits, transfers, trading) behave
      identically to the pre-modern-wallet baseline — spot-check against a
      pre-flag build or prior release notes if available.
- [ ] `shouldProvisionLegacy` path: a brand-new signup with the flag off
      still receives a legacy Privy wallet (kill-switch must not brick
      signup — Edge Case #2).

---

## Deferred live-verification items (from earlier tasks, all personas as noted)

These require a running app against a real/staging backend and could not be
exercised during implementation. Each names the task that deferred it.

- [ ] **Unlock — wrong vs. right passphrase** (T4/T8): wrong passphrase shows
      the taxonomy error copy without revealing which factor was wrong beyond
      what's safe; correct passphrase unlocks and resumes the caller's
      action via `onUnlocked`. Also test the no-passphrase-yet (recovery-only)
      wallet path in `WalletUnlockDialog`.
- [ ] **Wallet-mode toggle in navbar + `/trade`** (Personas A vs. B): absent
      for a fresh account, present and functional for a legacy-owning
      account.
- [ ] **Deposit modal per-network addresses** (T6/T19): confirm EVM L2s
      correctly reuse the same address as mainnet EVM (not a distinct
      per-L2 address), and that non-EVM networks show their own correct
      address with QR + copy.
- [ ] **Migration notice — both surfaces + dismiss sync** (T12): dismissing
      the notice on login syncs to notifications (and vice versa) without a
      page reload; a `legacyWalletExists === null` (inconclusive) account
      never shows it (Edge Case #15).
- [ ] **Send flow — countdown expiry and DEK-lapse resume** (T13/T18): let an
      intent's countdown reach zero and confirm the fresh-intent CTA appears
      (never a reused expired intent); separately, let the DEK TTL lapse
      mid-review and confirm the unlock modal appears with `onUnlocked`
      resuming the same review screen.
- [ ] **Sponsored send — txHash via sponsorship poll** (T14): a sponsored
      transaction reaches a final txHash through the sponsorship status
      poll, not just the initial submit response.
- [ ] **Spot — ETH pair and a non-ETH registry pair, or an honest banner**
      (T15): confirm at least one ETH-quoted pair trades correctly and one
      non-ETH-quoted registry pair either trades correctly or shows the
      honest "can't determine decimals/scale" banner instead of guessing.
- [ ] **Funding deposit — resume after reload** (T16): start a bridge
      deposit, reload the tab mid-transfer, confirm the localStorage resume
      record re-opens the status screen (not a blank/broken state) — Edge
      Case #25.
- [ ] **Futures — review → sign → submit round trip** (T9): a full order
      round trip against a live account, including the liquidation/fee
      warnings rendering with real numbers.
- [ ] **Setup — Creating → recovery-modal → Done, and partial-setup resume**
      (T21): kill the tab between wallet creation and package commit, restart
      setup, and confirm it resumes rather than duplicating a wallet — Edge
      Case #29.
- [ ] **Live mode-toggle — Est. Value follow** (T10/T22): toggling wallet
      mode updates the dashboard's "Est. Value" figure to the selected
      mode's data without a stale flash of the other mode's number.
- [ ] **Light + dark passes on all restyled panels**: `WalletUnlockDialog`,
      `MigrationNotice`, `CryptoSecurityPanel`, `RecoveryPanel`,
      `WalletKeyExportPanel`, `WalletChainProvisioningPanel`,
      `WalletSetupFlow`, `ModernWalletPage`, `SendFormScreen`,
      `SendReviewScreen`, `SendStatusScreen` — check contrast, the
      `bg-surface-sunken` fills, and hairline borders in both themes.

---

## Sign-off

Record the tester, date, staging build/commit, and any failures found
(link the follow-up issue) here before treating this checklist as complete.

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Staging commit | |
| Result | |
| Follow-up issues filed | |
