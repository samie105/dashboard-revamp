import { describe, expect, it } from "vitest"

import {
  CASH_DEPOSITS_CLOSED,
  CASH_WITHDRAWALS_CLOSED,
  doorsFor,
} from "@/components/flows/money-doors"

/**
 * The rule: a shut cash door must not appear on any chooser, in either
 * direction. The count matters as much as the contents — the money-flow modal
 * skips the question entirely when only one door is open, so a door that leaks
 * back onto the list doesn't just add a row, it re-introduces a question the
 * product decided not to ask.
 */

describe("doorsFor", () => {
  it("never offers the Dollar Account while cash deposits are shut", () => {
    const keys = doorsFor("deposit").map((door) => door.key)
    expect(CASH_DEPOSITS_CLOSED).toBe(true)
    expect(keys).not.toContain("cash")
    expect(keys).toEqual(["crypto"])
  })

  it("never offers the Dollar Account while cash withdrawals are shut", () => {
    const keys = doorsFor("withdraw").map((door) => door.key)
    expect(CASH_WITHDRAWALS_CLOSED).toBe(true)
    expect(keys).not.toContain("cash")
    expect(keys).toEqual(["crypto"])
  })

  /* One open door means the modal walks straight through instead of drawing a
     one-row chooser. That behaviour keys off the length, so assert it. */
  it("leaves one door in each direction, so no chooser is drawn", () => {
    expect(doorsFor("deposit")).toHaveLength(1)
    expect(doorsFor("withdraw")).toHaveLength(1)
  })

  it("still describes the crypto door in both directions", () => {
    expect(doorsFor("deposit")[0].title).toBeTruthy()
    expect(doorsFor("withdraw")[0].title).toBeTruthy()
  })
})
