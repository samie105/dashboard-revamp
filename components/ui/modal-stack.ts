"use client"

/**
 * One modal on screen at a time.
 *
 * Several flows interrupt themselves to ask for something: the deposit ticket
 * needs the wallet unlocked, the send review needs a fresh verification, the
 * swap needs a PIN before it will sign. Each of those opens
 * `WalletUnlockDialog` while its own modal is still open, and the result was
 * two cards stacked with the lower one showing round the edges of the upper,
 * under two backdrops — so the frost doubled and the whole screen went muddy.
 * It reads as a mistake even though every individual modal is correct.
 *
 * Closing the lower modal first is not an option: it owns the flow's state
 * (the amount typed, the network picked, the intent already created), and the
 * unlock exists precisely so the interrupted action can RESUME. Unmounting it
 * would throw away the thing the user is in the middle of.
 *
 * So the lower modal stays mounted and stops being drawn. This registry tracks
 * which modals are open, in the order they opened, and tells each one whether
 * it is the top. Anything below the top renders `invisible` — still in the
 * DOM, state intact, but painting nothing, taking no clicks, and out of both
 * the accessibility tree and the tab order, which is what `visibility: hidden`
 * buys over an opacity fade. Its backdrop hides with it, so exactly one frost
 * is on screen however deep the stack goes.
 *
 * MOUNT IS OPEN, for most callers. Base UI unmounts `Dialog.Portal` when a
 * dialog closes and nothing in this app passes `keepMounted`, so registering
 * on mount tracks open/closed exactly and no component has to thread an `open`
 * prop down to its content. `MoneyFlowProvider` is the exception and says so.
 */

import * as React from "react"

/* ── The decision, as pure functions ──────────────────────────────────────
   Kept separate from the store so the ordering rules can be asserted without
   mounting React — the same reason lib/dashboard-cards.ts exists. */

/** The layer that should be drawn: the most recently opened one. */
export function topLayer<T>(stack: readonly T[]): T | undefined {
  return stack.length > 0 ? stack[stack.length - 1] : undefined
}

/**
 * Should `id` draw, given the currently open layers?
 *
 * An id that is not in the stack draws. That is not a fallback — it is the
 * first commit of a modal that has mounted but whose layout effect has not run
 * yet, and answering "no" there would open every modal with a hidden frame.
 */
export function shouldDraw<T>(stack: readonly T[], id: T): boolean {
  if (!stack.includes(id)) return true
  return topLayer(stack) === id
}

/** `visibility: hidden` for every layer below the top, nothing for the top. */
export function recededClass(isTop: boolean): string {
  return isTop ? "" : "invisible pointer-events-none"
}

/* ── The store ────────────────────────────────────────────────────────── */

/** Open modals, oldest first. The last one is the one the user can see. */
let stack: symbol[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function snapshot() {
  return stack
}

/** Test seam: the stack is module state, so a test has to be able to reset it. */
export function resetModalStack() {
  stack = []
  emit()
}

/**
 * Whether this modal is the top of the stack, and so the one to draw.
 *
 * Call it from the component that renders the popup. It registers for as long
 * as that component is mounted, which is the whole story for anything built on
 * `ResponsiveModalContent`.
 *
 * @param open Pass this only when the calling component OUTLIVES its own
 *   dialog. `MoneyFlowProvider` wraps the app and renders its `Dialog.Root`
 *   unconditionally, so without it that modal would hold the top slot forever
 *   and every later modal would think something was above it.
 */
export function useIsTopModal(open = true): boolean {
  /* One identity per instance. A ref rather than `useId` because the value has
     to be stable across re-renders AND unique per mount, and it is only ever
     compared by identity. */
  const idRef = React.useRef<symbol | null>(null)
  if (idRef.current === null) idRef.current = Symbol("modal-layer")
  const id = idRef.current

  /* Layout effect, not effect: this runs before the browser paints, so a modal
     opening on top of another never gets a frame where both are drawn. */
  React.useLayoutEffect(() => {
    if (!open) return
    stack = [...stack, id]
    emit()
    return () => {
      stack = stack.filter((entry) => entry !== id)
      emit()
    }
  }, [id, open])

  const current = React.useSyncExternalStore(subscribe, snapshot, () => EMPTY)

  /* A closed dialog draws nothing, so the answer cannot matter — but it must
     not be `false`, or a caller applying the class unconditionally would hide
     content that is outside the dialog. */
  if (!open) return true
  return shouldDraw(current, id)
}

/** Server render has no open modals, and the snapshot must be referentially
 *  stable or useSyncExternalStore re-renders forever. */
const EMPTY: readonly symbol[] = []
