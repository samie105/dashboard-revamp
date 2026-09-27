import { describe, expect, it } from "vitest"

import {
  FIAT_CONFIG_AVAILABLE,
  FIAT_CONFIG_BLOCKED,
  FIAT_CONFIG_DISABLED,
  FIAT_CONFIG_DISCOVERY_ONLY,
} from "@/lib/crypto-backend/__fixtures__/fiat"
import {
  isBridgeFednowAvailable,
  isBridgeVirtualAccountAvailable,
  isBridgeWithdrawalAvailable,
  isMoneyMovementAvailable,
  isOnswitchOfframpAvailable,
  isOnswitchOnrampAvailable,
  onswitchCorridors,
} from "@/lib/crypto-backend/fiat-capabilities"
import type { FiatCapabilitySnapshot } from "@/lib/crypto-backend/types"

/**
 * Guide §5 capability gating (docs/fiat-frontend-integration-guide.md lines
 * 368-381) plus the CP2 composite gate: top-level availability "available"
 * AND enabled AND provider status "available" AND readiness
 * operationAvailable AND corridor enabled AND walletReady asset route.
 */

const clone = (): FiatCapabilitySnapshot => JSON.parse(JSON.stringify(FIAT_CONFIG_AVAILABLE))

/** Every money-moving action the UI could offer. */
function moneyMovingActions(config: FiatCapabilitySnapshot | undefined) {
  return {
    onswitchOnramp: isOnswitchOnrampAvailable(config),
    onswitchOfframp: isOnswitchOfframpAvailable(config),
    bridgeVirtualAccount: isBridgeVirtualAccountAvailable(config),
    bridgeWithdrawal: isBridgeWithdrawalAvailable(config),
    onrampCorridors: onswitchCorridors(config, "onramp").length > 0,
    offrampCorridors: onswitchCorridors(config, "offramp").length > 0,
  }
}

const ALL_OFF = {
  onswitchOnramp: false,
  onswitchOfframp: false,
  bridgeVirtualAccount: false,
  bridgeWithdrawal: false,
  onrampCorridors: false,
  offrampCorridors: false,
}

describe("top-level availability — every §5 status", () => {
  it("available: every action on the guide's example config is allowed", () => {
    expect(isMoneyMovementAvailable(FIAT_CONFIG_AVAILABLE)).toBe(true)
    expect(moneyMovingActions(FIAT_CONFIG_AVAILABLE)).toEqual({
      onswitchOnramp: true,
      onswitchOfframp: true,
      bridgeVirtualAccount: true,
      bridgeWithdrawal: true,
      onrampCorridors: true,
      offrampCorridors: true,
    })
  })

  it("disabled: every money-moving action is unavailable (line 370)", () => {
    expect(isMoneyMovementAvailable(FIAT_CONFIG_DISABLED)).toBe(false)
    expect(moneyMovingActions(FIAT_CONFIG_DISABLED)).toEqual(ALL_OFF)
  })

  it("blocked: every money-moving action is unavailable even though providers look green (line 371)", () => {
    // FIAT_CONFIG_BLOCKED keeps enabled=true and every provider "available";
    // only the top-level availability says blocked.
    expect(FIAT_CONFIG_BLOCKED.enabled).toBe(true)
    expect(FIAT_CONFIG_BLOCKED.providers.onswitch.status).toBe("available")
    expect(moneyMovingActions(FIAT_CONFIG_BLOCKED)).toEqual(ALL_OFF)
  })

  it("discovery_only: no money-moving buttons (line 372)", () => {
    expect(moneyMovingActions(FIAT_CONFIG_DISCOVERY_ONLY)).toEqual(ALL_OFF)
  })

  it("enabled=false blocks everything even if availability says available", () => {
    const config = clone()
    config.enabled = false
    expect(moneyMovingActions(config)).toEqual(ALL_OFF)
  })

  it("no config yet (loading/error): everything off", () => {
    expect(moneyMovingActions(undefined)).toEqual(ALL_OFF)
  })
})

describe("provider-level status — unavailable hides that rail only (line 374)", () => {
  it("bridge unavailable: Bridge actions off, OnSwitch still offered", () => {
    const config = clone()
    config.providers.bridge.status = "unavailable"
    const actions = moneyMovingActions(config)
    expect(actions.bridgeVirtualAccount).toBe(false)
    expect(actions.bridgeWithdrawal).toBe(false)
    expect(actions.onswitchOnramp).toBe(true)
  })

  it("onswitch unavailable: OnSwitch actions off, Bridge still offered", () => {
    const config = clone()
    config.providers.onswitch.status = "unavailable"
    const actions = moneyMovingActions(config)
    expect(actions.onswitchOnramp).toBe(false)
    expect(actions.onrampCorridors).toBe(false)
    expect(actions.bridgeVirtualAccount).toBe(true)
  })

  it.each(["disabled", "blocked", "discovery_only"] as const)("provider status %s turns that provider off", (status) => {
    const config = clone()
    config.providers.onswitch.status = status
    expect(isOnswitchOnrampAvailable(config)).toBe(false)
  })

  it("readiness.operationAvailable=false turns the provider off", () => {
    const config = clone()
    config.readiness.providers.bridge.operationAvailable = false
    expect(isBridgeVirtualAccountAvailable(config)).toBe(false)
    expect(isBridgeWithdrawalAvailable(config)).toBe(false)
  })

  it("direction flags gate onramp and offramp independently", () => {
    const config = clone()
    config.providers.onswitch.directions.offrampEnabled = false
    expect(isOnswitchOnrampAvailable(config)).toBe(true)
    expect(isOnswitchOfframpAvailable(config)).toBe(false)
    expect(onswitchCorridors(config, "offramp")).toEqual([])
  })

  it("a Bridge route with status other than available is off", () => {
    const config = clone()
    config.providers.bridge.routes[0].status = "blocked"
    expect(isBridgeVirtualAccountAvailable(config)).toBe(false)
    expect(isBridgeWithdrawalAvailable(config)).toBe(true)
  })

  it("Bridge account flags gate virtual accounts and withdrawals", () => {
    const config = clone()
    config.providers.bridge.account.virtualAccountsEnabled = false
    config.providers.bridge.account.withdrawalsEnabled = false
    expect(isBridgeVirtualAccountAvailable(config)).toBe(false)
    expect(isBridgeWithdrawalAvailable(config)).toBe(false)
  })
})

describe("corridor + walletReady asset route both required (lines 375-377)", () => {
  it("returns every enabled coverage item for the direction with the wallet-ready routes", () => {
    const corridors = onswitchCorridors(FIAT_CONFIG_AVAILABLE, "onramp")
    expect(corridors.map((c) => c.coverage.countryCode)).toEqual(["NG", "GH"])
    expect(corridors[0].assetRoutes.map((r) => r.localNetworkId)).toEqual(["ethereum-mainnet"])
  })

  it("drops a disabled coverage item", () => {
    const config = clone()
    config.providers.onswitch.coverage[1].enabled = false
    expect(onswitchCorridors(config, "onramp").map((c) => c.coverage.countryCode)).toEqual(["NG"])
  })

  it("drops a coverage item that doesn't list the direction", () => {
    const config = clone()
    config.providers.onswitch.coverage[0].directions = ["onramp"]
    expect(onswitchCorridors(config, "offramp").map((c) => c.coverage.countryCode)).toEqual(["GH"])
  })

  it("no corridors when no asset route is walletReady", () => {
    const config = clone()
    config.assetRoutes[0].walletReady = false
    config.assetRoutes[0].status = "wallet_capability_missing"
    expect(onswitchCorridors(config, "onramp")).toEqual([])
  })

  it("no corridors for a direction the asset route doesn't support", () => {
    const config = clone()
    config.assetRoutes[0].offrampSupported = false
    expect(onswitchCorridors(config, "onramp")).toHaveLength(2)
    expect(onswitchCorridors(config, "offramp")).toEqual([])
  })

  it("no corridors when top-level is blocked, even with enabled coverage and wallet-ready routes", () => {
    expect(onswitchCorridors(FIAT_CONFIG_BLOCKED, "onramp")).toEqual([])
  })
})

describe("fednow (guide §10.3)", () => {
  it("is hidden until the backend confirms how it is signalled (open question)", () => {
    expect(isBridgeFednowAvailable(FIAT_CONFIG_AVAILABLE)).toBe(false)
  })
})
