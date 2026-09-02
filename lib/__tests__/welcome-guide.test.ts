import { describe, expect, it } from "vitest"

import { WELCOME_GUIDE_KEY, WELCOME_SEEN_PREFIX, welcomeSeenKey, welcomeGuideSurfaces } from "@/lib/welcome-guide"

const ready = {
  eligible: true,
  ceremonyVisible: false,
  seenLocally: false,
  seenOnProfile: false,
}

describe("welcomeSeenKey", () => {
  it("keys the showing per user under the ws: convention", () => {
    expect(welcomeSeenKey("user_1")).toBe(`${WELCOME_SEEN_PREFIX}user_1`)
    expect(welcomeSeenKey(undefined)).toBe(`${WELCOME_SEEN_PREFIX}anonymous`)
  })

  it("names the profile flag the server stores", () => {
    expect(WELCOME_GUIDE_KEY).toBe("crypto-wallet")
  })
})

describe("welcomeGuideSurfaces", () => {
  it("shows once for a signed-in user who has never seen it", () => {
    expect(welcomeGuideSurfaces(ready)).toEqual({ guide: true })
  })

  it("stays away when the crypto wallet is switched off for this account", () => {
    expect(welcomeGuideSurfaces({ ...ready, eligible: false })).toEqual({ guide: false })
  })

  /* The guide's whole audience is people who have never done this before,
     and they arrive with no wallet. Greeting them only after they have
     already worked out the setup ceremony is greeting them too late — which
     is what an earlier `walletReady` condition did. */
  it("greets a newcomer who has not made a wallet yet", () => {
    expect(welcomeGuideSurfaces(ready)).toEqual({ guide: true })
  })

  it("waits for the setup ceremony to leave the screen", () => {
    expect(welcomeGuideSurfaces({ ...ready, ceremonyVisible: true })).toEqual({ guide: false })
  })

  it("does not show again on this device", () => {
    expect(welcomeGuideSurfaces({ ...ready, seenLocally: true })).toEqual({ guide: false })
  })

  // The durable half: a new device has an empty localStorage, and the profile
  // is what stops the guide greeting a two-year user all over again.
  it("does not show again on a fresh device once the profile records it", () => {
    expect(welcomeGuideSurfaces({ ...ready, seenOnProfile: true })).toEqual({ guide: false })
  })

  it("holds off while either store is still unknown", () => {
    expect(welcomeGuideSurfaces({ ...ready, seenLocally: "unknown" })).toEqual({ guide: false })
    expect(welcomeGuideSurfaces({ ...ready, seenOnProfile: "unknown" })).toEqual({ guide: false })
  })
})
