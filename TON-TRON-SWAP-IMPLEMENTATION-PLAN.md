# TON/TRON Swap Routing Implementation Plan

## Phase 0 — Confirm supported routes

Document the supported route matrix before coding:

```text
LI.FI:
- Ethereum
- Arbitrum
- Solana
- Sui

0x Cross-Chain API:
- Tron
- Solana ↔ Tron
- Tron ↔ EVM
- EVM ↔ Tron

STON.fi/Omniston:
- TON-native swaps
- TON jetton swaps

Intertrain bridge:
- Arbitrum USDC → Intertrain USDC
```

TON cross-chain routes remain disabled unless Omniston returns a valid executable transaction for that exact pair.

## Phase 1 — Create a backend router abstraction

Add a common router interface:

```ts
interface SwapRouter {
  supportsRoute(input: SwapRoute): boolean
  getQuote(input: SwapQuoteRequest): Promise<SwapQuote>
  buildIntent(input: SwapIntentRequest): Promise<UnsignedSwapIntent>
  getStatus(input: SwapStatusRequest): Promise<SwapStatus>
}
```

Implement:

- `LifiSwapRouter`
- `ZeroExSwapRouter`
- `OmnistonSwapRouter`
- `SunSwapRouter` later if a TRON same-chain liquidity fallback is required

The frontend calls one unified swap endpoint and never selects routers directly.

## Phase 2 — Add router configuration

Add backend-only configuration:

```env
ZEROEX_API_KEY=
ZEROEX_API_URL=https://api.0x.org
OMNISTON_API_URL=wss://omni-ws.ston.fi
STON_API_URL=https://api.ston.fi
```

API keys must never be placed in the frontend. The backend must return a clear configuration error when a required provider key is missing.

## Phase 3 — Expand chain and token metadata

Add TON mainnet and TRON mainnet metadata.

Add canonical identifiers for:

- Native TON
- TON jettons
- TRX
- TRC-20 USDT and USDC
- Solana tokens supported by 0x
- EVM tokens supported by 0x

Every token must include:

```ts
{
  chain,
  symbol,
  address,
  decimals,
  assetId
}
```

Never use a token symbol alone to identify an asset.

## Phase 4 — Fix the unified frontend token picker

Keep the existing `/swap` page and UI.

When a source chain changes:

- Filter the source-token dropdown to that chain.
- Remove tokens that do not belong to the selected chain.
- Reset the selected token if it is no longer valid.

When a destination chain changes, apply the same behavior to the destination-token dropdown.

Examples:

```text
TRON:
- TRX
- USDT
- USDC

TON:
- TON
- Supported jettons only

Solana:
- SOL
- USDC
- USDT
```

BTC must never appear under TRON or TON unless a real BTC route is implemented.

## Phase 5 — Add router selection on the backend

Create a deterministic router selector:

```text
if source/destination are Ethereum, Arbitrum, Solana, or Sui:
    LI.FI

else if source or destination is Tron:
    0x

else if source and destination are TON:
    Omniston

else:
    no executable route
```

Router selection happens before quote creation. Responses include the selected router and both chain identifiers.

## Phase 6 — Implement 0x TRON execution

Implement:

1. Request a quote from 0x.
2. Resolve allowance requirements.
3. Build TRON smart-contract transactions through TronWeb/TRON RPC.
4. Return an unsigned TRON transaction intent.
5. Validate sender, destination, token contract, amount, router contract, transaction ID, and raw data.
6. Let the modern wallet sign locally.
7. Broadcast through the existing TRON adapter.
8. Track source and destination settlement through the 0x status endpoint.

This enables TRON ↔ EVM and TRON ↔ Solana routes where 0x returns a valid quote and executable transaction.

## Phase 7 — Implement TON swaps with Omniston

Implement:

1. Connect to Omniston from the backend.
2. Request a TON quote.
3. Select the best valid quote.
4. Build TON outbound messages.
5. Return an unsigned TON transaction intent.
6. Extend the TON adapter to validate destination contract, message count, jetton address, amount, minimum output, and quote expiry.
7. Sign locally with the existing modern wallet.
8. Broadcast through the TON adapter.
9. Track settlement using Omniston trade status.

Omniston returns TON wallet messages rather than EVM-style calldata.

## Phase 8 — Support TON jettons

Add:

- Jetton metadata lookup
- Jetton wallet address resolution
- Jetton transfer payload validation
- Jetton swap simulation
- Destination jetton balance refresh
- Metadata and icon display

Do not treat a TON jetton like native TON.

## Phase 9 — Integrate unified intent execution

Extend the intent system to support:

```text
family: evm
family: solana
family: sui
family: ton
family: tron
```

Each intent preserves the router, quote ID, source chain, destination chain, input asset, output asset, minimum received amount, expiry, provider status ID, and idempotency key.

The existing passkey, PIN, and session-unlock flow remains unchanged.

## Phase 10 — Add status tracking

Add provider-specific status handling for:

- LI.FI
- 0x
- Omniston
- Native chain transaction status

Display:

```text
Awaiting signature
Submitted
Source confirmed
Route executing
Destination confirmed
Completed
Failed
Refunded
```

Never mark a cross-chain swap complete when only the source transaction is confirmed.

## Phase 11 — Improve user-facing errors

Replace generic errors with actionable messages such as:

```text
TON router returned no quote.
TRON requires additional TRX for network fees.
This token is not supported on the selected chain.
The route expired; request a fresh quote.
The selected provider is temporarily unavailable.
```

Never show raw `undefined`, `null`, or provider object names.

## Phase 12 — Verify the Arbitrum USDC bridge

Keep the Intertrain bridge separate from the swap router.

Verify:

- Arbitrum USDC contract
- Bridge contract
- `paused()` status
- Bridge release approval
- Relayer availability
- Source confirmation count
- Destination WSK/USDC balance update

The bridge displays unavailable when paused or incompletely configured.

## Phase 13 — Security review

Add provider-specific validation for:

- Contract allowlists
- Token allowlists
- Chain ID checks
- Sender checks
- Amount and slippage checks
- Quote expiration checks
- Replay protection
- Idempotency handling
- Signed transaction integrity

Never trust router-provided destination contracts without validation.

## Phase 14 — Testing

Add tests for:

- Chain-specific token filtering
- Router selection
- Unsupported route rejection
- 0x TRON transaction construction
- Solana ↔ TRON intent creation
- TON message validation
- Jetton payload validation
- Quote expiry
- Slippage enforcement
- Provider timeout handling
- Duplicate submissions
- Status transitions
- Bridge pause behavior

Run the following in both frontend and backend repositories:

```bash
npm test
npm run typecheck
npm run build
```

## Phase 15 — Rollout

Release behind provider-specific feature flags:

```env
ENABLE_ZEROEX_TRON_SWAPS=false
ENABLE_OMNISTON_TON_SWAPS=false
```

Enable progressively:

1. TON same-chain swaps
2. TRON same-chain swaps
3. Solana ↔ TRON
4. TRON ↔ EVM
5. Additional TON routes only after executable support is verified

The user keeps one familiar swap page. The backend chooses the correct router and signing format automatically.
