"use client"

/**
 * Modern Solana spot — the token-denominated companion to the USD ticket.
 *
 * The mints come from the selected registry row (spec §8): this panel holds no
 * catalogue of its own, and it refuses any token whose decimals the shared
 * table doesn't know rather than guessing a scale (`spot-order.ts`).
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { cryptoBackendClient, cryptoQueryKeys } from "@/lib/crypto-backend"
import type { CryptoWalletDetails, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { SLIPPAGE_BPS, tokenDecimalsFor } from "@/lib/crypto-backend/spot-order"
import { signSolanaIntent } from "@/lib/crypto-wallet"
import { toBaseUnits } from "@/lib/crypto-wallet/address-validation"

const SOLANA_NETWORK_ID = "solana-mainnet-beta"

export type JupiterMarket = {
  /** Base asset symbol, e.g. SOL. */
  symbol: string
  /** Quote asset symbol, e.g. USDC. */
  quote?: string
  /** The registry's network id — the decimals table is keyed by it. */
  networkId?: string
  /** The mint spent on a buy (the quote). */
  inputMint?: string
  /** The mint received on a buy (the base). */
  outputMint?: string
}

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

  const base = market.symbol.toUpperCase()
  const quote = (market.quote ?? "USDC").toUpperCase()
  const spentSymbol = side === "buy" ? quote : base

  async function submit() {
    setBusy(true)
    setMessage(null)
    setIntentId(null)
    try {
      if (!account?.id) throw new Error("Modern Solana wallet is not ready")
      if (!market.inputMint || !market.outputMint) {
        throw new Error(`The market registry didn't include the token mints for ${base}, so we can't build the swap.`)
      }
      // Buy spends the quote mint for the base; sell reverses it.
      const inputMint = side === "buy" ? market.inputMint : market.outputMint
      const outputMint = side === "buy" ? market.outputMint : market.inputMint
      const decimals = tokenDecimalsFor(market.networkId ?? SOLANA_NETWORK_ID, inputMint)
      if (decimals === undefined) {
        throw new Error(`We don't know ${spentSymbol}'s token precision yet, and we won't guess it — a wrong guess would send the wrong amount.`)
      }
      // The typed figure is already in whole tokens: convert it exactly, never
      // through a float multiply.
      const amountBaseUnits = toBaseUnits(amount.trim(), decimals)
      if (amountBaseUnits === null) throw new Error(`Enter a ${spentSymbol} amount with at most ${decimals} decimal places`)
      if (amountBaseUnits === "0") throw new Error(`Enter a ${spentSymbol} amount above zero`)

      const intent = await cryptoBackendClient.createModernSolanaSpotIntent({
        inputMint,
        outputMint,
        amountBaseUnits,
        slippageBps: SLIPPAGE_BPS,
        idempotencyKey: crypto.randomUUID(),
      })
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
            onClick={() => setSide(v)}
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
          className="mt-1 w-full rounded-lg border border-border bg-surface-sunken p-2.5"
          inputMode="decimal"
          placeholder="0.00"
          aria-label={`${spentSymbol} amount to swap`}
        />
      </label>
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
        disabled={busy}
        onClick={submit}
        className="mt-3 w-full rounded-full bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Preparing and signing…" : "Review Jupiter swap"}
      </button>
    </div>
  )
}
