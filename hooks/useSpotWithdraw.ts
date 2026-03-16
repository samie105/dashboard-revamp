import { useState, useCallback } from "react"

export interface WithdrawResult {
  success: boolean
  amount?: number
  destination?: string
  error?: string
}

export function useSpotWithdraw() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WithdrawResult | null>(null)

  const withdraw = useCallback(async (amount: number) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/spot/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Withdrawal failed")
      }

      const outcome: WithdrawResult = {
        success: true,
        amount: data.amount,
        destination: data.destination,
      }
      setResult(outcome)
      return outcome
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Withdrawal failed"
      setError(msg)
      setResult({ success: false, error: msg })
      return { success: false, error: msg } as WithdrawResult
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])

  return { withdraw, loading, error, result, reset }
}
