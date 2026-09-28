# WorldStreet Spot Trading Frontend Integration Guide

**Status:** Current-contract guide for the existing dashboard and crypto backend

**Scope:** Spot crypto trading only, after authentication is complete. This document covers market discovery, order construction, wallet-intent creation, local signing, submission, polling, and frontend error handling. It does not cover fiat, OnSwitch, Bridge, derivatives, order books, limit orders, or account/authentication setup.

This guide is based on the current code in:

- `dashboard-revamp`
- `worldstreet-crypto-backend`

The frontend should treat the existing source code and the response from `GET /trading/spot/markets` as the source of truth. Do not recreate token addresses, mints, decimals, provider routes, or chain mappings in the UI.

## 1. The integration model

The current flow is:

```text
Authenticated browser session
        |
        |  same-origin request to /api/crypto/*
        v
Dashboard server proxy
        |
        |  adds the Clerk bearer token server-side
        |  forwards to /v1/*
        v
Crypto backend
        |
        |  resolves the authenticated user's own wallet/account
        |  quotes and validates server-side
        |  creates a transaction intent
        v
Frontend signs the returned unsigned transaction locally
        |
        v
POST /transactions/intents/:intentId/submit
        |
        v
Frontend polls the intent until confirmed or failed
```

For the existing dashboard, the browser-facing base URL is:

```text
/api/crypto
```

The deployed backend equivalent is:

```text
https://crypto-backend.worldstreetgold.com/v1
```

Therefore:

```text
Browser:  /api/crypto/trading/spot/markets
Backend:  https://crypto-backend.worldstreetgold.com/v1/trading/spot/markets
```

Use the dashboard proxy from browser code. Direct backend calls are appropriate only for a trusted server-side consumer that can obtain and forward a valid Clerk bearer token.

The frontend must never call LI.FI, 0x, Jupiter, or any provider directly, and must never receive provider API keys.

## 2. Frontend environment configuration

The dashboard already has the relevant configuration shape:

```env
# Server-only. Used by app/api/crypto/[...path]/route.ts.
CRYPTO_API_URL=https://crypto-backend.worldstreetgold.com

# Public feature flags.
NEXT_PUBLIC_CRYPTO_ENABLED=true
NEXT_PUBLIC_CRYPTO_PROXY_ENABLED=true
```

`CRYPTO_API_URL` is server-only. It must not be renamed to `NEXT_PUBLIC_CRYPTO_API_URL` or exposed in a browser bundle.

The following do not belong in frontend environment variables:

- LI.FI API keys
- 0x API keys
- Jupiter API keys
- wallet/provider secrets
- backend sandbox or production credentials

The browser sends the authenticated session through the dashboard proxy. In raw `fetch` calls, use `credentials: "include"`.

## 3. What the current spot product supports

The current spot screen is an on-chain market swap against available liquidity. It is not a centralized-exchange order book.

Currently supported by the modern dashboard flow:

- market discovery from the backend market registry;
- market orders only;
- EVM spot rows through `POST /trading/spot/evm/intents`;
- Solana/Jupiter registry rows through `POST /trading/spot/lifi/intents` using a same-chain LI.FI route;
- EVM approval intents when the sell token allowance is insufficient;
- local signing of the backend-generated unsigned transaction;
- broadcast through the generic transaction-intent submit route;
- status polling until confirmation or terminal failure;
- authenticated-user ownership enforcement by the backend.

Not currently exposed as a modern spot feature:

- limit orders;
- stop orders;
- order-book bids and asks;
- partial-fill management;
- cancel-order APIs;
- a separate spot account or exchange balance;
- frontend-selected provider/API keys;
- a browser-supported generic provider-intent route.

The source of truth after execution is the transaction intent and its transaction record, not a frontend-generated order object.

## 4. Route inventory

All paths below are relative to `/api/crypto` in browser code or `/v1` on the backend.

| Method | Route | Use | Current browser status |
|---|---|---|---|
| `GET` | `/trading/spot/markets` | Load supported spot markets | Supported |
| `POST` | `/trading/spot/evm/intents` | Create an EVM spot intent | Supported |
| `POST` | `/trading/spot/lifi/intents` | Create the current Solana/Jupiter-row intent and other supported LI.FI intents | Supported |
| `GET` | `/trading/spot/lifi/quote` | Optional LI.FI quote preview | Proxy-supported; not required by the current spot ticket |
| `GET` | `/transactions/intents/:intentId` | Read an intent while signing, submitting, or polling | Supported |
| `POST` | `/transactions/intents/:intentId/simulate` | Re-run backend validation/simulation | Supported; optional because creation already simulates |
| `POST` | `/transactions/intents/:intentId/submit` | Submit the locally signed transaction | Supported |
| `GET` | `/transactions/:transactionId` | Read a transaction record | Supported |
| `GET` | `/transactions` | Read the user's transaction history | Supported |

Routes that should not be used by the current modern browser integration:

- `POST /trading/spot/solana/intents`: the dashboard has a helper for this path, but the current backend does not implement the route. For a `venue: "jupiter"` market row, call `POST /trading/spot/lifi/intents`.
- `GET /trading/spot/provider/quote`: exists in backend code for a non-LI.FI provider path but is not in the modern dashboard proxy allowlist.
- `POST /trading/spot/provider/intents`: exists in backend code for a non-LI.FI provider path but is not in the modern dashboard proxy allowlist.
- legacy `/api/[...path]` forwarding: do not use it for new spot code; use `/api/crypto`.

The route name `lifi` is intentional for the current Solana path. The market registry may label the venue as `jupiter`, but the current execution route is LI.FI and the frontend must follow the endpoint selected by the existing dashboard implementation.

## 5. Authentication and ownership

Authentication is assumed to be complete before the flow begins.

### Browser requests

Use the dashboard proxy:

```ts
const response = await fetch("/api/crypto/trading/spot/markets", {
  method: "GET",
  credentials: "include",
  signal,
});
```

The proxy obtains the Clerk token server-side and forwards it to the crypto backend.

### Trusted server-side requests

If a separate trusted server consumes the backend directly:

```ts
const response = await fetch(
  "https://crypto-backend.worldstreetgold.com/v1/trading/spot/markets",
  {
    headers: {
      Authorization: `Bearer ${clerkToken}`,
      Accept: "application/json",
    },
  },
);
```

Do not ask the browser user to provide a wallet ID or account ID in an intent request. The backend resolves the modern wallet and active account owned by the authenticated user. A frontend may select which local account/package to use for signing, but it must not use that to bypass backend ownership checks.

## 6. Response envelope and error parsing

Most backend responses use this envelope:

```json
{
  "success": true,
  "data": {}
}
```

Most errors use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "requestId": "request-id-for-support-and-logs"
}
```

`details` is optional. `requestId` is the value to log and provide to support; do not use the message string as a stable error identifier.

The spot quote endpoints have one important envelope difference:

```json
{
  "success": true,
  "quote": {}
}
```

The current `CryptoBackendClient` unwraps `data` for typed methods. Consequently, raw top-level fields such as the spot intent `quote` and `existing` flag are not exposed by the current `createModernSpotIntent` and `createModernLifiSwapIntent` return value. If the UI needs those raw top-level fields, the client wrapper must be extended deliberately; do not assume they are inside `data`.

A safe raw response helper looks like this:

```ts
type BackendErrorBody = {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  requestId?: string;
};

async function readJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as BackendErrorBody | null;
    const error = new Error(
      errorBody?.error?.message ?? `Crypto request failed with HTTP ${response.status}`,
    ) as Error & {
      status?: number;
      code?: string;
      details?: unknown;
      requestId?: string;
    };

    error.status = response.status;
    error.code = errorBody?.error?.code;
    error.details = errorBody?.error?.details;
    error.requestId = errorBody?.requestId ?? response.headers.get("x-request-id") ?? undefined;
    throw error;
  }

  return body;
}
```

The existing dashboard client already performs this kind of parsing, refreshes a Clerk token once after a 401, and exposes a `CryptoBackendError`. Prefer the existing client instead of duplicating request logic.

## 7. Load the market registry

### Request

```http
GET /api/crypto/trading/spot/markets
Accept: application/json
```

Optional query parameters:

| Parameter | Type | Meaning |
|---|---|---|
| `limit` | positive integer, maximum `500` | Maximum number of rows |
| `offset` | non-negative integer | Offset for pagination |

Example:

```ts
const result = await cryptoBackendClient.getModernSpotMarkets({
  limit: 50,
  offset: 0,
});

for (const market of result.markets) {
  // Render this exact registry row. Do not reconstruct token identifiers.
}
```

### Successful response

The following is illustrative; addresses, IDs, prices, and icons must come from the actual response.

```json
{
  "success": true,
  "data": {
    "total": 2,
    "markets": [
      {
        "id": "<market-id>",
        "symbol": "ETH",
        "quote": "USDC",
        "networkId": "ethereum-mainnet",
        "venue": "0x",
        "chartSymbol": "ETHUSDC",
        "chartSupported": true,
        "icon": "https://example.invalid/eth.png",
        "price": 3521.42,
        "sellToken": "0x1111111111111111111111111111111111111111",
        "buyToken": "0x2222222222222222222222222222222222222222",
        "baseDecimals": 18,
        "quoteDecimals": 6
      },
      {
        "id": "<market-id>",
        "symbol": "SOL",
        "quote": "USDC",
        "networkId": "solana-mainnet-beta",
        "venue": "jupiter",
        "chartSymbol": "SOLUSDC",
        "chartSupported": true,
        "icon": "https://example.invalid/sol.png",
        "price": 148.2,
        "inputMint": "<quote-token-mint>",
        "outputMint": "<base-token-mint>",
        "baseDecimals": 9,
        "quoteDecimals": 6
      }
    ]
  }
}
```

`total` is included when pagination is requested. An unpaginated response may contain only `data.markets`.

When the backend market registry is empty, it can return fallback rows. Fallback rows may omit `id`, `price`, token precision, or other live-registry fields. The UI may display a fallback row, but must disable trade construction until the required identifiers, decimals, and live price are present.

The live registry is filtered by the backend to active, chart-supported markets with a positive USD price and is sorted primarily by liquidity. The frontend should still fail closed when a row is incomplete.

### Market row rules

- Use `id` as the UI identity when available. Do not identify a market by symbol alone; `ETH` can exist on multiple networks.
- Use the row's `networkId` exactly. These are application network IDs, not interchangeable numeric chain IDs.
- Use the row's `venue` only to choose the existing execution method.
- Use the row's `sellToken`/`buyToken` or `inputMint`/`outputMint` exactly as returned.
- Use `baseDecimals` and `quoteDecimals` exactly as returned. Never default to 18 decimals.
- Treat `price` as a USD price used for USD-denominated sell calculations.
- The current order builder expects a USD-like quote asset such as `USD`, `USDC`, `USDC.E`, `USDT`, `USDB`, or `DAI`. The current registry normally uses `USDC`.

## 8. Convert the selected trade into an intent

All amounts sent to intent endpoints are integer base-unit strings. They are not decimal display amounts.

Examples:

```text
125 USDC with 6 decimals -> "125000000"
0.5 ETH with 18 decimals -> "500000000000000000"
1.25 SOL with 9 decimals -> "1250000000"
```

Use exact decimal arithmetic and `BigInt`-compatible conversion. Do not use binary floating-point arithmetic for the final amount. Reject an amount that cannot be represented exactly at the asset's precision, is zero, is negative, or becomes dust after conversion.

### EVM registry row (`venue: "0x"`)

The registry is oriented as:

```text
sellToken = quote asset
buyToken  = base asset
```

For a **buy** order:

```text
user input: quote/USD amount
sellToken:  market.sellToken
buyToken:   market.buyToken
amount:     quote amount converted with market.quoteDecimals
```

For a **sell** order:

```text
user input: base-token amount, or USD amount converted with the live market.price
sellToken:  market.buyToken
buyToken:   market.sellToken
amount:     base amount converted with market.baseDecimals
```

Example buy request for a fictitious 125 USDC ETH purchase:

```http
POST /api/crypto/trading/spot/evm/intents
Content-Type: application/json
```

```json
{
  "networkId": "ethereum-mainnet",
  "sellToken": "0x1111111111111111111111111111111111111111",
  "buyToken": "0x2222222222222222222222222222222222222222",
  "sellAmountBaseUnits": "125000000",
  "slippagePercentage": 0.01,
  "idempotencyKey": "spot-01J-example-evm-trade"
}
```

The current spot endpoint accepts `idempotencyKey` in the JSON body. Keep it in the body even if the client also supports an `Idempotency-Key` header for other APIs; do not rely on the header alone for spot intent creation.

The backend resolves the authenticated user's EVM wallet/account. Do not add `walletId` or `accountId` to this body.

### Solana/Jupiter registry row (`venue: "jupiter"`)

The current dashboard execution route is LI.FI:

```text
POST /trading/spot/lifi/intents
```

For a **buy** order:

```text
sourceNetworkId:      "solana-mainnet-beta"
destinationNetworkId: "solana-mainnet-beta"
sellToken:            market.inputMint
buyToken:             market.outputMint
amount:               quote amount converted with market.quoteDecimals
```

For a **sell** order, reverse the input/output mints and convert the base-token amount with `market.baseDecimals`.

Example request:

```http
POST /api/crypto/trading/spot/lifi/intents
Content-Type: application/json
```

```json
{
  "sourceNetworkId": "solana-mainnet-beta",
  "destinationNetworkId": "solana-mainnet-beta",
  "sellToken": "<quote-token-mint>",
  "buyToken": "<base-token-mint>",
  "sellAmountBaseUnits": "125000000",
  "slippagePercentage": 0.01,
  "idempotencyKey": "spot-01J-example-solana-trade"
}
```

The endpoint schema also permits other LI.FI network IDs. The current spot UI should only send the networks and token identifiers represented by the selected market row.

Do not call `/trading/spot/solana/intents` for this flow. That path is not implemented by the current backend.

### Slippage

The backend accepts `slippagePercentage` from `0.001` through `0.05` inclusive. The current order helper defaults to `0.01` and warns above `0.03`.

The frontend should:

- send a numeric percentage such as `0.01`, not `1` for 1%;
- clamp or reject values outside the backend range;
- show the selected slippage to the user before signing;
- avoid silently changing slippage during an approval rebuild.

## 9. Create an intent

The existing typed client exposes the current methods:

```ts
cryptoBackendClient.getModernSpotMarkets(options?, signal?)
cryptoBackendClient.createModernSpotIntent(input, signal?)
cryptoBackendClient.createModernLifiSwapIntent(input, signal?)
cryptoBackendClient.getIntent(intentId, signal?)
cryptoBackendClient.simulateIntent(intentId, signal?)
cryptoBackendClient.submitIntent(intentId, signedTransaction, signal?)
cryptoBackendClient.getTransaction(transactionId, signal?)
cryptoBackendClient.listTransactions(limit?, signal?)
```

The route selection in the current spot screen is:

```ts
const intentPlan =
  market.venue === "0x"
    ? await cryptoBackendClient.createModernSpotIntent({
        networkId,
        sellToken,
        buyToken,
        sellAmountBaseUnits,
        slippagePercentage,
        idempotencyKey,
      })
    : await cryptoBackendClient.createModernLifiSwapIntent({
        sourceNetworkId,
        destinationNetworkId,
        sellToken,
        buyToken,
        sellAmountBaseUnits,
        slippagePercentage,
        idempotencyKey,
      });
```

The typed client normalizes a single returned intent into:

```ts
type CryptoSpotIntentPlan = {
  intents: CryptoTransactionIntent[];
  requiresApproval?: boolean;
};
```

This means the frontend should process `intentPlan.intents`, not assume that every successful creation response is a single object.

The backend also returns an intent quote at the raw top level for normal new intent creation. A raw EVM response can look like this:

```json
{
  "success": true,
  "data": {
    "id": "intent_example_123",
    "status": "awaiting_signature",
    "chainFamily": "evm",
    "networkId": "ethereum-mainnet",
    "walletId": "wallet_example",
    "accountId": "account_example",
    "normalizedSummary": {
      "action": "swap",
      "chainFamily": "evm",
      "networkId": "ethereum-mainnet",
      "asset": "ETH"
    },
    "unsignedTransaction": {
      "family": "evm",
      "networkId": "ethereum-mainnet",
      "from": "0x3333333333333333333333333333333333333333",
      "to": "0x4444444444444444444444444444444444444444",
      "payload": {
        "to": "0x4444444444444444444444444444444444444444",
        "data": "0x...",
        "value": "0"
      }
    },
    "validationResult": {
      "ok": true,
      "errors": [],
      "warnings": []
    },
    "simulationResult": {
      "ok": true
    },
    "expiresAt": "2026-09-27T12:00:00.000Z"
  },
  "existing": false,
  "quote": {
    "buyAmount": "<provider-base-units>",
    "sellAmount": "125000000",
    "priceImpact": "<provider-value>",
    "sources": [],
    "tool": "<provider-tool>"
  }
}
```

The exact provider payload inside `unsignedTransaction.payload` is opaque to the frontend. Sign the intent with the appropriate existing chain-family signer; do not edit the payload.

## 10. Approval flow for EVM tokens

An EVM ERC-20 sell may require an allowance transaction before the swap.

When approval is required, intent creation returns a plan shaped like:

```json
{
  "success": true,
  "data": {
    "intents": [
      {
        "id": "approval_intent_example",
        "status": "awaiting_signature",
        "chainFamily": "evm",
        "networkId": "ethereum-mainnet",
        "unsignedTransaction": {
          "family": "evm",
          "networkId": "ethereum-mainnet",
          "from": "0x3333333333333333333333333333333333333333",
          "to": "0x5555555555555555555555555555555555555555",
          "payload": {
            "to": "0x5555555555555555555555555555555555555555",
            "data": "0x...",
            "value": "0"
          }
        }
      }
    ],
    "requiresApproval": true
  },
  "existing": false
}
```

The current flow is:

1. Sign the approval intent locally.
2. Submit it through `POST /transactions/intents/:intentId/submit`.
3. Poll that approval intent until `confirmed`.
4. Re-create the main swap intent using the same logical trade input and the same original idempotency key.
5. Sign and submit the fresh swap intent.

The backend internally derives the approval idempotency key from the main key. The frontend should not invent a second logical trade key.

For the current Solana spot path, do not add an EVM approval step.

## 11. Sign and submit the returned intent

Intent creation only prepares a transaction. It does not broadcast it.

The frontend must use the existing local wallet package/account and sign the exact `unsignedTransaction` returned by the backend. In the current dashboard these are the relevant signing helpers:

```text
lib/crypto-wallet/evm-signing.ts
lib/crypto-wallet/solana-signing.ts
```

Conceptual flow:

```ts
const intent = intentPlan.intents[0];

if (!intent || intent.status !== "awaiting_signature") {
  throw new Error("No signable spot intent was returned");
}

const signedTransaction =
  intent.chainFamily === "evm"
    ? await signEvmIntent({
        intent,
        walletPackage,
        accountId: selectedAccountId,
      })
    : await signSolanaIntent({
        intent,
        walletPackage,
        accountId: selectedAccountId,
      });

const submitted = await cryptoBackendClient.submitIntent(
  intent.id,
  signedTransaction,
);
```

The current generic submit route is:

```http
POST /api/crypto/transactions/intents/{intentId}/submit
Content-Type: application/json
```

Request body:

```json
{
  "signedTransaction": "<signed-chain-specific-transaction-string>"
}
```

The string must be at least 20 characters and no more than 2 MB. The backend verifies that it matches the intent before broadcasting.

Successful submit response:

```json
{
  "success": true,
  "data": {
    "id": "transaction_example_123",
    "intentId": "intent_example_123",
    "status": "submitted",
    "txHash": "0x<transaction-hash>",
    "chainFamily": "evm",
    "networkId": "ethereum-mainnet",
    "createdAt": "2026-09-27T11:55:00.000Z",
    "submittedAt": "2026-09-27T11:55:02.000Z"
  }
}
```

The returned transaction record is useful for history. Continue polling the intent for the authoritative workflow status.

## 12. Poll status after submission

Read the intent with:

```http
GET /api/crypto/transactions/intents/{intentId}
```

The backend intent status model is:

| Status | Frontend meaning | Action |
|---|---|---|
| `created` | Intent exists but is not yet ready to sign | Refresh once; do not sign blindly |
| `awaiting_signature` | Backend produced a signable transaction | Ask the user to sign |
| `signed` | Signed state recorded | Refresh and continue according to backend state |
| `submitted` | Broadcast submitted | Keep polling |
| `confirmed` | Final success | Show success and refresh balances/history |
| `failed` | Execution failed | Stop polling and show recoverable error |
| `cancelled` | Cancelled | Stop polling |
| `expired` | Intent can no longer be signed/submitted | Stop polling and create a new intent with a new key |

The current dashboard polls roughly every 5 seconds after submission and stops at a terminal state. Approval polling uses a shorter interval while waiting for the approval confirmation. A reasonable standalone consumer may use 3–5 seconds with a bounded timeout, then fetch once more before showing an unknown/pending state.

Do not interpret `submitted` as `confirmed`. Do not credit the user or mark the trade complete until the intent reaches `confirmed`.

Example confirmed response:

```json
{
  "success": true,
  "data": {
    "id": "intent_example_123",
    "status": "confirmed",
    "chainFamily": "evm",
    "networkId": "ethereum-mainnet",
    "normalizedSummary": {
      "action": "swap",
      "asset": "ETH"
    },
    "simulationResult": {
      "ok": true
    }
  }
}
```

After confirmation, invalidate the user's balance and transaction-history queries.

## 13. Optional LI.FI quote preview

The backend exposes an optional quote endpoint:

```http
GET /api/crypto/trading/spot/lifi/quote
```

Query parameters:

```text
fromChain=ethereum|arbitrum|solana|sui|tron|bitcoin
toChain=ethereum|arbitrum|solana|sui|tron|bitcoin
fromToken=<provider-token-address-or-mint>
toToken=<provider-token-address-or-mint>
amount=<decimal-amount>
slippage=0.005
```

Example:

```ts
const query = new URLSearchParams({
  fromChain: "solana",
  toChain: "solana",
  fromToken: quoteMint,
  toToken: baseMint,
  amount: "125000000",
  slippage: "0.005",
});

const response = await fetch(
  `/api/crypto/trading/spot/lifi/quote?${query.toString()}`,
  { credentials: "include" },
);
```

Raw response shape:

```json
{
  "success": true,
  "quote": {
    "router": "lifi",
    "sourceNetworkId": "solana-mainnet-beta",
    "destinationNetworkId": "solana-mainnet-beta",
    "toAmount": "<base-units>",
    "toAmountMin": "<minimum-base-units>",
    "toAmountUSD": "<usd-value>",
    "fromAmountUSD": "<usd-value>",
    "priceImpact": "<provider-value>",
    "gasCostUSD": "<usd-value>",
    "tool": "<provider-tool>",
    "executionDuration": 10,
    "feeCosts": [],
    "steps": [],
    "executionData": {},
    "fromToken": {},
    "toToken": {}
  }
}
```

This is a preview, not an authorization to execute. The intent endpoint performs its own server-side quote, policy checks, validation, and simulation. Treat a preview as stale as soon as the user changes the amount, slippage, market, or account. The current modern spot ticket does not need this route to create an executable intent.

## 14. Error contract and frontend behavior

Error codes are more stable than messages. Display a useful user message, preserve the backend code and `requestId` in logs, and choose retry behavior from the category.

### Authentication errors

```http
HTTP/1.1 401 Unauthorized
```

```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required"
  },
  "requestId": "req_example_401"
}
```

The dashboard proxy may report `UNAUTHORIZED` when the Clerk session is missing. Refresh the session once through the existing client. If the second attempt is also 401, send the user back through the existing authentication/session-recovery UI. Do not retry indefinitely.

### Validation errors

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "sellAmountBaseUnits": [
          "Expected a positive integer string"
        ]
      }
    }
  },
  "requestId": "req_example_400"
}
```

Other common 400-level spot codes include:

- `INVALID_SWAP`: same token, bad direction, or invalid swap combination;
- `TOKEN_NOT_SUPPORTED`: token is not in the current market/provider registry;
- `INVALID_AMOUNT`: zero, negative, malformed, or unrepresentable amount;
- `INVALID_TOKEN_ADDRESS`: invalid EVM address or token identifier;
- `NETWORK_FAMILY_MISMATCH`: EVM token on a Solana route or the reverse;
- `TRANSACTION_POLICY_REJECTED`: backend transaction policy rejected the generated transaction;
- `SIGNED_TRANSACTION_MISMATCH`: signed payload does not match the intent.

Show the user a field-level correction when possible. Do not retry the same invalid request.

### Ownership, wallet, and account readiness

Possible responses:

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_NOT_READY",
    "message": "A wallet account is not ready for this operation"
  },
  "requestId": "req_example_account"
}
```

Typical statuses/codes:

| HTTP | Code | Frontend action |
|---:|---|---|
| `404` | `NOT_FOUND` | Verify the selected market/intent belongs to the current session; do not guess another ID |
| `404` | wallet/account not found | Send the user to the existing wallet provisioning/unlock flow |
| `409` | `ACCOUNT_NOT_READY` | Ask the user to finish wallet/account setup or unlock |
| `409` | `SPOT_APPROVAL_PENDING` | Poll the existing approval intent rather than creating duplicate approvals |
| `409` | `SPOT_APPROVAL_RETRY` | Re-fetch wallet/allowance state, then retry the approved logical trade if instructed |

The backend does not permit using another user's wallet/account.

### Mainnet and operational controls

```json
{
  "success": false,
  "error": {
    "code": "MAINNET_DISABLED",
    "message": "Mainnet operations are disabled"
  },
  "requestId": "req_example_mainnet"
}
```

Common operational responses:

- `403 MAINNET_DISABLED`: show that trading is unavailable in the current environment; do not keep retrying.
- `503 NETWORK_NOT_AVAILABLE`: the selected network is not available; disable that market and refresh markets later.
- `503 WALLET_OPERATIONS_PAUSED`: global wallet operations are paused; show maintenance/unavailable state and stop submission retries.
- `429 RATE_LIMITED`: respect `Retry-After` when present and back off. Do not create a new idempotency key for a rate-limit retry.

### Quote, provider, and broadcast failures

```json
{
  "success": false,
  "error": {
    "code": "SPOT_QUOTE_FAILED",
    "message": "Unable to obtain a valid spot quote"
  },
  "requestId": "req_example_quote"
}
```

Common responses:

- `409 ROUTER_UNAVAILABLE`: refresh the market/quote and offer retry later.
- `502 SPOT_QUOTE_FAILED`: provider quote or route construction failed; retry the same logical request with the same idempotency key after a short backoff.
- `502 INVALID_PROVIDER_TRANSACTION`: provider returned a transaction that failed backend validation; do not ask the user to sign it.
- `502 BROADCAST_FAILED`: submission did not produce a confirmed broadcast. Re-read the intent before deciding whether a retry is safe.
- `409 INTENT_NOT_SUBMITTABLE`: the intent is no longer in a signable/submittable state; re-read it.
- `409 INTENT_EXPIRED`: discard the old intent and create a new one with a new key.
- `409 NONCE_STALE`: refresh the intent/account state and create a fresh intent if the backend does not recover it.
- `400/409 INSUFFICIENT_FUNDS`, `INSUFFICIENT_ALLOWANCE`, or `INSUFFICIENT_GAS`: show the missing requirement and do not blindly retry.

### Dashboard proxy errors

The dashboard proxy can return errors before the request reaches the backend:

| Status | Code | Meaning |
|---:|---|---|
| `401` | `UNAUTHORIZED` | No usable dashboard session |
| `503` | `CRYPTO_SERVICE_UNCONFIGURED` | `CRYPTO_API_URL` is missing on the dashboard server |
| `502` | `CRYPTO_SERVICE_UNREACHABLE` | Dashboard could not reach the backend |

These are deployment/session issues, not token or swap errors. Preserve the HTTP status and request ID in telemetry.

## 15. Idempotency and retry rules

Create one idempotency key per logical user trade:

```ts
const idempotencyKey = `spot-${crypto.randomUUID()}`;
```

Rules:

1. Reuse the same key if the intent request times out and the frontend is unsure whether the backend created it.
2. Reuse the same key when rebuilding the swap after an approval has confirmed.
3. Do not create a second key for a browser retry caused by `429`, a temporary network failure, or a lost response.
4. Create a new key only when starting a genuinely new logical trade, or after the old intent has expired and the user explicitly retries.
5. If the intent is already `submitted` or `confirmed`, do not create a duplicate intent. Read the existing intent/transaction instead.
6. Do not retry `POST /transactions/intents/:id/submit` blindly after a timeout. First fetch the intent and transaction state; a broadcast may have succeeded even if the HTTP response was lost.

The backend's replay response may be HTTP `200` with `existing: true`, while a new intent is normally HTTP `201` with `existing: false`. The existing typed client currently normalizes the `data` portion and does not expose those top-level flags.

## 16. End-to-end frontend pseudocode

The following illustrates the current contract. It intentionally leaves wallet-unlock UX and exact signer arguments to the existing dashboard wallet helpers.

```ts
async function executeSpotTrade({
  market,
  side,
  amount,
  slippagePercentage = 0.01,
  signal,
}: {
  market: SpotMarket;
  side: "buy" | "sell";
  amount: string;
  slippagePercentage?: number;
  signal?: AbortSignal;
}) {
  // 1. Validate the exact registry row and calculate direction/base units.
  const order = buildSpotOrderPlan({
    market,
    side,
    amount,
    slippagePercentage,
  });

  // order.input contains either the EVM or LI.FI body and one logical key.
  let plan =
    market.venue === "0x"
      ? await cryptoBackendClient.createModernSpotIntent(order.input, signal)
      : await cryptoBackendClient.createModernLifiSwapIntent(order.input, signal);

  // 2. Handle an EVM approval plan before the main swap.
  if (plan.requiresApproval) {
    for (const approvalIntent of plan.intents) {
      const signedApproval = await signEvmIntentFromExistingWallet(approvalIntent);
      await cryptoBackendClient.submitIntent(
        approvalIntent.id,
        signedApproval,
        signal,
      );
      await pollIntentUntilTerminal(approvalIntent.id, {
        signal,
        requireConfirmed: true,
      });
    }

    // Rebuild with the same order.input and idempotencyKey. The backend obtains
    // a fresh route/nonce after allowance confirmation.
    plan =
      market.venue === "0x"
        ? await cryptoBackendClient.createModernSpotIntent(order.input, signal)
        : await cryptoBackendClient.createModernLifiSwapIntent(order.input, signal);
  }

  // 3. Sign the exact main intent returned by the backend.
  const intent = plan.intents[0];
  if (!intent) throw new Error("No spot intent returned");

  const signed =
    intent.chainFamily === "evm"
      ? await signEvmIntentFromExistingWallet(intent)
      : await signSolanaIntentFromExistingWallet(intent);

  // 4. Broadcast through the generic owned-intent route.
  await cryptoBackendClient.submitIntent(intent.id, signed, signal);

  // 5. Confirm before updating balances or showing completed trade state.
  const finalIntent = await pollIntentUntilTerminal(intent.id, { signal });

  if (finalIntent.status !== "confirmed") {
    throw new Error(`Spot trade ended in ${finalIntent.status}`);
  }

  invalidateBalancesAndTransactionHistory();
  return finalIntent;
}
```

The helper names above are conceptual. In this repository, use the existing `buildSpotOrderPlan`, `cryptoBackendClient`, `signEvmIntent`, and `signSolanaIntent` implementations rather than creating a second amount/orientation implementation.

## 17. Suggested UI states

The UI should represent the backend state explicitly:

```text
Loading markets
  -> Select market
  -> Enter amount
  -> Validating amount / calculating exact base units
  -> Creating quote and intent
  -> Approval required (EVM only)
  -> Awaiting wallet signature
  -> Broadcasting
  -> Confirming on-chain
  -> Confirmed
```

For failure:

```text
Any state -> Error with stable error.code + retry guidance + requestId in logs
```

Important distinctions:

- “Quote/intent created” is not “trade submitted.”
- “Submitted” is not “confirmed.”
- “User rejected signature” is a local wallet event and should not be reported as a provider failure.
- “Unknown after network timeout” requires a read of the existing intent/transaction before another mutation.
- An expired intent requires a new intent; it cannot be safely re-signed.

## 18. Security requirements for the frontend

- Use the authenticated dashboard proxy for browser calls.
- Never expose backend/provider API keys in `NEXT_PUBLIC_*` variables.
- Never let a user type an arbitrary token address or mint into the execution request.
- Always bind the request to a selected market registry row.
- Treat market symbols as labels, not identifiers.
- Use exact decimal conversion and integer base-unit strings.
- Do not default missing decimals, price, network, or token identifiers.
- Do not edit, decode-and-rebuild, or substitute fields in `unsignedTransaction`.
- Show the user the network, sell asset, buy asset, amount, slippage, and destination summary before signing.
- Do not display a trade as complete until the backend intent is `confirmed`.
- Store only non-sensitive UI state locally. Wallet package material and signing secrets must follow the existing wallet security model.
- Log `requestId`, backend `error.code`, intent ID, transaction ID, and network—not secret payloads or private key material.

## 19. Integration checklist

Before considering the frontend integration complete:

- [ ] Browser calls use `/api/crypto`, not provider URLs.
- [ ] Authenticated requests include the existing dashboard session credentials.
- [ ] `GET /trading/spot/markets` is loaded before enabling the trade button.
- [ ] The selected row is retained through amount calculation and intent creation.
- [ ] `venue: "0x"` uses `/trading/spot/evm/intents`.
- [ ] `venue: "jupiter"` uses `/trading/spot/lifi/intents` with Solana network IDs.
- [ ] `/trading/spot/solana/intents` is not used.
- [ ] Token addresses/mints and decimals come only from the market row.
- [ ] Buy and sell orientation is reversed correctly.
- [ ] Final amounts are positive integer base-unit strings.
- [ ] Slippage is within `0.001`–`0.05`.
- [ ] One idempotency key is reused for one logical trade and any approval rebuild.
- [ ] Approval intents are signed/submitted/polled before rebuilding the swap.
- [ ] The exact backend unsigned transaction is signed locally.
- [ ] Submit uses `/transactions/intents/:id/submit`.
- [ ] Polling distinguishes submitted, confirmed, failed, cancelled, and expired.
- [ ] 401 is retried only through the existing session-refresh path.
- [ ] Broadcast timeouts are reconciled by reading existing state before retrying.
- [ ] Balances and history are invalidated only after confirmation.

## 20. Existing implementation references

These are the relevant current files for a frontend developer working inside the dashboard:

```text
lib/crypto-backend/client.ts
lib/crypto-backend/types.ts
lib/crypto-backend/spot-order.ts
lib/crypto-backend/error-messages.ts
lib/spot-markets.ts
components/trade/trade-client.tsx
lib/crypto-wallet/evm-signing.ts
lib/crypto-wallet/solana-signing.ts
app/api/crypto/[...path]/route.ts
```

Backend source of truth:

```text
src/api/routes/spot.ts
src/api/routes/transactions.ts
src/api/middleware/errorHandler.ts
src/models/TransactionIntent.ts
src/models/TransactionRecord.ts
src/workers/spotMarketRegistry.ts
```

The frontend integration should extend these existing abstractions when a new spot capability is needed. It should not create a parallel provider client or a second token/decimal registry.
