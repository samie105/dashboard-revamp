# Modern Wallet — Frontend Changes Required by the Integration Guide

Source: "Modern Wallet Frontend Integration Guide" (mdshare doc shared with the
`modern-wallet-arch` merge). Cross-referenced against `feat/self-custody` after
merge `8dedf65` on 2026-08-27. Each item states what the contract requires and
what the code currently does.

## Already compliant (do not redo)

- Creation flow: local key generation, Clerk-authorized provisioning,
  passphrase encryption, blocking recovery modal with copy/download + mandatory
  "I saved it" checkbox, ciphertext-only upload (`WalletSetupFlow`,
  `wallet-setup.ts`).
- Unlock: passphrase-first, package downloaded and decrypted locally, DEK
  memory-only with TTL, recovery secret as a separate credential.
- Transaction flow: unsigned intent → review (chain, asset, amount, recipient,
  fees, sponsorship, expiry) → explicit approval → local signing → submit →
  status polling (`useTransactionIntent`, `TransactionReview`).
- No plaintext keys/passphrases/recovery secrets in any API request; proxy
  allowlist enforces the surface.
- Encrypted backup download/restore exists under the security panel.
- Legacy Privy signing/trading flows untouched by the merge.

---

## 1. Wallet modes & migration rules (spec §1)

1. **Stop provisioning legacy Privy wallets for new Clerk users.**
   `lib/wallet-actions.ts` (pregenerate, tier selection) and
   `lib/ensureUserWallet.ts` still create Privy users + wallets on signup.
   New users must get the modern wallet only; existing users keep Privy.
2. **Promote wallet mode to a global, persistent selector.** Today the
   modern/legacy toggle exists only inside `trade-client.tsx`, driven by a
   `?wallet=legacy` URL param. The contract wants an obvious active-mode
   selector across the dashboard (hoist into `CryptoProvider` or a dedicated
   wallet-mode context, persist the choice).
3. **Thread the selected mode through every request** — balances, deposits,
   withdrawals, transfers, orders — so a modern action can never fall through
   to legacy code. Currently only trade-client branches on mode; assets and
   wallet pages don't know it exists.

## 2. Migration messaging (spec §2)

4. **Build the dismissible login migration notice** for users who have a legacy
   Privy wallet, with the doc's exact copy ("Your legacy wallet is still
   available… signing happens locally on your device"). Nothing like this
   exists in the codebase (grep confirms).
5. **Mirror the notice into notifications** until the user dismisses it or
   confirms migration; persist the dismissal.
6. **Never show it** to new users or users without a legacy wallet — requires a
   cheap "has legacy Privy wallet" check at login.
7. Never imply Worldstreet can recover or access keys, anywhere in copy.

## 3. Creation flow polish (spec §3)

8. **End setup on an addresses screen** — after creation, display the wallet
   address for each supported chain (addresses render on `ModernWalletPage`,
   but the setup flow itself should conclude with them).
9. Optionally reshape setup into the "familiar, legacy-style guided flow"
   (multi-step wizard) rather than a single form + modal.

## 4. Signing flow (spec §4)

10. **Add explorer links and final transaction status** to the modern flows.
    No explorer link exists anywhere in `components/crypto/` (grep confirms).
    Polling already lands on confirmed/failed/expired — surface it with the
    explorer URL per chain.

## 5. Balances & assets (spec §5)

11. **Fix the refresh policy in `useCryptoBalances`.** It currently always
    sends `refresh=true` (bypassing every cache) and refetches on mount. The
    contract allows refresh only on: initial load, explicit user refresh,
    after a confirmed transaction, or wallet/network context change.
12. **Preserve the last successful snapshot during refresh and show its
    timestamp.** Currently no timestamp UI and no stale-while-refreshing
    behavior.
13. **Per-network unavailable-provider states** — render a degraded state for
    the failing network instead of failing the whole balances view.
14. **Make balance sourcing mode-aware.** `useWalletBalances` was rewritten
    onto the crypto backend for all consumers; the contract says the legacy
    asset page keeps its existing data source when legacy mode is selected,
    and the modern UI must not use the legacy Privy hook. Split by mode.
15. Confirm rendering covers: network name + chain icon, address with copy,
    native balance, token symbol/name/decimals/icon/formatted amount, USD
    value when available.

## 6. Deposits & receiving (spec §6)

16. **Build the modern deposit/receive flow.** Required: chain/network
    selector, asset selector, **QR code**, copy-address button, network
    mismatch warning, and a line confirming the address belongs to the user's
    Worldstreet self-custodial wallet. QR code components exist only in the
    legacy `receive-modal`/`receive-panel`; the modern page only lists
    addresses with copy.
17. **Two-stage perps funding display.** Keep trading-account funding separate
    from ordinary deposits: stage 1 = USDC deposit to the supported chain
    address, stage 2 = trading-account funding transfer — each with its own
    independent status. `modern-funding-panel.tsx` has the actions but not the
    staged status presentation.

## 7. Transfers & withdrawals (spec §7)

18. **Pre-intent validation** in `ModernTransferFlow`: address format, amount,
    decimal precision, minimum balance, network — validate before requesting
    the intent, not after.
19. **Review screen must name the exact token contract/mint and destination.**
20. **Key assets by backend market/asset ID + token address/mint internally**,
    never by symbol alone (symbols are not unique).

## 8. Spot markets & orders (spec §8)

21. **Kill the hardcoded modern spot catalogue in `trade-client.tsx`**:
    remove the literal Arbitrum USDC/WETH addresses, the "symbol contains
    ETH" restriction, and the dead `modernSpotUnavailable = false` constant.
    Source markets from the backend's router-backed registry (the
    `crypto-backend` client already exposes the modern markets endpoint).
22. **Market list UI per contract**: provider icons with a safe monogram
    fallback; use the registry `id` as React key and internal identity;
    display network and quote asset; search the complete returned catalogue;
    show only chart-supported markets; load charts via the returned chart
    symbol/provider.
23. **Separate loading/error states** for markets, charts, order book, and
    wallet balances (no single shared spinner/error).
24. **Generalize the Jupiter panel** beyond the fixed SOL/USDC pair; Solana
    spot = Jupiter swap intent for any registry market. Treat a quote as not a
    fill — show complete only on backend-confirmed status.

## 9. Futures (spec §9)

25. **Bring the modern futures path to parity**: market/limit order types
    where supported, leverage and reduce-only controls, estimated fees and
    liquidation warnings, and open orders / fills / positions / cancellation
    wired to the modern account. The merge wired basic order submission via
    intents; audit what's missing against this list.
26. **Scrub venue-specific naming** ("Hyperliquid") from shared UI labels;
    treat the backend as the authority on market metadata, account state,
    order status, and venue constraints.

## 10. Perp funding actions (spec §10)

27. **Three distinct actions** — deposit/bridge, fund/transfer, withdraw —
    each with its own review, signing step, status timeline, retry behavior,
    and explorer/account reference.
28. **Idempotency keys on submission** + disabled duplicate submits.
29. **Never imply a bridge deposit is instant** — add expectation copy.

## 11. Sponsorship & gas (spec §11)

30. **Sponsorship availability must come from the backend intent**, not just
    the config-gated checkbox that exists today. Only display it when the
    intent explicitly says it's available for the network + asset + operation.
31. **Three messaging states**: "Worldstreet pays network fee" when accepted;
    the user-paid fallback fee when unavailable; a clear reason when policy /
    chain / operation / allowance disqualifies it.

## 12. Export, backup, devices (spec §12)

32. **Add a strong local confirmation + explicit warning to
    `WalletKeyExportPanel`** before revealing keys. Today the panel renders
    raw private keys for all five chains behind nothing but wallet unlock —
    no confirm step, no warning (grep confirms none). Keep export strictly
    local; per-chain/per-account with clear network labels (already the case).
33. **Harden restore**: validate package version, account ownership,
    checksum/integrity, and supported networks before replacing local state,
    with an explicit confirmation step (restore can replace the active local
    wallet package).

## 13. Error handling (spec §13)

34. **Central error-code → message mapping** on top of `CryptoBackendError`:
    - `AUTH_REQUIRED` → refresh the Clerk session, retry once.
    - `WALLET_NOT_FOUND` → offer wallet setup (partially done via
      `needsSetup`), never a generic network error.
    - `USER_VERIFICATION_REQUIRED` → explain the local verification/recovery
      step.
    - `INSUFFICIENT_FUNDS` → show available vs. requested amounts.
    - `SPONSORSHIP_UNAVAILABLE` → offer user-paid gas when supported.
    - `RPC_UNAVAILABLE` / provider failure → preserve last data, offer retry.
    - `INTENT_EXPIRED` → request a fresh intent, never reuse.
    - `DUPLICATE_REQUEST` → show the existing operation's status.
35. **Stop collapsing distinct failures.** `unlockWalletWithPassphrase`
    reports every error as "Wallet passphrase is incorrect"; don't label
    auth/RPC/missing-wallet/catalogue errors as "backend unreachable."

## 14. Merge hygiene that conflicts with the contract

36. **Remove the dev-mode raw balance JSON dump** in `ModernWalletPage`
    (contract: nothing sensitive in browser logs; it's debug leakage either
    way).
37. **Fix `.env.example`** — it ships `NEXT_PUBLIC_CRYPTO_ENABLED=true`, while
    the rollout doc says the feature is off by default. Anyone copying the
    example gets the wallet live.

---

## Suggested order of attack

1. **Safety/correctness first**: #1 (stop Privy provisioning for new users),
   #32 (export confirmation), #34–35 (error mapping), #37 (env example).
2. **Mode plumbing**: #2–3, #14 — everything else depends on a real
   wallet-mode context.
3. **Contract UI builds**: #4–6 (migration notice), #16 (deposit + QR),
   #21–24 (registry-driven markets), #10 (explorer links), #11–13 (balance
   refresh policy).
4. **Parity & polish**: #17, #25–29, #18–20, #30–31, #8–9, #33, #36.
