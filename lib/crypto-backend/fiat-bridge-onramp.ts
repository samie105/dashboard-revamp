/**
 * Bridge USD onramp logic for the Buy flow. Guide §10.1-10.2 (lines
 * 811-888), §11 (lines 982-984), §13 "Bridge USD onramp" (lines 1168-1178).
 *
 * "the Bridge virtual account is a reusable USD deposit instruction, not a
 * fiat balance that the frontend should model as a wallet" (lines 812-814).
 * Everything here renders what the backend returns.
 */

import type { CryptoBackendClient } from "./client"
import { isBridgeVirtualAccountAvailable, isOnswitchOnrampAvailable } from "./fiat-capabilities"
import { displayRows, type DisplayRow } from "./fiat-display"
import { runIdempotentMutation } from "./fiat-idempotency"
import { onrampOptions } from "./fiat-onramp"
import type { FiatCapabilitySnapshot, FiatVirtualAccount, FiatVirtualAccountActivity } from "./types"

type VirtualAccountClient = Pick<CryptoBackendClient, "createBridgeVirtualAccount">

/* ── Which Buy rails to offer (team decision + guide §5, §13) ─────────── */

export type BuyRail = "local" | "usd"

/**
 * Buy → OnSwitch for local currencies, Bridge for USD; which one is offered
 * comes from /fiat/config (docs/FIAT_RAMP_CONTEXT.md decision, guide §5).
 * `local` needs an OnSwitch corridor with a wallet-ready asset route (lines
 * 375-377); `usd` needs the Bridge virtual-account route (line 1169-1170).
 */
export function buyRails(config: FiatCapabilitySnapshot | undefined): BuyRail[] {
  const rails: BuyRail[] = []
  if (isOnswitchOnrampAvailable(config) && onrampOptions(config).length > 0) rails.push("local")
  if (isBridgeVirtualAccountAvailable(config)) rails.push("usd")
  return rails
}

/* ── Creating the virtual account (guide §10.1 lines 816-860) ─────────── */

/**
 * Select the network supplied by the backend capability contract. The
 * frontend never hardcodes Ethereum (or a token address). A response from an
 * older backend without the new fields remains fail-closed; an explicitly
 * null/invalid default also remains fail-closed.
 */
export function bridgeVirtualAccountNetworkId(
  config: FiatCapabilitySnapshot | undefined,
  ownedNetworkIds?: readonly string[],
): string | null {
  const bridge = config?.providers.bridge
  if (!bridge) return null
  const supported = bridge.supportedNetworks ?? []
  const defaultId = bridge.defaultNetworkId
  const usable = supported.filter((network) => network.asset === "USDC")
  if (defaultId === null) return null
  if (typeof defaultId !== "string") return usable[0]?.networkId ?? null

  const defaultIsSupported = usable.some((network) => network.networkId === defaultId)
  if (!defaultIsSupported) return null
  if (!ownedNetworkIds || ownedNetworkIds.length === 0) return defaultId

  const owned = new Set(ownedNetworkIds)
  if (owned.has(defaultId)) return defaultId
  return usable.find((network) => owned.has(network.networkId))?.networkId ?? null
}

export type BridgeVirtualAccountReadinessReason =
  | "capability_unavailable"
  | "wallet_unavailable"
  | "network_unavailable"
  | "wallet_address_unavailable"
  | null

export interface BridgeVirtualAccountReadiness {
  ready: boolean
  networkId: string | null
  networkName: string | null
  walletAddress: string | null
  asset: "USDC" | null
  reason: BridgeVirtualAccountReadinessReason
}

/**
 * Final client-side gate for POST /fiat/bridge/virtual-accounts. The backend
 * remains authoritative, but the CTA should not invite a request that cannot
 * be satisfied by this owned wallet. A wallet address is only used to prove
 * the selected network is provisioned; it is never sent as a provider token
 * address or persisted as fiat account data.
 */
export function bridgeVirtualAccountReadiness(
  config: FiatCapabilitySnapshot | undefined,
  walletId: string | undefined,
  walletNetworkAddresses?: Readonly<Record<string, string | undefined>>,
): BridgeVirtualAccountReadiness {
  if (!config || !isBridgeVirtualAccountAvailable(config)) {
    return { ready: false, networkId: null, networkName: null, walletAddress: null, asset: null, reason: "capability_unavailable" }
  }
  if (!walletId) {
    return { ready: false, networkId: null, networkName: null, walletAddress: null, asset: null, reason: "wallet_unavailable" }
  }
  const ownedNetworkIds = walletNetworkAddresses ? Object.keys(walletNetworkAddresses) : []
  const networkId = bridgeVirtualAccountNetworkId(config, ownedNetworkIds)
  const network = config.providers.bridge.supportedNetworks.find((item) => item.networkId === networkId)
  if (!network || network.asset !== "USDC") {
    return { ready: false, networkId: null, networkName: null, walletAddress: null, asset: null, reason: "network_unavailable" }
  }
  const walletAddress = walletNetworkAddresses?.[network.networkId]?.trim() || null
  if (!walletAddress) {
    return { ready: false, networkId: network.networkId, networkName: network.networkName, walletAddress: null, asset: "USDC", reason: "wallet_address_unavailable" }
  }
  return { ready: true, networkId: network.networkId, networkName: network.networkName, walletAddress, asset: "USDC", reason: null }
}

/**
 * POST /fiat/bridge/virtual-accounts with the guide's body: walletId,
 * networkId and asset "USDC" (lines 819-823). Never a token contract
 * address (lines 824-826). The key is scoped to (walletId, networkId,
 * asset): "The same request with the same idempotency key returns the
 * existing account" (lines 858-860).
 */
export function createBridgeUsdAccount(
  client: VirtualAccountClient,
  input: { walletId: string; networkId: string },
): Promise<FiatVirtualAccount> {
  const body = { walletId: input.walletId, networkId: input.networkId, asset: "USDC" }
  return runIdempotentMutation("virtual-account", body, (key) => client.createBridgeVirtualAccount(body, key))
}

/* ── Deposit instructions (guide lines 856-858) ───────────────────────── */

const DEPOSIT_LABELS: Record<string, string> = {
  currency: "Currency",
  paymentRails: "Send by",
  accountName: "Account name",
  routingNumber: "Routing number",
  accountNumber: "Account number",
  bankName: "Bank",
  reference: "Reference",
}

const DEPOSIT_SENSITIVE_KEYS: ReadonlySet<string> = new Set(["accountNumber", "routingNumber", "iban"])

/**
 * "Display depositInstructions exactly as returned, with masking/copy
 * controls appropriate for sensitive bank details. Do not store them in
 * analytics or log them." Rows are in the order returned; routing and
 * account numbers are marked sensitive (masked until revealed).
 */
export function depositInstructionRows(account: Pick<FiatVirtualAccount, "depositInstructions">): DisplayRow[] {
  return displayRows(account.depositInstructions, {
    labels: DEPOSIT_LABELS,
    sensitiveKeys: DEPOSIT_SENSITIVE_KEYS,
  })
}

/* ── Activity (guide §10.2 lines 862-888, §13 lines 1177-1178) ────────── */

/**
 * Ids of activity items the backend reports as a completed delivery. Guide
 * §13 lines 1177-1178: "Refresh the user's wallet balance/order history
 * after reconciled activity shows a completed delivery"; §10.2's example
 * (line 874) uses providerStatus "completed". Team decision 2026-09-28:
 * refresh only on that value, not on any change.
 */
export function completedActivityIds(items: FiatVirtualAccountActivity[] | undefined): Set<string> | undefined {
  if (!items) return undefined
  return new Set(items.filter((item) => item.providerStatus === "completed").map((item) => item.id))
}

/**
 * Whether the wallet balance should be refreshed: true when an item is
 * completed now that wasn't completed on the previous read. Not on the first
 * load (`previous` undefined: nothing has changed yet), and not while the
 * activity is still loading (`next` undefined).
 */
export function hasNewCompletedDelivery(
  previous: ReadonlySet<string> | undefined,
  next: ReadonlySet<string> | undefined,
): boolean {
  if (!previous || !next) return false
  for (const id of next) if (!previous.has(id)) return true
  return false
}
