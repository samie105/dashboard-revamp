"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Shield01Icon } from "@hugeicons/core-free-icons"

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"

/** A short onboarding explanation. Unlocking and key provisioning deliberately
 * continue in WalletSecurityModal so there is one security flow to maintain. */
export function IntertrainAddModal({
  open,
  onOpenChange,
  onAdd,
  onLearnMore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: () => void
  onLearnMore: () => void
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Add Intertrain to your wallet</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Intertrain mainnet uses WorldStreet Kash (WSK). It is a separate account and will not
            change your Ethereum, Solana, Sui, TON, or Tron accounts.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="flex flex-col gap-4 p-4 pt-1">
          <div className="flex items-start gap-3 rounded-2xl bg-primary/[0.08] p-4 ring-1 ring-primary/20">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.16] text-primary">
              <HugeiconsIcon icon={Shield01Icon} className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold">Your existing wallet stays intact</span>
              <span className="text-[12.5px] leading-relaxed text-muted-foreground">
                A new Intertrain key is generated and encrypted on this device. Your recovery and
                existing wallet records are preserved.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Add Intertrain (WSK)
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => onOpenChange(false)} className="min-h-10 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground">
              Not now
            </button>
            <button type="button" onClick={onLearnMore} className="min-h-10 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground">
              Learn more
            </button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
