"use client"

/**
 * One frost, however many dialogs are open.
 *
 * When a flow interrupts itself to ask for something — the deposit ticket
 * needs the wallet unlocked, the send review needs a fresh verification — two
 * dialogs are open at once, and each Base UI dialog draws its own backdrop.
 * Two `bg-black/45` layers compose to about 0.70 and two `backdrop-blur-md`
 * passes stack, so the page behind goes muddy and the whole screen reads as a
 * mistake even though every individual modal is correct.
 *
 * So only the top dialog paints a backdrop. The ones below suppress theirs and
 * are otherwise untouched.
 *
 * ── Why this does NOT hide the modals underneath ──────────────────────────
 * It used to. The lower dialog rendered `invisible`, which gave a true
 * one-at-a-time stack and looked right — until it didn't. Any bookkeeping
 * error, any dialog that legitimately opened and stayed open off-screen, and
 * the mechanism hides a modal the user is actively trying to open. That
 * failure is indistinguishable from a dead button, it was intermittent, and it
 * cost real debugging time twice: the withdraw flow and the dashboard's
 * overflow menu both "stopped opening".
 *
 * The rule that replaced it: this registry may only ever REMOVE decoration,
 * never hide content. Worst case now, if the stack is ever wrong, a dialog
 * renders without a frost behind it — cosmetic, self-evident, and not a
 * blocked user. Correctness of what's on screen outranks the polish of what's
 * behind it.
 */

import * as React from "react"

/* ── The decision, as pure functions ──────────────────────────────────── */

/** The dialog that should paint the backdrop: the most recently opened one. */
export function topLayer<T>(stack: readonly T[]): T | undefined {
  return stack.length > 0 ? stack[stack.length - 1] : undefined
}

/**
 * Should `id` paint its backdrop?
 *
 * An id that is not in the stack paints. That is the first commit of a dialog
 * that has mounted but whose layout effect has not run yet, and answering "no"
 * would open every modal with one un-frosted frame.
 */
export function shouldPaintBackdrop<T>(stack: readonly T[], id: T): boolean {
  if (!stack.includes(id)) return true
  return topLayer(stack) === id
}

/** Suppresses a backdrop. Applied to the BACKDROP only — never to a popup. */
export function backdropHiddenClass(paints: boolean): string {
  return paints ? "" : "hidden"
}

/* ── The store ────────────────────────────────────────────────────────── */

/** Open dialogs, oldest first. The last one owns the frost. */
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

/** Server render has no open dialogs, and the snapshot must be referentially
 *  stable or useSyncExternalStore re-renders forever. */
const EMPTY: readonly symbol[] = []

/**
 * Whether this dialog owns the backdrop.
 *
 * Call it from the component that renders the popup. It registers for as long
 * as that component is mounted, which is the whole story for anything built on
 * `ResponsiveModalContent` — Base UI unmounts the portal on close.
 *
 * @param open Pass this only when the calling component OUTLIVES its own
 *   dialog. `MoneyFlowProvider` wraps the app and renders its `Dialog.Root`
 *   unconditionally, so without it that dialog would hold the frost forever.
 */
export function useOwnsBackdrop(open = true): boolean {
  /* One identity per instance. A ref rather than `useId` because the value has
     to be stable across re-renders AND unique per mount, and it is only ever
     compared by identity. */
  const idRef = React.useRef<symbol | null>(null)
  if (idRef.current === null) idRef.current = Symbol("modal-layer")
  const id = idRef.current

  /* Layout effect, not effect: this runs before the browser paints, so a
     dialog opening on top of another never shows a doubled frost for a frame. */
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

  if (!open) return true
  return shouldPaintBackdrop(current, id)
}
