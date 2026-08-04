"use client"

/**
 * Money-flow modal — deposit (/buy) and withdrawal (/sell) as an overlay
 * instead of a page walk: a centered modal on desktop, a bottom drawer on
 * mobile. The /buy and /sell routes still render the full-page variant for
 * deep links and the /deposit → /buy, /withdraw → /sell redirects.
 *
 * Built on the same Base UI Dialog primitive as sheet.tsx, so focus trap,
 * scroll lock (modal), portal, and aria wiring come from one place.
 *
 * The one unforgivable bug here is accidentally dismissing an in-flight money
 * move. BuySellClient reports in-flight (mid-submit, or a processing status
 * screen); while true, backdrop clicks and Escape are ignored. The X button
 * still closes — an explicit close is a choice, and the order carries on
 * server-side (history shows how it ends). Success/failure screens dismiss
 * freely.
 */

import * as React from "react"
import { usePathname } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { BuySellClient } from "@/components/buy-sell/buy-sell-client"

type FlowMode = "buy" | "sell"

const MoneyFlowContext = React.createContext<{
  openFlow: (mode: FlowMode) => void
  closeFlow: () => void
} | null>(null)

export function useMoneyFlow() {
  const ctx = React.useContext(MoneyFlowContext)
  if (!ctx) {
    throw new Error(
      "useMoneyFlow must be used inside <MoneyFlowProvider> — it is mounted once in components/layout-shell.tsx.",
    )
  }
  return ctx
}

export function MoneyFlowProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  // `open` gates the dialog; `mode` survives the close so the panel keeps its
  // content while the exit transition plays instead of going blank.
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<FlowMode>("buy")

  // Written by BuySellClient (onInFlightChange), read by onOpenChange. A ref,
  // not state — the shell doesn't need to re-render when it flips.
  const inFlightRef = React.useRef(false)

  const openFlow = React.useCallback((next: FlowMode) => {
    inFlightRef.current = false
    setMode(next)
    setOpen(true)
  }, [])
  const closeFlow = React.useCallback(() => setOpen(false), [])
  const ctx = React.useMemo(() => ({ openFlow, closeFlow }), [openFlow, closeFlow])

  const handleInFlightChange = React.useCallback((v: boolean) => {
    inFlightRef.current = v
  }, [])

  // Backdrop clicks and Escape ask to close through here. While a move is in
  // flight they're accidents waiting to happen, so every dismissal reason is
  // ignored (the dialog is controlled — not flipping state keeps it open).
  // The X button is the one intentional exit: it calls closeFlow directly and
  // never passes through this handler.
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) return
    if (inFlightRef.current) return
    setOpen(false)
  }, [])

  // Links inside the flow ("View history", banner actions) client-navigate —
  // the modal must not outlive the page it was opened over.
  const prevPathname = React.useRef(pathname)
  React.useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      setOpen(false)
    }
  }, [pathname])

  return (
    <MoneyFlowContext.Provider value={ctx}>
      {children}

      <Dialog.Root open={open} onOpenChange={handleOpenChange} modal>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm" />
          <Dialog.Popup
            aria-label={mode === "buy" ? "Deposit USDT" : "Withdraw USDT"}
            className={cn(
              "fixed z-50 flex flex-col bg-card outline-none",
              isMobile
                ? // Bottom drawer — slides up, safe-area padded, capped height.
                  "inset-x-0 bottom-0 max-h-[90dvh] translate-y-0 rounded-t-2xl safe-area-bottom transition-transform duration-300 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full"
                : // Centered modal — subtle opacity + scale entrance.
                  "left-1/2 top-1/2 max-h-[85dvh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 scale-100 rounded-2xl transition-all duration-200 ease-out data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
            )}
          >
            {/* Grabber — the drawer names its own gesture. */}
            {isMobile && (
              <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/[0.16]" />
            )}

            {/* X — always available, even in flight (an explicit choice,
                unlike a stray backdrop tap). Pinned outside the scroll area. */}
            <button
              type="button"
              onClick={closeFlow}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <BuySellClient
                // Keyed by mode so a half-typed deposit never leaks into a
                // withdrawal. Each open is a fresh mount regardless — the
                // portal unmounts the popup once the close transition ends.
                key={mode}
                mode={mode}
                variant="modal"
                onInFlightChange={handleInFlightChange}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </MoneyFlowContext.Provider>
  )
}
