"use client"

/**
 * ModernReceiveModal — the source-agnostic ReceivePanel, wrapped for the
 * modern (self-custodial) wallet.
 *
 * The legacy ReceiveModal (components/assets/receive-modal.tsx) reads its
 * addresses from the Privy wallet-provider context; this reads them from the
 * modern wallet's own account list instead, mapping each account's chain
 * family onto the wallet-record chain ReceivePanel already knows how to
 * render (spec §6).
 */

import * as React from "react"

import { ReceivePanel } from "@/components/ui/receive-panel"
import {
  ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader,
  ResponsiveModalTitle, ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { InlineNotice } from "@/components/ui/flow"
import { useCryptoContext } from "@/components/crypto/CryptoProvider"
import type { WalletChain } from "@/lib/networks"

const FAMILY_TO_CHAIN: Record<string, WalletChain> = {
  evm: "ethereum", solana: "solana", sui: "sui", ton: "ton", tron: "tron",
}

export function ModernReceiveModal({ open, onOpenChange, asset = null }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset?: string | null
}) {
  const { wallet } = useCryptoContext()
  const addresses = React.useMemo(() => {
    const map: Partial<Record<WalletChain, string>> = {}
    for (const account of wallet.data?.accounts ?? []) {
      const chain = FAMILY_TO_CHAIN[account.chainFamily]
      if (chain && account.canonicalAddress) map[chain] = account.canonicalAddress
    }
    return map
  }, [wallet.data])

  // Older wallets (created before a chain family shipped) can hold keys on
  // fewer families than the wallet-record supports — that network simply has
  // no address yet, not an error. Name it so the missing option isn't a
  // silent gap, and point at where it gets fixed.
  const provisionedFamilies = React.useMemo(
    () => new Set((wallet.data?.accounts ?? []).map((account) => account.chainFamily)),
    [wallet.data],
  )
  const showProvisioningNotice = Boolean(wallet.data) && provisionedFamilies.size < Object.keys(FAMILY_TO_CHAIN).length

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Deposit crypto</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Choose the network first — funds sent on the wrong network can be lost.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="max-h-[70dvh] overflow-y-auto">
          <ReceivePanel
            asset={asset}
            addresses={addresses}
            only={Object.keys(addresses).length ? undefined : []}
            note="This address belongs to your Worldstreet self-custodial wallet. Only you control its keys."
          />
        </div>
        {showProvisioningNotice && (
          <InlineNotice tone="warning">
            Some networks aren&apos;t set up on this wallet yet — add them under{" "}
            <a href="#security" className="font-semibold underline underline-offset-2">Security</a>.
          </InlineNotice>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
