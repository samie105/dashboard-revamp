# Phases 6–8 Implementation Notes

## Phase 6 — EVM adapter

Implemented behind `ChainAdapter` and `AdapterRegistry`:

- Ethereum Sepolia.
- Base Sepolia.
- Mainnet/Arbitrum/Polygon/BNB metadata remains disabled until explicitly enabled.
- Native ETH transfers.
- ERC-20 transfers.
- EVM balance reads.
- Chain ID, sender, destination, value, calldata, and token metadata validation.
- RPC simulation before intent creation.
- Signed transaction sender/data/value binding before broadcast.
- Transaction receipt status reconciliation.

The EVM adapter uses `viem`. It never receives a private key; it accepts a signed raw transaction only after the client signs the reviewed unsigned payload.

## Phase 7 — Solana adapter

Implemented behind the same adapter contract:

- Solana devnet.
- Solana mainnet metadata remains disabled.
- SOL transfers.
- SPL-token transfer construction.
- Versioned transaction payloads.
- Fee payer and account validation.
- Simulation through Solana RPC.
- Signed message equivalence checks before broadcast.
- Signature status reconciliation.

The Solana adapter uses `@solana/web3.js` and `@solana/spl-token`. It does not translate Solana instructions into EVM concepts.

## Phase 8 — Intent and transaction lifecycle

### Create a reviewed unsigned intent

```http
POST /v1/transactions/intents
Authorization: Bearer <Clerk JWT>
Idempotency-Key: transfer-unique-key-001
```

```json
{
  "accountId": "...",
  "networkId": "ethereum-sepolia",
  "asset": { "kind": "native", "identifier": "ETH" },
  "to": "0x...",
  "amount": "0.001"
}
```

The backend:

1. Verifies Clerk user ownership of the account.
2. Verifies the network is enabled and matches the account family.
3. Builds a chain-native unsigned transaction.
4. Validates it with the chain adapter.
5. Simulates it.
6. Stores the intent and returns a normalized review summary.

### Submit a signed transaction

```http
POST /v1/transactions/intents/:intentId/submit
Authorization: Bearer <Clerk JWT>
```

```json
{
  "signedTransaction": "0x..."
}
```

For Solana, `signedTransaction` is base64. For EVM, it is a `0x` serialized signed transaction. The adapter verifies that the signed payload matches the reviewed intent before broadcasting.

### Balances and history

```text
GET /v1/wallets/me/accounts/:accountId/balances?networkId=ethereum-sepolia
GET /v1/transactions/intents/:intentId
GET /v1/transactions/:transactionId
GET /v1/transactions?limit=50
POST /v1/transactions/intents/:intentId/simulate
```

### Reconciliation

The backend starts a worker after MongoDB connects. It polls submitted/unknown transaction records, asks the relevant adapter for status, and updates both `transaction_records` and `transaction_intents`.

## Required configuration

Enabled testnet/devnet routes require RPC configuration:

```env
ETHEREUM_SEPOLIA_RPC_URL=
BASE_SEPOLIA_RPC_URL=
SOLANA_RPC_URL=https://api.devnet.solana.com
```

Missing EVM RPC configuration returns `RPC_NOT_CONFIGURED`; it does not silently fall back to an untrusted public endpoint.

## Current limitations

- Only transfer intents are enabled.
- EVM arbitrary contract calls and typed-data signing are not exposed by the API yet.
- Solana program-specific intents and swap integrations are not enabled yet.
- Mainnet networks remain disabled.
- Full MongoDB/RPC integration requires Docker and configured testnet/devnet endpoints.
