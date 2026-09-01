import { describe, expect, it } from "vitest"

import { passphraseStrength } from "@/lib/crypto-wallet/passphrase-strength"

describe("passphraseStrength", () => {
  it("floors anything under the 12-character minimum, however varied", () => {
    expect(passphraseStrength("")).toEqual({ score: 0, label: "Too short" })
    expect(passphraseStrength("Sh0rt!")).toEqual({ score: 0, label: "Too short" })
    // 11 characters, all four classes — still under the floor setup enforces.
    expect(passphraseStrength("Ab3$efghijk")).toEqual({ score: 0, label: "Too short" })
  })

  it("scores a bare 12-character passphrase weak", () => {
    expect(passphraseStrength("abcdefghijkl")).toEqual({ score: 1, label: "Weak" })
  })

  it("adds a point for three character classes, or for sheer length", () => {
    // 12 characters, lower + upper + digit.
    expect(passphraseStrength("abcdefghijK1")).toEqual({ score: 2, label: "Good" })
    // 20 characters, one class — length alone earns the same rung.
    expect(passphraseStrength("abcdefghijklmnopqrst")).toEqual({ score: 2, label: "Good" })
  })

  it("reserves Strong for length AND variety together", () => {
    // 16 characters with three classes.
    expect(passphraseStrength("abcdefghijklmnO1")).toEqual({ score: 3, label: "Strong" })
    expect(passphraseStrength("correct horse Battery staple 9")).toEqual({ score: 3, label: "Strong" })
    // 18 characters but a single class: long, not strong.
    expect(passphraseStrength("abcdefghijklmnopqr")).toEqual({ score: 1, label: "Weak" })
  })

  it("measures the trimmed passphrase, matching what setup enforces", () => {
    // 14 characters as typed, 10 once trimmed — wallet-setup.ts trims before
    // its length check, so the meter must not promise a passphrase it rejects.
    expect(passphraseStrength("  abcdefghij  ")).toEqual({ score: 0, label: "Too short" })
    expect(passphraseStrength("            ")).toEqual({ score: 0, label: "Too short" })
  })
})
