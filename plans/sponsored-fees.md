# Plan: Sponsored Gas Fees — Zero-Cost Transactions

> Source PRD: `PRD_SPONSORED_FEES.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Sponsorship mechanism**: Privy's `sponsor: true` flag on `wallets().rpc()` calls. No paymasters, no relayers, no ERC-4337. Privy bills WorldStreet monthly.
- **Supported chains**: Ethereum mainnet (1), Arbitrum (42161), Base (8453), Optimism (10), Polygon (137), BSC (56), Solana. All return `true` from the sponsorship engine.
- **Unsupported chains**: Tron (Privy doesn't support sponsor on `tron_sendTransaction`), SUI (`rawSign` only), TON (not implemented). All return `false` from the sponsorship engine.
- **Sponsorship engine**: A single utility (`shouldSponsor(chainType)`) that centralizes all sponsorship decisions. Respects `GAS_SPONSORSHIP_ENABLED` env var as a global kill switch.
- **Decision authority**: Server-decided only. No client-side override. The `requestSponsor` param on the execute-transaction route is removed. The `sponsor` param on the Ethereum send helper is removed. All calls go through the engine.
- **UI philosophy**: CEX feel. All gas-related text, labels, buffers, errors, and UI elements are removed for sponsored chains. No "Gas: Free", no "Sponsored by WorldStreet" — just absent. Users never see the word "gas."
- **Gas buffers**: Conditionally applied via `shouldSponsor()`. Sponsored chains: no buffer, user can send 100% of balance. Unsponsored chains (Tron, SUI, TON): existing buffer logic preserved silently.
- **Fallback behavior**: If Privy's sponsorship fails, the transaction fails with a standard error. No silent fallback to user-pays. Existing error handling is sufficient.
- **Admin logging**: Fire-and-forget POST from the dashboard frontend to the admin backend after every sponsored transaction. The `GasSponsorshipLog` model lives in the admin repo (`worldstreet-admin`).
- **Admin API route**: `POST /api/gas-logs` (create log entry), `GET /api/admin/gas-stats` (query stats with period/chain filters).
- **GasSponsorshipLog schema**: `{ userId, chain, txHash, method, estimatedCostUSD, timestamp }`
- **Solana send refactor**: `sendSol()` moves from Solana Kit (`signAndSendTransactionMessageWithSigners`) to `wallets().rpc()` with `signAndSendTransaction`. Old code deleted, no feature flag.
- **Testing**: No automated tests until all phases are built. Full end-to-end verification at the end.

---

## Phase 1: Sponsorship Engine + EVM Send Path

**User stories**: US-1, US-7, US-18, US-20

### What to build

Create the sponsorship decision engine and wire it into every EVM transaction path. After this phase, any transaction that goes through the Ethereum send layer or the execute-transaction route is automatically sponsored on all EVM chains — mainnet included.

Also set up the admin logging infrastructure: a model in the admin backend to store sponsorship logs, a POST endpoint to receive them, and fire-and-forget calls from the dashboard after each sponsored EVM transaction.

Specifically:

1. **Sponsorship engine** — new utility that exports `shouldSponsor(chainType)`. Returns `true` for `"ethereum"` and `"solana"`, `false` for `"tron"`, `"sui"`, `"ton"`. Reads `GAS_SPONSORSHIP_ENABLED` env var (defaults to `true` if unset).

2. **Ethereum send helper** — remove the `sponsor` parameter from the function signature. Internally call `shouldSponsor("ethereum")` and pass the result to the Privy RPC call. The `sendEth()` convenience function also uses the engine instead of hardcoding `false`.

3. **Execute-transaction route** — remove the `isL2` conditional logic. Remove the `requestSponsor` client override. Always sponsor via the engine. This covers all EVM sends through the general-purpose route (send modal, internal transfers, etc.).

4. **Already-sponsored call sites** — update the Hyperliquid bridge and the internal transfer route to use `shouldSponsor("ethereum")` instead of hardcoded `true`. This centralizes the kill switch.

5. **Admin backend** — create the `GasSponsorshipLog` Mongoose model and a `POST /api/gas-logs` endpoint behind API key auth. The endpoint accepts `{ userId, chain, txHash, method, estimatedCostUSD }` and stores it.

6. **Frontend logging** — after each successful sponsored EVM transaction, fire-and-forget POST the tx details to the admin backend's new endpoint. Follow the existing pattern used by SpotV2 deposit notifications.

### Acceptance criteria

- [ ] `shouldSponsor("ethereum")` returns `true`; `shouldSponsor("tron")` returns `false`
- [ ] Setting `GAS_SPONSORSHIP_ENABLED=false` makes `shouldSponsor()` return `false` for all chains
- [ ] The Ethereum send helper no longer accepts a `sponsor` parameter — all calls use the engine
- [ ] The execute-transaction route no longer checks `isL2` and no longer accepts `requestSponsor`
- [ ] An ETH mainnet send (chain 1) is sponsored (previously it was not)
- [ ] Hyperliquid bridge and internal transfer routes use `shouldSponsor()` instead of `true`
- [ ] Admin backend `POST /api/gas-logs` stores a `GasSponsorshipLog` document
- [ ] After a sponsored EVM transaction, a log entry appears in the admin database

---

## Phase 2: Solana Sponsorship

**User stories**: US-8, US-9

### What to build

Enable gas sponsorship for all Solana transactions. This requires refactoring the native SOL send function from the Solana Kit pattern to the `wallets().rpc()` pattern (which supports `sponsor`), and adding `sponsor: true` to all Solana RPC call sites. Also remove every SOL balance pre-flight check — users no longer need SOL for fees.

Specifically:

1. **Refactor `sendSol()`** — rewrite the native SOL send function to use `wallets().rpc()` with `signAndSendTransaction` method, serialize the transaction to base64 (same pattern the SPL token send route already uses), and pass `sponsor: shouldSponsor("solana")`. Delete the old Solana Kit imports and code entirely.

2. **SPL token send route** — add `sponsor: shouldSponsor("solana")` to the existing `wallets().rpc()` call.

3. **SpotV2 deposit send (Solana path)** — add `sponsor: shouldSponsor("solana")` to the Solana RPC call. Remove the `MIN_SOL_LAMPORTS` balance check and the "Insufficient SOL for fees" error.

4. **Spot v1 deposit send (Solana path)** — add `sponsor: shouldSponsor("solana")` to the Solana RPC call. Remove the `MIN_SOL_LAMPORTS` / `solBalance` check and the "Insufficient SOL for transaction fees" error.

5. **Spot v1 error handling** — remove the catch block that maps `insufficient lamports` / `Attempt to debit` errors to the "Insufficient SOL for transaction fees" user message.

6. **Frontend logging** — add fire-and-forget gas log POST after each sponsored Solana transaction.

### Acceptance criteria

- [ ] `sendSol()` uses `wallets().rpc()` with `signAndSendTransaction` — no Solana Kit imports remain
- [ ] `sendSol()` passes `sponsor: true` (via engine) in the RPC call
- [ ] SPL token send route includes `sponsor: true` in the RPC call
- [ ] SpotV2 deposit Solana path includes `sponsor: true` and has no SOL balance check
- [ ] Spot v1 deposit Solana path includes `sponsor: true` and has no SOL balance check
- [ ] A SOL send succeeds even when the wallet has 0 SOL beyond the transfer amount
- [ ] An SPL token send succeeds even when the wallet has 0 SOL
- [ ] Sponsored Solana transactions create a log entry in the admin database

---

## Phase 3: Swap, Bridge, SpotV2 Trade, Spot v1 Deposit (EVM)

**User stories**: US-2, US-3, US-4, US-5, US-6, US-10

### What to build

Add sponsorship to every remaining RPC call site that sends EVM transactions directly (bypassing the Ethereum send helper). These are the swap, bridge, SpotV2 trade execution, and Spot v1 EVM deposit paths.

Specifically:

1. **Swap route — approval RPC call** — add `sponsor: shouldSponsor("ethereum")` to the ERC-20 `approve()` transaction.

2. **Swap route — execution RPC call** — add `sponsor: shouldSponsor("ethereum")` to the swap execution transaction.

3. **Bridge actions** — add `sponsor: shouldSponsor("ethereum")` to the bridge execution RPC call.

4. **SpotV2 trade actions** — add `sponsor: shouldSponsor("ethereum")` to the trade execution RPC call.

5. **Spot v1 deposit (EVM path)** — add `sponsor: shouldSponsor("ethereum")` to the ERC-20 transfer RPC call.

6. **SpotV2 deposit send (EVM path)** — confirm this path goes through the Ethereum send helper (which was already updated in Phase 1). If it calls `wallets().rpc()` directly, add sponsor.

7. **Frontend logging** — add fire-and-forget gas log POST after each sponsored transaction in these paths.

### Acceptance criteria

- [ ] Swap approval transaction includes `sponsor: true`
- [ ] Swap execution transaction includes `sponsor: true`
- [ ] Bridge execution transaction includes `sponsor: true`
- [ ] SpotV2 trade execution includes `sponsor: true`
- [ ] Spot v1 EVM deposit includes `sponsor: true`
- [ ] A token swap completes without the user holding any native token for gas
- [ ] A bridge transfer completes without the user holding native token on the source chain
- [ ] All sponsored transactions in these paths create admin log entries

---

## Phase 4: UI — Remove All Gas References

**User stories**: US-11, US-12, US-16, US-17

### What to build

Strip every gas-related UI element from the dashboard. No gas buffers (for sponsored chains), no gas error messages, no "Network Fee" lines, no gas tooltips. The platform should feel like a CEX where fees are simply not a concept.

For unsponsored chains (Tron, SUI, TON), gas buffer logic is preserved silently — the max button subtracts the buffer, but no gas-related text is shown. If a Tron transaction fails due to insufficient TRX, the generic error handling catches it.

Specifically:

1. **Send modal** — replace the flat `GAS_BUFFER` record with conditional logic: if `shouldSponsor(chain)` returns `true`, no buffer is subtracted (max = full balance for native tokens). If `false`, use existing buffer values. Remove all gas-related error messages ("Insufficient balance for gas fees"), tooltips ("Leave at least X for transaction fees"), and gas-related UI text. The percentage buttons (25/50/75/MAX) use the full balance for sponsored chains.

2. **Swap UI** — remove the "Network Fee" line from the QuoteCard entirely. No "$0.00", no "Free" — the row is gone.

3. **Bridge UI** — replace the flat `GAS_BUFFER` record with the same conditional pattern as the send modal. For sponsored chains (all current EVM chains), no buffer. Remove any gas-related text.

4. **SpotV2 funding UI** — remove any SOL balance check or warning displayed to the user.

5. **Transaction confirmations / history** — if there are any gas cost displays in transaction receipts or history views, remove them.

6. **Error messages** — audit all user-facing error messages for gas-related copy. Remove or replace with generic alternatives. For example, swap/bridge pre-flight errors that mention gas should be removed since users no longer need gas.

### Acceptance criteria

- [ ] Send modal: MAX button on ETH shows full ETH balance (no buffer subtracted)
- [ ] Send modal: MAX button on SOL shows full SOL balance (no buffer subtracted)
- [ ] Send modal: MAX button on TRX still subtracts the TRX buffer (unsponsored)
- [ ] Send modal: no text containing "gas", "fee", or "network fee" appears for sponsored chains
- [ ] Swap QuoteCard: "Network Fee" line is completely absent
- [ ] Bridge UI: no gas buffer for EVM chains, no gas-related text
- [ ] No user-facing string in the dashboard contains the word "gas" for sponsored chain flows
- [ ] A user depositing USDT can immediately send, swap, bridge, or trade without encountering any gas-related friction or messaging

---

## Phase 5: Admin Gas Monitoring Dashboard

**User stories**: US-13, US-14, US-15

### What to build

Build the admin-facing analytics on top of the `GasSponsorshipLog` data that has been accumulating since Phase 1. This is a stats API endpoint and (optionally) an admin dashboard panel.

Specifically:

1. **Admin stats endpoint** — `GET /api/admin/gas-stats` accepts query params `period` (e.g. `7d`, `30d`) and optional `chain` filter. Returns:
   - `totalSpend`: aggregate estimated USD cost
   - `byChain`: breakdown per chain
   - `byDay`: daily time series
   - `topUsers`: highest-spending users by tx count and estimated cost

2. **Admin route registration** — register the new route under the existing admin routes with API key + auth middleware.

3. **Threshold alerts** — configurable daily spend threshold (env var or DB config). When cumulative daily gas spend exceeds the threshold, trigger a notification. Use whatever alert mechanism the admin backend already has (if none exists, log a warning and create a simple webhook POST).

4. **Admin dashboard panel** (if admin has a UI) — a panel showing daily burn rate, per-chain breakdown, and top users. If the admin is API-only, this is just the endpoint.

### Acceptance criteria

- [ ] `GET /api/admin/gas-stats?period=7d` returns aggregated sponsorship data
- [ ] Stats endpoint returns correct `byChain` breakdown
- [ ] Stats endpoint returns `byDay` time series
- [ ] Stats endpoint returns `topUsers` list
- [ ] Daily threshold alert fires when cumulative spend exceeds configured limit
- [ ] Endpoint is protected by API key + auth middleware

---

## Phase 6: End-to-End Verification

**User stories**: All (US-1 through US-20)

### What to build

Comprehensive verification that the entire system works as specified. This is not a separate code phase — it's the structured testing pass after all code changes are complete.

### Verification matrix

**Sponsored EVM transactions (each chain: ETH mainnet, Arbitrum, Base, Optimism, Polygon, BSC):**
- [ ] Send native token (ETH/MATIC/BNB) — succeeds with 0 extra native balance
- [ ] Send ERC-20 token (USDT/USDC) — succeeds with 0 native balance
- [ ] Send full balance (MAX) — no buffer subtracted

**Sponsored Solana transactions:**
- [ ] Send SOL — succeeds with exact amount (no extra SOL needed for fees)
- [ ] Send SPL token (USDT) — succeeds with 0 SOL balance
- [ ] SpotV2 deposit (Solana) — succeeds with 0 SOL for fees

**Swap (any EVM chain):**
- [ ] ERC-20 swap — approval + execution both complete without gas
- [ ] No "Network Fee" line visible in the quote card

**Bridge:**
- [ ] Cross-chain bridge — completes without native token on source chain
- [ ] No gas buffer applied in bridge UI

**SpotV2:**
- [ ] Deposit to SpotV2 treasury — succeeds without gas
- [ ] Trade execution via LI.FI — succeeds without gas

**Spot v1:**
- [ ] USDT deposit (ETH) — succeeds without gas
- [ ] USDT deposit (Solana) — succeeds without 0 SOL

**Tron (unsponsored — verify no regression):**
- [ ] TRX send still works (user pays TRX fees as before)
- [ ] TRC-20 send still works
- [ ] Max button still subtracts TRX buffer
- [ ] No gas-related text is shown

**UI audit:**
- [ ] Search entire dashboard for the word "gas" — zero results in user-facing UI
- [ ] Search for "network fee" — zero results
- [ ] Search for "insufficient.*fee" error messages — zero results for sponsored chains
- [ ] Transaction history shows no gas cost fields

**Admin monitoring:**
- [ ] After running the above tests, `GET /api/admin/gas-stats` returns entries for each chain tested
- [ ] Log count matches number of sponsored transactions executed

**Kill switch:**
- [ ] Set `GAS_SPONSORSHIP_ENABLED=false` — verify all transactions revert to user-pays behavior
- [ ] Unset it — verify sponsorship resumes
