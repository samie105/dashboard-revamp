import { describe, expect, it } from "vitest"
import { toBaseUnits, validateAddress, validateAmount } from "@/lib/crypto-wallet/address-validation"
import { generateIntertrainKey } from "@/lib/crypto-wallet/key-generation"

describe("validateAddress", () => {
  it("accepts Intertrain mainnet addresses and rejects another prefix", () => {
    const address = generateIntertrainKey().canonicalAddress
    expect(validateAddress("intertrain", address).ok).toBe(true)
    expect(validateAddress("intertrain", address.replace(/^mna1/, "sui1")).ok).toBe(false)
  })
  it("accepts a checksummed EVM address and rejects a truncated one", () => {
    expect(validateAddress("evm", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831").ok).toBe(true)
    expect(validateAddress("evm", "0xaf88d065").ok).toBe(false)
  })
  it("rejects a Solana address pasted into an EVM field", () => {
    expect(validateAddress("evm", "11111111111111111111111111111112").ok).toBe(false)
  })
  it("accepts 32-byte base58 for Solana and rejects other lengths", () => {
    expect(validateAddress("solana", "11111111111111111111111111111112").ok).toBe(true)
    expect(validateAddress("solana", "abc").ok).toBe(false)
  })
  it("trims surrounding whitespace before validating", () => {
    expect(validateAddress("evm", "  0xaf88d065e77c8cC2239327C5EDb3A432268e5831  ").ok).toBe(true)
  })
  it("requires a value", () => {
    expect(validateAddress("evm", "").ok).toBe(false)
  })
})

describe("toBaseUnits", () => {
  it("converts without float drift", () => {
    expect(toBaseUnits("1.000000000000000001", 18)).toBe("1000000000000000001")
    expect(toBaseUnits("0.1", 6)).toBe("100000")
  })
  it("rejects more fraction digits than the asset has", () => {
    expect(toBaseUnits("0.1234567", 6)).toBeNull()
  })
  it("rejects malformed input", () => {
    for (const bad of ["", ".", "1.", "1..2", "1e5", "-1", "abc"]) expect(toBaseUnits(bad, 6)).toBeNull()
  })
})

describe("validateAmount", () => {
  it("rejects zero", () => {
    expect(validateAmount({ amount: "0", decimals: 6 }).ok).toBe(false)
  })
  it("rejects amounts above the available balance via BigInt compare", () => {
    expect(validateAmount({ amount: "2", decimals: 6, availableBaseUnits: "1500000" }).ok).toBe(false)
    expect(validateAmount({ amount: "1.5", decimals: 6, availableBaseUnits: "1500000" }).ok).toBe(true)
  })
})
