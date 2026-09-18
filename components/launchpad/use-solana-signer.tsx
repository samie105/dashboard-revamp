"use client"

/**
 * Sign-and-submit for launchpad intents, with the wallet-unlock detour.
 *
 * `run(action)` runs the action if the wallet is unlocked; if not, it opens
 * the unlock dialog and runs the SAME action once unlocked — resume, don't
 * restart (the rule the swap and send flows already follow).
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { useAuth } from "@/components/auth-provider"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionIntent } from "@/lib/crypto-backend/types"
import { signSolanaIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"

export function useSolanaSigner() {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const walletPackage = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data),
    staleTime: 3 * 60_000,
  })
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const pending = React.useRef<(() => void) | null>(null)

  const ready = Boolean(user && wallet.data && walletPackage.data)

  /** Runs `action` now, or after the wallet is unlocked. */
  const run = React.useCallback(
    (action: () => void) => {
      if (!user || !wallet.data) return action()
      if (!getUnlockedWalletState(user.userId, wallet.data.id)) {
        pending.current = action
        setUnlockOpen(true)
        return
      }
      action()
    },
    [user, wallet.data]
  )

  /** Signs on this device and submits. Returns the transaction hash. */
  const signAndSubmit = React.useCallback(
    async (intent: CryptoTransactionIntent) => {
      if (!user || !wallet.data || !walletPackage.data)
        throw new Error("Your wallet isn't ready yet.")
      const account = wallet.data.accounts.find(
        (a) => a.chainFamily === "solana" && a.state === "active"
      )
      if (!account?.id) throw new Error("Your Solana account isn't ready yet.")
      const signed = await signSolanaIntent(
        user.userId,
        wallet.data.id,
        walletPackage.data,
        intent,
        account.id
      )
      const submitted = await cryptoBackendClient.submitIntent(
        intent.id,
        signed
      )
      return submitted.txHash
    },
    [user, wallet.data, walletPackage.data]
  )

  const dialog = (
    <WalletUnlockDialog
      action="swap"
      open={unlockOpen}
      onOpenChange={setUnlockOpen}
      onUnlocked={() => {
        const resume = pending.current
        pending.current = null
        resume?.()
      }}
    />
  )

  return { ready, run, signAndSubmit, dialog }
}
