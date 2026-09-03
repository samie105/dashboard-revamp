import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearUnlockedWalletState,
  getUnlockedWalletState,
  setUnlockedWalletState,
  touchUnlockedWalletState,
  WALLET_UNLOCK_IDLE_TIMEOUT_MS,
  WALLET_UNLOCK_MAX_LIFETIME_MS,
} from "../unlock-state"

describe("local wallet unlock session", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { clearUnlockedWalletState(); vi.useRealTimers() })

  it("keeps the DEK in memory and expires after the idle window", () => {
    const dek = new Uint8Array([1, 2, 3])
    setUnlockedWalletState("user", "wallet", dek, 1_000, 10_000)
    dek.fill(0)
    expect(getUnlockedWalletState("user", "wallet")?.dek).toEqual(new Uint8Array([1, 2, 3]))
    vi.advanceTimersByTime(1_001)
    expect(getUnlockedWalletState("user", "wallet")).toBeUndefined()
  })

  it("touches activity without extending the absolute lifetime", () => {
    setUnlockedWalletState("user", "wallet", new Uint8Array([7]), WALLET_UNLOCK_IDLE_TIMEOUT_MS, 2_000)
    vi.advanceTimersByTime(1_500)
    expect(touchUnlockedWalletState("user", "wallet")).toBe(true)
    vi.advanceTimersByTime(600)
    expect(getUnlockedWalletState("user", "wallet")).toBeUndefined()
  })

  it("uses the 30 minute idle and 24 hour maximum defaults", () => {
    setUnlockedWalletState("user", "wallet", new Uint8Array([9]))
    vi.advanceTimersByTime(WALLET_UNLOCK_IDLE_TIMEOUT_MS + 1)
    expect(getUnlockedWalletState("user", "wallet")).toBeUndefined()

    setUnlockedWalletState("user", "wallet", new Uint8Array([9]), WALLET_UNLOCK_MAX_LIFETIME_MS * 2, WALLET_UNLOCK_MAX_LIFETIME_MS)
    vi.advanceTimersByTime(WALLET_UNLOCK_MAX_LIFETIME_MS + 1)
    expect(getUnlockedWalletState("user", "wallet")).toBeUndefined()
  })
})
