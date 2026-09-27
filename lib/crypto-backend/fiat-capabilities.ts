/**
 * Fiat capability gating (CP2). Pure functions over a
 * FiatCapabilitySnapshot; screens compose these instead of poking
 * the snapshot directly.
 *
 * Guide §5 (docs/fiat-frontend-integration-guide.md lines 207-381) says
 * every money-moving screen starts with GET /fiat/config and must
 * derive corridor/asset/direction/channel selectors from the response.
 * The status enum for `availability` (line 369):
 *
 *   disabled       Hide or disable fiat actions. The global switch is
 *                  off or the provider is not enabled.
 *   blocked        Show a non-actionable "temporarily unavailable"
 *                  state. Do not allow quote/order creation.
 *   discovery_only Read-only capability discovery is available; do not
 *                  show money-moving buttons.
 *   available      The corresponding action may be shown, subject to
 *                  customer, beneficiary, wallet, corridor, and asset
 *                  checks.
 *   unavailable    Hide the affected provider route and offer another
 *                  available rail if one exists.
 *
 * "availability is not a guarantee that every corridor works. A
 * specific OnSwitch coverage item and a specific assetRoutes item
 * must both be enabled and wallet-ready before showing a quote
 * action." (guide lines 375-377)
 *
 * The CP2 checklist adds the composite gate: top-level
 * availability === "available" AND enabled AND provider status
 * "available" AND readiness.providers[x].operationAvailable AND
 * corridor enabled AND asset route walletReady for the direction.
 * `blocked`, `disabled` or `discovery_only` top-level blocks every
 * money-moving action even when a provider looks green.
 */

import type { FiatCapabilitySnapshot } from "./types"

/** Top-level gate — nothing money-moving is allowed unless this is true. */
export function isMoneyMovementAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  if (!config) return false
  return config.enabled === true && config.availability === "available"
}

export function isOnswitchProviderAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  if (!isMoneyMovementAvailable(config) || !config) return false
  const provider = config.providers.onswitch
  const readiness = config.readiness.providers.onswitch
  return provider.status === "available" && readiness.operationAvailable === true
}

export function isBridgeProviderAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  if (!isMoneyMovementAvailable(config) || !config) return false
  const provider = config.providers.bridge
  const readiness = config.readiness.providers.bridge
  return provider.status === "available" && readiness.operationAvailable === true
}

export function isOnswitchOnrampAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  if (!isOnswitchProviderAvailable(config) || !config) return false
  return config.providers.onswitch.directions.onrampEnabled === true
}

export function isOnswitchOfframpAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  if (!isOnswitchProviderAvailable(config) || !config) return false
  return config.providers.onswitch.directions.offrampEnabled === true
}

export function isBridgeVirtualAccountAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  if (!isBridgeProviderAvailable(config) || !config) return false
  const route = config.providers.bridge.routes.find(
    (r) => r.direction === "onramp" && r.accountType === "virtual_account",
  )
  if (!route || route.status !== "available") return false
  return config.providers.bridge.account.virtualAccountsEnabled === true
}

export function isBridgeWithdrawalAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  if (!isBridgeProviderAvailable(config) || !config) return false
  const route = config.providers.bridge.routes.find(
    (r) => r.direction === "offramp" && r.accountType === "external_bank_account",
  )
  if (!route || route.status !== "available") return false
  return config.providers.bridge.account.withdrawalsEnabled === true
}

/**
 * Guide §10.3: "Only render fednow when the capability response and
 * account configuration make it available."
 *
 * The illustrative §5 config does not carry an inline `fednow` flag,
 * and the guide gives no example of where it appears. Returning
 * `false` here is the conservative default; CP8 revisits when the
 * backend team confirms the shape (open question in
 * `docs/FIAT_RAMP_CONTEXT.md`).
 */
export function isBridgeFednowAvailable(
  config: FiatCapabilitySnapshot | undefined,
): boolean {
  // TODO(CP8, open question): confirm how fednow enablement is signalled
  // in /fiat/config with the backend team. Until then this always returns
  // false so we can't accidentally render an unsupported channel.
  void config
  return false
}

export interface OnswitchCorridorMatch {
  coverage: FiatCapabilitySnapshot["providers"]["onswitch"]["coverage"][number]
  /** The wallet-ready asset routes that support this direction. */
  assetRoutes: FiatCapabilitySnapshot["assetRoutes"]
}

/**
 * The (corridor, assetRoutes) pairs the UI can offer for a direction.
 * Guide §5 line 376: "A specific OnSwitch coverage item and a specific
 * assetRoutes item must both be enabled and wallet-ready before
 * showing a quote action."
 */
export function onswitchCorridors(
  config: FiatCapabilitySnapshot | undefined,
  direction: "onramp" | "offramp",
): OnswitchCorridorMatch[] {
  const providerAvailable =
    direction === "onramp"
      ? isOnswitchOnrampAvailable(config)
      : isOnswitchOfframpAvailable(config)
  if (!providerAvailable || !config) return []

  const walletReady = config.assetRoutes.filter((route) => {
    if (!route.walletReady) return false
    return direction === "onramp" ? route.onrampSupported : route.offrampSupported
  })
  if (walletReady.length === 0) return []

  return config.providers.onswitch.coverage
    .filter((coverage) => coverage.enabled && coverage.directions.includes(direction))
    .map((coverage) => ({ coverage, assetRoutes: walletReady }))
}
