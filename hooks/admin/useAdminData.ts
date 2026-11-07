"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { adminData } from "@/lib/admin/source"
import { AdminDataError, type AdminAuditQuery, type AdminControlUpdate, type AdminInviteInput, type AdminMemberUpdate, type AdminPeriod, type AdminTransactionsQuery, type AdminUsersQuery } from "@/lib/admin/types"

export const adminQueryKeys = {
  overview: (period: AdminPeriod) => ["admin", "overview", period] as const,
  users: (period: AdminPeriod, query: AdminUsersQuery) => ["admin", "users", period, query.search ?? "", query.page ?? 1, query.pageSize ?? 20, query.sort ?? "joined"] as const,
  wallets: (period: AdminPeriod) => ["admin", "wallets", period] as const,
  volume: (period: AdminPeriod) => ["admin", "volume", period] as const,
  fiat: (period: AdminPeriod) => ["admin", "fiat", period] as const,
  transactions: (query: AdminTransactionsQuery) => ["admin", "transactions", query.period ?? "30d", query.status ?? "all", query.page ?? 1, query.pageSize ?? 50] as const,
  audit: (query: AdminAuditQuery) => ["admin", "audit", query.action ?? "all", query.page ?? 1, query.pageSize ?? 25] as const,
  controls: () => ["admin", "controls"] as const,
  admins: () => ["admin", "admins"] as const,
}

/** A refusal or "not connected" won't change on retry; anything else gets two more tries. */
export function shouldRetryAdmin(failureCount: number, error: unknown): boolean {
  if (error instanceof AdminDataError && error.kind !== "failed") return false
  return failureCount < 2
}

const COMMON = {
  retry: shouldRetryAdmin,
  staleTime: 60_000,
  // Admins leave these open: refresh every 2 minutes and when the tab returns.
  refetchInterval: 120_000,
  refetchOnWindowFocus: true,
  // Switching period keeps the last figures on screen (dimmed) instead of
  // dropping back to skeletons.
  placeholderData: keepPreviousData,
} as const

export function useAdminOverview(period: AdminPeriod) {
  return useQuery({ queryKey: adminQueryKeys.overview(period), queryFn: ({ signal }) => adminData.getOverview(period, { signal }), ...COMMON })
}

export function useAdminUsers(period: AdminPeriod, query: AdminUsersQuery) {
  return useQuery({ queryKey: adminQueryKeys.users(period, query), queryFn: ({ signal }) => adminData.getUsers(period, query, { signal }), ...COMMON })
}

export function useAdminWallets(period: AdminPeriod) {
  return useQuery({ queryKey: adminQueryKeys.wallets(period), queryFn: ({ signal }) => adminData.getWallets(period, { signal }), ...COMMON })
}

export function useAdminVolume(period: AdminPeriod) {
  return useQuery({ queryKey: adminQueryKeys.volume(period), queryFn: ({ signal }) => adminData.getVolume(period, { signal }), ...COMMON })
}

export function useAdminFiat(period: AdminPeriod) {
  return useQuery({ queryKey: adminQueryKeys.fiat(period), queryFn: ({ signal }) => adminData.getFiat(period, { signal }), ...COMMON })
}

export function useAdminTransactions(query: AdminTransactionsQuery) {
  return useQuery({ queryKey: adminQueryKeys.transactions(query), queryFn: ({ signal }) => adminData.getTransactions(query, { signal }), ...COMMON })
}

export function useAdminAuditLog(query: AdminAuditQuery) {
  return useQuery({ queryKey: adminQueryKeys.audit(query), queryFn: ({ signal }) => adminData.getAuditLog(query, { signal }), ...COMMON })
}

export function useAdminControls() {
  return useQuery({ queryKey: adminQueryKeys.controls(), queryFn: ({ signal }) => adminData.getControls({ signal }), ...COMMON })
}

export function useUpdateAdminControl() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminControlUpdate) => adminData.updateControl(input, { idempotencyKey: crypto.randomUUID(), ifMatch: `"${input.expectedVersion}"` }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminQueryKeys.controls() }) },
  })
}

export function useReconcileAdminTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (transactionId: string) => adminData.reconcileTransaction(transactionId, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin", "transactions"] }) },
  })
}

export function useAdminMembers() {
  return useQuery({ queryKey: adminQueryKeys.admins(), queryFn: ({ signal }) => adminData.getAdminMembers({ signal }), ...COMMON })
}

export function useInviteAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminInviteInput) => adminData.inviteAdmin(input, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminQueryKeys.admins() }) },
  })
}

export function useUpdateAdminMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminMemberUpdate) => adminData.updateAdminMember(input, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminQueryKeys.admins() }) },
  })
}

export function useRevokeAdminMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (adminId: string) => adminData.revokeAdminMember(adminId, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminQueryKeys.admins() }) },
  })
}
