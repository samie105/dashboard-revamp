# Legacy → OnSwitch / Bridge route mapping (CP3)

Written mapping of every `lib/crypto-api.ts` call made by the buy, sell and
fund UI, and what replaces it. No code was changed to produce this.

Guide = `docs/fiat-frontend-integration-guide.md`. Line numbers refer to that
file. Repo references are `file:line`.

---

## 1. Which screens exist today, and who mounts them

| Surface | Component | Mounted by | Calls `lib/crypto-api.ts`? |
|---|---|---|---|
| `/buy` | `BuySellClient mode="buy"` | `app/buy/page.tsx` | Yes |
| `/sell` | `BuySellClient mode="sell"` | `app/sell/page.tsx` | Yes |
| Money modal "Deposit" / "Withdraw" tabs | `BuySellClient` | `components/flows/money-flow-modal.tsx:626` | Yes |
| `/fund`, `/trading-withdraw`, money modal "Fund" tabs, the "cash" door | `HyperliquidFundingClient` | `app/fund/page.tsx`, `app/trading-withdraw/page.tsx`, `money-flow-modal.tsx:633` | **No.** It already uses the modern wallet and `cryptoBackendClient` (`components/fund/hyperliquid-funding-client.tsx:3-15`) |
| Legacy fund / trading-withdraw | `FundClient` | **Nothing.** Only mentioned in comments (`components/crypto/SendModal.tsx:15`, `components/flows/money-doors.tsx:155`) | Yes, but unreachable |
| Dollar Account balance chip | `useCashBalance` | `hooks/useCashBalance.ts:18`, used by the dashboard hero, user card and navbar | Yes (`fetchDollarBalances`) |

So the port touches one live component, `BuySellClient`, in three places.
`/fund` has nothing left to port.

---

## 2. The legacy flows are not bank ramps (needs a product decision before CP5)

The team decision says the legacy buy/sell/fund flow is "Flutterwave on the
backend". What the dashboard code actually does is different, and it changes
what the Buy and Sell buttons will mean after the port:

| | Legacy buy / sell in this repo | OnSwitch (guide §9, lines 640-809) | Bridge (guide §10, lines 811-945) |
|---|---|---|---|
| Where the money comes from (buy) | The user's **Dollar Account** USD balance. `BuySellClient` blocks the buy when the Dollar Account is short (`buy-sell-client.tsx:385`) | A **bank transfer** the user makes to provider payment instructions (lines 740-757) | An **ACH/wire** to a Bridge virtual account (lines 816-860) |
| Where the money goes (sell) | Credited back to the **Dollar Account** (`Sell.usdProceeds`, `credited`, `lib/crypto-api.ts:185-199`) | Paid to a **verified, user-owned bank account** (lines 542-639) | Paid to a **verified US bank account** (lines 890-945) |
| Asset | **USDT** only (`buy-sell-client.tsx:664`, `lib/crypto-api.ts:147-199`) | Whatever `/fiat/config` `assetRoutes` returns; the guide's example is USDC on Ethereum (lines 346-360) | **USDC** (line 820) |
| Networks | Fixed list: Tron, Solana, Ethereum (`lib/crypto-api.ts:149-150`) | From `/fiat/config`, never hardcoded (lines 364-366) | `networkId` validated by the backend (lines 824-826) |
| Wallet | **Legacy Privy** custodial wallets (`components/wallet-provider.tsx`, `useWallet().addresses`; calls guarded by `assertLegacyPrivyEnabled`, `lib/crypto-api.ts:79-81`) | The user's **self-custodial WorldStreet wallet** by `walletId` (lines 707-722) | Same, by `walletId` (lines 818-822) |
| Fiat side lives in | The Dollar Account, which is a separate product funded on the Worldstreet home: "Funding it happens on the Worldstreet home — this is a read." (`lib/crypto-api.ts:921-925`) | The OnSwitch order | The Bridge virtual account (not a balance, guide line 812-815) |

Nothing in this repo calls Flutterwave (confirmed in the earlier search). If
Flutterwave is involved, it is behind the Dollar Account funding on the
Worldstreet home, not behind buy/sell here.

**Consequence:** after the port, "Buy" stops meaning "spend my Dollar
Account balance on USDT" and starts meaning "pay by bank transfer and receive
USDC in my modern wallet". "Sell" stops crediting the Dollar Account and
pays a bank account instead. See questions Q1-Q4 in section 8.

---

## 3. `BuySellClient`, buy mode → OnSwitch onramp (built in CP5)

Guide flow: §13 "OnSwitch local-fiat onramp" (lines 1145-1156).

| Legacy call (`buy-sell-client.tsx`) | What it does today | Replacement | Guide |
|---|---|---|---|
| `fetchBuyAvailability()` → `GET /api/buy/availability` (line 198) | Fee %, min/max USDT, which of Tron/Solana/Ethereum are enabled and funded | `cryptoBackendClient.getFiatConfig()` via `useFiatConfig`, then `isOnswitchOnrampAvailable` and `onswitchCorridors(config, "onramp")` (CP2) | §5 lines 207-381, especially 364-377 |
| — (no legacy equivalent) | Legacy has no corridor choice; it's USD only | Country / currency / channel picked from `providers.onswitch.coverage`; asset and network from the wallet-ready `assetRoutes` | §5 lines 364-377, §13 lines 1147-1149 |
| — (no legacy equivalent) | Legacy shows a fee % and computes the charge client-side | `createFiatQuote(input, key)` → `POST /fiat/quotes`, shown with `sourceAmount`, `destinationAmount`, `providerRate`, `providerFee`, `worldstreetFee` and the `expiresAt` countdown | §9.1 lines 641-705 |
| `fetchDollarBalances()` → `GET /api/dollar/balances` (line 218) | Checks the Dollar Account can cover the buy | **Removed from the onramp.** The onramp is paid by bank transfer, so no balance check applies | §9.2 lines 740-757 |
| `initiateBuy({ usdtAmount, network })` → `POST /api/buy` (line 398) | Debits the Dollar Account and sends USDT; 200 = delivered, 202 = in flight | `createFiatOrder({ provider: "onswitch", walletId, quoteId }, key)` → `POST /fiat/orders`, run through `runIdempotentMutation("order", …)`. 201 = record created, **not paid**; 200 = idempotent replay of the same order | §9.2 lines 707-757, §11 lines 966-969, §3.3 lines 147-157 |
| — (no legacy equivalent) | Legacy delivers straight away; nothing for the user to do | Render `providerDisplay.paymentInstructions` as plain text: amount, bank, account name, masked account number, `expiresAt` | §9.2 lines 755-757 |
| `fetchBuy(reference)` → `GET /api/buy/:reference` (lines 237, 283) | Polls 4s / 10s / 30s, gives up after 15 minutes (`buy-sell-client.tsx` `POLL_STEPS`) | `useFiatOrderPoll(orderId)` → `GET /fiat/orders/:id`, ladder 2s, 4s, 8s, 15s, 30s, then 45s, stopping on terminal states | §11 lines 976-980 |
| `savePendingFlow` / `readPendingFlow` / `clearPendingFlow` (`lib/pending-flow.ts`, **localStorage**) | Resumes an in-flight buy by reference after a refresh | Keep the same pattern but store the **order id** (not bank details) and resume with `GET /fiat/orders/:id`; if the id is lost, reload with `GET /fiat/orders` rather than creating another order | §11 lines 974-975 |
| Legacy statuses `pending`, `payment_confirmed`, `sending_usdt`, `completed`, `delivery_failed`, `cancelled` | Drive the four-step status screen | Backend order `state`: `created`/`quoted`, `awaiting_bank_deposit`, `provider_processing`/`scheduled`, `completed`, `manual_review`/`blocked`, `failed`/`reversed`/`refund_in_flight`/`refunded`/`refund_failed`. `providerStatus` is diagnostics only | §11 lines 947-963 |
| `CryptoApiError` message shown to the user (line 407) | Shows the service's message text | `describeFiatError` by `status` + `code`, keeping `requestId` for support | §4 lines 204-205, §12 lines 986-1094 |
| Network-failure copy "Something went wrong before anything was charged — it's safe to try again." (line 407) | Tells the user retrying is safe | **Must not carry over.** A status-0 failure is an uncertain outcome: the key is kept and the order may exist. Copy has to say the request is being checked, and the retry must reuse the key or reload the order | §12.3 lines 1140-1142 |
| `useWallet().addresses` (Privy) and `ReceivePanel asset="USDT"` (lines 164, 337, 664) | Chooses the delivery address; offers a receive panel | `walletId` from `useCryptoWallet()` (`hooks/crypto/useCryptoWallet.ts:9-21`). The destination address is the backend's business; the UI never picks one | §9.2 lines 710-722 |

---

## 4. `BuySellClient`, sell mode → OnSwitch offramp (CP7, disabled) or Bridge withdrawal (CP8, disabled)

Guide flows: §13 "OnSwitch local-fiat offramp" (lines 1157-1167) and
"Bridge USD offramp" (lines 1179-1186). Both ship behind
`FIAT_OFFRAMP_UI_ENABLED=false`; legacy sell stays live until then.

| Legacy call | What it does today | Replacement | Guide |
|---|---|---|---|
| `fetchSellInfo()` → `GET /api/sell/info` (line 206) | Fee %, min/max, enabled networks | `getFiatConfig()`, then `isOnswitchOfframpAvailable` + `onswitchCorridors(config, "offramp")`, or `isBridgeWithdrawalAvailable` | §5 lines 207-381 |
| — (no legacy equivalent) | Legacy credits the Dollar Account, so there's no payee to pick | `listFiatInstitutions({ country, currency, channel })`, then `createFiatBeneficiary(…, key)` with documented BANK fields only, and `listFiatBeneficiaries()` filtered to `status === "verified" && ownershipStatus === "verified"` | §8 lines 542-639 |
| — (no legacy equivalent) | — | OnSwitch: `createFiatQuote({ direction: "offramp", … }, key)`. Bridge has no quote step (fees are an open question, `FIAT_RAMP_CONTEXT.md` Q8) | §9.1 lines 658-670, §10.3 lines 890-945 |
| `fetchDollarBalances()` (line 218) | Shows the Dollar Account balance next to the sell | **Removed from the offramp.** The payout goes to a bank account, not the Dollar Account | §8, §10.3 |
| `initiateSell({ usdtAmount, network })` → `POST /api/sell` (line 399) | Backend moves USDT from the Privy wallet and credits the Dollar Account | OnSwitch: `createFiatOrder({ provider: "onswitch", walletId, quoteId, beneficiaryId }, key)`. Bridge: `createFiatOrder({ provider: "bridge", walletId, networkId, asset, amount, beneficiaryId, channel }, key)` (asset address is open question Q3) | §9.2 lines 715-722, §10.3 lines 894-912 |
| — (no legacy equivalent; the backend moved the funds) | — | The returned `cryptoIntent` is signed with the existing signing modules (simulate, sign, submit), not `createTransferIntent`. The deposit address is never editable | §9.2 lines 792-795, §10.3 lines 943-945 |
| — (no legacy equivalent) | — | OnSwitch only: `confirmFiatOrder(orderId, transactionHash, confirmKey)` after the broadcast, with a key separate from order creation. Bridge withdrawals never call confirm | §9.3 lines 797-809, §10.3 lines 943-945 |
| `fetchSell(reference)` (lines 237, 283) | Polls to `completed` / `failed` | `useFiatOrderPoll(orderId)` | §11 lines 976-980 |
| `ReceivePanel` / `useWallet().addresses` (line 724) | Legacy Privy addresses | Modern wallet via `walletId` | §9.2, §10.3 |

---

## 5. Legacy `FundClient` (not mounted) → no fiat replacement

These calls move money between the Dollar Account and Hyperliquid. None of
them is a fiat ramp, and no OnSwitch or Bridge route replaces them. The
component isn't rendered anywhere, so the port leaves it alone (kept, not
deleted, per the scope rules).

| Legacy call (`components/fund/fund-client.tsx`) | Route | Replacement |
|---|---|---|
| `fetchFundAvailability` | `GET /api/trading-wallet/fund/availability` | None needed. Live `/fund` uses `HyperliquidFundingClient` |
| `initiateFund` | `POST /api/trading-wallet/fund` | Same |
| `fetchFund` | `GET /api/trading-wallet/fund/:ref` | Same |
| `fetchTradingWithdrawInfo` | `GET /api/trading-wallet/withdraw/info` | Same |
| `initiateTradingWithdraw` | `POST /api/trading-wallet/withdraw` | Same |
| `fetchTradingWithdraw` | `GET /api/trading-wallet/withdraw/:ref` | Same |
| `fetchHlAccount`, `setupTradingWallet`, `fetchTradingWalletStatus` | `/api/trade/*`, `/api/trading-wallet/*` | Same |
| `fetchDollarBalances` | `GET /api/dollar/balances` | Same as section 6 |

---

## 6. Dollar Account read → stays as it is; Bridge sits beside it

| Legacy call | Where | Replacement |
|---|---|---|
| `fetchDollarBalances()` → `GET /api/dollar/balances` | `hooks/useCashBalance.ts:18`, plus `BuySellClient` and `FundClient` | **None.** The Dollar Account is a separate product and keeps its read. A Bridge virtual account is a deposit instruction, not a balance (guide lines 812-815), so it must not be added into this figure. Bridge USD appears as its own panel in the Dollar Account area (CP6): `listBridgeVirtualAccounts`, `createBridgeVirtualAccount`, `useFiatVirtualAccountPoll`, `useFiatVirtualAccountActivityPoll` |

---

## 7. New calls with no legacy equivalent

| New call | Used for | Checkpoint | Guide |
|---|---|---|---|
| `getFiatCompliance` | Compliance status on every screen that moves money | CP4 | §7 lines 434-460 |
| `createBridgeKycLink`, `syncBridgeCompliance` | Bridge hosted KYC, then "I've finished" | CP4 | §7 lines 461-541 |
| `createFiatCustomer` | OnSwitch profile form (does not block the onramp) | CP4 | §7 lines 503-524 |
| `createBridgeVirtualAccount`, `listBridgeVirtualAccounts`, `getBridgeVirtualAccount`, `listBridgeVirtualAccountActivity` | Bridge USD onramp in the Dollar Account area | CP6 | §10.1-10.2 lines 816-888 |
| `listFiatOrders` | Order history | CP9 | §6.2 line 422 |
| `getFiatQuote` | Reload a quote after navigation | CP5 | §9.1 lines 703-705 |

---

## 8. Questions to settle before CP5

- **Q1. Buy semantics.** Is it intended that the Buy button (and the modal's
  "Deposit" tab) stops spending the Dollar Account balance and becomes "pay by
  bank transfer, receive USDC in the modern wallet"? Or should OnSwitch sit
  beside the Dollar Account buy as a second option? The rollback flag design
  assumes replacement.
- **Q2. Sell semantics.** Legacy sell credits the Dollar Account. OnSwitch
  pays a local bank account and Bridge pays a US bank account. Which one takes
  over the Sell button once offramps are enabled, or is it a choice between
  rails based on `/fiat/config`?
- **Q3. "Fund".** `/fund` already runs on the modern wallet (Hyperliquid
  funding) and the legacy `FundClient` isn't mounted. Is "fund" in the
  decision about this page, or about funding the Dollar Account itself (which
  happens on the Worldstreet home, outside this repo)?
- **Q4. Users without a modern wallet.** Legacy buy/sell run on Privy
  wallets. The new flows need the self-custodial wallet's `walletId`. Should
  the OnSwitch path send users without one to wallet setup first?
- **Q5. Asset.** Legacy delivers USDT; the guide's example and Bridge use
  USDC. The UI will offer whatever `/fiat/config` returns. Confirm product is
  fine with the Buy screen no longer saying USDT.

Pre-existing inconsistency spotted along the way (not in scope, not
changed): the money modal's "From your Dollar Account" door says "Fund
directly from your Dollar Account into your trading account"
(`components/flows/money-doors.tsx:93-96`), but it opens
`HyperliquidFundingClient`, which funds from the modern wallet on Arbitrum
(`money-flow-modal.tsx:137-138`, `hyperliquid-funding-client.tsx`).
