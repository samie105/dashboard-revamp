

WorldStreet Fiat ↔ Crypto Frontend Integration Guide
Status and audience
This document is for the dashboard/frontend engineer integrating the existing
WorldStreet fiat-ramp backend. It describes the routes that the UI consumes,
the request and response contracts, authentication, idempotency, order
lifecycles, polling, and error handling.

The backend is the source of truth for provider capability, corridor support,
customer compliance, beneficiary ownership, quotes, order state, and provider
reconciliation. The frontend must not call OnSwitch or Bridge directly.

The implementation supports:

all African country/currency/channel/direction corridors returned by the
OnSwitch coverage API at runtime;
OnSwitch local-fiat onramp and offramp into the user's existing WorldStreet
self-custodial wallet; and
Bridge USD virtual-account funding and USD withdrawals to a verified,
user-owned bank account.
This guide reflects the current backend and dashboard code on 2026-09-26.
Provider capabilities, approval, and supported corridors can change without a
frontend release, so the UI must always start with GET /fiat/config.

1. The URL the frontend should use
There are two relevant URLs:

Use case	URL	Who should use it
Browser/dashboard requests	/api/crypto	Frontend code. This is the recommended path.
Direct backend API	https://crypto-backend.worldstreetgold.com/v1	Server-to-server tools, backend integration tests, or a trusted server component.
The dashboard proxy turns:

/api/crypto/fiat/config
into:

https://crypto-backend.worldstreetgold.com/v1/fiat/config
The proxy obtains the Clerk session token server-side and forwards it as a
Bearer token. Browser components should therefore use the existing
cryptoBackendClient or fetch('/api/crypto/...'); they should not manually
construct a provider authorization header.

Backend routes that are not frontend routes
These are provider/internal callbacks and must never be called by a browser:

POST https://crypto-backend.worldstreetgold.com/webhooks/fiat/onswitch
POST https://crypto-backend.worldstreetgold.com/webhooks/fiat/bridge
POST https://crypto-backend.worldstreetgold.com/internal/v1/fiat/reconcile
The webhook endpoints are called by the providers. The reconciliation endpoint
is operator/service-only. The frontend only reads the resulting order and
virtual-account state through the authenticated /v1/fiat/... routes.

2. Environment variables: what goes where
2.1 Dashboard/frontend repository
Put this in the dashboard's server environment (.env.local for local
development, or the deployment's server-side environment):

# Server-only. Do not prefix this with NEXT_PUBLIC_.
CRYPTO_API_URL=https://crypto-backend.worldstreetgold.com

# Existing dashboard rollout controls.
NEXT_PUBLIC_CRYPTO_ENABLED=true
NEXT_PUBLIC_CRYPTO_PROXY_ENABLED=true
CRYPTO_API_URL is read by the Next.js API proxy. It is not a browser API
base URL and must not be exposed as NEXT_PUBLIC_CRYPTO_API_URL.

The browser normally needs no fiat-specific environment variable. It calls the
same /api/crypto proxy used by the rest of the modern wallet UI.

2.2 Crypto backend repository
Provider credentials and the fiat kill switch belong only in the crypto
backend's environment/secret manager:

# One master switch for every OnSwitch and Bridge fiat lane.
FIAT_RAMP_ENABLED=false

# Global compliance and production controls.
FIAT_COMPLIANCE_APPROVED=false
FIAT_RAMP_PRODUCTION_APPROVED=false

# OnSwitch.
ONSWITCH_API_BASE_URL=https://api.onswitch.xyz
ONSWITCH_SANDBOX_SERVICE_KEY=<sandbox-service-key>
ONSWITCH_LIVE_SERVICE_KEY=<production-service-key>
ONSWITCH_ACCOUNT_APPROVED=false
ONSWITCH_WEBHOOK_CONFIGURED=false

# Bridge.
BRIDGE_SANDBOX_API_BASE_URL=https://api.sandbox.bridge.xyz
BRIDGE_LIVE_API_BASE_URL=https://api.bridge.xyz
BRIDGE_SANDBOX_API_KEY=<sandbox-api-key>
BRIDGE_LIVE_API_KEY=<production-api-key>
BRIDGE_WEBHOOK_PUBLIC_KEY=<webhook-public-key>
BRIDGE_ACCOUNT_APPROVED=false
BRIDGE_WEBHOOK_CONFIGURED=false
BRIDGE_FEDNOW_ENABLED=false
The individual provider flags are compatibility/configuration fields; they are
not the master enablement switch. FIAT_RAMP_ENABLED is the single switch for
all fiat operations. Even when it is true, the backend still blocks an
operation if credentials, provider approval, compliance approval, webhook
configuration, wallet mapping, or a provider capability is missing.

Do not place any OnSwitch service key or Bridge API key in:

a React component;
a NEXT_PUBLIC_* variable;
a browser request;
a dashboard repository file;
a mobile bundle; or
a frontend error/reporting payload.
The credentials previously pasted during setup are intentionally not repeated
in this document. Rotate/revoke any credential that was exposed outside the
backend secret manager. A Bridge sandbox integration must use a sandbox key and
the sandbox host; do not use a live-style key against the sandbox host.

3. Authentication and common headers
3.1 Browser requests through the dashboard proxy
Use the existing Clerk session and include credentials:

const response = await fetch('/api/crypto/fiat/config', {
  method: 'GET',
  credentials: 'include',
  headers: { Accept: 'application/json' },
  cache: 'no-store',
})
The existing cryptoBackendClient already sets credentials: 'include',
Accept, Content-Type for JSON bodies, and the idempotency header when the
method requires it.

3.2 Direct trusted-server requests
Only a trusted server may call the backend directly:

const response = await fetch(
  'https://crypto-backend.worldstreetgold.com/v1/fiat/config',
  {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${clerkSessionToken}`,
    },
    cache: 'no-store',
  },
)
Never substitute a provider key for the Clerk Bearer token. The backend uses
Clerk identity to scope every user-owned quote, order, customer, beneficiary,
wallet, and virtual account.

3.3 Required mutation headers
Every state-changing fiat request requires an Idempotency-Key header:

Idempotency-Key: 5d2f937e-4ac5-4af7-a332-3d97f2c0a846
Use a new UUID for each new logical action. Reuse the same key only when
retrying the exact same request body after a timeout, connection failure, or
uncertain response. Never reuse an old key for a different amount, beneficiary,
wallet, quote, or channel.

The backend treats a request with the same key and same operation scope as the
same operation. A completed replay may return 200 instead of 201.

Recommended optional headers:

Accept: application/json
Content-Type: application/json
X-Request-Id: <frontend-trace-id>
The backend returns an x-request-id response header and usually includes the
same identifier in the JSON envelope. Log this identifier with UI diagnostics,
but never log authorization tokens, provider credentials, raw bank details, or
private keys.

4. Common response envelopes
Successful requests use this shape:

{
  "success": true,
  "data": {},
  "requestId": "b7c5ef0d-7b3f-4a36-bf56-d35a4c8e6b42"
}
The dashboard's typed cryptoBackendClient unwraps data and returns the
value directly. A raw fetch caller must read payload.data itself.

Errors use this shape:

{
  "success": false,
  "error": {
    "code": "FIAT_PROVIDER_NOT_READY",
    "message": "onswitch quote lane is not approved",
    "details": {
      "provider": "onswitch",
      "direction": "onramp",
      "blockingReasons": ["FIAT_RAMP_ENABLED is false"]
    }
  },
  "requestId": "2f61a4b8-4a56-41b1-9d58-96f60444c329"
}
The typed dashboard client throws CryptoBackendError with:

type CryptoBackendErrorFields = {
  message: string
  status: number // 0 means no HTTP response was received
  code: string
  details?: unknown
  requestId?: string
}
Use error.status, error.code, and error.requestId for behavior and
support diagnostics. Do not branch on the human-readable message.

5. Start every screen with capability discovery
GET /fiat/config
Dashboard path:

GET /api/crypto/fiat/config
Direct backend path:

GET https://crypto-backend.worldstreetgold.com/v1/fiat/config
This is an authenticated read. Cache it for no longer than the returned
cacheExpiresAt; refetch after that time or after a provider-related error.

Illustrative successful response:

{
  "success": true,
  "data": {
    "generatedAt": "2026-09-26T10:20:00.000Z",
    "cacheExpiresAt": "2026-09-26T10:21:00.000Z",
    "environment": "sandbox",
    "enabled": true,
    "availability": "available",
    "rollout": { "allowlisted": true },
    "readiness": {
      "environment": "sandbox",
      "featureEnabled": true,
      "productionApproved": true,
      "complianceApproved": true,
      "ready": true,
      "blockingReasons": [],
      "providers": {
        "onswitch": {
          "provider": "onswitch",
          "environment": "sandbox",
          "baseUrl": "https://api.onswitch.xyz",
          "enabled": true,
          "keyConfigured": true,
          "configured": true,
          "keyEnvironmentValid": true,
          "accountApproved": true,
          "webhookConfigured": true,
          "complianceApproved": true,
          "discoveryAvailable": true,
          "operationAvailable": true,
          "blockingReasons": []
        },
        "bridge": {
          "provider": "bridge",
          "environment": "sandbox",
          "baseUrl": "https://api.sandbox.bridge.xyz",
          "enabled": true,
          "keyConfigured": true,
          "configured": true,
          "keyEnvironmentValid": true,
          "accountApproved": true,
          "webhookConfigured": true,
          "complianceApproved": true,
          "discoveryAvailable": true,
          "operationAvailable": true,
          "blockingReasons": []
        }
      }
    },
    "providers": {
      "onswitch": {
        "status": "available",
        "directions": {
          "onrampEnabled": true,
          "offrampEnabled": true
        },
        "coverage": [
          {
            "countryCode": "NG",
            "currencyCode": "NGN",
            "channels": ["BANK"],
            "directions": ["onramp", "offramp"],
            "enabled": true,
            "settlementCurrency": "NGN",
            "countryName": "Nigeria"
          },
          {
            "countryCode": "GH",
            "currencyCode": "GHS",
            "channels": ["MOBILE_MONEY"],
            "directions": ["onramp", "offramp"],
            "enabled": true,
            "settlementCurrency": "GHS",
            "countryName": "Ghana"
          }
        ],
        "assets": [
          {
            "providerAssetId": "ethereum:usdc",
            "symbol": "USDC",
            "decimals": 6,
            "chain": "ethereum",
            "address": "0x...",
            "onrampSupported": true,
            "offrampSupported": true
          }
        ]
      },
      "bridge": {
        "status": "available",
        "routes": [
          {
            "id": "bridge-usd-virtual-account",
            "provider": "bridge",
            "direction": "onramp",
            "fiatCurrency": "USD",
            "paymentRail": "ach_or_wire",
            "accountType": "virtual_account",
            "requiresCustomerKyc": true,
            "requiresOwnedExternalAccount": false,
            "status": "available",
            "notes": []
          },
          {
            "id": "bridge-usd-withdrawal",
            "provider": "bridge",
            "direction": "offramp",
            "fiatCurrency": "USD",
            "paymentRail": "ach_or_wire",
            "accountType": "external_bank_account",
            "requiresCustomerKyc": true,
            "requiresOwnedExternalAccount": true,
            "status": "available",
            "notes": []
          }
        ],
        "account": {
          "customerRequired": true,
          "kycRequired": true,
          "supportedFiat": ["USD"],
          "virtualAccountsEnabled": true,
          "withdrawalsEnabled": true,
          "liquidationEnabled": true
        }
      }
    },
    "assetRoutes": [
      {
        "provider": "onswitch",
        "providerAssetId": "ethereum:usdc",
        "symbol": "USDC",
        "decimals": 6,
        "providerChain": "ethereum",
        "providerAddress": "0x...",
        "localNetworkId": "ethereum-mainnet",
        "walletReady": true,
        "status": "wallet_ready",
        "onrampSupported": true,
        "offrampSupported": true
      }
    ]
  },
  "requestId": "b7c5ef0d-7b3f-4a36-bf56-d35a4c8e6b42"
}
The values above are illustrative. The UI must derive its country, currency,
channel, direction, asset, network, and payment-rail selectors from the live
response.

Capability status behavior
Status	Frontend behavior
disabled	Hide or disable fiat actions. The global switch is off or the provider is not enabled.
blocked	Show a non-actionable “temporarily unavailable” state. Do not allow quote/order creation.
discovery_only	Read-only capability discovery is available; do not show money-moving buttons.
available	The corresponding action may be shown, subject to customer, beneficiary, wallet, corridor, and asset checks.
unavailable	Hide the affected provider route and offer another available rail if one exists.
availability is not a guarantee that every corridor works. A specific
OnSwitch coverage item and a specific assetRoutes item must both be enabled
and wallet-ready before showing a quote action.

Bridge currently exposes USD only. Do not display NGN as a Bridge currency;
NGN and other African local currencies remain OnSwitch corridors when returned
by OnSwitch capability discovery.

6. Route catalog
All routes below are relative to:

https://crypto-backend.worldstreetgold.com/v1
For browser code, replace that prefix with /api/crypto.

6.1 Current dashboard proxy availability
The dashboard proxy currently allowlists these fiat paths:

Route group	Through /api/crypto now?
Config	Yes
Quotes	Yes
Orders	Yes
Bridge virtual accounts/activity	Yes
Compliance/customer/KYC	Not yet allowlisted
Institutions	Not yet allowlisted
Beneficiaries	Not yet allowlisted
The backend routes in the last three rows are implemented, but the dashboard
proxy must be extended before browser components can use them through
/api/crypto. Do not work around this by putting provider credentials in the
browser. Add the exact allowlist entries in
app/api/crypto/[...path]/route.ts and add typed client methods in the same
change. Until that dashboard change is made, call those routes only from a
trusted server integration or leave the UI flow disabled.

6.2 Endpoint summary
Method	Path	Purpose	Idempotency
GET	/fiat/config	Capability and readiness discovery	No
GET	/fiat/compliance	List the signed-in user's provider customer mappings	No
POST	/fiat/compliance/customer	Create/sync an OnSwitch or Bridge customer profile	Yes
POST	/fiat/compliance/bridge/kyc-link	Create a Bridge hosted KYC link	Yes
POST	/fiat/compliance/bridge/sync	Refresh the user's Bridge customer/endorsement state	No
GET	/fiat/institutions	Discover OnSwitch banks/payment institutions	No
GET	/fiat/beneficiaries	List the user's own fiat beneficiaries	No
POST	/fiat/beneficiaries	Create and verify a user-owned offramp beneficiary	Yes
DELETE	/fiat/beneficiaries/:beneficiaryId	Deactivate an owned beneficiary	Yes
POST	/fiat/quotes	Create an OnSwitch onramp/offramp quote	Yes
GET	/fiat/quotes/:quoteId	Read an owned quote	No
POST	/fiat/orders	Create an OnSwitch order or Bridge USD withdrawal	Yes
GET	/fiat/orders	List the signed-in user's orders	No
GET	/fiat/orders/:orderId	Read and refresh an owned order	No
POST	/fiat/orders/:orderId/confirm	Confirm an OnSwitch offramp crypto deposit	Yes
POST	/fiat/bridge/virtual-accounts	Create/get a Bridge USD deposit account	Yes
GET	/fiat/bridge/virtual-accounts	List the user's Bridge deposit accounts	No
GET	/fiat/bridge/virtual-accounts/:accountId	Read and refresh an owned account	No
GET	/fiat/bridge/virtual-accounts/:accountId/activity	Read locally reconciled USD deposit activity	No
7. Compliance and customer setup
Bridge money movement requires a Bridge customer, KYC, and the required
endorsement. OnSwitch customer setup is also represented by the backend so the
frontend has one consistent compliance surface.

GET /fiat/compliance
Returns the signed-in user's provider customer mappings. Never accept a
customer ID from another user or expose provider customer IDs in the UI.

Illustrative response:

{
  "success": true,
  "data": [
    {
      "id": "66f000000000000000000001",
      "provider": "bridge",
      "status": "approved",
      "country": "US",
      "kycStatus": "approved",
      "tosStatus": "accepted",
      "endorsements": {
        "base": "approved"
      },
      "termsAcceptedAt": "2026-09-26T10:10:00.000Z",
      "lastSyncedAt": "2026-09-26T10:15:00.000Z",
      "createdAt": "2026-09-25T09:00:00.000Z",
      "updatedAt": "2026-09-26T10:15:00.000Z"
    }
  ],
  "requestId": "..."
}
POST /fiat/compliance/bridge/kyc-link
Use this as the normal Bridge onboarding path:

{
  "legalName": "Example User",
  "email": "user@example.com",
  "country": "US"
}
Headers:

Content-Type: application/json
Idempotency-Key: <new-uuid>
Illustrative response:

{
  "success": true,
  "data": {
    "customer": {
      "id": "66f000000000000000000001",
      "provider": "bridge",
      "status": "pending",
      "country": "US",
      "kycStatus": "pending",
      "tosStatus": "pending",
      "endorsements": {},
      "createdAt": "2026-09-26T10:20:00.000Z",
      "updatedAt": "2026-09-26T10:20:00.000Z"
    },
    "kycLink": {
      "url": "https://provider.example/hosted-kyc/<opaque-token>",
      "tosUrl": "https://provider.example/terms/<opaque-token>",
      "kycStatus": "pending",
      "tosStatus": "pending"
    }
  },
  "requestId": "..."
}
Open kycLink.url in the appropriate hosted flow. Do not embed the provider
API key or try to reproduce the provider KYC form in the dashboard. After the
user finishes, call POST /fiat/compliance/bridge/sync and then refetch
GET /fiat/compliance.

POST /fiat/compliance/customer
Use this for an explicit provider customer profile when the integration has
the required fields:

{
  "provider": "onswitch",
  "legalName": "Example User",
  "firstName": "Example",
  "lastName": "User",
  "email": "user@example.com",
  "phone": "+2348000000000",
  "country": "NG",
  "birthDate": "1990-01-01",
  "residentialAddress": {
    "country": "NG",
    "city": "Lagos"
  }
}
Bridge direct customer creation requires a complete profile. Prefer the hosted
KYC-link flow for Bridge unless the backend/operator has explicitly approved a
direct profile workflow.

POST /fiat/compliance/bridge/sync
No request body is needed. It returns the current sanitized Bridge customer:

{
  "success": true,
  "data": {
    "id": "66f000000000000000000001",
    "provider": "bridge",
    "status": "approved",
    "country": "US",
    "kycStatus": "approved",
    "tosStatus": "accepted",
    "endorsements": { "base": "approved" },
    "lastSyncedAt": "2026-09-26T10:30:00.000Z"
  },
  "requestId": "..."
}
8. Institution discovery and beneficiaries
Beneficiaries are for fiat offramps only. The policy is “only accounts owned
by the signed-in user.” The frontend may collect account details, but the
backend/provider verification decides whether the beneficiary is usable.

GET /fiat/institutions
Use this to populate a bank/payment-institution selector instead of hardcoding
bank codes:

GET /api/crypto/fiat/institutions?country=NG&currency=NGN&channel=BANK
The backend redacts provider response data before returning it. The exact
data shape is provider-controlled and can evolve, so render known fields
defensively and preserve the selected provider identifier exactly when posting
the beneficiary payload.

Illustrative response:

{
  "success": true,
  "data": [
    {
      "id": "provider-bank-code",
      "name": "Example Bank",
      "code": "000001",
      "country": "NG",
      "currency": "NGN",
      "channel": "BANK"
    }
  ],
  "requestId": "..."
}
The response above is illustrative; do not assume every provider returns these
exact property names.

GET /fiat/beneficiaries
Returns only the signed-in user's beneficiary records:

{
  "success": true,
  "data": [
    {
      "id": "66f000000000000000000021",
      "provider": "onswitch",
      "direction": "offramp",
      "country": "NG",
      "currency": "NGN",
      "channel": "BANK",
      "holderType": "individual",
      "holderName": "EXAMPLE USER",
      "maskedAccount": "******4321",
      "ownershipStatus": "verified",
      "verificationMethod": "provider_lookup",
      "verificationReason": null,
      "status": "verified",
      "verifiedAt": "2026-09-26T10:40:00.000Z",
      "createdAt": "2026-09-26T10:39:00.000Z",
      "updatedAt": "2026-09-26T10:40:00.000Z"
    }
  ],
  "requestId": "..."
}
Only offer a beneficiary for an order when its status is verified and its
ownershipStatus is verified. Treat pending, rejected, disabled, or
missing ownership as unusable.

POST /fiat/beneficiaries
Request shape:

{
  "provider": "onswitch",
  "direction": "offramp",
  "country": "NG",
  "currency": "NGN",
  "channel": "BANK",
  "holderName": "Example User",
  "holderType": "individual",
  "providerPayload": {
    "account_number": "<collected-at-runtime>",
    "bank_code": "000001",
    "holder_name": "Example User",
    "holder_type": "individual"
  }
}
Do not invent providerPayload fields. Use the selected institution and the
provider's dynamic beneficiary requirements. Never persist or log the raw
account number in the frontend. Send it over TLS and let the backend handle
redaction/encryption/provider verification.

The response status is 201 for a new record and 200 for an idempotent
existing record. The response body is the same sanitized beneficiary shape as
the list route.

DELETE /fiat/beneficiaries/:beneficiaryId
This deactivates an owned beneficiary; it does not delete another user's
beneficiary and does not make an in-flight order disappear.

DELETE /api/crypto/fiat/beneficiaries/66f000000000000000000021
Idempotency-Key: <new-uuid>
9. OnSwitch quote and order flow
9.1 Create an OnSwitch quote
POST /fiat/quotes supports OnSwitch only. Use a coverage item and a
wallet-ready asset route from /fiat/config.

Request:

{
  "provider": "onswitch",
  "direction": "onramp",
  "country": "NG",
  "currency": "NGN",
  "channel": "BANK",
  "amount": "100000",
  "asset": "ethereum:usdc",
  "network": "ethereum-mainnet",
  "exactOutput": false
}
The same endpoint works for an offramp by changing direction and using the
returned corridor/asset semantics:

{
  "provider": "onswitch",
  "direction": "offramp",
  "country": "NG",
  "currency": "NGN",
  "channel": "BANK",
  "amount": "100000",
  "asset": "ethereum:usdc",
  "network": "ethereum-mainnet"
}
Illustrative response:

{
  "success": true,
  "data": {
    "id": "66f000000000000000000031",
    "provider": "onswitch",
    "direction": "onramp",
    "country": "NG",
    "currency": "NGN",
    "channel": "BANK",
    "exactOutput": false,
    "sourceAmount": "100000",
    "sourceCurrency": "NGN",
    "destinationAmount": "62.450000",
    "destinationCurrency": "USDC",
    "asset": "ethereum:usdc",
    "network": "ethereum-mainnet",
    "providerRate": "1602.564102",
    "providerFee": "500",
    "worldstreetFee": "100",
    "expectedSettlementSeconds": 900,
    "expiresAt": "2026-09-26T10:55:00.000Z",
    "state": "active",
    "createdAt": "2026-09-26T10:45:00.000Z",
    "updatedAt": "2026-09-26T10:45:00.000Z"
  },
  "requestId": "..."
}
Display the quote expiry. A quote is not a payment and does not reserve funds.
When expiresAt has passed, request a new quote with a new idempotency key.

GET /fiat/quotes/:quoteId
Use this to reload an owned quote after navigation or a browser refresh. It
returns the same quote shape. A quote ID is not transferable between users.

9.2 Create an OnSwitch order
Onramp request:

{
  "provider": "onswitch",
  "walletId": "66f000000000000000000041",
  "quoteId": "66f000000000000000000031"
}
Offramp request:

{
  "provider": "onswitch",
  "walletId": "66f000000000000000000041",
  "quoteId": "66f000000000000000000032",
  "beneficiaryId": "66f000000000000000000021"
}
Illustrative onramp response:

{
  "success": true,
  "data": {
    "id": "66f000000000000000000051",
    "publicReference": "WS-ONSWITCH-000051",
    "provider": "onswitch",
    "direction": "onramp",
    "country": "NG",
    "currency": "NGN",
    "channel": "BANK",
    "asset": "ethereum:usdc",
    "network": "ethereum-mainnet",
    "quoteId": "66f000000000000000000031",
    "state": "awaiting_bank_deposit",
    "providerStatus": "pending",
    "providerDisplay": {
      "paymentInstructions": {
        "amount": "100000",
        "currency": "NGN",
        "bankName": "Example Bank",
        "accountName": "WorldStreet Settlement",
        "accountNumber": "******1234",
        "expiresAt": "2026-09-26T11:00:00.000Z"
      }
    },
    "createdAt": "2026-09-26T10:50:00.000Z",
    "updatedAt": "2026-09-26T10:50:00.000Z"
  },
  "requestId": "..."
}
providerDisplay is a sanitized display object. Render only the fields
returned by the backend and treat the instructions as expiring. Do not infer
bank details from the quote.

Illustrative offramp response:

{
  "success": true,
  "data": {
    "id": "66f000000000000000000052",
    "publicReference": "WS-ONSWITCH-000052",
    "provider": "onswitch",
    "direction": "offramp",
    "country": "NG",
    "currency": "NGN",
    "channel": "BANK",
    "asset": "ethereum:usdc",
    "network": "ethereum-mainnet",
    "beneficiaryId": "66f000000000000000000021",
    "quoteId": "66f000000000000000000032",
    "localCryptoIntentId": "66f000000000000000000061",
    "state": "crypto_intent_ready",
    "providerStatus": "awaiting_crypto_deposit",
    "cryptoIntent": {
      "id": "66f000000000000000000061",
      "status": "prepared",
      "to": "0xprovider-deposit-address",
      "amount": "62.450000",
      "asset": "USDC",
      "network": "ethereum-mainnet"
    },
    "expiresAt": "2026-09-26T11:20:00.000Z",
    "createdAt": "2026-09-26T10:50:00.000Z",
    "updatedAt": "2026-09-26T10:50:00.000Z"
  },
  "requestId": "..."
}
The exact cryptoIntent object follows the existing WorldStreet wallet intent
contract. The frontend must pass it through the existing wallet simulation,
approval/signing, submit, and transaction-status flow. Never ask the user to
copy a provider address into an arbitrary wallet screen.

9.3 Confirm an OnSwitch offramp deposit
After the local wallet transaction has been broadcast successfully:

{
  "transactionHash": "0x<confirmed-worldstreet-wallet-transaction-hash>"
}
Call:

POST /api/crypto/fiat/orders/66f000000000000000000052/confirm
Idempotency-Key: <new-confirmation-uuid>
The confirmation key is separate from the order-creation key. A successful
response returns the updated order. Do not call confirm before the transaction
has been submitted, and do not confirm an OnSwitch onramp or a Bridge order.

10. Bridge USD flow
Bridge is the USD rail. The WorldStreet wallet remains the crypto destination;
the Bridge virtual account is a reusable USD deposit instruction, not a fiat
balance that the frontend should model as a wallet.

10.1 Create a Bridge USD virtual account
Request:

{
  "walletId": "66f000000000000000000041",
  "networkId": "ethereum-mainnet",
  "asset": "USDC"
}
The backend validates that the network has the configured canonical WorldStreet
USDC token. The frontend must not submit an arbitrary token contract address to
this endpoint.

Illustrative response:

{
  "success": true,
  "data": {
    "id": "66f000000000000000000071",
    "provider": "bridge",
    "walletId": "66f000000000000000000041",
    "networkId": "ethereum-mainnet",
    "asset": "USDC",
    "destinationAddress": "0x<worldstreet-user-usdc-address>",
    "status": "active",
    "providerStatus": "active",
    "depositInstructions": {
      "currency": "USD",
      "paymentRails": ["ach", "wire"],
      "accountName": "Example User",
      "routingNumber": "******6789",
      "accountNumber": "******4321",
      "bankName": "Example Bank",
      "reference": "WS-VA-000071"
    },
    "lastSyncedAt": "2026-09-26T11:00:00.000Z",
    "createdAt": "2026-09-26T11:00:00.000Z",
    "updatedAt": "2026-09-26T11:00:00.000Z"
  },
  "requestId": "..."
}
Display depositInstructions exactly as returned, with masking/copy controls
appropriate for sensitive bank details. Do not store them in analytics or log
them. The same request with the same idempotency key returns the existing
account; the backend also prevents duplicate active accounts for the same
user/wallet/network/asset.

10.2 List/read virtual accounts and activity
GET /api/crypto/fiat/bridge/virtual-accounts
GET /api/crypto/fiat/bridge/virtual-accounts/:accountId
GET /api/crypto/fiat/bridge/virtual-accounts/:accountId/activity?limit=100
Illustrative activity response:

{
  "success": true,
  "data": [
    {
      "id": "66f000000000000000000081",
      "virtualAccountId": "66f000000000000000000071",
      "providerStatus": "completed",
      "amount": "250.00",
      "currency": "USD",
      "destinationTxHash": "0x<worldstreet-settlement-tx>",
      "sourcePaymentRail": "ach",
      "occurredAt": "2026-09-27T14:00:00.000Z",
      "createdAt": "2026-09-27T14:01:00.000Z",
      "updatedAt": "2026-09-27T14:01:00.000Z"
    }
  ],
  "requestId": "..."
}
Activity is locally reconciled backend data. An empty list means no reconciled
activity is available yet; it does not necessarily mean a bank payment failed.
Refresh the account and activity with a modest backoff.

10.3 Bridge USD withdrawal
The withdrawal uses the generic order endpoint. The beneficiary must be a
verified, owned Bridge USD external bank account.

Request:

{
  "provider": "bridge",
  "walletId": "66f000000000000000000041",
  "networkId": "ethereum-mainnet",
  "asset": "0x<canonical-worldstreet-usdc-address>",
  "amount": "100.00",
  "beneficiaryId": "66f000000000000000000091",
  "channel": "ach"
}
Allowed channel values:

ach | ach_same_day | wire | fednow
Only render fednow when the capability response and account configuration
make it available. The backend rejects it when BRIDGE_FEDNOW_ENABLED is
false.

Illustrative response:

{
  "success": true,
  "data": {
    "id": "66f000000000000000000101",
    "publicReference": "WS-BRIDGE-000101",
    "provider": "bridge",
    "direction": "offramp",
    "country": "US",
    "currency": "USD",
    "channel": "ach",
    "asset": "0x<canonical-worldstreet-usdc-address>",
    "network": "ethereum-mainnet",
    "beneficiaryId": "66f000000000000000000091",
    "localCryptoIntentId": "66f000000000000000000111",
    "state": "crypto_intent_ready",
    "providerStatus": "awaiting_crypto_deposit",
    "cryptoIntent": {
      "id": "66f000000000000000000111",
      "status": "prepared",
      "to": "0x<bridge-deposit-address>",
      "amount": "100.00",
      "asset": "USDC",
      "network": "ethereum-mainnet"
    },
    "createdAt": "2026-09-26T11:10:00.000Z",
    "updatedAt": "2026-09-26T11:10:00.000Z"
  },
  "requestId": "..."
}
Use the existing wallet cryptoIntent signing flow. The Bridge withdrawal
does not use the OnSwitch /confirm endpoint; after broadcast, refresh the
order with GET /fiat/orders/:orderId.

11. Order lifecycle and UI state rules
The backend's state is the product-level source of truth. providerStatus
is useful for diagnostics but is provider-specific and must not drive the main
UI alone.

The frontend should handle at least these states:

State	UI meaning
created / quoted	Local record exists; continue the flow or reload.
awaiting_bank_deposit	Show local-fiat payment instructions and expiry.
awaiting_crypto_deposit	Show the signed transaction intent flow or wait for a submitted transaction.
crypto_intent_ready	Open the existing wallet signing flow.
crypto_submitted	Show transaction pending; do not create a second order.
provider_processing / scheduled	Provider is processing; poll with backoff.
completed	Show success and update wallet/order history.
manual_review / blocked	Stop automatic retries and show support/review messaging.
failed / reversed / refund_in_flight / refunded / refund_failed	Show the backend's safe reason and a support/recovery action.
Important rules:

HTTP 201 means the backend created an order record; it does not mean the
fiat payment settled.
HTTP 200 after a mutation can be a safe idempotent replay; inspect the
returned order/account rather than treating it as an error.
A quote can expire between display and order creation. Re-quote when the
backend returns FIAT_QUOTE_NOT_ACTIVE.
A provider webhook is asynchronous. The browser should poll the owned
resource; it should not wait for or verify provider webhooks itself.
Do not create another order merely because the first request timed out. Use
the same idempotency key or reload the order list.
Polling recommendation
For an active order, use a bounded backoff such as 2s, 4s, 8s, 15s, 30s,
then every 30–60s while the screen is open. Stop on a terminal state. Refetch
on window focus and after a wallet transaction submit. Avoid polling every
second across a list of orders; the backend is rate-limited.

For virtual-account activity, poll less frequently (15–30s while the account
screen is open) and refresh on focus. The user can leave the screen; backend
reconciliation continues independently.

12. Error reference
12.1 Status-code policy
HTTP	Typical codes	Frontend action
400	INVALID_REQUEST, IDEMPOTENCY_KEY_REQUIRED, FIAT_AMOUNT_INVALID, BENEFICIARY_REQUIRED	Fix the request/UI input. Do not retry unchanged.
401	UNAUTHORIZED from dashboard proxy or AUTH_REQUIRED from backend	Refresh Clerk once. If still unauthorized, send the user to sign in.
403	FORBIDDEN, BENEFICIARY_NOT_VERIFIED	Stop the action and show ownership/compliance guidance. Do not retry.
404	NOT_FOUND	Reload the user's list or show that the resource is unavailable. Never probe another user's ID.
409	FIAT_PROVIDER_NOT_READY, FIAT_QUOTE_NOT_ACTIVE, IDEMPOTENCY_IN_PROGRESS, IDEMPOTENT_REQUEST_FAILED, FIAT_CONFIRMATION_CONFLICT	Resolve state. Reuse the same key for an in-flight retry; use a new key only for a new logical action.
413	PAYLOAD_TOO_LARGE	Reduce input size; never include raw provider payload beyond required fields.
422	FIAT_CORRIDOR_UNAVAILABLE, FIAT_DIRECTION_UNSUPPORTED, FIAT_ASSET_MAPPING_MISSING, BRIDGE_ASSET_UNSUPPORTED, BRIDGE_NETWORK_UNSUPPORTED, FIAT_PROVIDER_* validation errors	Refresh capabilities or correct the selected corridor/asset/account.
429	RATE_LIMITED	Honor Retry-After when present and back off. Do not start a duplicate mutation.
502	FIAT_PROVIDER_*, PROVIDER_RESPONSE_INVALID, PROVIDER_OWNERSHIP_MISMATCH, CRYPTO_SERVICE_UNREACHABLE	Treat as temporary/provider failure unless the resource can be reloaded. Retry reads with backoff; retry mutations with the same idempotency key only.
503	CRYPTO_SERVICE_UNCONFIGURED, provider rate-limit conversion, service unavailable	Show temporary unavailability and retry later with backoff.
500	INTERNAL_ERROR, IDEMPOTENCY_RESOURCE_MISSING	Do not create a duplicate. Keep the request ID, reload the resource, and escalate if persistent.
Provider authentication errors are intentionally mapped to a backend/provider
error instead of exposing provider credentials or raw upstream details to the
browser.

12.2 Representative error responses
Missing dashboard session:

HTTP/1.1 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized"
  }
}
Missing/invalid direct backend session:

{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required"
  },
  "requestId": "..."
}
Malformed request body:

{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request validation failed",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "country": ["Invalid input: expected string, received undefined"],
        "amount": ["Invalid input: expected string or number, received undefined"]
      }
    }
  },
  "requestId": "..."
}
Missing idempotency key:

{
  "success": false,
  "error": {
    "code": "IDEMPOTENCY_KEY_REQUIRED",
    "message": "Idempotency-Key header is required"
  },
  "requestId": "..."
}
Feature/provider not ready:

{
  "success": false,
  "error": {
    "code": "FIAT_PROVIDER_NOT_READY",
    "message": "bridge operation is not approved",
    "details": {
      "provider": "bridge",
      "blockingReasons": [
        "FIAT_RAMP_ENABLED is false",
        "BRIDGE account approval is not complete"
      ]
    }
  },
  "requestId": "..."
}
Not owned or not verified:

{
  "success": false,
  "error": {
    "code": "BENEFICIARY_NOT_VERIFIED",
    "message": "The selected beneficiary is not verified for this account"
  },
  "requestId": "..."
}
Provider/corridor rejection:

{
  "success": false,
  "error": {
    "code": "FIAT_PROVIDER_VALIDATION",
    "message": "The selected corridor is not available",
    "details": {
      "provider": "onswitch",
      "providerCode": "<sanitized-provider-code>"
    }
  },
  "requestId": "..."
}
The exact provider error code/message may vary. The frontend should show a
safe generic message and retain the request ID for support.

12.3 Retry helper
The existing client already throws CryptoBackendError. A UI mutation handler
should follow this pattern:

import { CryptoBackendError } from '@/lib/crypto-backend/errors'

function isRetryableReadError(error: unknown): boolean {
  return error instanceof CryptoBackendError &&
    (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504)
}

function userMessage(error: unknown): string {
  if (!(error instanceof CryptoBackendError)) {
    return 'Something went wrong. Please try again.'
  }

  switch (error.code) {
    case 'AUTH_REQUIRED':
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please sign in again.'
    case 'FIAT_PROVIDER_NOT_READY':
      return 'This fiat rail is temporarily unavailable.'
    case 'FIAT_QUOTE_NOT_ACTIVE':
      return 'The quote expired. Get a new quote to continue.'
    case 'BENEFICIARY_NOT_VERIFIED':
      return 'Verify that the bank account belongs to you before continuing.'
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment and try again.'
    default:
      return error.message || 'The fiat transaction could not be completed.'
  }
}

async function handleFiatError(error: unknown) {
  if (error instanceof CryptoBackendError) {
    console.warn('fiat request failed', {
      status: error.status,
      code: error.code,
      requestId: error.requestId,
    })
  }

  return userMessage(error)
}
For a mutation timeout, the UI must not generate a new idempotency key until it
has either retried the exact request with the original key or confirmed the
result by listing/reading the resource.

13. Recommended frontend implementation sequence
OnSwitch local-fiat onramp
Call GET /fiat/config.
Select an enabled OnSwitch coverage item with direction: "onramp".
Select an assetRoutes item with walletReady: true and
onrampSupported: true.
Create a quote with POST /fiat/quotes.
Show amounts, fees, expiry, and destination asset/network.
Create the order with POST /fiat/orders and a new idempotency key.
Display the sanitized providerDisplay payment instructions.
Refresh GET /fiat/orders/:orderId after the user pays or returns to the
app.
Stop when the order reaches a terminal state.
OnSwitch local-fiat offramp
Call GET /fiat/config and select an enabled offramp corridor.
Discover the institution through GET /fiat/institutions if needed.
Create a user-owned beneficiary and wait for status: "verified".
Create an offramp quote.
Create the order with the verified beneficiaryId.
Open the returned WorldStreet cryptoIntent in the existing signing flow.
Submit/broadcast the wallet transaction.
Call POST /fiat/orders/:orderId/confirm with the transaction hash and a
separate idempotency key.
Poll the order until the fiat settlement reaches a terminal state.
Bridge USD onramp
Call GET /fiat/config and verify the Bridge USD virtual-account route is
available.
Complete Bridge KYC using POST /fiat/compliance/bridge/kyc-link and
POST /fiat/compliance/bridge/sync.
Create a virtual account with
POST /fiat/bridge/virtual-accounts.
Display the returned USD ACH/wire instructions.
Poll the account and activity routes while the screen is open.
Refresh the user's wallet balance/order history after reconciled activity
shows a completed delivery.
Bridge USD offramp
Complete Bridge customer approval and required endorsement.
Create a verified, owned USD bank beneficiary.
Call GET /fiat/config and display only supported withdrawal channels.
Create a Bridge order through POST /fiat/orders.
Sign and broadcast the returned WorldStreet crypto intent.
Refresh GET /fiat/orders/:orderId until completed, failed, reversed, or
manual review.
14. Minimal raw-fetch wrapper
The typed client is preferred. If a screen needs a raw wrapper, keep it
limited to the dashboard proxy:

type ApiSuccess<T> = {
  success: true
  data: T
  requestId?: string
}

type ApiFailure = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  requestId?: string
}

export async function cryptoFetch<T>(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

  const response = await fetch(`/api/crypto${path}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  })

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure
  if (!response.ok || payload.success === false) {
    const error = payload as ApiFailure
    throw new Error(error.error?.message ?? `Crypto backend error ${response.status}`)
  }

  return (payload as ApiSuccess<T>).data
}
For production UI code, prefer the existing cryptoBackendClient because it
already handles CryptoBackendError, Clerk refresh/retry behavior for a 401,
typed fiat responses, idempotency headers, and abort signals.

15. Frontend security checklist
The browser calls /api/crypto, not OnSwitch or Bridge.
CRYPTO_API_URL is server-only and points to
https://crypto-backend.worldstreetgold.com.
No provider key appears in frontend environment variables, bundles,
source maps, logs, analytics, or error reports.
Every mutation sends a fresh UUID idempotency key.
The same key is reused for an exact retry after an uncertain response.
The UI uses only IDs returned for the signed-in user.
Only status: "verified" and ownershipStatus: "verified"
beneficiaries can be selected.
The UI never trusts a browser-supplied user ID or beneficiary ownership
flag.
Raw bank account numbers and full provider instructions are not logged.
Provider display fields are rendered defensively and treated as
untrusted data.
The UI never treats order creation as settlement.
The UI handles expired quotes, provider unavailability, review states,
reversals, and refunds.
The global FIAT_RAMP_ENABLED kill switch is respected through the
/fiat/config response; no cached “available” state can authorize a
mutation after the backend has disabled the rail.
16. Frontend/backend handoff checklist
Before a frontend fiat screen is marked complete:

Confirm CRYPTO_API_URL is set only on the dashboard server and points to
the backend base host without /v1.
Confirm the frontend can obtain a valid Clerk session.
Confirm GET /api/crypto/fiat/config returns the expected environment and
capability status.
Confirm the dashboard proxy allowlist includes every route used by the
screen. In the current tree, compliance, institutions, and beneficiary
paths still need allowlist/client additions.
Confirm every mutation has a stable idempotency-key lifecycle.
Test a missing session and verify the UI handles 401 without a duplicate
order.
Test a disabled global switch and verify the UI shows unavailable state and
does not attempt a mutation.
Test an expired quote and FIAT_QUOTE_NOT_ACTIVE.
Test a duplicate mutation and verify the replay is rendered as the same
resource rather than a second payment.
Test provider timeout/502/503 behavior and confirm read retries are
bounded.
Test an ownership failure for a beneficiary and ensure the UI does not
allow the order to proceed.
Capture the backend requestId in support diagnostics for every failed
request.
17. Relevant source files
Backend routes and contracts:

src/api/routes/fiat.ts
src/api/middleware/errorHandler.ts
src/fiat-ramp/service.ts
src/fiat-ramp/readiness.ts
src/fiat-ramp/quotes.ts
src/fiat-ramp/orders.ts
src/fiat-ramp/beneficiaries.ts
src/fiat-ramp/compliance.ts
src/fiat-ramp/virtualAccounts.ts
Dashboard integration:

app/api/crypto/[...path]/route.ts
lib/crypto-backend/client.ts
lib/crypto-backend/types.ts
lib/crypto-backend/errors.ts
Provider documentation:

OnSwitch documentation
Bridge API overview
