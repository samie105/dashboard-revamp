"use client"

/**
 * Modern Solana spot — the token-denominated companion to the USD ticket.
 *
 * The mints come from the selected registry row (spec §8): this panel holds no
 * catalogue of its own and derives NOTHING itself. Venue, quote, mints,
 * orientation, precision and the base-unit conversion all come from
 * `spot-order.ts`, the same path the USD ticket takes — one refuse-don't-guess
 * gate, so a misoriented row cannot spend the wrong token's scale here either.
 */

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cryptoBackendClient, cryptoQueryKeys } from "@/lib/crypto-backend"
import type { CryptoWalletDetails, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { buildSolanaSwapPlanFromTokenAmount, solanaSwapProblem, type ModernSpotMarketRow } from "@/lib/crypto-backend/spot-order"
import { signSolanaIntent } from "@/lib/crypto-wallet"

/** The registry row itself — the panel reads it, it never rebuilds it. */
export type JupiterMarket = ModernSpotMarketRow

export function ModernJupiterPanel({
  userId,
  wallet,
  packageValue,
  market,
}: {
  userId: string
  wallet: CryptoWalletDetails
  packageValue: CryptoWalletPackageDocument
  market: JupiterMarket
}) {
  const account = wallet.accounts.find((a) => a.chainFamily === "solana" && a.state === "active")
  const [side, setSide] = React.useState<"buy" | "sell">("buy")
  const [amount, setAmount] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [intentId, setIntentId] = React.useState<string | null>(null)
  const queryClient = useQueryClient()

  // Spec §8: the swap is done when the backend says `confirmed`, not when the
  // submit call returns — the same poll the transfer flow runs.
  const intentQuery = useQuery({
    queryKey: cryptoQueryKeys.intent(userId, intentId ?? "none"),
    queryFn: ({ signal }) => cryptoBackendClient.getIntent(intentId as string, signal),
    enabled: Boolean(intentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "confirmed" || status === "failed" || status === "expired" ? false : 5_000
    },
  })
  const intentStatus = intentId ? intentQuery.data?.status : undefined

  // The balance snapshot has `staleTime: Infinity` (spec §5's explicit-
  // invalidation list) — a confirmed swap has to say so itself or the wallet
  // page shows pre-trade balances forever. Guarded on the created→confirmed
  // TRANSITION (a ref, not the poll tick) so a swap that reopens this intent
  // id on a later confirmed read never re-fires it.
  const invalidatedFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (intentStatus !== "confirmed" || !intentId || invalidatedFor.current === intentId) return
    invalidatedFor.current = intentId
    void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
    void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
  }, [intentStatus, intentId, queryClient, userId])

  const base = market.symbol.toUpperCase()
  const quote = (market.quote ?? "USDC").toUpperCase()
  const spentSymbol = side === "buy" ? quote : base
  // The row is judged before an amount is typed, by the same gate the ticket
  // uses — so an unroutable or misoriented pair disables the field outright.
  const rowProblem = React.useMemo(() => solanaSwapProblem(market, side), [market, side])

  async function submit() {
    setBusy(true)
    setMessage(null)
    setIntentId(null)
    try {
      if (!account?.id) throw new Error("Modern Solana wallet is not ready")
      const plan = buildSolanaSwapPlanFromTokenAmount(market, side, amount)
      if (plan.kind !== "solana") throw new Error(plan.kind === "unavailable" ? plan.reason : "This pair can't be swapped here.")

      const intent = await cryptoBackendClient.createModernSolanaSpotIntent(plan.input)
      const signed = await signSolanaIntent(userId, wallet.id, packageValue, intent, account.id)
      await cryptoBackendClient.submitIntent(intent.id, signed)
      setIntentId(intent.id)
      // Spec §8: a submitted swap is not a fill.
      setMessage("Jupiter swap submitted. It isn't a fill until the backend confirms it on-chain.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Jupiter swap failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">
          {base}/{quote} · token amount
        </h3>
        <span className="text-[11px] text-muted-foreground">Jupiter</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1">
        {(["buy", "sell"] as const).map((v) => (
          <button
            key={v}
            // The field's unit flips with the side (spend quote vs spend base),
            // so the typed figure cannot carry across.
            onClick={() => { setSide(v); setAmount("") }}
            className={`rounded-md py-2 text-xs font-semibold ${side === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {v === "buy" ? `Buy ${base}` : `Sell ${base}`}
          </button>
        ))}
      </div>
      <label className="block text-xs">
        {spentSymbol} amount
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={Boolean(rowProblem)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-sunken p-2.5 disabled:opacity-50"
          inputMode="decimal"
          placeholder="0.00"
          aria-label={`${spentSymbol} amount to swap`}
        />
      </label>
      {rowProblem && (
        <p role="alert" className="mt-2 rounded-lg bg-warning-chip px-2.5 py-1.5 text-[11px] leading-relaxed text-warning">
          {rowProblem}
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {message}
        </p>
      )}
      {intentId && (
        <p role="status" aria-live="polite" className="mt-1 text-[11px] text-subtle">
          {intentStatus === "confirmed"
            ? `Confirmed on-chain. Your ${base} balance updates shortly.`
            : intentStatus === "failed"
            ? "The swap didn't go through — nothing left your wallet beyond network fees."
            : intentStatus === "expired"
            ? "The swap expired before it confirmed. Nothing was swapped."
            : "Waiting for on-chain confirmation…"}
        </p>
      )}
      <button
        disabled={busy || Boolean(rowProblem)}
        onClick={submit}
        className="mt-3 w-full rounded-full bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Preparing and signing…" : rowProblem ? "Pair unavailable" : "Review Jupiter swap"}
      </button>
    </div>
  )
}
