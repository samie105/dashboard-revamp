/**
 * Local-only transactions sample-data gate.
 *
 * When on, the transactions page's wallet history comes from
 * lib/transactions-mock.ts (invented ledger records, run through the real
 * mapping in hooks/use-unified-transactions.ts) instead of GET /transactions,
 * and the page is tagged "Demo". DOUBLE-GATED like the fiat, launchpad and
 * analytics mocks: only `next dev` with the opt-in set, so a production build
 * can never show invented transactions.
 */
export const TRANSACTIONS_MOCKS_ENABLED: boolean =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_TRANSACTIONS_MOCKS === "true"
