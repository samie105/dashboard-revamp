/**
 * Bridge USD withdrawal logic for Sell.
 *
 * Bridge does not expose a quote endpoint in the current backend contract.
 * The browser therefore submits a bounded USDC source amount only after the
 * backend capability, owned wallet network, verified Bridge beneficiary, and
 * channel gates all pass. The backend resolves the canonical USDC contract
 * from the network; the browser sends the public `USDC` symbol, never a
 * copied token address.
 */

import type { CryptoBackendClient } from "./client"
import { isBridgeWithdrawalAvailable, bridgeWithdrawalChannels } from "./fiat-capabilities"
import { runIdempotentMutation } from "./fiat-idempotency"
import { isValidAmount } from "./fiat-onramp"
import { offrampOrderView, offrampStageIndex } from "./fiat-offramp"
import type {
  BridgeWithdrawalChannel,
  FiatBeneficiary,
  FiatCapabilitySnapshot,
  FiatOrder,
} from "./types"

type BridgeWithdrawalClient = Pick<CryptoBackendClient, "createFiatOrder">

export interface BridgeWithdrawalNetworkOption {
  networkId: string
  networkName: string
  paymentRail: string
  asset: "USDC"
}

export interface BridgeWithdrawalRequest {
  provider: "bridge"
  walletId: string
  networkId: string
  asset: "USDC"
  amount: string
  beneficiaryId: string
  channel: BridgeWithdrawalChannel
}

/** Channels the backend explicitly says are available for owned accounts. */
export function bridgeWithdrawalChannelOptions(
  config: FiatCapabilitySnapshot | undefined,
) {
  return bridgeWithdrawalChannels(config)
}

/**
 * Return only Bridge-supported networks that the current wallet actually
 * owns. An omitted/empty wallet-network list intentionally returns no options
 * so a loading or partially provisioned wallet cannot create a withdrawal.
 */
export function bridgeWithdrawalNetworkOptions(
  config: FiatCapabilitySnapshot | undefined,
  ownedNetworkIds: readonly string[] = [],
): BridgeWithdrawalNetworkOption[] {
  if (!config || !isBridgeWithdrawalAvailable(config) || ownedNetworkIds.length === 0) return []
  const owned = new Set(ownedNetworkIds)
  return config.providers.bridge.supportedNetworks
    .filter((network) => network.asset === "USDC" && owned.has(network.networkId))
    .map((network) => ({
      networkId: network.networkId,
      networkName: network.networkName,
      paymentRail: network.paymentRail,
      asset: "USDC" as const,
    }))
}

/** Prefer the backend default, then the first network owned by the wallet. */
export function selectBridgeWithdrawalNetwork(
  config: FiatCapabilitySnapshot | undefined,
  ownedNetworkIds: readonly string[] = [],
): BridgeWithdrawalNetworkOption | undefined {
  const options = bridgeWithdrawalNetworkOptions(config, ownedNetworkIds)
  const configured = config?.providers.bridge.defaultNetworkId
  return options.find((network) => network.networkId === configured) ?? options[0]
}

function same(value: string | undefined, expected: string): boolean {
  return value?.trim().toUpperCase() === expected.trim().toUpperCase()
}

/**
 * Only verified Bridge beneficiaries for the signed-in user's USD payout
 * account are selectable. A channel filter prevents an ACH-only external
 * account being presented for a wire order, while the backend repeats every
 * ownership check authoritatively.
 */
export function verifiedBridgeBeneficiaries(
  beneficiaries: FiatBeneficiary[] | undefined,
  channel?: BridgeWithdrawalChannel,
): FiatBeneficiary[] {
  return (beneficiaries ?? []).filter((beneficiary) =>
    same(beneficiary.provider, "bridge") &&
    same(beneficiary.direction, "offramp") &&
    same(beneficiary.country, "US") &&
    same(beneficiary.currency, "USD") &&
    (!channel || same(beneficiary.channel, channel)) &&
    same(beneficiary.status, "verified") &&
    same(beneficiary.ownershipStatus, "verified"),
  )
}

export function bridgeWithdrawalChannelLabel(channel: BridgeWithdrawalChannel): string {
  switch (channel) {
    case "ach":
      return "ACH"
    case "ach_same_day":
      return "Same-day ACH"
    case "wire":
      return "Wire"
    case "fednow":
      return "FedNow"
  }
}

export function buildBridgeWithdrawalRequest(input: {
  walletId: string
  networkId: string
  amount: string
  beneficiaryId: string
  channel: BridgeWithdrawalChannel
}): BridgeWithdrawalRequest {
  return {
    provider: "bridge",
    walletId: input.walletId,
    networkId: input.networkId,
    asset: "USDC",
    amount: input.amount.trim(),
    beneficiaryId: input.beneficiaryId,
    channel: input.channel,
  }
}

export function createBridgeWithdrawalOrder(
  client: BridgeWithdrawalClient,
  input: Omit<BridgeWithdrawalRequest, "provider" | "asset">,
): Promise<FiatOrder> {
  const body = buildBridgeWithdrawalRequest(input)
  return runIdempotentMutation(
    "order",
    {
      provider: body.provider,
      walletId: body.walletId,
      networkId: body.networkId,
      asset: body.asset,
      amount: body.amount,
      beneficiaryId: body.beneficiaryId,
      channel: body.channel,
    },
    (key) => client.createFiatOrder(body, key),
  )
}

/** Bridge uses the same normalized order state vocabulary as other offramps. */
export function bridgeWithdrawalOrderView(
  order: Pick<FiatOrder, "state" | "failureReason" | "reviewReason" | "refundReason">,
) {
  return offrampOrderView(order)
}

export { isValidAmount, offrampStageIndex }
