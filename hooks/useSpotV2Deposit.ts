import { useState, useCallback, useRef, useEffect } from "react"

export interface SpotV2DepositInfo {
  adminDepositId: string
  treasuryAddress: string
  treasuryChain: string
  depositChain: string
  depositToken: string
  depositAmount: number
  status: string
  depositTxHash?: string
  disburseTxHash?: string
}

interface InitiateParams {
  depositChain: "ethereum" | "solana" | "tron"
  depositAmount: number
  depositFromAddress: string
  depositToken?: "USDT" | "USDC"
}

export function useSpotV2Deposit() {
  const [deposit, setDeposit] = useState<SpotV2DepositInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const pollStatus = useCallback(
    async (adminDepositId: string) => {
      try {
        const res = await fetch(
          `/api/spotv2/deposit/status?id=${encodeURIComponent(adminDepositId)}`,
        )
        const data = await res.json()

        if (data.success && data.deposit) {
          setDeposit((prev) =>
            prev ? { ...prev, ...data.deposit } : data.deposit,
          )

          const terminal = ["completed", "disbursed", "failed", "expired", "rejected"]
          if (terminal.includes(data.deposit.status)) {
            stopPolling()
          }
        }
      } catch {
        // Silently retry next interval
      }
    },
    [stopPolling],
  )

  const startPolling = useCallback(
    (adminDepositId: string) => {
      stopPolling()
      pollStatus(adminDepositId)
      pollingRef.current = setInterval(
        () => pollStatus(adminDepositId),
        8000,
      )
    },
    [pollStatus, stopPolling],
  )

  const initiate = useCallback(
    async (params: InitiateParams) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/spotv2/deposit/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to initiate deposit")
        }

        setDeposit(data.deposit)

        // Start polling for deposit completion
        if (data.deposit.adminDepositId) {
          startPolling(data.deposit.adminDepositId)
        }

        return data.deposit
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to initiate deposit"
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [startPolling],
  )

  const reset = useCallback(() => {
    stopPolling()
    setDeposit(null)
    setError(null)
  }, [stopPolling])

  return { deposit, loading, error, initiate, reset }
}
