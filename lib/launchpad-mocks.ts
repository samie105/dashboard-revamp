/**
 * Local-only launchpad mock gate.
 *
 * When on, the launchpad reads invented launches and market data from
 * lib/launchpad-market/mock.ts instead of the backend. DOUBLE-GATED like the
 * fiat and admin mocks: only `next dev` with the opt-in set, so a production
 * build can never show invented tokens or prices.
 */
export const LAUNCHPAD_MOCKS_ENABLED: boolean =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LAUNCHPAD_MOCKS === "true"
