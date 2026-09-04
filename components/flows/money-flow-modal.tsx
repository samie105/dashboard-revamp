"use client"

/**
 * Money-flow modal — deposit (/buy) and withdrawal (/sell) as an overlay
 * instead of a page walk: one centred card at every width. The /buy and /sell
 * routes still render the full-page variant for deep links and the
 * /deposit → /buy, /withdraw → /sell redirects.
 *
 * The shape comes from components/ui/modal-surface.ts, the same two strings
 * ResponsiveModal uses, so this surface cannot drift away from the rest of the
 * app's dialogs again. It used to be a bottom drawer under 640px — glued to
 * both edges and pinned to the floor while every other modal was a centred
 * card. Owner call, 2026-09-03: one way in, everywhere, and mobile above all.
 * Only the SIZE is ours (see the popup below), because this is the one modal
 * that has to be wide enough for a two-pane terminal.
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
 *
 * ── Two ways in ───────────────────────────────────────────────────────────
 * `openFlow(mode)` goes straight to one flow. That is what Vivid, /buy, /sell
 * and the trade workspace want: they already know which money is moving.
 *
 * `openDoor(direction)` opens on a CHOICE first, because from the crypto
 * dashboard "deposit" is ambiguous — it means either the Dollar Account
 * topping the trading account up, or coins arriving from another app. See
 * money-doors.tsx. Picking a door advances the same modal in place; the back
 * arrow in the master bar returns to the question, so a wrong turn costs one
 * tap rather than close-reopen-refind.
 *
 * A direction with only ONE open door skips the question entirely and lands on
 * that door, with no back arrow — there is nothing behind it. That is withdraw
 * today, because cash withdrawals are closed until a treasury exists to settle
 * them (money-doors.tsx, CASH_WITHDRAWALS_CLOSED). The test is the door COUNT,
 * never the word "withdraw", so re-opening the door restores the question on
 * its own.
 */

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { MODAL_BACKDROP, MODAL_SURFACE } from "@/components/ui/modal-surface"
import { PanelErrorBoundary } from "@/components/ui/panel-error-boundary"
import { Segmented, type SegmentedOption } from "@/components/ui/system"
import { BuySellClient } from "@/components/buy-sell/buy-sell-client"
import { HyperliquidFundingClient } from "@/components/fund/hyperliquid-funding-client"
import { FlowSkeleton } from "@/components/ui/flow"
import { DoorChooser, doorsFor, type DoorKey, type MoneyDirection } from "@/components/flows/money-doors"
import { PENDING_PANEL_KEY } from "@/lib/vivid-functions"
import { registerVividContext } from "@/lib/vivid-page-context"

/** The wallet's own send/receive surfaces, split out of every route's bundle.
 *  See crypto-doors.tsx for why they are lazy and why they are panels rather
 *  than the ready-made ModernReceiveModal / SendModal popups. */
const CryptoDoorPanel = dynamic(
  () => import("@/components/flows/crypto-doors").then((m) => m.CryptoDoorPanel),
  { ssr: false, loading: () => <div className="p-4 sm:p-5"><FlowSkeleton /></div> },
)

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

/** Which chooser a flow belongs behind. Read when the direction toggle flips
 *  mid-flow, so the back arrow keeps aiming at the question that matches what
 *  is now on screen instead of the one the user originally answered. */
const MODE_DIRECTION: Record<FlowMode, MoneyDirection> = {
  buy: "deposit",
  fund: "deposit",
  sell: "withdraw",
  "trading-withdraw": "withdraw",
}

/**
 * What the popup is showing.
 *
 * "flow" is the original modal — the paired custodial panels under the
 * direction toggle. The other three are steps reached through `openDoor`:
 * the question itself, and the wallet's two crypto surfaces.
 */
type FlowView = "choice" | "flow" | "receive" | "send"

/** In-flight is tracked per panel, and the crypto send is a panel too — it
 *  reports the same way, so one OR covers every surface that can be mid-move. */
type InFlightKey = FlowMode | "send"

/**
 * Where a door leads. Pure, and outside the component, because TWO callers
 * need the same answer from different places: `pickDoor` (the user answered
 * the question) and `openDoor` (there was only one answer, so nobody asked).
 * Keeping it in one function is what stops those two paths drifting apart.
 */
function doorTarget(
  direction: MoneyDirection,
  door: DoorKey,
): { view: FlowView; mode?: FlowMode } {
  const out = direction === "withdraw"
  if (door === "crypto") return { view: out ? "send" : "receive" }
  return { view: "flow", mode: out ? "trading-withdraw" : "fund" }
}

const MoneyFlowContext = React.createContext<{
  openFlow: (mode: FlowMode) => void
  closeFlow: () => void
  /** Opens on the choice step: "where is this money coming from / going to?"
   *  Use this from any button whose label alone doesn't say which money moves
   *  — the dashboard's Deposit and Withdraw. */
  openDoor: (direction: MoneyDirection) => void
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

  // `open` gates the dialog; `mode` and `view` survive the close so the panel
  // keeps its content while the exit transition plays instead of going blank.
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<FlowMode>("buy")
  const [view, setView] = React.useState<FlowView>("flow")
  // Which chooser this journey came through, or null when a caller named the
  // flow outright. Null means no back arrow: there is nothing behind it.
  const [direction, setDirection] = React.useState<MoneyDirection | null>(null)

  // Written by BuySellClient (onInFlightChange), read by onOpenChange. A ref,
  // not state — the shell doesn't need to re-render when it flips.
  const inFlightRef = React.useRef(false)

  // Both sides of a pair stay mounted (see the panel stack below), so BOTH
  // report their in-flight state. Track them separately and take the OR: the
  // idle one always reports false, and only the visible one can ever be busy.
  const inFlightByMode = React.useRef<Partial<Record<InFlightKey, boolean>>>({})
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

  // The crypto send joins the same tally. It unmounts on close rather than
  // reporting its way back to false, which is why every open clears the map.
  const reportSendInFlight = React.useCallback((v: boolean) => {
    inFlightByMode.current.send = v
    inFlightRef.current = Object.values(inFlightByMode.current).some(Boolean)
  }, [])

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
  // Only the two-pane terminal wants the wide frame. The chooser is two rows,
  // and both crypto surfaces are single columns, so every step outside a flow
  // asks for the narrow one.
  const compact = view === "flow" ? !!compactByMode[mode] : true

  // Is there a question behind what's on screen? Only then does the back arrow
  // earn its place. Two things can make the answer no: a caller named the flow
  // outright (`direction === null` — Vivid, /buy, /sell, the trade workspace),
  // or the direction has a single open door and the chooser was never shown.
  //
  // Derived from the door COUNT rather than from any particular direction, so
  // re-opening a closed door (money-doors.tsx, CASH_WITHDRAWALS_CLOSED) brings
  // the arrow back by itself — including for someone who reached a one-door
  // direction sideways, by flipping the Segmented toggle inside a flow.
  const canGoBack = direction !== null && doorsFor(direction).length > 1

  const openFlow = React.useCallback((next: FlowMode) => {
    inFlightRef.current = false
    inFlightByMode.current = {}
    // A named flow has no question behind it, so no back arrow appears. This
    // is what keeps Vivid, /buy, /sell and the trade workspace unchanged.
    setDirection(null)
    setView("flow")
    setMode(next)
    setOpen(true)
  }, [])

  const openDoor = React.useCallback((next: MoneyDirection) => {
    inFlightRef.current = false
    inFlightByMode.current = {}
    setDirection(next)

    // A question with one answer isn't a question. Withdraw has a single open
    // door while cash withdrawals are closed (money-doors.tsx), and a one-row
    // chooser would cost a tap while teaching nothing — so walk straight
    // through to that door. `canGoBack` sees the same count and keeps the back
    // arrow off, since the only thing behind here is the question we skipped.
    //
    // The test is the COUNT, never the word "withdraw". Re-open the door and
    // this branch stops firing on its own.
    const doors = doorsFor(next)
    if (doors.length === 1) {
      const target = doorTarget(next, doors[0].key)
      if (target.mode) setMode(target.mode)
      setView(target.view)
    } else {
      setView("choice")
    }
    setOpen(true)
  }, [])

  const closeFlow = React.useCallback(() => setOpen(false), [])
  const ctx = React.useMemo(
    () => ({ openFlow, closeFlow, openDoor }),
    [openFlow, closeFlow, openDoor],
  )

  // Picking a door advances the SAME popup. The cash doors hand off to the
  // flows that already exist — /fund's content, rendered here since the modal
  // shipped — and the crypto doors swap the body for the wallet's own surface.
  const pickDoor = React.useCallback(
    (door: DoorKey) => {
      // `direction` is non-null whenever a chooser is on screen — that is the
      // only view that calls this — so defaulting is about types, not reality.
      const target = doorTarget(direction ?? "deposit", door)
      if (target.mode) setMode(target.mode)
      setView(target.view)
    },
    [direction],
  )

  // Back to the question. Blocked while a move is in flight for the same
  // reason a backdrop click is: leaving would hide a live status screen behind
  // a menu, and the crypto send has no server-side record to come back to.
  const backToChoice = React.useCallback(() => {
    if (inFlightRef.current) return
    // Belt and braces: the arrow is only rendered when this is true, but a
    // one-door direction has no chooser to return to and landing on one would
    // be a dead end rather than a wrong turn.
    if (!canGoBack) return
    setView("choice")
  }, [canGoBack])

  // Direction toggle: swap to the paired flow in place. Ignored while a move
  // is in flight — switching would hide a live status screen.
  const switchMode = React.useCallback((next: FlowMode) => {
    if (inFlightRef.current) return
    setMode(next)
    // Re-aim the back arrow at whichever question now matches what's on
    // screen. Only when a door was used to get here — otherwise there is
    // still nothing behind this flow. If the direction we land on has a single
    // open door, `canGoBack` hides the arrow rather than aiming it at a
    // one-row chooser, and un-hides it if the toggle comes back.
    setDirection((prev) => (prev === null ? null : MODE_DIRECTION[next]))
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

  // What the popup is called right now — its accessible name, and what Vivid
  // reports. The flows keep the labels they already had.
  const title =
    view === "choice"
      ? direction === "withdraw"
        ? "Take money out"
        : "Add money"
      : view === "receive"
        ? "Receive coins"
        : view === "send"
          ? "Send crypto"
          : FLOW_LABELS[mode]

  // Which side of the wall the money is on, for the backlight. On the choice
  // step the answer is the question itself.
  const moneyIn =
    view === "choice"
      ? direction !== "withdraw"
      : view === "receive"
        ? true
        : view === "send"
          ? false
          : mode === "buy" || mode === "fund"

  // Publish what's up so "what am I looking at?" sees the modal, not just the
  // page behind it. A flow reports exactly what it always did; the new steps
  // report `step` instead, because `direction` there would name a flow the
  // user hasn't chosen yet.
  React.useEffect(() => {
    return registerVividContext("moneyFlowModal", () =>
      open ? { openModal: title, ...(view === "flow" ? { direction: mode } : { step: view }) } : null,
    )
  }, [open, mode, view, title])

  return (
    <MoneyFlowContext.Provider value={ctx}>
      {children}

      <Dialog.Root open={open} onOpenChange={handleOpenChange} modal>
        <Dialog.Portal>
          {/* Verbatim, no local additions: the frost behind this modal is the
              frost behind every modal. See components/ui/modal-surface.ts. */}
          <Dialog.Backdrop className={MODAL_BACKDROP} />

          {/* Backlight — a direction-coloured bloom BEHIND the glass, so the
              modal reads as lit from the money's side of the wall. The wrapper
              carries the scale-in; the two tints cross-fade inside it.

              Still desktop-only, and this is the one thing `useIsMobile` is
              left doing. A 620px bloom centred on a phone spills past every
              edge of the screen, so it stops reading as light coming from
              behind the card and starts reading as a tinted screen. */}
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
                    moneyIn === (d === "in") ? "opacity-100" : "opacity-0",
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
            aria-label={title}
            className={cn(
              // The house shape: material, elevation, centring, corners, and
              // the entrance/exit animation — byte-identical to the "How this
              // works" guide and every other dialog. Everything BELOW this line
              // is size and inner layout, which modal-surface.ts deliberately
              // leaves to the caller, and is the only thing this modal is
              // allowed to have an opinion about.
              MODAL_SURFACE,

              // overflow-hidden is load-bearing: the sticky CTA footer paints a
              // solid card fill to the popup's edges, and without clipping it
              // squared off the bottom corners against the rounded top.
              "flex flex-col overflow-hidden",

              // A FIXED height, so flipping direction with the Segmented toggle
              // never resizes the card out from under a half-read screen.
              //
              // The dvh cap is what makes a fixed height survivable now that
              // the card floats in the middle instead of standing on the floor:
              // 680px + the 1rem gutter needs 712px of viewport, and plenty of
              // phones have less. Under that the card shrinks to fit and the
              // body below scrolls, which it was already built to do. The 2rem
              // matches the side gutter MODAL_SURFACE supplies, so the card
              // sits in an even margin rather than a wide one and a thin one.
              "max-h-[calc(100dvh-2rem)]",

              // The chooser and the receive step are the exceptions. Neither
              // is a flow — nothing steps, so nothing can resize under the
              // user — and a 680px slab holding them is either mostly empty
              // air (the chooser) or slightly too short, which is worse: the
              // receive panel was a hair over and every deposit ended in a
              // scroll to reach the address it exists to show.
              //
              // auto → a pixel height cannot tween, so stepping from one of
              // these into a flow SNAPS. That is the deliberate trade: a snap
              // costs one frame, a wrong height costs every frame.
              view === "choice" || view === "receive" ? "h-auto" : "h-[680px]",

              // WIDE for the two-pane terminal; MORPHS narrow when the active
              // panel is a single column (status, receive, setup).
              //
              // Both caps are breakpoint-prefixed on purpose. MODAL_SURFACE
              // sets the base `max-w-[calc(100%-2rem)]` that gives the phone
              // its gutter, and an unprefixed cap here would be a second
              // max-width fighting it for the same declaration; a variant wins
              // cleanly instead. So below 640px both morph states are simply
              // "the screen minus the gutter", which is the right answer on a
              // phone anyway. The wide state waits for `md` because 42rem is
              // wider than a 640px screen — it would eat its own gutter — and
              // keeps the full-width-minus-gutter cap in the 640–767px band.
              compact ? "sm:max-w-md" : "sm:max-w-[calc(100%-2rem)] md:max-w-2xl",

              // Only the width can actually tween between morph states (auto ↔
              // px height cannot), so the transition names it rather than using
              // transition-all, which would also try to interpolate every
              // property MODAL_SURFACE's entrance and exit animations touch.
              "transition-[max-width] duration-300 ease-out",
            )}
          >
            {/* Gold rim shimmer — a faint standing stroke with a slow glint
                walking the border. The money surface's one standing gold. */}
            <span aria-hidden className="ws-ring-shimmer" />

            {/* The direction atmosphere lives in each panel's STAGE now (see
                flow-terminal.tsx) — it swaps with the panels, so no wash is
                painted at the shell level. */}

            {/* The grabber went with the drawer. A handle on a card that
                doesn't move advertises a gesture that does nothing. */}

            {/* Master bar — the direction toggle spans the width (this modal's
                one top-level choice) with the X inline beside it. The X stays
                available even in flight: an explicit choice, unlike a stray
                backdrop tap. Both pinned above the scroll area.

                On the choice step the toggle is GONE, not merely disabled: the
                chooser is itself the top-level control, and a Deposit/Withdraw
                bar sitting above a Deposit question would be two controls
                competing to answer the same thing. The bar carries only the X
                there — the way back out of a question is to leave it. */}
            <div className="ws-casc ws-casc-0 relative flex shrink-0 items-center gap-2 px-4 pb-1 pt-4 sm:px-5">
              {canGoBack && view !== "choice" && (
                /* Deliberately not <BackAction>, which is styled identically
                   but hard-labelled "Back". SendFlow draws its own "Back" a
                   few rows below on the review step, and two controls with one
                   name in one dialog is a real problem for anyone listening to
                   it rather than looking. */
                <button
                  type="button"
                  onClick={backToChoice}
                  aria-label="Back to options"
                  title="Back to options"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-8 sm:w-8"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="h-[18px] w-[18px]" />
                </button>
              )}
              {view === "flow" ? (
                <Segmented
                  grow
                  value={mode}
                  onChange={switchMode}
                  options={mode === "buy" || mode === "sell" ? CASH_DIRECTIONS : TRADING_DIRECTIONS}
                />
              ) : (
                /* The step names itself in the body (the chooser's and each
                   crypto surface's own FlowHeader), so the bar only has to
                   hold the X out at the right edge. */
                <span className="flex-1" />
              )}
              <button
                type="button"
                onClick={closeFlow}
                aria-label="Close"
                /* 44px on touch, 36 once there's a pointer — the same pair
                   ResponsiveModal's X uses (`size-11 sm:size-9`). The glyph
                   stays 16px at both sizes; only the tap area grows. */
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </button>
            </div>

            {/* scrollbar-none: the shell is a fixed height, so a track would be
                permanent furniture on a surface that's mostly short enough not
                to need it. Wheel, trackpad, touch and keys all still scroll. */}
            <div className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
              {view === "choice" && direction && (
                <DoorChooser direction={direction} onPick={pickDoor} />
              )}

              {/* Mounted only while a crypto door is open — see crypto-doors.tsx.
                  The cost is a blank body for the 300ms exit transition after
                  closing from one of these, which is the same trade SendModal
                  already makes and the same reason: a send holds a live intent
                  and a poll, and neither may outlive the popup. */}
              {/* Wrapped: SendFlow is the heaviest panel in the app and it is
                  reached by a button with no other feedback, so a throw in it
                  used to produce an empty modal and nothing to report. */}
              {open && (view === "receive" || view === "send") && (
                <PanelErrorBoundary label={view === "send" ? "Send" : "Receive"} resetKey={view}>
                  <CryptoDoorPanel view={view} onClose={closeFlow} onInFlightChange={reportSendInFlight} />
                </PanelErrorBoundary>
              )}

              {/* `hidden` rather than unmounted: display:none takes the flows
                  out of layout (so the chooser can size the popup to itself)
                  while React keeps every panel's state, which is the whole
                  point of the stack below — a half-typed amount survives a
                  trip back to the question and out through the other door. */}
              <PanelErrorBoundary label="This screen" resetKey={mode}>
              <div className={view === "flow" ? undefined : "hidden"}>
                {/* Both sides of the pair stay mounted and stack in ONE grid
                    cell. Swapping is then a pure cross-fade between two
                    already-painted layers — no unmount, no refetch, no
                    skeleton. (Remounting on every toggle blocked the main
                    thread for ~130ms, which no amount of easing can hide.) The
                    grid row also stretches both to the same height, so the
                    shell never resizes.

                    Each mode keeps its own state, so a half-typed deposit
                    can't leak into a withdrawal — and comes back if you return
                    to it.

                    `invisible` (not just opacity-0) is load-bearing:
                    visibility inherits, so the idle panel's controls are
                    unfocusable and invisible to Vivid's target lookup, which
                    resolves by first match and would otherwise grab the wrong
                    amount field. */}
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
                            <HyperliquidFundingClient
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
              </PanelErrorBoundary>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </MoneyFlowContext.Provider>
  )
}
