# PRD: Sponsored Gas Fees — Zero-Cost Transactions for All Users

## Problem Statement

Users on the WorldStreet platform currently need native tokens (ETH, SOL, TRX) in their wallets to pay gas fees for on-chain transactions. This creates two problems:

1. **Onboarding friction**: New users who deposit USDT or USDC cannot immediately trade, swap, or send because they have no native tokens for gas. They must acquire ETH/SOL/TRX first — a confusing and hostile experience, especially for users coming from traditional finance.

2. **Crypto complexity leakage**: The entire platform is designed to feel like a fintech product (fiat on/off ramps, named accounts, clean UI), but gas fees break the abstraction. Users shouldn't need to understand gas, block space, or native tokens to use a trading dashboard.

The platform already sponsors gas on some L2 chains (Arbitrum, Base, Optimism, Polygon) and for Hyperliquid bridge transfers via Privy's `sponsor: true` flag. But coverage is inconsistent — Ethereum mainnet, Solana, and most direct send/swap flows are unsponsored.

## Solution

Extend Privy's built-in gas sponsorship (`sponsor: true`) to **every user-initiated on-chain transaction** across all Privy-supported chains: Ethereum mainnet, all EVM L2s, and Solana. Remove all gas-related UI from the dashboard — no gas buffers, no "insufficient gas" errors, no native token requirements. The platform absorbs all gas costs.

For Tron: Privy does not support the `sponsor` flag on `tron_sendTransaction`. Tron transactions will continue to work via the existing raw-signing approach, where gas (TRX energy/bandwidth) is consumed from the user's wallet. Tron sponsorship is out of scope for v1 and tracked as a follow-up.

The result: users deposit USDT, and from that moment they can send, swap, bridge, trade, and withdraw without ever needing to think about gas.

## User Stories

1. As a new user, I want to deposit USDT and immediately send it to another address, so that I don't have to buy ETH/SOL first just to cover fees.
2. As a trader, I want to swap tokens on any supported chain without worrying about having native tokens for gas, so that I can focus on my trading strategy.
3. As a user bridging assets cross-chain, I want the bridge transaction to execute without me needing gas on the source chain, so that moving assets between chains is seamless.
4. As a user depositing to SpotV2, I want the on-chain USDT transfer to the treasury wallet to be gasless, so that spot trading setup is frictionless.
5. As a user executing a spot trade (LI.FI), I want both the token approval and swap execution to be sponsored, so that I pay zero extra costs beyond the swap itself.
6. As a user withdrawing from SpotV2, I want the Arbitrum withdrawal to remain sponsored, so that I receive full value without gas deductions.
7. As a user sending native ETH on mainnet, I want the gas fee to be sponsored, so that my full balance is sendable.
8. As a user sending SOL on Solana, I want the transaction fee to be sponsored, so that I don't get blocked by "Insufficient SOL for fees" errors.
9. As a user sending SPL tokens (USDT/USDC on Solana), I want the transfer to be gasless, so that I can operate without holding any SOL.
10. As a user performing a LI.FI swap, I want both the ERC-20 approval transaction and the swap execution transaction to be gas-sponsored, so that the full swap flow feels like one zero-fee operation.
11. As a user, I want the send modal to let me send my entire token balance without deducting a gas buffer, so that I never see "leave X for gas fees" warnings.
12. As a user, I want to see "Sponsored by WorldStreet" (or similar) where gas cost used to appear, so that I understand the platform is covering this cost for me.
13. As an admin, I want to see a dashboard with gas sponsorship spend per chain, per day, and per user, so that I can monitor costs and detect anomalies.
14. As an admin, I want to see the total monthly Privy sponsorship cost broken down by chain, so that I can budget appropriately.
15. As an admin, I want to receive alerts when daily gas spend exceeds a configurable threshold, so that I can investigate abnormal usage.
16. As a user on Tron, I want to understand that TRX fees still apply (for v1), so that I'm not surprised when a Tron transaction requires energy/bandwidth.
17. As a user, I want all transaction confirmations and history entries to show "Gas: Free" or "Gas: Sponsored", so that the zero-fee experience is consistently communicated.
18. As a user performing an internal transfer (main wallet → trading wallet), I want the transfer to remain sponsored, so that wallet-to-wallet moves are free.
19. As a user, I want my deposits via the GlobalPay flow to not require gas from me, since the backend treasury already handles disbursement gas.
20. As a developer, I want a single utility function that determines whether to sponsor a transaction based on chain type, so that sponsorship logic is centralized and consistently applied.

## Implementation Decisions

### Module 1: Sponsorship Decision Engine (New — `lib/privy/sponsorship.ts`)

A centralized utility that determines whether a transaction should be sponsored based on chain type. All RPC call sites will import this instead of hardcoding `sponsor: true/false`.

**Interface:**
```
shouldSponsor(chainType: "ethereum" | "solana") → true
shouldSponsor(chainType: "tron") → false
shouldSponsor(chainType: "sui" | "ton") → false (unsupported by Privy currently)
```

This module is intentionally simple for v1 (always returns true for EVM/Solana). It becomes the single place to add rate limits, per-user budgets, or chain-specific logic in the future without touching call sites.

### Module 2: Ethereum Transaction Layer (Modify — `lib/privy/ethereum.ts`)

- `sendEthereumTransaction()` — change default from `sponsor: false` to pulling from the sponsorship engine. Currently the `sponsor` param defaults to `false`; after this change it defaults to `true` for all EVM chains.
- `sendEth()` — currently hardcodes `sponsor: false` and `chain_id: 1`. Update to use the sponsorship engine (will resolve to `true`).

### Module 3: Solana Transaction Layer (Modify — `lib/privy/solana.ts` + Solana API routes)

Privy supports `sponsor` on Solana `signAndSendTransaction` RPC calls. Add `sponsor: true` to:

- `sendSol()` in `lib/privy/solana.ts` — native SOL sends (uses `signAndSendTransactionMessageWithSigners` which does not directly accept a `sponsor` flag; this needs refactoring to use `privyClient.wallets().rpc()` with `signAndSendTransaction` method instead, which does accept `sponsor`).
- `POST /api/privy/wallet/solana/send-token` route — SPL token sends. Already uses `privyClient.wallets().rpc()` with `signAndSendTransaction`; add `sponsor: true`.
- `sendTokenSolana()` in `app/api/spotv2/deposit/send/route.ts` — SpotV2 deposit sends. Same pattern; add `sponsor: true`.

Also **remove the SOL balance pre-flight check** (`MIN_SOL_LAMPORTS` / "Insufficient SOL for fees" error) that currently blocks sends when the user has low SOL. When sponsored, the user doesn't need SOL for fees.

### Module 4: Direct RPC Call Sites (Modify — 3 files)

These files call `privyClient.wallets().rpc()` directly without going through the Ethereum helper. Add `sponsor: true` to each:

- `lib/spotv2/trade-actions.ts` — SpotV2 LI.FI trade execution
- `app/api/swap/route.ts` — LI.FI swap token approval + swap execution (2 separate RPC calls)
- `lib/bridge-actions.ts` — LI.FI bridge execution

### Module 5: Execute Transaction Route (Modify — `app/api/privy/wallet/ethereum/execute-transaction/route.ts`)

Currently auto-sponsors only L2 chains (`isL2` check for chain IDs 42161, 8453, 10, 137). Change to sponsor all EVM chains including mainnet (chain ID 1) and BSC (56). Remove the `isL2` conditional — always sponsor.

### Module 6: Send Modal UI (Modify — `components/assets/send-modal.tsx`)

- Remove the `GAS_BUFFER` constant and all gas buffer subtraction logic.
- Remove the "Insufficient balance for gas fees" validation and error message.
- Remove the "Leave at least X for transaction fees" tooltip.
- For native token sends (ETH, SOL), allow the user to send their entire balance (the max button shows 100%, not balance minus buffer).
- Add a small "Gas: Sponsored" indicator where gas cost was previously shown or implied.

### Module 7: Bridge UI Gas Buffers (Modify — `components/bridge/bridge-client.tsx`)

- Remove the `GAS_BUFFER` constant used for bridge operations.
- Remove pre-flight gas balance validation for EVM chains.
- Allow full balance bridging.

### Module 8: Swap UI (Modify — `components/swap/swap-client.tsx`)

- In the `QuoteCard` component, change the "Network Fee" line from showing `~$X.XX` to showing "Sponsored" or "$0.00 (Sponsored)".
- Remove or update the `gasCostUSD` display to reflect zero user cost.

### Module 9: SpotV2 Deposit Flow (Modify — `components/wallet/spot-funding-swap.tsx`)

- Remove the Solana SOL balance check that shows "Insufficient SOL for fees" error.
- The deposit amount the user enters is the exact amount they receive (no gas deduction).

### Module 10: Admin Gas Monitoring (New — Backend + Admin API)

Create a lightweight monitoring system:

- **Backend model**: A `GasSponsorshipLog` collection that records every sponsored transaction: userId, chain, txHash, timestamp, estimatedCostUSD (derived from gas used × gas price, fetched post-confirmation or estimated).
- **Backend API endpoint**: `GET /api/admin/gas-stats` returning: total spend per day, per chain, per user. Includes breakdowns and top-spending users.
- **Admin dashboard integration**: A new panel/page in the admin interface showing gas sponsorship analytics — daily burn rate, per-chain breakdown, trend charts.
- **Alert mechanism**: A configurable daily threshold. When cumulative gas spend exceeds it, trigger a notification (email, Slack webhook, or in-dashboard alert — depending on existing admin notification infrastructure).

### Module 11: Tron Handling / Graceful Degradation

- Tron uses `tron_sendTransaction` via raw REST API (not the typed SDK). Privy does not support the `sponsor` flag for Tron. For v1, Tron transactions remain user-pays (energy/bandwidth from TRX balance).
- In the send modal, for Tron assets, keep the existing TRX gas buffer behavior. Add a subtle note: "Tron fees apply" or "TRX required for network fees" to differentiate from sponsored chains.
- SUI and TON: SUI uses `rawSign` (no sponsorship support). TON is not yet implemented. Both are out of scope.

### API Contract

No new external API routes are needed for the core feature. The sponsorship is applied at the infrastructure layer (Privy RPC calls). The only new endpoint is for admin monitoring:

```
GET /api/admin/gas-stats?period=7d&chain=ethereum
→ { totalSpend: number, byChain: Record<string, number>, byDay: Array<{date, spend}>, topUsers: Array<{userId, spend, txCount}> }
```

### Architecture Notes

- Privy's sponsorship is billed to the WorldStreet Privy account. There is no on-chain paymaster or relayer to manage. The cost shows up on the monthly Privy invoice.
- All sponsorship decisions flow through a single module (`lib/privy/sponsorship.ts`), making it trivial to add per-user limits, chain exclusions, or disable sponsorship globally via environment variable in the future.
- The `WALLET_PURPOSE.FEES` constant that exists in the admin backend remains unused — it was reserved for a pre-funding approach that is no longer needed given Privy's native sponsorship.

## Testing Decisions

Good tests for this feature verify **external behavior** — does a transaction succeed without the user holding native tokens? Does the UI correctly remove gas-related friction?

### Modules to Test

1. **Sponsorship Decision Engine** (`lib/privy/sponsorship.ts`)
   - Unit test: returns `true` for ethereum, solana; `false` for tron, sui, ton.
   - Unit test: if a future env var `DISABLE_SPONSORSHIP=true` is set, returns `false` for all chains (future-proofing the interface).

2. **Ethereum Transaction Layer** (`lib/privy/ethereum.ts`)
   - Integration test: `sendEthereumTransaction()` passes `sponsor: true` in the RPC call payload for all chain IDs.
   - Integration test: `sendEth()` includes `sponsor: true`.

3. **Solana Send Routes** (`/api/privy/wallet/solana/send-token`, `/api/spotv2/deposit/send`)
   - Integration test: RPC call includes `sponsor: true`.
   - Test: a Solana token send no longer fails when the wallet has 0 SOL (the "Insufficient SOL" check is removed).

4. **Admin Gas Monitoring** (`/api/admin/gas-stats`)
   - Integration test: after a sponsored transaction, a `GasSponsorshipLog` record exists.
   - Integration test: stats endpoint returns correct aggregations.

### Prior Art

The codebase currently has a `test-base.tsx` file and test utilities. The existing pattern of testing Privy interactions involves mocking `privyClient.wallets().rpc()` responses — the same approach applies here. Tests should mock the Privy RPC layer and verify the `sponsor` field in the call payload.

## Out of Scope

- **Tron gas sponsorship**: Privy doesn't support `sponsor` on `tron_sendTransaction`. Tron transactions remain user-pays in v1. A future approach could be a pre-funding micro-transfer of TRX, but that's a separate workstream.
- **SUI and TON gas sponsorship**: SUI uses `rawSign` (no sponsorship hook). TON is not yet implemented. Out of scope.
- **Per-user rate limiting or budgets**: The decision is no limits for v1. The sponsorship engine module is designed to make adding limits easy later without changing call sites.
- **Custom paymaster or ERC-4337 account abstraction**: Privy's native sponsorship is sufficient. No need for on-chain paymaster contracts.
- **Privy billing optimization**: Cost monitoring is in scope, but negotiating Privy pricing tiers or switching providers is not.
- **Backend treasury gas optimization**: The admin backend's `sendService.js` and `disbursementService.js` already pay gas from treasury wallets. That cost model is separate from user-facing sponsorship and is not changed.

## Further Notes

- **Privy Sponsorship on Solana**: Privy supports the `sponsor` parameter on Solana `signAndSendTransaction` RPC calls. This means the refactor of `sendSol()` to use `privyClient.wallets().rpc()` (instead of `signAndSendTransactionMessageWithSigners`) is required to unlock Solana sponsorship. The SPL token send routes already use the correct RPC pattern and only need the `sponsor: true` addition.

- **Cost Estimation**: Gas costs vary by chain. Rough estimates:
  - Ethereum mainnet: $0.50–$5.00 per tx (most expensive)
  - Arbitrum/Base/Optimism: $0.01–$0.10 per tx
  - Solana: $0.001–$0.01 per tx
  - The admin monitoring module is critical to track actual costs and adjust strategy if mainnet sponsorship becomes unsustainable.

- **Rollout Strategy**: Consider rolling out in phases:
  1. Phase 1: Add `sponsor: true` to all existing L2 + Solana calls (low cost, high impact)
  2. Phase 2: Add `sponsor: true` to Ethereum mainnet (higher cost, monitor closely)
  3. Phase 3: Remove all gas UI elements (send modal buffers, error messages, swap fee displays)
  4. Phase 4: Ship admin monitoring dashboard

- **Fallback Behavior**: If Privy's sponsorship service is unavailable or errors, the transaction should **fail with a clear error** ("Transaction could not be processed — please try again") rather than silently falling back to user-pays. This prevents users from being surprised by unexpected gas charges.

- **Environment Variable Kill Switch**: The sponsorship engine should respect an env var like `GAS_SPONSORSHIP_ENABLED=true|false` so it can be disabled globally without a deploy if Privy costs spike unexpectedly.
