import { describe, it, expect } from "vitest"
import { orderCopy, orderTone } from "@/components/trade/order-placed-modal"

/* The confirmation and the ticket's inline line read from this one map, so
   these assertions are what stops the two surfaces drifting into describing
   the same intent in different words. */

describe("orderCopy", () => {
  it("says placed — never filled — while the intent is still working", () => {
    for (const status of [undefined, "created", "awaiting_signature", "submitted"]) {
      const { title, body } = orderCopy(status, "TRUMP")
      expect(title).toBe("Order placed")
      expect(body).toMatch(/few seconds/i)
      // The one lie this screen must not tell.
      expect(title.toLowerCase()).not.toContain("filled")
    }
  })

  it("claims a fill only on confirmed", () => {
    expect(orderCopy("confirmed", "TRUMP").title).toBe("Order filled")
    expect(orderCopy("confirmed", "TRUMP").body).toContain("TRUMP")
  })

  it("states that nothing moved when the order fails or expires", () => {
    expect(orderCopy("failed", "TRUMP").body).toMatch(/nothing left your wallet/i)
    expect(orderCopy("expired", "TRUMP").body).toMatch(/nothing was traded/i)
  })

  it("never calls the order a swap — that is our plumbing, not the user's act", () => {
    for (const status of [undefined, "confirmed", "failed", "expired"]) {
      const { title, body } = orderCopy(status, "TRUMP")
      expect(`${title} ${body}`.toLowerCase()).not.toContain("swap")
    }
  })

  it("degrades to a generic noun rather than an empty gap for a missing symbol", () => {
    expect(orderCopy("confirmed", "").body).not.toContain("Your  balance")
  })
})

describe("orderTone", () => {
  it("maps the lifecycle onto the three visual states", () => {
    expect(orderTone(undefined)).toBe("working")
    expect(orderTone("submitted")).toBe("working")
    expect(orderTone("confirmed")).toBe("done")
    expect(orderTone("failed")).toBe("failed")
    expect(orderTone("expired")).toBe("failed")
  })

  it("treats an unrecognised status as still working, never as done", () => {
    expect(orderTone("something-new-from-the-backend")).toBe("working")
  })
})
