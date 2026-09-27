/**
 * Local-only fiat mock gate (CP1 of the fiat ramp port).
 *
 * When on, requests to `/api/crypto/fiat/*` are answered from the verbatim
 * guide fixtures in `lib/crypto-backend/__fixtures__/fiat.ts` instead of
 * being forwarded to the crypto backend. Independent of DEV_AUTH_BYPASS —
 * a developer can run against real Clerk and still mock the fiat surface.
 *
 * DOUBLE-GATED: this can only ever be true in `next dev`, never in a
 * production build. Same shape as DEV_AUTH_BYPASS (see lib/dev-auth-bypass.ts)
 * so `next build` cannot ship a mock-serving artifact even if the env var
 * leaks into the deployed environment.
 */
export const FIAT_MOCKS_ENABLED: boolean =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_FIAT_MOCKS === "true"
