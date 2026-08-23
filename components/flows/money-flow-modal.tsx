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
import { Segmented, type SegmentedOption } from "@/components/ui/system"
import { BuySellClient } from "@/components/buy-sell/buy-sell-client"
import { FundClient } from "@/components/fund/fund-client"
import { PENDING_PANEL_KEY } from "@/lib/vivid-functions"
import { registerVividContext } from "@/lib/vivid-page-context"

/** Vivid panel ids → flow modes. The provider is mounted on every route, so it
 *  is always the synchronous handler for vivid:open-panel. */
const VIVID_PANEL_TO_MODE: Record<string, FlowMode> = {
  deposit: "buy",
  withdraw: "sell",
  fund_trading: "fund",
  withdraw_trading: "trading-withdraw",
}

/** The four money doors. buy/sell move USDT against the Dollar Account;
 *  fund/trading-withdraw move USDC between the Dollar Account and Hyperliquid. */
type FlowMode = "buy" | "sell" | "fund" | "trading-withdraw"

const FLOW_LABELS: Record<FlowMode, string> = {
  buy: "Deposit USDT",
  sell: "Withdraw USDT",
  fund: "Fund trading account",
  "trading-withdraw": "Withdraw trading balance",
}

/** Each door pairs with its opposite direction — money in ↔ money out. The
 *  toggle at the top of the modal flips between them without closing, so
 *  "wrong direction" is one tap to fix instead of close-reopen-refind. */
const CASH_DIRECTIONS: readonly SegmentedOption<FlowMode>[] = [
  { key: "buy", label: "Deposit" },
  { key: "sell", label: "Withdraw" },
]
const TRADING_DIRECTIONS: readonly SegmentedOption<FlowMode>[] = [
  { key: "fund", label: "Fund" },
  { key: "trading-withdraw", label: "Withdraw" },
]

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

  // Both sides of a pair stay mounted (see the panel stack below), so BOTH
  // report their in-flight state. Track them separately and take the OR: the
  // idle one always reports false, and only the visible one can ever be busy.
  const inFlightByMode = React.useRef<Partial<Record<FlowMode, boolean>>>({})
  const inFlightHandlers = React.useMemo(() => {
    const modes: FlowMode[] = ["buy", "sell", "fund", "trading-withdraw"]
    return Object.fromEntries(
      modes.map((m) => [
        m,
        (v: boolean) => {
          inFlightByMode.current[m] = v
          inFlightRef.current = Object.values(inFlightByMode.current).some(Boolean)
        },
      ]),
    ) as Record<FlowMode, (v: boolean) => void>
    // A ref is stable for the component's life, so this never re-runs — but
    // naming it lets the React Compiler verify that rather than assume it.
  }, [inFlightByMode])

  // Which width the ACTIVE panel wants: the two-pane terminal needs the wide
  // frame; the status / receive / setup screens are single columns that
  // drown in it, so they ask for the narrow one and the popup morphs.
  const [compactByMode, setCompactByMode] = React.useState<Partial<Record<FlowMode, boolean>>>({})
  const compactHandlers = React.useMemo(() => {
    const modes: FlowMode[] = ["buy", "sell", "fund", "trading-withdraw"]
    return Object.fromEntries(
      modes.map((m) => [
        m,
        (v: boolean) =>
          setCompactByMode((prev) => (prev[m] === v ? prev : { ...prev, [m]: v })),
      ]),
    ) as Record<FlowMode, (v: boolean) => void>
  }, [])
  const compact = !!compactByMode[mode]

  const openFlow = React.useCallback((next: FlowMode) => {
    inFlightRef.current = false
    inFlightByMode.current = {}
    setMode(next)
    setOpen(true)
  }, [])
  const closeFlow = React.useCallback(() => setOpen(false), [])
  const ctx = React.useMemo(() => ({ openFlow, closeFlow }), [openFlow, closeFlow])

  // Direction toggle: swap to the paired flow in place. Ignored while a move
  // is in flight — switching would hide a live status screen.
  const switchMode = React.useCallback((next: FlowMode) => {
    if (inFlightRef.current) return
    setMode(next)
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

  // ── Vivid ────────────────────────────────────────────────────────────────
  // The assistant opens these flows via vivid:open-panel; `handled` is flipped
  // synchronously so the dispatcher knows nothing else needs to happen. A
  // stashed request (set when this provider wasn't mounted yet) replays once.
  React.useEffect(() => {
    const onPanel = (e: Event) => {
      const detail = (e as CustomEvent).detail as { panel?: string; handled?: boolean }
      const mode = detail?.panel ? VIVID_PANEL_TO_MODE[detail.panel] : undefined
      if (!mode) return
      detail.handled = true
      openFlow(mode)
    }
    window.addEventListener("vivid:open-panel", onPanel)

    let pending: string | null = null
    try {
      pending = sessionStorage.getItem(PENDING_PANEL_KEY)
      if (pending) sessionStorage.removeItem(PENDING_PANEL_KEY)
    } catch { /* private mode */ }
    if (pending && VIVID_PANEL_TO_MODE[pending]) {
      const mode = VIVID_PANEL_TO_MODE[pending]
      setTimeout(() => openFlow(mode), 120)
    }

    return () => window.removeEventListener("vivid:open-panel", onPanel)
  }, [openFlow])

  // Publish what's up so "what am I looking at?" sees the modal, not just the
  // page behind it.
  React.useEffect(() => {
    return registerVividContext("moneyFlowModal", () =>
      open ? { openModal: FLOW_LABELS[mode], direction: mode } : null,
    )
  }, [open, mode])

  return (
    <MoneyFlowContext.Provider value={ctx}>
      {children}

      <Dialog.Root open={open} onOpenChange={handleOpenChange} modal>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-md" />

          {/* Backlight — a direction-coloured bloom BEHIND the glass, so the
              modal reads as lit from the money's side of the wall. The wrapper
              carries the scale-in; the two tints cross-fade inside it. */}
          {!isMobile && (
            <div
              aria-hidden
              className="ws-modal-glow pointer-events-none fixed left-1/2 top-1/2 z-50 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2"
            >
              {(["in", "out"] as const).map((d) => (
                <div
                  key={d}
                  className={cn(
                    "absolute inset-0 rounded-full transition-opacity duration-500",
                    (mode === "buy" || mode === "fund") === (d === "in") ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    background: `radial-gradient(closest-side, color-mix(in oklab, ${
                      d === "in" ? "var(--credit)" : "var(--debit)"
                    } 15%, transparent), transparent 72%)`,
                  }}
                />
              ))}
            </div>
          )}
          <Dialog.Popup
            aria-label={FLOW_LABELS[mode]}
            className={cn(
              // overflow-hidden is load-bearing: the sticky CTA footer paints a
              // solid card fill to the popup's edges, and without clipping it
              // squared off the bottom corners against a rounded top.
              // ws-glass: heavy frost — the dashboard stays present as blurred
              // material behind the money, which is what sells the elevation.
              "ws-glass ws-glass-edge fixed z-50 flex flex-col overflow-hidden outline-none",
              "shadow-[0_40px_100px_-24px_rgb(0_0_0/0.65)] ring-1 ring-foreground/10",
              isMobile
                ? // Bottom drawer — slides up, safe-area padded. A FIXED height
                  // (not max-h) so switching direction never resizes the sheet.
                  "inset-x-0 bottom-0 h-[86dvh] translate-y-0 rounded-t-[28px] safe-area-bottom transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] data-ending-style:translate-y-full data-starting-style:translate-y-full"
                : // Centered modal — springy push-up with a blur-to-focus
                  // resolve, quick fade out. WIDE for the two-pane terminal;
                  // MORPHS narrow when the active panel shows a single-column
                  // screen (status, receive, setup). Fixed height either way;
                  // dvh cap keeps it honest on laptops.
                  cn(
                    "ws-modal-in left-1/2 top-1/2 h-[680px] max-h-[86dvh] w-full -translate-x-1/2 -translate-y-1/2 rounded-[28px] transition-all duration-300 ease-out data-ending-style:scale-[0.97] data-ending-style:opacity-0",
                    compact ? "max-w-md" : "max-w-2xl",
                  ),
            )}
          >
            {/* Gold rim shimmer — a faint standing stroke with a slow glint
                walking the border. The money surface's one standing gold. */}
            <span aria-hidden className="ws-ring-shimmer" />

            {/* The direction atmosphere lives in each panel's STAGE now (see
                flow-terminal.tsx) — it swaps with the panels, so no wash is
                painted at the shell level. */}

            {/* Grabber — the drawer names its own gesture. */}
            {isMobile && (
              <div aria-hidden className="relative mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/[0.16]" />
            )}

            {/* Master bar — the direction toggle spans the width (this modal's
                one top-level choice) with the X inline beside it. The X stays
                available even in flight: an explicit choice, unlike a stray
                backdrop tap. Both pinned above the scroll area. */}
            <div className="ws-casc ws-casc-0 relative flex shrink-0 items-center gap-2 px-4 pb-1 pt-4 sm:px-5">
              <Segmented
                grow
                value={mode}
                onChange={switchMode}
                options={mode === "buy" || mode === "sell" ? CASH_DIRECTIONS : TRADING_DIRECTIONS}
              />
              <button
                type="button"
                onClick={closeFlow}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </button>
            </div>

            {/* scrollbar-none: the shell is a fixed height, so a track would be
                permanent furniture on a surface that's mostly short enough not
                to need it. Wheel, trackpad, touch and keys all still scroll. */}
            <div className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
              {/* Both sides of the pair stay mounted and stack in ONE grid cell.
                  Swapping is then a pure cross-fade between two already-painted
                  layers — no unmount, no refetch, no skeleton. (Remounting on
                  every toggle blocked the main thread for ~130ms, which no
                  amount of easing can hide.) The grid row also stretches both
                  to the same height, so the shell never resizes.

                  Each mode keeps its own state, so a half-typed deposit can't
                  leak into a withdrawal — and comes back if you return to it.

                  `invisible` (not just opacity-0) is load-bearing: visibility
                  inherits, so the idle panel's controls are unfocusable and
                  invisible to Vivid's target lookup, which resolves by first
                  match and would otherwise grab the wrong amount field. */}
              <div className="grid min-h-full">
                {(mode === "buy" || mode === "sell" ? CASH_DIRECTIONS : TRADING_DIRECTIONS).map(
                  (opt, i, pair) => {
                    const active = opt.key === mode
                    // Idle panels wait on the side they sit on in the toggle,
                    // so content travels the same way the tab you pressed did.
                    const after = i > pair.findIndex((o) => o.key === mode)
                    return (
                      <div
                        key={opt.key}
                        aria-hidden={!active}
                        className={cn(
                          "col-start-1 row-start-1 flex min-h-full flex-col",
                          // The swap is a spring, not a fade: the incoming
                          // panel travels in from the side its tab sits on,
                          // resolves from a soft blur, and kisses a hair past
                          // centre before settling (the >1 bezier). The idle
                          // panel waits slightly scaled-down and out of focus,
                          // so depth — not just position — says which side is
                          // live.
                          "transition-[opacity,translate,visibility,scale,filter] duration-[420ms] [transition-timing-function:cubic-bezier(0.3,1.25,0.4,1)] motion-reduce:transition-none",
                          active
                            ? "visible translate-x-0 scale-100 opacity-100 blur-none"
                            : cn(
                                "invisible pointer-events-none opacity-0 scale-[0.96] blur-[6px]",
                                after ? "translate-x-14" : "-translate-x-14",
                              ),
                        )}
                      >
                        {opt.key === "buy" || opt.key === "sell" ? (
                          <BuySellClient
                            mode={opt.key}
                            variant="modal"
                            onInFlightChange={inFlightHandlers[opt.key]}
                            onCompactChange={compactHandlers[opt.key]}
                          />
                        ) : (
                          <FundClient
                            mode={opt.key === "fund" ? "fund" : "withdraw"}
                            variant="modal"
                            onInFlightChange={inFlightHandlers[opt.key]}
                            onCompactChange={compactHandlers[opt.key]}
                            onDismiss={closeFlow}
                          />
                        )}
                      </div>
                    )
                  },
                )}
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </MoneyFlowContext.Provider>
  )
}
