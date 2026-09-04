import { describe, expect, it } from "vitest"

import {
  backdropHiddenClass,
  shouldPaintBackdrop,
  topLayer,
} from "@/components/ui/modal-stack"

/**
 * The rule: when a flow opens the unlock dialog over its own ticket, exactly
 * one frost is painted — the top dialog's. Two backdrops compose to a muddy
 * 0.70 and blur twice.
 *
 * The rule underneath that one, which these tests exist to lock down: this
 * registry may only ever remove DECORATION. An earlier version hid the popups
 * underneath too, and any bookkeeping slip then hid a modal the user was
 * trying to open — a failure indistinguishable from a dead button. Nothing
 * here may ever return a value that hides content.
 */

const flow = Symbol("money-flow")
const unlock = Symbol("unlock")
const confirm = Symbol("confirm")

describe("topLayer", () => {
  it("is nothing when no dialog is open", () => {
    expect(topLayer([])).toBeUndefined()
  })

  it("is the most recently opened dialog", () => {
    expect(topLayer([flow, unlock])).toBe(unlock)
  })
})

describe("shouldPaintBackdrop", () => {
  it("paints for the only open dialog", () => {
    expect(shouldPaintBackdrop([flow], flow)).toBe(true)
  })

  it("gives the frost to the unlock and takes it from the flow beneath", () => {
    expect(shouldPaintBackdrop([flow, unlock], unlock)).toBe(true)
    expect(shouldPaintBackdrop([flow, unlock], flow)).toBe(false)
  })

  it("leaves exactly one frost however deep the stack goes", () => {
    const open = [flow, unlock, confirm]
    const painting = open.filter((id) => shouldPaintBackdrop(open, id))
    expect(painting).toEqual([confirm])
  })

  it("gives the frost back when the dialog above closes", () => {
    expect(shouldPaintBackdrop([flow, unlock], flow)).toBe(false)
    expect(shouldPaintBackdrop([flow], flow)).toBe(true)
  })

  /* The first commit of a newly mounted dialog, before its layout effect has
     registered it. Answering "no" would open every modal with one un-frosted
     frame. */
  it("paints for a dialog that has mounted but not registered yet", () => {
    expect(shouldPaintBackdrop([flow], unlock)).toBe(true)
    expect(shouldPaintBackdrop([], unlock)).toBe(true)
  })
})

describe("backdropHiddenClass", () => {
  it("hides a backdrop that isn't the top one", () => {
    expect(backdropHiddenClass(false)).toBe("hidden")
  })

  it("adds nothing for the dialog that owns the frost", () => {
    expect(backdropHiddenClass(true)).toBe("")
  })

  /* The guard rail. These are the only two values this module may produce, and
     neither may ever be applied to a popup — see the module docblock. */
  it("only ever emits a backdrop-safe class, never one that hides content", () => {
    expect([backdropHiddenClass(true), backdropHiddenClass(false)]).toEqual(["", "hidden"])
    expect(backdropHiddenClass(false)).not.toContain("invisible")
    expect(backdropHiddenClass(false)).not.toContain("opacity")
  })
})
