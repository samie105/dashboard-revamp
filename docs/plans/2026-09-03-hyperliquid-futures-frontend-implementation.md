# Hyperliquid Futures Frontend Implementation Plan

Status: frontend implementation started; backend contracts audited
Date: 2026-09-03
Scope: Hyperliquid mainnet, modern Worldstreet wallet only

## Objective

Deliver a complete futures experience in the dashboard without introducing a
second wallet architecture or changing the established trading UI:

- discover Hyperliquid perpetual markets;
- deposit USDC from the modern wallet on Arbitrum into Hyperliquid;
- withdraw available USDC from Hyperliquid back to the modern wallet;
- place market and limit orders with leverage, reduce-only, TP, and SL;
- monitor balances, open positions, open orders, fills, and failures;
- make every money-moving action explicit, reviewable, locally signed, and
  recoverable.

## Current architecture

The crypto backend is the authority for Hyperliquid metadata, account state,
order construction, transaction preparation, validation, simulation, and
submission. The browser is responsible for user intent, wallet unlock, local
decryption, signing, and displaying state.

```text
Dashboard UI
  -> Next crypto proxy + Clerk session
    -> crypto backend /v1/trading/hyperliquid/*
      -> Hyperliquid mainnet API / Arbitrum RPC

Modern wallet package (browser only)
  -> decrypt local EVM key after unlock
  -> sign backend-prepared EVM or Hyperliquid payload
  -> send signature/raw transaction back to backend
```

Private keys must never be sent to the frontend server, crypto backend, logs,
analytics, or third-party router.

## Backend contracts already available

### Market discovery

`GET /v1/trading/hyperliquid/markets` returns the futures universe, current
mid prices, size precision, maximum leverage, isolated-margin constraints, and
the $10 minimum notional.

### Account monitoring

`GET /v1/trading/hyperliquid/account` returns:

- withdrawable and total perps USDC;
- spot USDC and spot balances;
- open positions with size, side, entry, mark, PnL, ROE, liquidation price,
  margin, and leverage;
- open orders;
- the account address and readiness state.

The frontend should poll this endpoint while the futures workspace is open,
back off when hidden or offline, and refresh immediately after a submission.

### Futures intents

`POST /v1/trading/hyperliquid/intents` builds an unsigned, expiring intent.
Supported actions are:

- `order` for market/limit futures orders;
- `cancel` for open orders;
- `updateLeverage`;
- `usdClassTransfer` for spot/perps margin movement;
- `withdraw3` for Hyperliquid withdrawals.

For an order, the backend enforces market existence, price availability, size
precision, maximum leverage, minimum notional, reduce-only validity, and TP/SL
direction rules. TP/SL orders are emitted as protected reduce-only trigger
orders in the same prepared intent.

`POST /v1/trading/hyperliquid/intents/:id/submit` accepts one verified
signature per prepared step and relays the exact prepared action to
Hyperliquid.

### Deposits

`POST /v1/trading/hyperliquid/deposit/intents` prepares two Arbitrum EVM
transactions:

1. USDC approval for the Hyperliquid bridge;
2. bridge `sendUSDC` deposit.

Each transaction includes nonce, gas, chain ID, and fee fields. The browser
signs each with `signEvmIntent` and submits each through the generic modern
transaction-intent endpoint.

## Frontend implementation phases

### Phase 1 — Open the existing futures UI

- enable the futures route in `TradeClient`;
- remove the sidebar “Soon” state and link directly to
  `/trade?market=futures`;
- allow futures in the Markets and Portfolio views;
- make futures rows link to the futures ticket;
- keep the existing chart, order book, positions, orders, review modal, and
  TP/SL controls unchanged stylistically.

Completed in this change set.

### Phase 2 — Modern wallet readiness and unlock

- require an active modern EVM account for Hyperliquid;
- show the existing wallet unlock modal when the wallet is locked;
- resume the action after unlock instead of asking the user to press the CTA
  again;
- ensure the reviewed order is still the same intent after unlocking;
- never sign an intent whose wallet ID, account ID, or prepared payload does
  not match the local wallet.

The futures order flow already follows this pattern. Deposit and withdrawal
now use the same unlock boundary.

### Phase 3 — Deposit to Hyperliquid

User flow:

1. User opens Deposit and chooses the Hyperliquid/Futures destination.
2. Frontend displays Arbitrum, the modern EVM wallet address, amount, and
   destination before submission.
3. Backend prepares approval and bridge intents.
4. Frontend unlocks the wallet if needed.
5. Frontend signs the approval locally and submits it.
6. Frontend signs the bridge transaction locally and submits it.
7. UI displays “submitted” and keeps checking Hyperliquid account state.
8. The futures balance updates when the deposit lands.

Failure rules:

- if approval fails, do not submit the bridge transaction;
- if approval succeeds but bridge submission fails, show the exact stage and
  retain the intent reference for retry/recovery;
- never recreate the pair with a new idempotency key during a retry;
- invalidate wallet balances after confirmed approval/bridge transactions.

Implemented using `createHyperliquidDepositIntents`, `signEvmIntent`, and
`submitIntent` in the modern funding panel. A follow-up hardening pass should
persist the two intent IDs in pending-flow storage for browser-refresh
recovery.

### Phase 4 — Withdraw from Hyperliquid

User flow:

1. User opens Withdraw and sees the current withdrawable Futures USDC.
2. Frontend uses the active modern EVM address as the destination.
3. Backend prepares a mainnet `withdraw3` typed action.
4. Frontend unlocks and signs the exact typed action locally.
5. Backend verifies the signature and submits it to Hyperliquid.
6. UI shows the intent as submitted and refreshes the account until the funds
   are reflected in the Arbitrum wallet balance.

The amount must be checked against `perpsWithdrawableUsdc`, with a clear
warning that Hyperliquid may apply its withdrawal fee and final settlement is
asynchronous.

### Phase 5 — Place futures orders

The ticket must support:

- market orders using the current order book;
- limit orders with a visible limit price;
- leverage clamped to the selected contract’s maximum;
- cross/isolated mode where the backend permits it;
- reduce-only close orders;
- take-profit and stop-loss trigger prices;
- a backend-priced review screen before signing;
- local Hyperliquid L1/user-signed action signing;
- a post-submit result that distinguishes filled, resting, partial, and
  failed outcomes.

The backend is responsible for all final pricing, rounding, precision,
minimum-notional, and trigger-direction validation. The frontend must not
rebuild or mutate the signed action.

Completed in the existing futures ticket and enabled in this change set.

### Phase 6 — Position and order monitoring

While `/trade?market=futures` is visible:

- fetch markets once and refresh when stale;
- poll the account about every 10 seconds while visible;
- refresh immediately after place, cancel, close, deposit, or withdrawal;
- show a loading state distinct from an empty account;
- preserve the last good account state during transient failures;
- show stale/offline status rather than zeroing balances or positions;
- allow cancel and close actions from the existing Positions/Orders panels;
- show entry, mark, unrealized PnL, ROE, liquidation price, margin, leverage,
  and notional without inventing unavailable values.

Completed for the visible trade workspace with a 30-second account refresh;
the next tuning pass should make the interval visibility-aware and use a
10-second cadence while the futures tab is active.

### Phase 7 — Margin transfers

If users need to move funds between Hyperliquid Spot and Perps without
leaving the venue, expose `usdClassTransfer` as a separate, clearly named
action. It must have its own review/sign/submit state and must not be confused
with Arbitrum deposits or withdrawals.

This is not required for the initial deposit/withdraw release and should be a
separate follow-up so the balance labels remain unambiguous.

## Error and safety requirements

- Mainnet only: no testnet toggle or fallback.
- EIP-712/Hyperliquid signing chain ID must remain the backend-provided value.
- A locked wallet is an actionable unlock state, not a generic internal error.
- Expired intents must be discarded and rebuilt only after the user confirms a
  new action.
- A retry of a signed or partially submitted action must use the original
  intent reference where the backend permits it.
- Do not report “filled” merely because a request returned HTTP 200.
- Do not display undefined symbols, chain names, transaction IDs, or route
  names; render an explicit unavailable state instead.
- Never display a zero balance when the account request failed.
- Rate-limit account polling and pause it when the tab is hidden.

## Test plan

### Unit and type checks

- `pnpm typecheck`
- test order request mapping for market, limit, leverage, reduce-only, TP, and
  SL;
- test unlock-resume behavior;
- test EVM deposit transaction signing rejects incomplete fee fields;
- test withdrawal destination and amount validation;
- test partial deposit failure states.

### Authenticated staging checks

- create/unlock a modern wallet with an active EVM account;
- load futures markets and confirm the list is non-empty;
- verify account balance, position, and open-order rendering;
- create a small order intent and inspect the review summary;
- sign and submit a deliberately small permitted order;
- place TP/SL and verify both trigger orders appear;
- cancel an open order;
- close a small position with reduce-only;
- deposit a small amount through approval + bridge;
- withdraw a small amount back to the wallet.

### Production readiness checks

- confirm `HYPERLIQUID_ENVIRONMENT=mainnet` and the production API URL;
- confirm Arbitrum USDC and bridge addresses are production values;
- confirm RPC providers are configured with rotation and no exhausted key is
  the only provider;
- run backend config and index verification;
- check reverse-proxy headers and rate-limit trust-proxy configuration;
- verify Clerk auth, CORS, and wallet session cookies;
- watch backend logs for intent creation, signature mismatch, simulation,
  relay, and Hyperliquid response errors;
- test a browser refresh during a pending deposit and withdrawal;
- verify no private key or wallet package secret appears in network logs.

## Rollout and rollback

1. Deploy backend first and verify the Hyperliquid markets/account endpoints.
2. Deploy frontend with the futures gate enabled only after backend checks
   pass.
3. Run one small authenticated order and one small funding operation.
4. Monitor intent failure rate, account polling volume, RPC 429s, and
   Hyperliquid relay errors.
5. If needed, rollback by disabling the frontend futures entry point while
   leaving already-created backend intents auditable and untouched.

## Files changed in the initial frontend implementation

- `components/trade/trade-client.tsx` — enable the existing futures workspace.
- `components/app-sidebar.tsx` — expose Futures as live.
- `components/trading/markets-client.tsx` — enable futures data and trade
  links.
- `lib/venues.ts` — share the live venue state with portfolio/dashboard.
- `components/fund/hyperliquid-funding-client.tsx` — modern deposit and
  withdrawal signing flow.
- `components/flows/money-flow-modal.tsx` — route trading funding through the
  modern panel.
- `app/fund/page.tsx` and `app/trading-withdraw/page.tsx` — use the modern
  Hyperliquid funding pages.
- `app/api/crypto/[...path]/route.ts` — allow Hyperliquid intent status reads.
