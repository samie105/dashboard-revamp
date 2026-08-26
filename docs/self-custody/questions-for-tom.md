# Open questions for the crypto backend — 2026-08-26

1. **Clerk audience.** Plain Clerk session tokens carry no `aud` claim. Can
   `CLERK_JWT_AUDIENCE` be left unset with an `azp`-against-CORS-origins check
   instead (our preference), or do you want a JWT template with a fixed
   audience? (`.env.example` ships `CLERK_JWT_AUDIENCE=worldstreet`, and
   `verify:production-config` may enforce it — needs a decision either way.)
2. **Envelope spec ack.** `envelope-format-spec.md` in this folder — please
   confirm the three "open items" at the bottom so Phase 2 can build it.
3. **PRF-unavailable stance.** We propose refusing wallet creation without
   WebAuthn PRF (v1) rather than a weaker fallback. Agree?
4. **Swaps / trading.** Phase 6–8 docs say swaps are "not enabled yet" and
   there's no Hyperliquid surface. What's the sequencing for spot/futures and
   fiat buy/sell — do they stay on crypto-api.worldstreetgold.com
   indefinitely, or move here in phase 9–11?
5. **TON / TRON / SUI.** The new model is evm + solana only. Legacy users hold
   TON/TRON/SUI balances — do those stay on Privy forever, or is there a
   migration destination?
6. **Sponsored fees.** EVM clients supply their own gas; Solana payloads carry
   `feePayer`. Is sponsor-as-feePayer co-signing planned, or is the sponsored
   fees concept dead in the new architecture?
7. **`ENABLE_LEGACY_PRIVY_BRIDGE`.** Your `.env.example` points it at our
   `user-account/userwallets` collection. What does the bridge do today, and
   should the frontend's legacy-vs-new detection build on it rather than on
   probing `GET /v1/wallets/me` for 404?
8. **Mainnet timeline.** Both gates (`ENABLE_MAINNET`,
   `MAINNET_RELEASE_APPROVED`) are off. Rough timeline, so we can stage the
   "move your funds" messaging?
