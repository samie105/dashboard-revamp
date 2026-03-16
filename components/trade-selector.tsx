"use client"

import * as React from "react"
import Link from "next/link"
import { Dialog } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Exchange01Icon,
  ChartLineData02Icon,
  GlobeIcon,
  BinaryCodeIcon,
  RepeatIcon,
  Link01Icon,
  Copy01Icon,
  Store01Icon,
  BarChartIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

// ── Trading Routes ───────────────────────────────────────────────────────

interface TradingRoute {
  name: string
  description: string
  href: string
  icon: typeof Exchange01Icon
  tag?: string
}

const TRADING_ROUTES: TradingRoute[] = [
  { name: "Spot", description: "Buy & sell crypto instantly", href: "/spot", icon: Exchange01Icon },
  { name: "Futures", description: "Perpetual futures trading", href: "/futures", icon: ChartLineData02Icon },
  { name: "Forex", description: "Currency pair trading", href: "/forex", icon: GlobeIcon },
  { name: "Binary", description: "Binary options trading", href: "/binary", icon: BinaryCodeIcon },
  { name: "Swap", description: "One-tap token conversion", href: "/swap", icon: RepeatIcon },
  { name: "Bridge", description: "Cross-chain transfers", href: "/bridge", icon: Link01Icon },
  { name: "Copy Trading", description: "Mirror top traders", href: "/copy-trading", icon: Copy01Icon },
  { name: "P2P Trading", description: "Peer-to-peer exchange", href: "/p2p", icon: Store01Icon },
  { name: "Markets", description: "Full market screener", href: "/trading/markets", icon: BarChartIcon },
]

// ── Context for controlling the selector ─────────────────────────────────

interface TradeSelectorCtx {
  open: boolean
  setOpen: (v: boolean) => void
  /** Optional: pre-set a pair to pass to the target route */
  pair?: string
}

const TradeSelectorContext = React.createContext<TradeSelectorCtx>({
  open: false,
  setOpen: () => {},
})

export function useTradeSelectorContext() {
  return React.useContext(TradeSelectorContext)
}

// ── Provider ─────────────────────────────────────────────────────────────

export function TradeSelectorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [pair, setPair] = React.useState<string | undefined>()

  const ctx = React.useMemo(() => ({
    open,
    setOpen: (v: boolean) => { setOpen(v); if (!v) setPair(undefined) },
    pair,
  }), [open, pair])

  return (
    <TradeSelectorContext.Provider value={ctx}>
      {children}
      <TradeSelectorModal open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPair(undefined) }} pair={pair} />
    </TradeSelectorContext.Provider>
  )
}

// ── Hook for opening the selector from anywhere ──────────────────────────

export function useTradeSelector() {
  const ctx = React.useContext(TradeSelectorContext)
  return {
    openTradeSelector: (_pair?: string) => {
      ctx.setOpen(true)
    },
  }
}

// ── Shared Route Grid Content ────────────────────────────────────────────

function RouteGrid({ pair, onClose }: { pair?: string; onClose: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {TRADING_ROUTES.map((route) => {
        const href = pair && (route.href === "/spot" || route.href === "/futures")
          ? `${route.href}?pair=${pair}`
          : route.href

        return (
          <Link
            key={route.name}
            href={href}
            onClick={onClose}
            className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-accent/60"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/60 transition-colors group-hover:bg-primary/10">
              <HugeiconsIcon icon={route.icon} className="h-5 w-5 text-foreground group-hover:text-primary" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">{route.name}</span>
                {route.tag && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {route.tag}
                  </span>
                )}
              </div>
              <span className="truncate text-xs text-muted-foreground">{route.description}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ── Modal (Dialog on desktop, bottom Sheet on mobile) ────────────────────

function TradeSelectorModal({
  open,
  onOpenChange,
  pair,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pair?: string
}) {
  const isMobile = useIsMobile()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {/* Backdrop */}
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
        />
        <Dialog.Popup
          className={cn(
            "fixed z-50 flex flex-col bg-background text-sm shadow-2xl transition duration-200 ease-in-out outline-none",
            "data-ending-style:opacity-0 data-starting-style:opacity-0",
            isMobile
              ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t data-ending-style:translate-y-10 data-starting-style:translate-y-10"
              : "top-1/2 left-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border data-ending-style:scale-95 data-starting-style:scale-95"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <Dialog.Title className="text-base font-semibold">Choose Trading Type</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Select where you&apos;d like to trade
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-4">
            <RouteGrid pair={pair} onClose={() => onOpenChange(false)} />
          </div>

          {/* Mobile drag handle */}
          {isMobile && (
            <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-border/60" />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
