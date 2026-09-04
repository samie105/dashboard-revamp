import { describe, expect, it } from "vitest"

import { generateIntertrainKey } from "../key-generation"

describe("Intertrain wallet key generation", () => {
  it("creates a mainnet mna bech32m WSK address from an ed25519 key", () => {
    const generated = generateIntertrainKey()

    expect(generated.family).toBe("intertrain")
    expect(generated.algorithm).toBe("ed25519")
    expect(generated.secretKey).toHaveLength(32)
    expect(generated.publicKey).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(generated.canonicalAddress).toMatch(/^mna1[023456789acdefghjklmnpqrstuvwxyz]+$/)
  })

  it("generates distinct accounts", () => {
    expect(generateIntertrainKey().canonicalAddress).not.toBe(generateIntertrainKey().canonicalAddress)
  })
})
