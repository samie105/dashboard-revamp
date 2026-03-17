"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type {
  UnifiedTransaction,
  TransactionStats,
  TransactionFilters,
} from "@/types/transactions"

interface UseUnifiedTransactionsOptions {
  pollInterval?: number
}

interface UseUnifiedTransactionsReturn {
  transactions: UnifiedTransaction[]
  stats: TransactionStats | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  filters: TransactionFilters
  setFilters: (filters: Partial<TransactionFilters>) => void
  loadMore: () => void
  refresh: () => void
  sentinelRef: (node: HTMLElement | null) => void
}

const DEFAULT_STATS: TransactionStats = {
  totalDeposits: 0,
  totalWithdrawals: 0,
  totalTrades: 0,
  totalSwaps: 0,
  totalTransfers: 0,
  depositVolume: 0,
  withdrawalVolume: 0,
  netVolume: 0,
}

export function useUnifiedTransactions(
  options: UseUnifiedTransactionsOptions = {},
): UseUnifiedTransactionsReturn {
  const { pollInterval = 30000 } = options

  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([])
  const [stats, setStats] = useState<TransactionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>()

  const [filters, setFiltersState] = useState<TransactionFilters>({ limit: 30 })
  const observerRef = useRef<IntersectionObserver | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams()
      if (filters.type) params.set("type", filters.type)
      if (filters.status) params.set("status", filters.status)
      if (filters.search) params.set("search", filters.search)
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.set("dateTo", filters.dateTo)
      if (cursor) params.set("cursor", cursor)
      params.set("limit", String(filters.limit || 30))
      return `/api/transactions/unified?${params.toString()}`
    },
    [filters],
  )

  const fetchTransactions = useCallback(
    async (append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true)
        } else {
          setIsLoading(true)
        }
        setError(null)

        const url = buildUrl(append ? nextCursor : undefined)
        const res = await fetch(url)
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.message || "Failed to fetch transactions")
        }

        if (append) {
          setTransactions((prev) => [...prev, ...data.transactions])
        } else {
          setTransactions(data.transactions)
        }

        setStats(data.stats || DEFAULT_STATS)
        setHasMore(data.pagination?.hasMore ?? false)
        setNextCursor(data.pagination?.nextCursor)
      } catch (err) {
        console.error("Fetch transactions error:", err)
        setError(err instanceof Error ? err.message : "Failed to load transactions")
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [buildUrl, nextCursor],
  )

  useEffect(() => {
    setNextCursor(undefined)
    fetchTransactions(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.status, filters.search, filters.dateFrom, filters.dateTo])

  useEffect(() => {
    if (pollInterval <= 0) return

    pollRef.current = setInterval(() => {
      fetchTransactions(false)
    }, pollInterval)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollInterval, filters])

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchTransactions(true)
    }
  }, [isLoadingMore, hasMore, nextCursor, fetchTransactions])

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) observerRef.current.disconnect()
      if (!node) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
            loadMore()
          }
        },
        { rootMargin: "200px" },
      )
      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, loadMore],
  )

  const setFilters = useCallback((partial: Partial<TransactionFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  const refresh = useCallback(() => {
    setNextCursor(undefined)
    fetchTransactions(false)
  }, [fetchTransactions])

  return {
    transactions,
    stats,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    filters,
    setFilters,
    loadMore,
    refresh,
    sentinelRef,
  }
}
