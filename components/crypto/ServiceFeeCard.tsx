"use client"

/**
 * The service fee on a withdrawal or swap that has just been sent.
 *
 * The backend decides whether a fee applies (Solana and EVM only, and only for
 * a transfer the user made by hand). When it does, this card shows the amount
 * and asks the user to approve it as its own transfer, so the fee is something
 * they see and sign, never something added to the transaction they reviewed.
 * When nothing applies it renders nothing.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { Button } from "@/components/ui/button"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useTransactionIntent } from "@/hooks/crypto/useTransactionIntent"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { describeCryptoError } from "@/lib/crypto-backend/error-messages"
import type { ServiceFeeQuote } from "@/lib/crypto-backend"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"

type Phase = "checking" | "none" | "ready" | "paying" | "paid"

export function ServiceFeeCard({ parentIntentId, symbol }: { parentIntentId: string | null; symbol: string }) {
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const wallet = useCryptoWalletState()
  const walletId = wallet.data?.id

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(walletId),
    staleTime: 60_000,
  })
  const feeTx = useTransactionIntent(walletId, packageQuery.data)
  const { adoptIntent } = feeTx

  const [phase, setPhase] = React.useState<Phase>("checking")
  const [fee, setFee] = React.useState<ServiceFeeQuote | null>(null)
  const [error, setError] = React.useState<unknown>(null)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const asked = React.useRef<string | null>(null)

  // Ask once per sent transfer. The backend returns the same fee transfer if
  // this is repeated, so a remount never creates a second charge.
  React.useEffect(() => {
    if (!parentIntentId || asked.current === parentIntentId) return
    asked.current = parentIntentId
    let cancelled = false
    cryptoBackendClient
      .createServiceFeeIntent(parentIntentId)
      .then((result) => {
        if (cancelled) return
        if (!result.fee || !result.intent) {
          setPhase("none")
          return
        }
        setFee(result.fee)
        adoptIntent(result.intent.id)
        setPhase(result.intent.status === "submitted" || result.intent.status === "confirmed" ? "paid" : "ready")
      })
      .catch((cause) => {
        if (cancelled) return
        // The fee is a courtesy to the flow above it: never let a failure here
        // hide a transfer that has already gone through.
        setError(cause)
        setPhase("none")
      })
    return () => {
      cancelled = true
    }
  }, [parentIntentId, adoptIntent])

  const pay = React.useCallback(async () => {
    setError(null)
    setPhase("paying")
    try {
      await feeTx.submitIntent({ useSponsorship: false })
      setPhase("paid")
    } catch (cause) {
      setError(cause)
      setPhase("ready")
    }
  }, [feeTx])

  const press = () => {
    if (!walletId) return
    if (!getUnlockedWalletState(userId, walletId)) {
      setUnlockOpen(true)
      return
    }
    void pay()
  }

  if (phase === "checking" || phase === "none") return null

  const described = error ? describeCryptoError(error) : null

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-foreground">Service fee</span>
          <span className="text-[12.5px] leading-relaxed text-muted-foreground">
            {phase === "paid"
              ? "Paid. Thank you."
              : `${fee?.percent}% of what you sent, approved as its own small transfer.`}
          </span>
        </div>
        <span className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
          {fee?.amount} {symbol}
        </span>
      </div>
      {described ? <p className="text-[12.5px] leading-relaxed text-debit">{described.message}</p> : null}
      {phase !== "paid" ? (
        <Button onClick={press} disabled={phase === "paying" || !feeTx.intent || !packageQuery.data}>
          {phase === "paying" ? "Approving fee…" : "Approve fee"}
        </Button>
      ) : null}
      <WalletUnlockDialog
        action="send"
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => void pay()}
      />
    </div>
  )
}
