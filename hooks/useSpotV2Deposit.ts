import { useState, useCallback, useRef, useEffect } from "react"

export interface SpotV2DepositInfo {
  id?: string
  adminDepositId: string
  treasuryAddress: string
  treasuryChain: string
  depositChain: string
  depositToken: string
  depositAmount: number
  status: string
  depositTxHash?: string
  credited?: boolean
  creditedAmount?: number
}

export type DepositPhase = "idle" | "initiating" | "sending" | "polling"

interface InitiateParams {
  depositChain: "ethereum" | "solana" | "tron"
  depositAmount: number
  depositFromAddress: string
  depositToken?: "USDT" | "USDC"
}

export function useSpotV2Deposit() {
  const [deposit, setDeposit] = useState<SpotV2DepositInfo | null>(null)
  const [phase, setPhase] = useState<DepositPhase>("idle")
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
            setPhase("idle")
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
      setPhase("polling")
      pollStatus(adminDepositId)
      pollingRef.current = setInterval(
        () => pollStatus(adminDepositId),
        8000,
      )
    },
    [pollStatus, stopPolling],
  )

  const send = useCallback(
    async (depositInfo: SpotV2DepositInfo): Promise<boolean> => {
      setPhase("sending")
      try {
        const res = await fetch("/api/spotv2/deposit/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            treasuryAddress: depositInfo.treasuryAddress,
            depositChain: depositInfo.depositChain,
            depositToken: depositInfo.depositToken,
            depositAmount: depositInfo.depositAmount,
            adminDepositId: depositInfo.adminDepositId,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to send funds")
        }

        setDeposit((prev) =>
          prev ? { ...prev, depositTxHash: data.txHash } : prev,
        )

        // Start polling for admin confirmation
        startPolling(depositInfo.adminDepositId)
        return true
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to send funds"
        setError(msg)
        setPhase("idle")
        return false
      }
    },
    [startPolling],
  )

  const initiate = useCallback(
    async (params: InitiateParams) => {
      setLoading(true)
      setError(null)
      setPhase("initiating")

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

        const depositInfo: SpotV2DepositInfo = data.deposit
        setDeposit(depositInfo)

        // Auto-send from user's wallet to treasury
        await send(depositInfo)

        return depositInfo
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to initiate deposit"
        setError(msg)
        setPhase("idle")
        return null
      } finally {
        setLoading(false)
      }
    },
    [send],
  )

  const reset = useCallback(() => {
    stopPolling()
    setDeposit(null)
    setError(null)
    setPhase("idle")
  }, [stopPolling])

  return { deposit, phase, loading, error, initiate, reset }
}
