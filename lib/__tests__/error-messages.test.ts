import { describe, it, expect } from "vitest"
import { humanizeErrorMessage } from "@/lib/crypto-backend/error-messages"

describe("humanizeErrorMessage", () => {
  it("turns the live rent failure into the sentence the user needs", () => {
    // What was on screen: Something went wrong. {"InsufficientFundsForRent":…}
    expect(humanizeErrorMessage('{"InsufficientFundsForRent":{"account_index":0}}')).toBe(
      "Insufficient funds for gas",
    )
  })

  it("reads the same failure in its other spellings", () => {
    expect(humanizeErrorMessage("Transfer: insufficient lamports 1642804, need 2039280")).toBe(
      "Insufficient funds for gas",
    )
    expect(humanizeErrorMessage("insufficient funds for gas * price + value")).toBe(
      "Insufficient funds for gas",
    )
  })

  it("names a slippage failure rather than its hex code", () => {
    expect(humanizeErrorMessage("custom program error: 0x1771")).toMatch(/price moved/i)
  })

  it("withholds any payload it does not recognise", () => {
    const raw = '{"InstructionError":[3,{"Custom":6023}]}'
    const message = humanizeErrorMessage(raw)
    expect(message).not.toContain("InstructionError")
    expect(message).not.toContain("{")
    expect(message).toMatch(/network rejected/i)
  })

  it("passes a real sentence through untouched", () => {
    const written =
      "Not enough SOL to cover network fees and account rent — about 0.0004 SOL short."
    expect(humanizeErrorMessage(written)).toBe(written)
  })

  it("never returns an empty string", () => {
    expect(humanizeErrorMessage("")).toBeTruthy()
    expect(humanizeErrorMessage(null)).toBeTruthy()
    expect(humanizeErrorMessage(undefined)).toBeTruthy()
  })

  it("shows no JSON for any of the shapes a chain actually emits", () => {
    const payloads = [
      '{"InsufficientFundsForRent":{"account_index":0}}',
      '{"InstructionError":[0,{"Custom":1}]}',
      "0x1771",
      '["BlockhashNotFound"]',
    ]
    for (const payload of payloads) {
      const message = humanizeErrorMessage(payload)
      expect(message).not.toMatch(/[{}[\]]|"[A-Za-z]+":/)
    }
  })
})
