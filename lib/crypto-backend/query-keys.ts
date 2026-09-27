import type { TransactionFilters } from "@/types/transactions"

export const cryptoQueryKeys = {
  all: ["crypto"] as const,
  health: () => [...cryptoQueryKeys.all, "health"] as const,
  wallet: (userId: string) =>
    [...cryptoQueryKeys.all, "wallet", userId] as const,
  walletPackage: (userId: string) =>
    [...cryptoQueryKeys.all, "wallet-package", userId] as const,
  networks: () => [...cryptoQueryKeys.all, "networks"] as const,
  fiatConfig: () => [...cryptoQueryKeys.all, "fiat-config"] as const,
  balances: (userId: string) =>
    [...cryptoQueryKeys.all, "balances", userId] as const,
  balanceSnapshot: (userId: string) =>
    [...cryptoQueryKeys.all, "balance-snapshot", userId] as const,
  balance: (userId: string, accountId: string, networkId: string) =>
    [...cryptoQueryKeys.all, "balance", userId, accountId, networkId] as const,
  recovery: (userId: string) =>
    [...cryptoQueryKeys.all, "recovery", userId] as const,
  devices: (userId: string) =>
    [...cryptoQueryKeys.all, "devices", userId] as const,
  transactions: (userId: string, filters: TransactionFilters) =>
    [
      ...cryptoQueryKeys.all,
      "transactions",
      userId,
      filters.type ?? "all",
      filters.status ?? "all",
      filters.search ?? "",
      filters.dateFrom ?? "",
      filters.dateTo ?? "",
      filters.limit ?? 30,
    ] as const,
  intent: (userId: string, intentId: string) =>
    [...cryptoQueryKeys.all, "intent", userId, intentId] as const,
  transaction: (userId: string, transactionId: string) =>
    [...cryptoQueryKeys.all, "transaction", userId, transactionId] as const,
  fiatCompliance: (userId: string) =>
    [...cryptoQueryKeys.all, "fiat-compliance", userId] as const,
  fiatInstitutions: (
    userId: string,
    query: { country: string; currency: string; channel: string },
  ) =>
    [
      ...cryptoQueryKeys.all,
      "fiat-institutions",
      userId,
      query.country,
      query.currency,
      query.channel,
    ] as const,
  fiatBeneficiaries: (userId: string) =>
    [...cryptoQueryKeys.all, "fiat-beneficiaries", userId] as const,
  fiatQuote: (userId: string, quoteId: string) =>
    [...cryptoQueryKeys.all, "fiat-quote", userId, quoteId] as const,
  fiatOrders: (userId: string, limit: number) =>
    [...cryptoQueryKeys.all, "fiat-orders", userId, limit] as const,
  fiatOrder: (userId: string, orderId: string) =>
    [...cryptoQueryKeys.all, "fiat-order", userId, orderId] as const,
  fiatVirtualAccounts: (userId: string) =>
    [...cryptoQueryKeys.all, "fiat-virtual-accounts", userId] as const,
  fiatVirtualAccount: (userId: string, accountId: string) =>
    [...cryptoQueryKeys.all, "fiat-virtual-account", userId, accountId] as const,
  fiatVirtualAccountActivity: (userId: string, accountId: string) =>
    [...cryptoQueryKeys.all, "fiat-virtual-account-activity", userId, accountId] as const,
}
