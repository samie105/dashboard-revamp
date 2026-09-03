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
    ? "Modern wallet backend is not enabled"
    : !wallet.data
      ? "Create your modern wallet first"
      : !evmAccount
        ? "Your modern wallet has no active EVM account"
        : !packageQuery.data
          ? "Preparing your modern wallet"
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
  React.useEffect(() => onCompactChange?.(false), [onCompactChange])

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
        setMessage("A Hyperliquid deposit is already prepared. Resume it to finish the remaining step.")
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
        setSuccess("Your Hyperliquid withdrawal was submitted. We are checking for settlement.")
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
        if (prepared.length !== 2) throw new Error("The backend returned an incomplete Hyperliquid deposit")
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
        setSuccess(`${amountValue.toLocaleString()} USDC deposit submitted to Hyperliquid. It may take a moment to arrive.`)
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
        setSuccess(`${amountValue.toLocaleString()} USDC withdrawal submitted to ${destination?.slice(0, 6)}…${destination?.slice(-4)}. Waiting for settlement.`)
      }
      setAmount("")
      await queryClient.invalidateQueries({ queryKey: ["crypto", "hyperliquid", "account", user.userId] })
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(user.userId) })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Hyperliquid transfer could not be submitted.")
    } finally {
      setBusy(false)
    }
  }

  const content = (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        {isDeposit
          ? "Deposit USDC from your modern wallet on Arbitrum into your Hyperliquid Futures account."
          : "Withdraw available USDC from Hyperliquid Futures to your modern wallet on Arbitrum."}
      </div>
      <AmountField value={amount} onChange={setAmount} unit="USDC" disabled={busy || Boolean(pendingDeposit)} hint={isDeposit ? "Minimum deposit: $5" : `Withdrawable: $${balance.toFixed(2)}`} />
      <DetailPanel rows={[
        { label: "Network", value: isDeposit ? "Arbitrum → Hyperliquid" : "Hyperliquid → Arbitrum" },
        { label: "Wallet", value: destination ? `${destination.slice(0, 8)}…${destination.slice(-6)}` : "Modern EVM wallet" },
        ...(isDeposit ? [{ label: "Destination", value: "Futures account" }] : []),
      ]} />
      {isDeposit && (busy || pendingDeposit) && !success && (
        <div className="rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          {depositStage === 0 ? "Preparing the Arbitrum approval…" : depositStage === 1 ? "Approval submitted. Sending USDC to Hyperliquid…" : "Deposit submitted. Waiting for Hyperliquid to credit Futures."}
        </div>
      )}
      {message && <InlineNotice tone="error">{message}</InlineNotice>}
      {!isDeposit && withdrawalIntentId && withdrawalQuery.data?.status === "failed" && <InlineNotice tone="error">Hyperliquid reported that this withdrawal failed. Your Futures balance was not settled.</InlineNotice>}
      {!isDeposit && withdrawalIntentId && withdrawalQuery.data?.status === "submitted" && <div className="rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] text-muted-foreground">Withdrawal relayed to Hyperliquid. The Arbitrum balance will update after settlement.</div>}
      {!isDeposit && accountQuery.isError && <InlineNotice tone="warning">We can’t verify the latest Futures balance right now. Nothing will be submitted until it is available.</InlineNotice>}
      {success && <InlineNotice className="bg-credit-chip text-credit">{success}</InlineNotice>}
      <FlowCta label={busy ? "Signing and submitting…" : blocker ?? (pendingDeposit ? "Resume deposit" : isDeposit ? "Deposit to Hyperliquid" : "Withdraw from Hyperliquid")} onClick={() => void submit()} disabled={Boolean(blocker) || busy} busy={busy} />
    </div>
  )

  return (
    <>
      {variant === "modal" ? content : <FlowShell><PageHeader title={isDeposit ? "Deposit to Hyperliquid" : "Withdraw from Hyperliquid"} subtitle="Modern wallet only · Hyperliquid mainnet" back="/" className="mb-5" />{content}</FlowShell>}
      <WalletUnlockDialog action="hyperliquid-deposit" open={unlockOpen} onOpenChange={setUnlockOpen} onUnlocked={() => { const action = resume.current; resume.current = null; action?.() }} />
      {onDismiss && success && <button type="button" onClick={onDismiss} className="sr-only">Done</button>}
    </>
  )
}
