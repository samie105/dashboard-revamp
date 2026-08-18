"use client"

/**
 * ReceiveModal — the counterpart to SendModal on the assets page.
 *
 * Receiving is the one money movement that can't fail: it needs no balance, no
 * gas and no backend, just the user's own address. So this is deliberately
 * thin — it wraps ReceivePanel (the same QR + address + warning the deposit
 * flow shows) and gets out of the way.
 *
 * Opened two ways, which is why `asset` is optional:
 *  · from a token row  → scoped to that token's network, warning names the token
 *  · from the header   → every network the wallet holds a key on, generic warning
 *
 * It used to hand-roll its own overlay: a fixed inset-0 backdrop, a mousedown
 * listener for outside clicks, a keydown listener for Escape, and a hard-coded
 * centred panel that stayed centred on a phone. All four are solved problems —
 * ResponsiveModal is the app's Base UI dialog, so focus trapping, scroll lock,
 * the portal, the aria wiring and the desktop-dialog/mobile-sheet split come
 * from one place and behave the same as every other modal in the product.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Wallet01Icon } from "@hugeicons/core-free-icons"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ReceivePanel } from "@/components/ui/receive-panel"
import { NETWORKS } from "@/lib/networks"

export interface ReceivableAsset {
  symbol: string
  /** Network key from lib/networks — "arbitrum" is its own key, not "ethereum". */
  chain: string
  icon: string
}

export function ReceiveModal({
  open,
  onClose,
  asset,
}: {
  open: boolean
  onClose: () => void
  asset?: ReceivableAsset
}) {
  const network = asset ? NETWORKS.find((n) => n.key === asset.chain) : undefined

  return (
    <ResponsiveModal open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <div className="flex items-center gap-3">
            {asset ? (
              <CoinAvatar src={asset.icon} symbol={asset.symbol} size="lg" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.12]">
                <HugeiconsIcon icon={Wallet01Icon} className="h-4 w-4 text-primary" />
              </span>
            )}
            <div className="min-w-0">
              <ResponsiveModalTitle className="text-[15px]">
                {asset ? `Receive ${asset.symbol}` : "Receive crypto"}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-[13px]">
                {network
                  ? `Scan or copy your ${network.label} address`
                  : "Scan or copy your wallet address"}
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>

        {/* max-h + scroll so the QR and the multi-network list still fit on a
            short phone in landscape, where the sheet has very little height. */}
        <div className="max-h-[70dvh] overflow-y-auto">
          <ReceivePanel
            only={asset ? [asset.chain] : undefined}
            asset={asset ? asset.symbol : null}
          />
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
