import { useState, useCallback } from "react"

export interface SpotV2WithdrawResult {
  success: boolean
  id?: string
  amount?: number
  token?: string
  chain?: string
  destination?: string
  txHash?: string
  newBalance?: number
  error?: string
}

export function useSpotV2Withdraw() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpotV2WithdrawResult | null>(null)

  const withdraw = useCallback(
    async (amount: number, chain: string = "ethereum", token: string = "USDC") => {
      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const res = await fetch("/api/spotv2/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, chain, token }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Withdrawal failed")
        }

        const outcome: SpotV2WithdrawResult = {
          success: true,
          id: data.withdrawal.id,
          amount: data.withdrawal.amount,
          token: data.withdrawal.token,
          chain: data.withdrawal.chain,
          destination: data.withdrawal.destination,
          txHash: data.withdrawal.txHash,
          newBalance: data.withdrawal.newBalance,
        }
        setResult(outcome)
        return outcome
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Withdrawal failed"
        setError(msg)
        const outcome: SpotV2WithdrawResult = { success: false, error: msg }
        setResult(outcome)
        return outcome
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])

  return { withdraw, loading, error, result, reset }
}
