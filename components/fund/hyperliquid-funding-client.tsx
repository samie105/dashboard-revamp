"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { signEvmIntent, signHyperliquidIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { useAuth } from "@/components/auth-provider"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { FlowShell, AmountField, DetailPanel, InlineNotice, FlowCta } from "@/components/ui/flow"
import { PageHeader } from "@/components/ui/system"
import { clearPendingFlow, readPendingFlow, savePendingFlow } from "@/lib/pending-flow"
import type { CryptoTransactionIntent } from "@/lib/crypto-backend"

type Mode = "fund" | "withdraw"

/** Mainnet Hyperliquid funding. Every money-moving action is an intent built
 * by the backend and signed by the modern wallet in this browser. */
export function HyperliquidFundingClient({ mode, variant = "page", onDismiss, onInFlightChange, onCompactChange }: {
  mode: Mode
  variant?: "page" | "modal"
  onDismiss?: () => void
  onInFlightChange?: (inFlight: boolean) => void
  onCompactChange?: (compact: boolean) => void
}) {
  const isDeposit = mode === "fund"
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const queryClient = useQueryClient()
  const [amount, setAmount] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const resume = React.useRef<(() => void) | null>(null)
  const [depositStage, setDepositStage] = React.useState<0 | 1 | 2>(0)
  const [pendingDeposit, setPendingDeposit] = React.useState<CryptoTransactionIntent[] | null>(null)
  const [withdrawalIntentId, setWithdrawalIntentId] = React.useState<string | null>(null)

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })
  const accountQuery = useQuery({
    queryKey: ["crypto", "hyperliquid", "account", user?.userId ?? "anonymous"],
    queryFn: () => cryptoBackendClient.getHyperliquidAccount(),
    enabled: isCryptoBackendEnabled && Boolean(user?.userId),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
  const withdrawalQuery = useQuery({
    queryKey: ["crypto", "hyperliquid", "intent", user?.userId ?? "anonymous", withdrawalIntentId ?? "none"],
    queryFn: ({ signal }) => cryptoBackendClient.getHyperliquidIntent(withdrawalIntentId as string, signal),
    enabled: !isDeposit && Boolean(withdrawalIntentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "failed" || status === "expired" ? false : 5_000
    },
  })

  const evmAccount = wallet.data?.accounts.find(
    (account) => account.chainFamily === "evm" && account.state === "active"
  )
  const destination = evmAccount?.canonicalAddress
  const amountValue = Number(amount)
  const validAmount = Number.isFinite(amountValue) && amountValue > 0
  const balance = accountQuery.data?.balances?.perpsWithdrawableUsdc ?? 0
  const blocker = !isCryptoBackendEnabled
    ? "Wallet service is unavailable"
    : !wallet.data
      ? "Set up your wallet first"
      : !evmAccount
        ? "Your wallet isn’t ready for this yet"
        : !packageQuery.data
          ? "Getting your wallet ready…"
        : !isDeposit && accountQuery.isLoading
          ? "Loading your Futures balance"
        : !isDeposit && accountQuery.isError
          ? "Futures balance is temporarily unavailable"
        : !validAmount
          ? "Enter an amount"
          : isDeposit && amountValue < 5
            ? "Minimum deposit is 5 USDC"
            : !isDeposit && amountValue > balance
              ? `Only $${balance.toFixed(2)} is withdrawable from Futures`
              : null

  React.useEffect(() => onInFlightChange?.(busy), [busy, onInFlightChange])
  /* COMPACT. This is one column — a heading, an amount, three rows and a
     button. Reporting `false` asked the money-flow modal for the width it
     keeps for the two-pane trading terminal (md:max-w-2xl), so a narrow form
     was stretched across 42rem with its labels at one edge and its values at
     the other. */
  React.useEffect(() => onCompactChange?.(true), [onCompactChange])

  React.useEffect(() => {
    if (!isDeposit) return
    const pending = readPendingFlow("hyperliquid-deposit")
    if (!pending) return
    try {
      const parsed = JSON.parse(pending.reference) as { intents?: CryptoTransactionIntent[]; stage?: 0 | 1 | 2; amount?: number }
      if (Array.isArray(parsed.intents) && parsed.intents.length === 2) {
        setPendingDeposit(parsed.intents)
        setDepositStage(parsed.stage ?? 0)
        if (typeof parsed.amount === "number") setAmount(String(parsed.amount))
        setMessage("You have a transfer already started. Resume it to finish the last step.")
      }
    } catch {
      clearPendingFlow("hyperliquid-deposit")
    }
  }, [isDeposit])

  React.useEffect(() => {
    if (isDeposit) return
    const pending = readPendingFlow("hyperliquid-withdrawal")
    if (!pending) return
    try {
      const parsed = JSON.parse(pending.reference) as { intentId?: string; amount?: number }
      if (parsed.intentId) {
        setWithdrawalIntentId(parsed.intentId)
        if (typeof parsed.amount === "number") setAmount(String(parsed.amount))
        setSuccess("Your transfer was sent. We’re checking for it to settle.")
      }
    } catch {
      clearPendingFlow("hyperliquid-withdrawal")
    }
  }, [isDeposit])

  async function submit() {
    if (blocker || busy || !user?.userId || !wallet.data?.id || !packageQuery.data || !evmAccount) return
    if (!getUnlockedWalletState(user.userId, wallet.data.id)) {
      resume.current = () => void submit()
      setUnlockOpen(true)
      return
    }
    setBusy(true)
    setMessage(null)
    setSuccess(null)
    try {
      if (isDeposit) {
        const prepared = pendingDeposit ?? (await cryptoBackendClient.createHyperliquidDepositIntents({
          amount: Math.round(amountValue * 1_000_000) / 1_000_000,
          idempotencyKey: crypto.randomUUID(),
        })).intents
        if (prepared.length !== 2) throw new Error("We couldn’t prepare that transfer. Nothing has moved — try again.")
        const start = pendingDeposit ? depositStage : 0
        setPendingDeposit(prepared)
        for (let index = start; index < prepared.length; index++) {
          const intent = prepared[index]
          setDepositStage(index as 0 | 1 | 2)
          savePendingFlow("hyperliquid-deposit", JSON.stringify({ intents: prepared, amount: amountValue, stage: index }), Date.now())
          const signed = await signEvmIntent(user.userId, wallet.data.id, packageQuery.data, intent, evmAccount.id)
          await cryptoBackendClient.submitIntent(intent.id, signed)
          setDepositStage((index + 1) as 0 | 1 | 2)
          savePendingFlow("hyperliquid-deposit", JSON.stringify({ intents: prepared, amount: amountValue, stage: index + 1 }), Date.now())
        }
        clearPendingFlow("hyperliquid-deposit")
        setPendingDeposit(null)
        setDepositStage(0)
        setSuccess(`${amountValue.toLocaleString()} USDC is on its way to your Futures account. It may take a moment to arrive.`)
      } else {
        const intent = await cryptoBackendClient.createHyperliquidIntent({
          type: "withdraw3",
          amount: amountValue,
          destination,
          idempotencyKey: crypto.randomUUID(),
        })
        const signatures = await signHyperliquidIntent(user.userId, wallet.data.id, packageQuery.data, evmAccount.id, intent.steps)
        await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
        setWithdrawalIntentId(intent.id)
        savePendingFlow("hyperliquid-withdrawal", JSON.stringify({ intentId: intent.id, amount: amountValue }))
        setSuccess(`${amountValue.toLocaleString()} USDC is on its way to your wallet (${destination?.slice(0, 6)}…${destination?.slice(-4)}). Waiting for it to settle.`)
      }
      setAmount("")
      await queryClient.invalidateQueries({ queryKey: ["crypto", "hyperliquid", "account", user.userId] })
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(user.userId) })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That transfer couldn’t be sent. Nothing has moved.")
    } finally {
      setBusy(false)
    }
  }

  /* WHERE THE MONEY GOES, in the two words the user thinks in. The rows used
     to read "Arbitrum → Hyperliquid", a wallet in hex and "Futures account",
     which names the rails rather than the accounts: someone moving money into
     their own futures balance was being shown a venue they never chose and an
     address they never typed. From and To answer the only question the screen
     raises. The address stays as its own row, quieter, because it IS worth
     being able to check — it just isn't the headline. */
  const shortAddress = destination ? `${destination.slice(0, 6)}…${destination.slice(-4)}` : null
  const content = (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {isDeposit
          ? "Move USDC out of your wallet and into your Futures account, ready to trade with."
          : "Move USDC out of your Futures account and back into your wallet."}
      </p>
      <AmountField value={amount} onChange={setAmount} unit="USDC" disabled={busy || Boolean(pendingDeposit)} hint={isDeposit ? "Minimum deposit: $5" : `Withdrawable: $${balance.toFixed(2)}`} />
      <DetailPanel rows={[
        { label: "From", value: isDeposit ? "Your wallet" : "Futures account" },
        { label: "To", value: isDeposit ? "Futures account" : "Your wallet" },
        ...(shortAddress ? [{ label: "Wallet address", value: shortAddress }] : []),
      ]} />
      {isDeposit && (busy || pendingDeposit) && !success && (
        <div className="rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          {depositStage === 0 ? "Getting your wallet ready…" : depositStage === 1 ? "Approved. Sending your USDC…" : "Sent. Waiting for it to land in Futures."}
        </div>
      )}
      {message && <InlineNotice tone="error">{message}</InlineNotice>}
      {!isDeposit && withdrawalIntentId && withdrawalQuery.data?.status === "failed" && <InlineNotice tone="error">That withdrawal didn’t go through. Nothing left your Futures account.</InlineNotice>}
      {!isDeposit && withdrawalIntentId && withdrawalQuery.data?.status === "submitted" && <div className="rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] text-muted-foreground">On its way. Your wallet balance updates once it settles.</div>}
      {!isDeposit && accountQuery.isError && <InlineNotice tone="warning">We can’t check your Futures balance right now. Nothing will be sent until we can.</InlineNotice>}
      {success && <InlineNotice className="bg-credit-chip text-credit">{success}</InlineNotice>}
      <FlowCta label={busy ? "Sending…" : blocker ?? (pendingDeposit ? "Resume transfer" : isDeposit ? "Add to Futures" : "Move to wallet")} onClick={() => void submit()} disabled={Boolean(blocker) || busy} busy={busy} />
    </div>
  )

  return (
    <>
      {/* The modal variant gets the same column padding BuySellClient and
          FundClient use for their modal bodies. Without it this panel ran
          flush to the popup's edges while its siblings sat inset, which is
          what made one modal look like two different designs. */}
      {variant === "modal" ? (
        <div className="flex flex-1 flex-col p-4 sm:p-5">{content}</div>
      ) : (
        <FlowShell><PageHeader title={isDeposit ? "Add to Futures" : "Move to wallet"} subtitle={isDeposit ? "From your Worldstreet wallet" : "Back into your Worldstreet wallet"} back="/" className="mb-5" />{content}</FlowShell>
      )}
      <WalletUnlockDialog action="hyperliquid-deposit" open={unlockOpen} onOpenChange={setUnlockOpen} onUnlocked={() => { const action = resume.current; resume.current = null; action?.() }} />
      {onDismiss && success && <button type="button" onClick={onDismiss} className="sr-only">Done</button>}
    </>
  )
}
