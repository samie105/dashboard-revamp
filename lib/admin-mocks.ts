/**
 * Local-only admin mock gate.
 *
 * When on, the admin dashboard reads invented figures from lib/admin/mock.ts
 * instead of a real backend.
 *
 * DOUBLE-GATED, the same shape as FIAT_MOCKS_ENABLED (lib/fiat-mocks.ts) and
 * DEV_AUTH_BYPASS: it can only be true in `next dev` with the opt-in set, so
 * `next build` can never ship mock figures even if the env var leaks into a
 * deployed environment. (Unlike the fiat gate, there is no test-host
 * exception.)
 */
export const ADMIN_MOCKS_ENABLED: boolean =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ADMIN_MOCKS === "true"
