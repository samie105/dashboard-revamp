"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { adminData } from "@/lib/admin/source"
import { AdminDataError, type AdminPeriod } from "@/lib/admin/types"

export const adminQueryKeys = {
  overview: (period: AdminPeriod) => ["admin", "overview", period] as const,
  wallets: (period: AdminPeriod) => ["admin", "wallets", period] as const,
}

/** A refusal or "not connected" won't change on retry; anything else gets two more tries. */
export function shouldRetryAdmin(failureCount: number, error: unknown): boolean {
  if (error instanceof AdminDataError && error.kind !== "failed") return false
  return failureCount < 2
}

const COMMON = {
  retry: shouldRetryAdmin,
  staleTime: 60_000,
  // Switching period keeps the last figures on screen (dimmed) instead of
  // dropping back to skeletons.
  placeholderData: keepPreviousData,
} as const

export function useAdminOverview(period: AdminPeriod) {
  return useQuery({ queryKey: adminQueryKeys.overview(period), queryFn: ({ signal }) => adminData.getOverview(period, { signal }), ...COMMON })
}

export function useAdminWallets(period: AdminPeriod) {
  return useQuery({ queryKey: adminQueryKeys.wallets(period), queryFn: ({ signal }) => adminData.getWallets(period, { signal }), ...COMMON })
}
