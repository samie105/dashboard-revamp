/**
 * Local-only analytics sample-data gate.
 *
 * When on, /analytics draws invented wallet transactions, bank orders, fills,
 * positions and trigger orders from lib/analytics-mock.ts instead of the
 * backend, and says so on the page. DOUBLE-GATED like the fiat, admin and
 * launchpad mocks: only `next dev` with the opt-in set, so a production build
 * can never show invented figures.
 */
export const ANALYTICS_MOCKS_ENABLED: boolean =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ANALYTICS_MOCKS === "true"
