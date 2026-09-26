# WorldStreet Fiat ↔ Crypto Implementation Guide

## Status

Phase 4/5 implementation baseline. The backend money-movement paths, provider
adapters, webhook/reconciliation services, and dashboard proxy/client contract
are implemented, but all provider mutation lanes remain fail-closed by default.
The planning sections below remain the architecture, compliance, testing, and
production-rollout source of truth.

Prepared on 2026-09-26 after reviewing the current OnSwitch and Bridge documentation and the WorldStreet dashboard and crypto-backend repositories.

## 1. Decisions locked for this release

The implementation should follow these product decisions:

1. Support every African fiat corridor that OnSwitch exposes through its coverage API, rather than hardcoding only NGN.
2. Deliver purchased stablecoins to the user's existing WorldStreet self-custodial wallet.
3. Provide both:
   - reusable USD deposit accounts for USD → stablecoin funding through Bridge; and
   - stablecoin → USD withdrawals to the user's verified bank account through Bridge.
4. Permit only beneficiary accounts owned by the authenticated user.
5. Keep this guide as the architecture, rollout, and operational source of truth
   while the implementation advances through the remaining UI and provider-gate work.

The phrase "all supported African OnSwitch stuff" is interpreted as all currently supported African country, currency, direction, and payment-channel corridors. Stablecoin and blockchain support remains subject to the compatibility matrix described below, because the provider asset catalog and WorldStreet wallet network catalog are separate systems.

## 2. Executive recommendation

Use the providers as fiat-rail and settlement adapters, not as the user's primary wallet provider.

The recommended boundary is:

    WorldStreet dashboard
      -> existing Next.js authenticated proxy
        -> worldstreet-crypto-backend
          -> OnSwitch adapter for African local-currency rails
          -> Bridge adapter for USD rails
          -> existing self-custodial wallet transaction-intent/signing system
          -> provider webhooks and reconciliation workers

Do not create OnSwitch wallets or Bridge custodial wallets for ordinary users in v1. Both products introduce a second crypto custody model and make the user's balance diverge from the existing WorldStreet self-custodial wallet.

Use:

- OnSwitch onramp for local fiat to stablecoin.
- OnSwitch offramp for stablecoin to African local fiat.
- Bridge virtual accounts for reusable USD deposit instructions and automatic delivery of stablecoins to the user's WorldStreet wallet.
- Bridge one-time crypto-to-fiat transfers for exact USD withdrawals. Add permanent Bridge liquidation addresses later if the product needs a reusable withdrawal address.
- WorldStreet wallet transaction intents for every user-signed crypto deposit to a provider address.

## 3. Provider capability findings

### 3.1 OnSwitch

OnSwitch's public API currently exposes:

- GET /coverage for supported countries, currencies, channels, directions, settlement times, and limits.
- GET /asset for supported stablecoin assets and per-asset onramp, offramp, swap, and wallet capability flags.
- GET /beneficiary/requirement for the beneficiary fields required by a corridor.
- GET /institution and POST /institution/lookup for bank/payment-institution discovery and account lookup.
- POST /onramp/quote and POST /onramp/initiate.
- POST /offramp/quote and POST /offramp/initiate.
- GET /payment/status and payment history endpoints.
- HMAC-signed webhooks for status changes.

Current documented African coverage includes:

| Country | Currency | Documented channels |
| --- | --- | --- |
| Benin | XOF | Mobile money |
| Cameroon | XAF | Mobile money |
| Côte d'Ivoire | XOF | Mobile money |
| Democratic Republic of Congo | CDF | Mobile money |
| Ethiopia | ETB | Mobile money |
| Gabon | XAF | Mobile money |
| Gambia | GMD | Mobile money |
| Ghana | GHS | Mobile money |
| Guinea | GNF | Mobile money |
| Kenya | KES | Mobile money, bank |
| Liberia | LRD | Mobile money |
| Malawi | MWK | Mobile money |
| Mali | XOF | Mobile money |
| Nigeria | NGN | Bank |
| Rwanda | RWF | Mobile money |
| Senegal | XOF | Mobile money |
| Sierra Leone | SLE | Mobile money |
| South Africa | ZAR | Bank |
| Tanzania | TZS | Mobile money, bank |
| Uganda | UGX | Mobile money |
| Zambia | ZMW | Mobile money |

This table is documentation context, not an application allowlist. At runtime the backend must call or refresh GET /coverage and expose only corridors returned by the current provider account. A corridor may be returned for only one direction, so the UI must not assume every listed currency supports both onramp and offramp.

For Nigeria, the current API contract documents:

- NG / NGN in both ONRAMP and OFFRAMP directions.
- BANK as the channel.
- Bank beneficiary fields including account_number, bank_code, holder_name, and holder_type.
- Account lookup through POST /institution/lookup.
- Optional sender_name, narration, reason, callback_url, refund_address, and reference fields.

OnSwitch's onramp returns local-currency bank deposit instructions. Its offramp returns a crypto deposit address and exact deposit amount. Dynamic offramp addresses are one-time-use and expire after approximately 30 minutes unless static is explicitly requested. The v1 design should use dynamic, one-time addresses.

OnSwitch authentication uses x-service-key on https://api.onswitch.xyz. Sandbox and production use the same host; the key determines the environment. Webhooks contain x-switch-signature and x-switch-timestamp. The signature is an HMAC-SHA256 hex digest of the raw request body using the service key.

OnSwitch has a wallet product that returns private key material during wallet creation and has an export endpoint. That product is deliberately out of scope for this integration. The WorldStreet backend must never persist an OnSwitch wallet private key for a normal user.

Primary references:

- [OnSwitch documentation index](https://docs.onswitch.xyz/llms.txt)
- [OnSwitch coverage API](https://docs.onswitch.xyz/api-reference/miscellaneous/get-coverage.md)
- [OnSwitch supported countries](https://docs.onswitch.xyz/countries.md)
- [OnSwitch supported assets](https://docs.onswitch.xyz/api-reference/miscellaneous/get-assets.md)
- [OnSwitch stablecoin to NGN flow](https://docs.onswitch.xyz/guides/stablecoin-to-ngn.md)
- [OnSwitch onramp initiation contract](https://docs.onswitch.xyz/api-reference/onramp/initiate.md)
- [OnSwitch webhooks](https://docs.onswitch.xyz/webhook.md)

### 3.2 Bridge

Bridge's current public documentation exposes:

- USD virtual accounts for ACH, wire, and FedNow-related flows.
- Transfers for fiat → crypto and crypto → fiat.
- External accounts for verified USD bank destinations.
- Liquidation addresses for permanent crypto → fiat routes.
- Bridge customer/KYC/KYB and endorsement flows.
- Webhooks for transfers, virtual-account activity, customers, external accounts, and other objects.

Bridge's documented USD routes include:

- USD onramp through ACH push, wire, ACH, same-day ACH, and FedNow where enabled.
- USD offramp through wire, ACH, same-day ACH, and FedNow where enabled.
- A reusable USD virtual account whose incoming deposits are converted and delivered to a configured crypto destination.
- A USD external account representing the user's bank account for withdrawals.

FedNow access is documented as invitation/beta-dependent and must be capability-checked before being displayed.

Bridge's virtual account is a bank deposit rail, not a spendable fiat ledger that WorldStreet should model as a locally held USD balance. Bridge's custodial wallet is a crypto custody product and is not required for the recommended design.

Bridge's current public supported-fiat-rail page lists USD, EUR, MXN, BRL, GBP, and COP rails; it does not list NGN. NGN therefore remains an OnSwitch responsibility.

Bridge uses:

- API keys in the Api-Key header.
- https://api.sandbox.bridge.xyz for sandbox.
- https://api.bridge.xyz for production.
- Idempotency-Key on every POST request.
- X-Webhook-Signature for webhook verification using the per-endpoint public key and raw request body.

Bridge sandbox has important limitations: no real money movement, no testnet support, dummy virtual accounts/liquidation addresses/transfers, and no payment webhooks. Customer creation and simulated KYC are supported. Payment webhook fixtures and reconciliation tests must therefore be generated locally.

Primary references:

- [Bridge welcome](https://apidocs.bridge.xyz/get-started/introduction/overview)
- [Bridge supported fiat rails](https://apidocs.bridge.xyz/get-started/introduction/what-we-support/payment-routes)
- [Bridge USD integration guide](https://apidocs.bridge.xyz/get-started/guides/move-money/usd-integration-guide)
- [Bridge virtual accounts](https://apidocs.bridge.xyz/platform/orchestration/virtual_accounts/virtual-account)
- [Bridge virtual-account API reference](https://apidocs.bridge.xyz/api-reference/virtual-accounts/create-a-virtual-account)
- [Bridge virtual-account activity](https://apidocs.bridge.xyz/api-reference/virtual-accounts/virtual-account-activity)
- [Bridge transfers](https://apidocs.bridge.xyz/platform/orchestration/transfers/transfer)
- [Bridge transfer states](https://apidocs.bridge.xyz/platform/orchestration/transfers/transfer-states)
- [Bridge external accounts](https://apidocs.bridge.xyz/platform/orchestration/external-accounts/external-accounts-api)
- [Bridge liquidation addresses](https://apidocs.bridge.xyz/get-started/guides/move-money/offramp_liquidation)
- [Bridge customer/KYC overview](https://apidocs.bridge.xyz/platform/customers/overview)
- [Bridge authentication](https://apidocs.bridge.xyz/api-reference/introduction/introduction)
- [Bridge idempotency](https://apidocs.bridge.xyz/api-reference/introduction/idempotence)
- [Bridge sandbox](https://apidocs.bridge.xyz/get-started/introduction/quick-start/setting-up-sandbox)
- [Bridge webhook signatures](https://apidocs.bridge.xyz/platform/additional-information/webhooks/signature)

## 4. Current repository constraints

The dashboard already proxies authenticated wallet API calls through app/api/crypto/[...path]/route.ts. Provider credentials must never be placed in the dashboard or forwarded to the browser. The dashboard should call only the crypto backend's typed fiat-ramp endpoints.

The crypto backend already owns:

- Clerk identity resolution.
- Wallet ownership and self-custodial wallet metadata.
- EVM, Solana, and other chain adapters.
- Transaction intents, simulation, local signing handoff, broadcasting, and transaction reconciliation.
- Transaction history and audit/security models.

The current backend network catalog is in src/config/networks.ts. It includes Ethereum, Arbitrum, Solana, Sui, TON, TRON, Bitcoin, and Intertrain entries, but not every chain present in the OnSwitch asset catalog. In particular, provider assets such as Base, Polygon, and BSC cannot be enabled merely because the provider advertises them. Each provider asset must map to an enabled WorldStreet network, a known token contract, decimals, and a wallet adapter capable of building and broadcasting the required transfer.

Before implementation, create a provider-asset compatibility matrix:

| Provider asset format | WorldStreet network | Token contract/config | User transfer supported | Enabled |
| --- | --- | --- | --- | --- |
| base:usdc | configured Base network | provider asset metadata | pending network support | false |
| ethereum:usdc | ethereum-mainnet | verified USDC contract | existing EVM adapter after mainnet gate | false until released |
| arbitrum:usdc | arbitrum-one | verified USDC contract | existing EVM adapter after mainnet gate | false until released |
| solana:usdc | solana-mainnet-beta | verified mint | existing Solana adapter after mainnet gate | false until released |

The final matrix must be generated from provider asset data plus WorldStreet configuration, not from an unreviewed list in a React component.

## 5. Security and credential policy

The credentials previously pasted into chat must be treated as compromised and rotated before any real integration work.

Non-negotiable rules:

1. Never hardcode an OnSwitch or Bridge key in TypeScript, Markdown examples, tests, Docker images, client bundles, or committed environment files.
2. Keep only placeholder names in .env.example.
3. Inject real keys through the deployment secret manager or server environment.
4. Keep provider clients in the crypto backend, never in the browser or dashboard proxy.
5. Do not log Authorization, Api-Key, x-service-key, webhook secrets, raw bank-account numbers, full beneficiary payloads, private keys, or full deposit instructions.
6. Store only bank-account last four digits and provider identifiers in ordinary API responses.
7. Encrypt sensitive beneficiary fields at rest with a key-management-backed envelope.
8. Keep webhook raw bodies available for signature verification.
9. Apply a replay window and event deduplication.
10. Do not trust a browser claim that a beneficiary belongs to the user. Ownership is a backend decision.

Suggested backend-only environment variables:

    ONSWITCH_API_BASE_URL=https://api.onswitch.xyz
    ONSWITCH_SANDBOX_SERVICE_KEY=
    ONSWITCH_LIVE_SERVICE_KEY=
    ONSWITCH_ACCOUNT_APPROVED=false
    ONSWITCH_WEBHOOK_CONFIGURED=false

    BRIDGE_SANDBOX_API_BASE_URL=https://api.sandbox.bridge.xyz
    BRIDGE_LIVE_API_BASE_URL=https://api.bridge.xyz
    BRIDGE_SANDBOX_API_KEY=
    BRIDGE_LIVE_API_KEY=
    BRIDGE_WEBHOOK_PUBLIC_KEY=
    BRIDGE_ACCOUNT_APPROVED=false
    BRIDGE_WEBHOOK_CONFIGURED=false
    BRIDGE_FEDNOW_ENABLED=false

    FIAT_RAMP_ENABLED=false
    FIAT_COMPLIANCE_APPROVED=false
    FIAT_RAMP_ALLOWED_USERS=
    FIAT_RAMP_DISABLED_CORRIDORS=
    FIAT_RAMP_DEFAULT_ASSET=
    FIAT_RAMP_DEFAULT_NETWORK=
    FIAT_RAMP_MAX_ORDER_USD=
    FIAT_RAMP_DAILY_USER_LIMIT_USD=
    FIAT_RAMP_QUOTE_TTL_SECONDS=

The OnSwitch sandbox key belongs in ONSWITCH_SANDBOX_SERVICE_KEY. The Bridge sandbox key must be a sandbox key and must be sent to the sandbox host. A credential with a live-key prefix must not be configured as a sandbox key.

## 6. Customer, wallet, and ownership model

### 6.1 WorldStreet wallet

The user's existing WorldStreet wallet remains the canonical crypto wallet:

- Its EVM or Solana address is the destination of an onramp.
- It signs the user's crypto deposit to an off-ramp provider address.
- WorldStreet balance and transaction history remain the source of truth for on-chain holdings.
- Provider balances are not copied into a second internal wallet.

For EVM users, the same address may be usable across multiple EVM networks, but the provider destination still names a specific payment rail. Store the chosen network explicitly.

### 6.2 Bridge customer

Bridge requires a customer object and KYC/KYB eligibility for money movement. Create one Bridge customer mapping per WorldStreet user and persist:

- provider customer ID;
- WorldStreet user ID;
- onboarding/KYC state;
- country and address snapshot used for the provider;
- terms acceptance state;
- endorsement/rail eligibility state;
- last provider synchronization time.

The customer ID must be server-owned and never accepted from the browser without checking the authenticated user mapping.

### 6.3 OnSwitch identity

OnSwitch's public contract is service-key based and does not expose the same customer object model as Bridge. WorldStreet must still create a local provider identity record for:

- the user's verified legal name;
- country/residence;
- OnSwitch beneficiary IDs;
- AML lookup references;
- local compliance decision;
- supported corridor permissions.

Do not rely on OnSwitch's service account as proof that a WorldStreet user is eligible.

### 6.4 Own-account-only policy

Every saved payout destination must have:

- owner user ID;
- provider;
- country and currency;
- channel;
- provider beneficiary or external-account ID;
- normalized holder name;
- verification status;
- last four digits or masked phone;
- created and last-verified timestamps;
- immutable audit history.

The backend must reject:

- a beneficiary whose legal holder name does not match the user's verified identity;
- a provider account ID belonging to another WorldStreet user;
- a destination edited after verification without re-verification;
- a payout to an arbitrary address or account supplied only at order time;
- third-party beneficiary fields.

For Nigerian bank accounts, use institution lookup/account resolution and require the resolved account name to match the user's verified legal name according to a defined normalization policy. For mobile money, require the strongest ownership evidence supported by the corridor, such as provider verification, OTP/phone ownership, or a manual-review path. If the provider cannot establish mobile-money ownership, that corridor must remain disabled under the own-account-only policy.

## 7. Domain model

Add provider-neutral models in the crypto backend. Keep provider payloads in a redacted provider-data field or encrypted blob; do not make the dashboard depend directly on provider response shapes.

### 7.1 FiatProviderCustomer

Fields:

- userId;
- provider: onswitch or bridge;
- providerCustomerId;
- status;
- country;
- kycStatus;
- termsAcceptedAt;
- endorsement snapshot;
- createdAt and updatedAt.

Unique index: userId + provider.

### 7.2 FiatBeneficiary

Fields:

- userId;
- provider;
- direction;
- country;
- currency;
- channel;
- providerBeneficiaryId or providerExternalAccountId;
- holderType;
- normalizedHolderName;
- maskedAccount;
- ownershipStatus;
- verification metadata;
- encrypted provider fields;
- status and audit timestamps.

Unique index: userId + provider + provider destination ID.

### 7.3 FiatQuote

Fields:

- userId;
- provider;
- direction;
- country/currency/channel;
- source amount and currency;
- destination amount and currency;
- asset and network;
- provider rate;
- provider fee;
- WorldStreet fee;
- expected settlement time;
- provider quote expiry;
- request fingerprint;
- immutable raw response hash;
- acceptedAt.

Use decimal strings or Decimal128. Do not calculate money with JavaScript Number.

### 7.4 FiatOrder

Fields:

- internal order ID and public reference;
- userId and walletId;
- provider;
- direction;
- corridor;
- asset/network;
- beneficiary ID;
- quote ID and immutable pricing snapshot;
- provider reference/transfer ID;
- provider idempotency key;
- deposit instructions, encrypted or redacted as appropriate;
- local crypto intent ID and transaction record ID;
- expected and observed deposit amount;
- observed transaction hash;
- provider status and normalized status;
- local state;
- failure/reversal/review reason;
- created, updated, expiry, and completion timestamps.

Unique indexes:

- provider + provider reference;
- provider + idempotency key;
- userId + public reference;
- provider + observed deposit transaction hash where available.

### 7.5 FiatWebhookEvent

Fields:

- provider;
- provider event ID or deterministic event fingerprint;
- event type;
- provider object/reference;
- raw body hash;
- signature verification result;
- firstSeenAt and processedAt;
- processing result/error.

Unique index: provider + provider event ID/fingerprint.

### 7.6 FiatLedgerEntry

Use a provider-neutral ledger projection rather than treating a fiat payout as a normal on-chain transfer:

- fiat_onramp_pending;
- fiat_onramp_completed;
- fiat_offramp_crypto_submitted;
- fiat_offramp_completed;
- fiat_offramp_failed;
- fiat_offramp_reversed;
- provider_fee;
- WorldStreet_fee;
- refund.

Link every ledger row to FiatOrder, provider reference, quote snapshot, and any on-chain TransactionRecord.

## 8. Normalized state machines

### 8.1 Local order states

Use a monotonic state machine with explicit exception paths:

    created
      -> quoted
      -> awaiting_beneficiary
      -> awaiting_bank_deposit
      -> awaiting_crypto_deposit
      -> crypto_intent_ready
      -> crypto_submitted
      -> provider_processing
      -> completed

Exception paths:

    quoted -> expired
    awaiting_* -> cancelled
    provider_processing -> failed
    provider_processing -> scheduled
    provider_processing -> blocked
    completed -> reversed
    crypto_submitted -> manual_review

The browser may request refresh, but it cannot transition an order to completed.

### 8.2 OnSwitch statuses

Normalize at least:

- AWAITING_DEPOSIT → awaiting_bank_deposit or awaiting_crypto_deposit;
- PROCESSING → provider_processing;
- COMPLETED → completed;
- FAILED → failed;
- REVERSED → reversed;
- SCHEDULED → scheduled;
- BLOCKED → blocked.

Keep the raw status because the public OpenAPI enum and webhook documentation do not expose exactly the same status set.

### 8.3 Bridge statuses

Normalize at least:

- awaiting_funds → awaiting_bank_deposit or awaiting_crypto_deposit;
- in_review → manual_review;
- funds_received → provider_processing;
- payment_submitted → provider_processing;
- payment_processed → completed;
- undeliverable → failed/manual_review;
- returned, refund_in_flight, refunded, refund_failed → explicit refund states;
- missing_return_policy → blocked;
- canceled → cancelled;
- error → failed/manual_review.

Bridge states do not move backward through the normal happy path. The reconciler must preserve exception and refund semantics.

## 9. OnSwitch African flows

### 9.1 Runtime capability discovery

At backend startup and on a scheduled refresh:

1. Fetch OnSwitch assets.
2. Fetch ONRAMP coverage.
3. Fetch OFFRAMP coverage.
4. Store a short-lived, versioned capability snapshot.
5. Intersect provider assets with the WorldStreet provider-asset compatibility matrix.
6. Expose only enabled corridors and assets through GET /fiat/config.

Do not hardcode the current country table as the production source of truth. The UI may use the cached backend capability snapshot for rendering.

### 9.2 African fiat → stablecoin onramp

1. The user selects country, fiat currency, channel, stablecoin, network, and destination WorldStreet wallet account.
2. The backend verifies the corridor and asset are enabled for ONRAMP.
3. The backend verifies the destination address belongs to the authenticated user's wallet.
4. If the user selects a saved beneficiary, verify ownership and status. Otherwise build an inline beneficiary from the canonical wallet address and verified legal name.
5. If the channel is mobile money, collect the provider-required payer number and network.
6. Request a quote with amount, country, asset, currency, channel, exact-output mode, and any disclosed WorldStreet fee.
7. Store the immutable quote and expiry.
8. After explicit user confirmation, initiate the onramp with:
   - a generated UUID reference;
   - callback URL;
   - the verified wallet beneficiary;
   - selected channel;
   - exact-output flag;
   - provider-required payer details;
   - no hidden fee.
9. Persist the returned local-currency bank or mobile-money deposit instructions and expiry.
10. Display exact amount, account/phone details, reference/memo, expiry, fees, exchange rate, destination asset/network, and expected settlement time.
11. Wait for the signed webhook and/or status requery.
12. Mark the order completed only after OnSwitch reports completion and the destination crypto transfer is observable or provider-confirmed.
13. Reconcile the provider transaction and WorldStreet on-chain balance/history.

The dashboard should not ask the user to paste an arbitrary wallet address in this flow. The wallet destination comes from the selected WorldStreet wallet account.

### 9.3 Stablecoin → African fiat offramp

1. The user selects asset/network and desired source amount or exact local-currency output.
2. The backend verifies the asset/network mapping and wallet ownership.
3. The user selects an already verified own-account beneficiary.
4. The backend rechecks beneficiary ownership, corridor availability, and daily limits.
5. Request a quote with provider-supported source asset, country, currency, channel, and exact-output mode.
6. Store the quote and expiry.
7. Initiate the off-ramp with:
   - a generated UUID reference;
   - the verified beneficiary;
   - callback URL;
   - reason/purpose where required;
   - a refund address that resolves to the user's WorldStreet wallet;
   - static=false for a one-time deposit address.
8. Persist the exact provider deposit asset, amount, address, expiry, and notes.
9. Create a WorldStreet transfer intent that sends exactly the provider deposit amount to exactly the provider deposit address on exactly the provider network.
10. Present a human-readable signing review containing:
    - provider and corridor;
    - crypto amount and asset;
    - destination provider address;
    - expected local-currency amount;
    - rate and all fees;
    - quote expiry;
    - deposit-address expiry;
    - refund policy.
11. The browser signs with the existing WorldStreet wallet and submits through the current crypto backend.
12. Store the resulting transaction hash against FiatOrder.
13. Call OnSwitch payment confirmation with the reference and transaction hash when the provider contract requires it.
14. Wait for webhook/status confirmation, reconcile the on-chain deposit, and update the local order.
15. Only show completed when the provider confirms the fiat payout. If the provider fails or reverses, surface the exact recovery/refund state.

Never automatically retry POST /offramp/initiate after a timeout without first querying the order/reference. A second initiation can create a second deposit address and a duplicate payout obligation.

### 9.4 Corridor-specific UI

The UI must be schema-driven:

- BANK: render provider-required bank fields and account-resolution feedback.
- MOBILEMONEY: render provider-required network, phone number, and any additional fields.
- Country/currency: derived from coverage, not a fixed country switch.
- Beneficiary requirements: fetched from GET /beneficiary/requirement.
- Bank codes/institutions: fetched from GET /institution, never copied from a stale frontend list.
- Limits and settlement estimates: display the selected coverage snapshot and quote response.

## 10. Bridge USD flows

### 10.1 Bridge customer onboarding

1. Create or retrieve the Bridge customer mapping for the WorldStreet user.
2. Collect the information Bridge requires for the user's country and customer type.
3. Accept Bridge terms where required.
4. Complete Bridge KYC/KYB or hosted onboarding.
5. Wait for approved customer status and the required USD rail endorsement.
6. Cache only the provider status and identifiers; do not expose provider API keys.

Do not provision a USD account before Bridge confirms the user and rail are eligible.

### 10.2 Reusable USD virtual account → WorldStreet stablecoin

The first USD funding product should be a reusable Bridge virtual account tied to a fixed destination configuration.

1. The user completes Bridge eligibility.
2. The backend chooses a configured stablecoin/network that is present in the compatibility matrix.
3. Create a virtual account for the Bridge customer:
   - source currency: USD;
   - destination payment rail: selected blockchain;
   - destination currency: selected stablecoin;
   - destination address: the user's WorldStreet wallet address;
   - optional disclosed developer fee.
4. Persist the virtual account ID and redacted deposit instructions.
5. Display the USD bank name, routing/account details, accepted rails, beneficiary name, any deposit memo, supported sender policy, fees, and expected timing.
6. Receive Bridge virtual_account.activity webhook events.
7. Requery the virtual account or related activity before changing local state.
8. When Bridge reports delivery, wait for the destination crypto transaction or provider-confirmed destination hash.
9. Refresh the WorldStreet wallet balance and transaction history.

The destination address and asset/network must be immutable from the user's perspective. A user who changes their wallet destination must create a new virtual account or go through an explicit, audited reconfiguration flow.

One virtual account may not be assumed to support every blockchain or stablecoin. Create one record per provider-supported source/destination combination and display only those configured for the user's wallet.

### 10.3 Stablecoin → USD bank withdrawal

For the initial withdrawal product, use a one-time Bridge transfer because it carries an exact amount and a clear transfer state.

1. Collect the user's US bank account details or use the approved Bridge account-linking flow.
2. Create a Bridge external account for the authenticated Bridge customer.
3. Verify the account owner and bank-account eligibility.
4. Store the Bridge external-account ID, masked account, currency, and verification state.
5. Request a USD offramp quote or calculate the exact provider amount according to the Bridge contract available to the account.
6. Create a Bridge transfer with:
   - source crypto payment rail and currency;
   - source user address where supported;
   - destination USD payment rail;
   - Bridge external-account ID;
   - on_behalf_of Bridge customer ID;
   - a unique Idempotency-Key.
7. Persist Bridge source_deposit_instructions.
8. Create a WorldStreet transfer intent to the exact Bridge deposit address, amount, token, and network.
9. Ask the user to sign and submit the transaction.
10. Track Bridge transfer events through payment_processed or an exception/refund state.
11. Reconcile the final USD payout with the external account and user's transaction history.

Use ACH, wire, same-day ACH, or FedNow only when the external account and Bridge account capability snapshot says the rail is supported. Do not display FedNow merely because it exists in documentation.

Permanent Bridge liquidation addresses are a later optimization for frequent withdrawals. If enabled later, create one per user, asset/network, USD external account, and configured return policy; do not use a permanent address until the operational refund and reconciliation policy is approved.

### 10.4 What "USD wallet" means in this design

WorldStreet should describe the product accurately:

- USD virtual account: reusable bank deposit instructions for receiving USD.
- USD bank withdrawal: payout to a verified USD external account.
- WorldStreet wallet: user's stablecoin wallet.
- Bridge custodial wallet: optional provider custody, not used in v1.
- Local fiat balance: not held or maintained by WorldStreet unless a separately approved ledger and custody product is built.

Do not display an unspent virtual-account deposit as a WorldStreet USD wallet balance. Credit only provider-confirmed money movement and distinguish pending fiat deposits from available crypto.

## 11. Provider-neutral backend API

The dashboard should call provider-neutral routes. Provider-specific identifiers remain server-side.

Recommended authenticated routes:

    GET    /v1/fiat/config
    GET    /v1/fiat/compliance
    POST   /v1/fiat/compliance/customer
    POST   /v1/fiat/compliance/bridge/kyc-link
    POST   /v1/fiat/compliance/bridge/sync
    GET    /v1/fiat/institutions
    GET    /v1/fiat/beneficiaries
    POST   /v1/fiat/beneficiaries
    DELETE /v1/fiat/beneficiaries/:beneficiaryId
    POST   /v1/fiat/quotes
    GET    /v1/fiat/quotes/:quoteId
    POST   /v1/fiat/orders
    GET    /v1/fiat/orders
    GET    /v1/fiat/orders/:orderId
    POST   /v1/fiat/orders/:orderId/confirm
    POST   /v1/fiat/bridge/virtual-accounts
    GET    /v1/fiat/bridge/virtual-accounts
    GET    /v1/fiat/bridge/virtual-accounts/:accountId

Recommended unauthenticated provider webhook routes:

    POST /webhooks/fiat/onswitch
    POST /webhooks/fiat/bridge

Webhook routes must identify the provider from the route, verify the raw request body, durably deduplicate the event, apply only a provider-authoritative status transition, and return a 2xx response. They must not depend on Clerk user authentication. Unmatched events are retained as ignored events for reconciliation; they never create a user/order mapping from provider-controlled data.

Recommended internal/operator routes:

    POST /internal/v1/fiat/onswitch/compliance/:userId
    POST /internal/v1/fiat/beneficiaries/:beneficiaryId/ownership-review
    POST /internal/v1/fiat/reconcile

Operator actions must be narrowly scoped. There must be no generic endpoint that changes an order to completed.

The current Phase 3 beneficiary endpoint is provider-neutral. Its `providerPayload`
is accepted only by the backend, redacted before persistence, and never returned
to the dashboard. Provider-specific beneficiary requirement schemas should be
added to the API once each corridor is enabled; a frontend must not invent bank,
mobile-money, or Bridge account fields.

## 12. Dashboard integration

The dashboard proxy/client portion is implemented for the current backend contract:

- `lib/crypto-backend/types.ts` contains typed quotes, orders, Bridge virtual accounts, and virtual-account activity.
- `lib/crypto-backend/client.ts` exposes the quote/order/confirmation/virtual-account/activity methods and sends `Idempotency-Key` as a header.
- `app/api/crypto/[...path]/route.ts` allowlists the new authenticated GET/POST paths.

Remaining UI work is intentionally separate from the provider integration:

1. Add query keys for order, quote, virtual-account, and activity resources scoped by authenticated user and resource ID.
2. Add hooks for capability discovery, beneficiaries, quotes, orders, and virtual accounts.
3. Add a unified Funding/Withdraw flow with provider and corridor labels.
4. Reuse the existing wallet unlock and transaction-intent signing components for crypto deposits.
5. Add transaction-history normalization for fiat_onramp and fiat_offramp records.
6. Show pending, scheduled, blocked, reversed, refunded, and manual-review states distinctly.
7. Never render raw provider payloads or provider account identifiers.

The dashboard should not contain OnSwitch or Bridge SDKs, keys, provider-specific signing logic, bank account ownership decisions, or webhook processing.

## 13. Provider adapter design

Create a common interface with provider-specific implementations:

    interface FiatRailProvider {
      getCapabilities(direction): Promise<CapabilitySnapshot>
      getQuote(input): Promise<NormalizedQuote>
      createOnramp(input): Promise<NormalizedOrder>
      createOfframp(input): Promise<NormalizedOrder>
      getOrderStatus(reference): Promise<NormalizedOrderStatus>
      verifyWebhook(rawBody, headers): VerifiedWebhook
      normalizeWebhook(event): ProviderEvent
    }

OnSwitch adapter responsibilities:

- x-service-key authentication;
- coverage and asset catalog;
- dynamic beneficiary requirements;
- institution lookup;
- quote/initiate/status/confirm calls;
- callback signature verification;
- status normalization;
- redaction of bank and personal data.

Bridge adapter responsibilities:

- sandbox/live base URL selection;
- Api-Key authentication;
- customer/KYC/endorsement state;
- external accounts;
- virtual accounts;
- transfers;
- liquidation addresses if later enabled;
- Idempotency-Key generation and replay;
- X-Webhook-Signature verification;
- Bridge event/status normalization.

Provider clients must use explicit timeouts, bounded retries, structured error mapping, and request IDs. Retry GET/status calls freely within limits; retry POST only with the same idempotency identity and the same body when the provider contract guarantees it.

## 14. Idempotency and failure handling

### 14.1 Local idempotency

Every browser mutation must carry or receive an internal idempotency key. The backend stores:

- authenticated user ID;
- operation type;
- normalized request hash;
- provider;
- provider idempotency/reference;
- response snapshot;
- status.

A repeated request with the same key and a different body must be rejected.

### 14.2 Provider idempotency

Bridge requires Idempotency-Key on every POST and documents a 24-hour guarantee. Generate one key per logical provider mutation, store it, and reuse it with the identical body for safe retries.

OnSwitch documents a reference field but does not document a Bridge-style Idempotency-Key contract. Treat OnSwitch initiation as non-idempotent unless the provider confirms otherwise:

1. write the local order and UUID reference before initiation;
2. prevent concurrent initiation for the same local order;
3. on timeout, query by reference/address/status before retrying;
4. require manual review when the result remains unknown.

### 14.3 Webhook processing

Webhook handling must be at-least-once safe:

1. read raw bytes;
2. verify timestamp/signature;
3. reject stale or invalid events;
4. insert the event under a unique provider event key;
5. acknowledge quickly;
6. process in a worker;
7. requery the provider for ambiguous payloads;
8. apply only valid monotonic transitions;
9. record the raw body hash and processing result.

Out-of-order webhooks must not move a completed order back to awaiting deposit. Reversal/refund transitions require explicit provider evidence.

## 15. Fees, quotes, and amounts

Every order must preserve the exact quote used for the customer confirmation:

- provider rate;
- provider exchange fee;
- provider network/gas fee if returned;
- WorldStreet developer/service fee;
- source amount;
- destination amount;
- quote expiry;
- expected settlement time;
- rounding rule;
- provider and asset/network.

Use integer minor units or decimal strings. For stablecoins, preserve token decimals from the provider asset metadata and the WorldStreet token configuration. For fiat, preserve the currency's minor-unit rules and provider rounding.

Do not use a later live rate to rewrite a historical order. If the quote expires before initiation, request a new quote and require confirmation again.

## 16. Compliance and operational controls

Before production:

- Obtain written provider confirmation that WorldStreet may offer the selected African corridors and USD products to its target user countries.
- Confirm Bridge KYC/KYB, terms, endorsement, and supported-country requirements.
- Confirm OnSwitch's compliance, AML, sanctions, PEP, and transaction-purpose requirements per country.
- Define transaction limits, velocity limits, daily limits, and manual-review thresholds.
- Define how a blocked, reversed, returned, or refunded order is communicated.
- Define who owns provider liquidity and who monitors it.
- Define chargeback/return handling for fiat deposits.
- Define customer support evidence: order reference, provider reference, transaction hash, masked beneficiary, status timeline.
- Obtain legal/compliance approval for each active African country and USD banking corridor.

The provider's sandbox approval is not a production compliance approval.

## 17. Testing plan

### 17.1 Unit tests

Cover:

- provider capability intersection;
- country/currency/channel/direction validation;
- asset/network mapping;
- exact-output calculations;
- decimal and rounding behavior;
- quote expiry;
- fee calculation;
- own-account name normalization;
- beneficiary state transitions;
- provider status mapping;
- webhook signature verification;
- replay-window rejection;
- webhook deduplication;
- monotonic state transitions;
- provider error normalization;
- idempotency body mismatch;
- refund-address validation.

### 17.2 OnSwitch contract fixtures

Maintain fixtures for:

- every current African coverage row;
- both directions where returned;
- bank and mobile-money channels;
- NGN account lookup success and mismatch;
- quote and initiation responses;
- dynamic crypto deposit instructions;
- dynamic bank deposit instructions;
- COMPLETED, FAILED, REVERSED, SCHEDULED, and BLOCKED webhooks;
- invalid signature, stale timestamp, duplicate event, and out-of-order event.

The test matrix must be generated from the cached capability fixture so a new provider corridor does not silently bypass validation.

### 17.3 Bridge contract fixtures

Maintain fixtures for:

- customer creation and KYC approval;
- USD virtual-account creation;
- virtual-account activity;
- US external-account creation/verification;
- ACH, wire, same-day ACH, and FedNow capability differences;
- crypto source deposit instructions;
- transfer states from awaiting_funds through payment_processed;
- returned/refunded/undeliverable/error paths;
- Bridge webhook signature parsing and event_id deduplication.

Because Bridge sandbox does not fire payment webhooks, replay local signed webhook fixtures in integration tests.

### 17.4 End-to-end scenarios

At minimum:

1. African bank onramp to the existing EVM wallet.
2. African bank offramp from the existing EVM wallet.
3. African mobile-money onramp where the corridor supports it.
4. African mobile-money offramp with ownership verification.
5. USD virtual-account onramp to the existing wallet.
6. USD bank withdrawal from the existing wallet.
7. Expired quote before initiation.
8. Expired provider deposit address.
9. Duplicate button click and browser reload.
10. Provider timeout after a successful remote creation.
11. Duplicate and out-of-order webhooks.
12. Chain transaction failure or wrong token/network rejection.
13. Provider reversal/refund.
14. Cross-user beneficiary ID and order ID attacks.
15. Provider-asset route advertised but WorldStreet network disabled.

## 18. Implementation phases

### Phase 0 — Credential and provider readiness

Exit gate:

- exposed credentials rotated;
- separate sandbox/live secrets configured server-side;
- OnSwitch sandbox account enabled;
- Bridge sandbox account and sandbox key confirmed;
- Bridge webhook public key and endpoint setup documented;
- provider commercial/compliance access confirmed.

### Phase 1 — Capability and compatibility catalog

Work:

- build provider clients for GET /coverage and GET /asset;
- build Bridge route/account capability discovery;
- add the WorldStreet provider-asset matrix;
- expose a redacted capability endpoint;
- add feature flags and per-corridor kill switches (`FIAT_RAMP_DISABLED_CORRIDORS`).

Exit gate:

- the UI can render all currently enabled OnSwitch African corridors dynamically;
- unsupported WorldStreet networks are hidden;
- no provider secret appears in a response.

Implementation status (phase 0/1): the backend now contains a fail-closed
provider configuration/readiness layer, read-only OnSwitch capability clients,
a Bridge USD route/customer capability client, a provider-asset to WorldStreet
network compatibility catalog, and `GET /v1/fiat/config`. The dashboard exposes
the endpoint through `/api/crypto/fiat/config` and has typed query support. The
operational runbook is in `worldstreet-crypto-backend/docs/runbooks/fiat-ramp-phase-0-1.md`.
At the Phase 0/1 baseline, all flags defaulted to disabled and the
readiness/catalog implementation did not create quotes, accounts,
beneficiaries, withdrawals, or transfers. Later phase sections below describe
the now-implemented guarded mutations.

### Phase 2 — Durable domain and provider adapters

Work:

- add provider customer, beneficiary, quote, order, webhook, and ledger models;
- implement idempotency;
- implement status normalization;
- implement provider request redaction and structured errors;
- add webhook raw-body handling before JSON parsing.

Exit gate:

- provider fixtures pass;
- concurrent duplicate creates produce one local order;
- webhook replay and out-of-order tests pass.

Implementation status (phase 2 foundation): the backend now contains durable
provider-customer, beneficiary, quote, order, webhook-event, ledger, and
idempotency models; a local order-draft service; provider-neutral OnSwitch and
Bridge adapters; deterministic request fingerprints; redacted provider errors
and payload snapshots; normalized provider status transitions; and raw-body
webhook ingestion with replay-window and signature validation. At that phase
boundary, webhooks were acknowledged only after a verified, deduplicated event
was stored and the local order-draft/idempotency primitives were ready for the
later identity and money-movement phases. The remaining provider-fixture and
operational approval gate still applies before enabling a mutation lane.

### Phase 3 — Identity, KYC, and own-account beneficiaries

Work:

- Bridge customer/KYC mapping;
- OnSwitch local compliance mapping;
- bank institution lookup;
- account-name verification;
- mobile-money ownership verification;
- beneficiary create/list/deactivate flows;
- audit logs.

Exit gate:

- a user cannot use another user's beneficiary or external-account ID;
- mismatched names cannot be saved or paid;
- provider KYC/eligibility blocks money movement.

Implementation status (phase 3 foundation): the backend now contains user-scoped
provider-customer mappings, a hosted Bridge KYC-link route, Bridge customer/KYC
sync, a protected OnSwitch local-compliance decision route, OnSwitch institution
discovery, own-account beneficiary create/list/deactivate/review routes,
account-owner name normalization and hashing, provider verification handling,
and append-only audit events. The backend enforces the existing Clerk-to-WorldStreet user
boundary on every customer and beneficiary query and verifies that a Bridge
external account is attached to the mapped Bridge customer before it can be
used.

The Bridge KYC-link route is the recommended onboarding path. The direct Bridge
customer route remains available for an approved, server-controlled integration
that already has the required individual fields. Bridge external-account
verification is applied for the account types documented by Bridge; US ACH does
not provide the same provider verification endpoint, so an ACH beneficiary
remains pending/manual-review and cannot be paid under the own-account-only
policy until an independent ownership control is added. OnSwitch corridors with
no provider-returned account-owner evidence also remain pending/manual-review.

Provider mutations remain fail-closed until the corresponding sandbox or
production configuration is approved. The provider sandbox contracts still
need controlled integration fixtures before enabling a live mutation lane.

### Phase 4 — OnSwitch African onramp/offramp

Work:

- quotes;
- dynamic bank/mobile-money deposit instructions;
- crypto deposit intent generation;
- OnSwitch confirmation/status/webhooks;
- refunds and manual review;
- unified history.

Exit gate:

- one bank onramp and one bank offramp reconcile end-to-end in sandbox/controlled testing;
- at least one supported mobile-money corridor passes its ownership and payout test;
- all enabled corridors are capability-driven.

Implementation status (Phase 4): the backend now contains an OnSwitch quote
route and expiring quote model, capability-driven corridor/asset validation,
provider-backed onramp/offramp initiation, dynamic bank/mobile-money or crypto
deposit instructions, an owner-scoped wallet transfer intent for crypto
deposits, OnSwitch confirmation, order status requery, monotonic webhook
processing, and user-scoped order history. Provider references and raw payloads
remain server-side; only selected payment instructions are returned to the
authenticated owner. Refund/reversal/blocked/manual-review states are modeled
and reconciled, but automatic refund creation is intentionally not enabled
until the provider's refund contract and operations policy are approved.

Implemented authenticated routes:

```text
POST /v1/fiat/quotes
GET  /v1/fiat/quotes/:quoteId
POST /v1/fiat/orders
GET  /v1/fiat/orders
GET  /v1/fiat/orders/:orderId
POST /v1/fiat/orders/:orderId/confirm
```

An OnSwitch offramp order returns a normal WorldStreet transaction intent when
the provider returns a deposit address and the asset is mapped to a local token
contract. The client signs/submits that intent through the existing wallet
transaction flow, then calls the confirm route with the resulting transaction
hash. No provider deposit is accepted from a browser-supplied arbitrary address.

### Phase 5 — Bridge USD virtual account and withdrawal

Work:

- Bridge customer eligibility;
- reusable virtual accounts mapped to WorldStreet wallet destination;
- USD external accounts;
- one-time crypto-to-USD transfer;
- USD webhook/status/reconciliation;
- ACH/wire capability display;
- FedNow gated by account capability.

Exit gate:

- a verified user can obtain USD deposit instructions and receive stablecoins in the existing wallet;
- the same user can withdraw stablecoins to their own verified USD bank account;
- returned/refunded/undeliverable states are recoverable.

Implementation status (Phase 5): the backend now contains a Bridge virtual
account model and owner-scoped create/list/get routes. A virtual account is
created with USD as the source and a selected wallet-owned USDC destination;
bank deposit instructions are fetched live and returned only to that owner,
while the persisted provider snapshot is redacted. Bridge USD withdrawals use
the documented crypto `from_address` source, a verified own-account external
account, a USD ACH/ACH-same-day/wire/FedNow destination, and a returned crypto
deposit address wired into the existing wallet signing intent flow.

Implemented authenticated routes:

```text
POST /v1/fiat/bridge/virtual-accounts
GET  /v1/fiat/bridge/virtual-accounts
GET  /v1/fiat/bridge/virtual-accounts/:accountId
GET  /v1/fiat/bridge/virtual-accounts/:accountId/activity
POST /v1/fiat/orders          # provider=bridge for USD withdrawal
```

Bridge does not expose a quote endpoint in this adapter, so USD withdrawals
accept a bounded source USDC amount and retain the provider response/status as
the authoritative execution record. FedNow is still shown/accepted only when
the account-level feature gate is enabled and the external account has passed
the own-account verification policy. Bridge sandbox limitations mean webhook,
bank settlement, and on-chain reconciliation must be exercised with signed
local fixtures before any production enablement. The internal reconciler also
uses Bridge's per-virtual-account `/history` endpoint to persist redacted
`funds_received`, `payment_submitted`, and `payment_processed` activity with
destination transaction hashes.

### Phase 6 — Production rollout with one master switch

Roll out in this order:

1. Read-only capability discovery.
2. Internal test users only.
3. One low-limit African bank corridor.
4. Additional African corridors by coverage and compliance approval.
5. USD virtual accounts.
6. USD withdrawals.
7. Mobile-money corridors after ownership and settlement evidence.

Use exactly one fiat-ramp kill switch: `FIAT_RAMP_ENABLED` in the backend
runtime environment. When it is `false`, no new fiat-ramp capability or
money-movement lane is enabled. When it is `true`, all configured OnSwitch and
Bridge lanes are eligible to operate, subject to provider credentials, account
approval, compliance approval, webhook configuration, wallet ownership, asset
mapping, and provider capability checks. Those checks are safety/readiness
requirements, not additional kill switches.

`FIAT_RAMP_DISABLED_CORRIDORS` remains an optional defense-in-depth denylist,
and `BRIDGE_FEDNOW_ENABLED` remains a provider capability attestation because
FedNow cannot be enabled by an application flag when Bridge has not enabled it
for the account.

Sandbox backend configuration shape:

```dotenv
FIAT_RAMP_ENVIRONMENT=sandbox
FIAT_RAMP_ENABLED=true
ONSWITCH_SANDBOX_SERVICE_KEY=<OnSwitch-sandbox-service-key>
BRIDGE_SANDBOX_API_KEY=<Bridge-sandbox-key-with-sk-test-prefix>
BRIDGE_WEBHOOK_PUBLIC_KEY=<Bridge-webhook-public-key>
FIAT_COMPLIANCE_APPROVED=<only-after-internal-sandbox-approval>
ONSWITCH_ACCOUNT_APPROVED=<only-after-OnSwitch-account-approval>
ONSWITCH_WEBHOOK_CONFIGURED=<only-after-webhook-is-deployed>
BRIDGE_ACCOUNT_APPROVED=<only-after-Bridge-account-approval>
BRIDGE_WEBHOOK_CONFIGURED=<only-after-webhook-or-fixture-path-is-ready>
BRIDGE_FEDNOW_ENABLED=false
FIAT_RAMP_ALLOWED_USERS=<optional-comma-separated-user-ids>
```

All of these values belong in the crypto backend's server-side secret manager
or runtime environment. None belong in the frontend `.env`, browser bundle, or
Next.js public environment variables.

## 19. Observability and reconciliation

Record metrics for:

- quote latency and failure rate;
- initiate latency and uncertain-result count;
- provider 4xx/5xx/429 rates;
- webhook verification failures;
- webhook processing lag;
- order age by state;
- quote-expiry rate;
- crypto transaction confirmation time;
- provider payout completion time;
- refund/reversal rate;
- beneficiary verification failures;
- Bridge KYC/endorsement failures;
- capability refresh failures;
- provider and WorldStreet balance/liquidity mismatches.

Scheduled reconciliation must:

- find orders stuck beyond the expected settlement window;
- requery provider status;
- requery blockchain transaction state;
- detect a provider-completed order without a corresponding on-chain record;
- detect a confirmed crypto deposit not linked to an order;
- detect a completed payout without a completed local ledger row;
- alert without silently creating a second payout.

## 20. Outstanding provider confirmations

These are implementation gates, not questions for the user:

### OnSwitch

- Production availability and limits for every current African corridor.
- Whether all listed corridors support both directions in the WorldStreet account.
- Exact mobile-money ownership verification behavior.
- Exact refund behavior for late, under, over, or wrong-asset deposits.
- Whether POST /payment/confirm is mandatory for every offramp.
- Whether the reference field is sufficient for safe recovery after a timeout.
- Provider fees, settlement cutoffs, and rate/quote lock semantics.
- Production webhook retry and replay behavior.

### Bridge

- Whether the target WorldStreet user countries are eligible for USD virtual accounts and USD withdrawals.
- Which stablecoin/network pairs are enabled on the Bridge account.
- Whether a source external wallet transfer can bind from_address to the user's WorldStreet address.
- Exact external-account ownership verification requirements.
- Whether ACH, wire, same-day ACH, and FedNow are enabled for the account.
- Required crypto return policy before enabling withdrawals.
- Webhook endpoint/public-key configuration and event delivery behavior.
- Production legal/compliance approval for the proposed user flow.

### WorldStreet

- Which mainnet networks are enabled for user transfers.
- Whether Base, Polygon, BSC, Optimism, and other provider routes should be added to the crypto backend.
- The default stablecoin/network for each fiat provider.
- The legal identity fields already available from Clerk/profile/KYC.
- The product fee policy and revenue-recipient configuration.

## 21. Definition of done

The guide is ready to turn into implementation when:

- provider access and compliance gates are approved;
- all enabled African corridors come from OnSwitch coverage, not a stale hardcoded list;
- Bridge USD eligibility and routes are confirmed;
- user-owned wallet and beneficiary invariants are enforced server-side;
- every provider mutation is locally and remotely idempotent where supported;
- webhooks are signature-verified, replay-protected, deduplicated, and reconciled;
- all crypto deposits use WorldStreet transaction intents and local signing;
- no provider private key or API key reaches the browser or source control;
- quote, fee, rate, expiry, payout, and refund history is auditable;
- sandbox limitations are covered by local fixtures;
- a controlled production canary reconciles provider records, blockchain records, user history, and balances exactly.

## 22. Source and repository references

Provider documentation:

- [OnSwitch introduction](https://docs.onswitch.xyz/introduction)
- [OnSwitch quickstart](https://docs.onswitch.xyz/quickstart.md)
- [OnSwitch authentication](https://docs.onswitch.xyz/authentication.md)
- [OnSwitch sandbox](https://docs.onswitch.xyz/sandbox.md)
- [OnSwitch webhooks](https://docs.onswitch.xyz/webhook.md)
- [Bridge overview](https://apidocs.bridge.xyz/get-started/introduction/overview)
- [Bridge USD integration](https://apidocs.bridge.xyz/get-started/guides/move-money/usd-integration-guide)
- [Bridge sandbox](https://apidocs.bridge.xyz/get-started/introduction/quick-start/setting-up-sandbox)
- [Bridge webhooks](https://apidocs.bridge.xyz/platform/additional-information/webhooks/structure)

Relevant WorldStreet areas:

- Dashboard provider proxy: app/api/crypto/[...path]/route.ts
- Dashboard backend client: lib/crypto-backend/client.ts
- Dashboard transaction types: types/transactions.ts
- Crypto backend network catalog: src/config/networks.ts
- Crypto backend authenticated routes: src/api/routes/transactions.ts
- Crypto backend intent service: src/wallet/transactions/IntentService.ts
- Existing self-custodial wallet architecture: docs/CRYPTO-BACKEND-FRONTEND-INTEGRATION-PLAN.md
