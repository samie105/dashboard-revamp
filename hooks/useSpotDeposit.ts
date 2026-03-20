import { useState, useCallback, useRef, useEffect } from "react"

export interface DepositInfo {
  id: string
  status: string
  treasuryAddress?: string
  treasuryChain?: string
  depositChain?: string
  depositToken?: string
  depositAmount?: number
  depositTxHash?: string
  disburseTxHash?: string
  bridgeTxHash?: string
  disbursedAmount?: number
  bridgedAmount?: number
  spotAmount?: number
  errorMessage?: string
  createdAt?: string
  updatedAt?: string
}

interface InitiateParams {
  depositChain: "ethereum" | "solana" | "tron"
  depositAmount: number
  depositFromAddress: string
  depositToken?: "USDT" | "USDC"
}

export function useSpotDeposit() {
  const [deposit, setDeposit] = useState<DepositInfo | null>(null)
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
    async (depositId: string) => {
      try {
        const res = await fetch(
          `/api/spot/deposit/status?depositId=${depositId}`,
        )
        const data = await res.json()

        if (data.deposit) {
          setDeposit(data.deposit)

          const terminal = ["completed", "failed", "expired"]
          if (terminal.includes(data.deposit.status)) {
            stopPolling()
          }
        }
      } catch {
        // Silently fail on poll errors — we'll retry next interval
      }
    },
    [stopPolling],
  )

  const startPolling = useCallback(
    (depositId: string) => {
      stopPolling()
      pollingRef.current = setInterval(() => pollStatus(depositId), 8000)
      pollStatus(depositId)
    },
    [pollStatus, stopPolling],
  )

  const sendUsdt = useCallback(async (depositId: string) => {
    try {
      setDeposit((prev) =>
        prev ? { ...prev, status: "sending_usdt" } : prev,
      )

      const res = await fetch("/api/spot/deposit/send-usdt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to send USDT")
      }

      setDeposit((prev) =>
        prev
          ? {
              ...prev,
              status: data.deposit.status,
              depositTxHash: data.txHash,
            }
          : prev,
      )
      return data
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to send USDT"
      setError(msg)
      setDeposit((prev) =>
        prev ? { ...prev, status: "failed", errorMessage: msg } : prev,
      )
      return null
    }
  }, [])

  const initiate = useCallback(
    async (params: InitiateParams) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/spot/deposit/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to initiate deposit")
        }

        setDeposit(data.deposit)

        const sendResult = await sendUsdt(data.deposit.id)

        startPolling(data.deposit.id)

        return sendResult ? data.deposit : null
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to initiate deposit"
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [startPolling, sendUsdt],
  )

  const resumePolling = useCallback(async () => {
    try {
      const res = await fetch("/api/spot/deposit/status")
      const data = await res.json()
      if (data.deposit) {
        setDeposit(data.deposit)
        const terminal = ["completed", "failed", "expired"]
        if (!terminal.includes(data.deposit.status)) {
          startPolling(data.deposit.id)
        }
      }
    } catch {
      // No active deposit or error
    }
  }, [startPolling])

  const reset = useCallback(() => {
    stopPolling()
    setDeposit(null)
    setError(null)
  }, [stopPolling])

  const cancel = useCallback(async () => {
    if (!deposit?.id) return
    stopPolling()
    try {
      await fetch("/api/spot/deposit/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositId: deposit.id }),
      })
    } catch {
      // Even if server call fails, clear local state
    }
    setDeposit(null)
    setError(null)
  }, [deposit?.id, stopPolling])

  return {
    deposit,
    loading,
    error,
    initiate,
    resumePolling,
    reset,
    cancel,
    stopPolling,
  }
}
