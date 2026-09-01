import type { TransactionFilters } from "@/types/transactions"

export const cryptoQueryKeys = {
  all: ["crypto"] as const,
  health: () => [...cryptoQueryKeys.all, "health"] as const,
  wallet: (userId: string) => [...cryptoQueryKeys.all, "wallet", userId] as const,
  walletPackage: (userId: string) => [...cryptoQueryKeys.all, "wallet-package", userId] as const,
  networks: () => [...cryptoQueryKeys.all, "networks"] as const,
  balances: (userId: string) => [...cryptoQueryKeys.all, "balances", userId] as const,
  balanceSnapshot: (userId: string) => [...cryptoQueryKeys.all, "balance-snapshot", userId] as const,
  balance: (userId: string, accountId: string, networkId: string) => [
    ...cryptoQueryKeys.all,
    "balance",
    userId,
    accountId,
    networkId,
  ] as const,
  recovery: (userId: string) => [...cryptoQueryKeys.all, "recovery", userId] as const,
  devices: (userId: string) => [...cryptoQueryKeys.all, "devices", userId] as const,
  transactions: (userId: string, filters: TransactionFilters) => [
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
  intent: (userId: string, intentId: string) => [...cryptoQueryKeys.all, "intent", userId, intentId] as const,
  transaction: (userId: string, transactionId: string) => [
    ...cryptoQueryKeys.all,
    "transaction",
    userId,
    transactionId,
  ] as const,
}
