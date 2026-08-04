"use client"

/**
 * ReceiveModal — the counterpart to SendModal on the assets page.
 *
 * Receiving is the one money movement that can't fail: it needs no balance, no
 * gas and no backend, just the user's own address. So this modal is deliberately
 * thin — it wraps ReceivePanel (the same QR + address + warning the deposit flow
 * shows) in the page's modal chrome and gets out of the way.
 *
 * Opened two ways, which is why `asset` is optional:
 *  · from a token row  → scoped to that token's network, warning names the token
 *  · from the header   → every network the wallet holds a key on, generic warning
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
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
  const panelRef = React.useRef<HTMLDivElement>(null)

  // Outside click and Escape both close — nothing here is destructive or
  // mid-flight, so there's no reason to trap the user the way a send does.
  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  const network = asset ? NETWORKS.find((n) => n.key === asset.chain) : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={asset ? `Receive ${asset.symbol}` : "Receive crypto"}
        className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-popover shadow-2xl"
      >
        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <div className="flex items-center gap-3">
            {asset ? (
              <img src={asset.icon} alt="" className="size-7 rounded-full" />
            ) : (
              <div className="flex size-7 items-center justify-center rounded-full bg-primary/[0.12]">
                <HugeiconsIcon icon={Wallet01Icon} className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold">
                {asset ? `Receive ${asset.symbol}` : "Receive crypto"}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {network
                  ? `Scan or copy your ${network.label} address`
                  : "Scan or copy your wallet address"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <div className="p-5">
          <ReceivePanel
            only={asset ? [asset.chain] : undefined}
            asset={asset ? asset.symbol : null}
          />
        </div>
      </div>
    </div>
  )
}
