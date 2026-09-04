import { describe, expect, it } from "vitest"

import { recededClass, shouldDraw, topLayer } from "@/components/ui/modal-stack"

/**
 * The rule these assert: when a flow opens the unlock dialog over its own
 * ticket, exactly one of them draws — and it is the unlock, because it is what
 * the user is being asked. The ticket stays mounted and hidden so the
 * interrupted action can resume against the state it still holds.
 */

const flow = Symbol("money-flow")
const unlock = Symbol("unlock")
const confirm = Symbol("confirm")

describe("topLayer", () => {
  it("is nothing when no modal is open", () => {
    expect(topLayer([])).toBeUndefined()
  })

  it("is the most recently opened modal", () => {
    expect(topLayer([flow, unlock])).toBe(unlock)
  })
})

describe("shouldDraw", () => {
  it("draws the only open modal", () => {
    expect(shouldDraw([flow], flow)).toBe(true)
  })

  it("draws the unlock and hides the flow beneath it", () => {
    expect(shouldDraw([flow, unlock], unlock)).toBe(true)
    expect(shouldDraw([flow, unlock], flow)).toBe(false)
  })

  it("hides every layer below the top, not just the one under it", () => {
    const open = [flow, unlock, confirm]
    expect(shouldDraw(open, confirm)).toBe(true)
    expect(shouldDraw(open, unlock)).toBe(false)
    expect(shouldDraw(open, flow)).toBe(false)
  })

  it("gives the flow back when the modal above it closes", () => {
    expect(shouldDraw([flow, unlock], flow)).toBe(false)
    expect(shouldDraw([flow], flow)).toBe(true)
  })

  /* The first commit of a newly mounted modal, before its layout effect has
     registered it. Answering "no" here would open every modal with a hidden
     frame, which is the flicker this whole mechanism exists to avoid. */
  it("draws a modal that has mounted but not registered yet", () => {
    expect(shouldDraw([flow], unlock)).toBe(true)
    expect(shouldDraw([], unlock)).toBe(true)
  })
})

describe("recededClass", () => {
  it("hides without unmounting, and takes no clicks", () => {
    expect(recededClass(false)).toContain("invisible")
    expect(recededClass(false)).toContain("pointer-events-none")
  })

  it("adds nothing to the modal that is being shown", () => {
    expect(recededClass(true)).toBe("")
  })
})
