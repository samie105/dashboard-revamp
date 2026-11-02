/** Mirrors the copy-trading service's wire shapes (worldstreet-copy-trading). */

export type MarketKind = "spot" | "perp"

export interface Leader { id: string; displayName: string; venue: string }

export interface GrantTerms {
  kinds: MarketKind[]
  /** Empty means every market of the allowed kinds. */
  symbols: string[]
  maxOrderUsd: number
  maxLeverage: number
  maxDailyNotionalUsd: number
  /** Unix seconds. */
  expiresAt: number
}

export interface Delegation {
  ref: string
  venue: string
  masterAddress: string
  agentAddress: string
  status: "pending" | "active" | "revoked"
  grant: GrantTerms
  createdAt: number
}

/** The exact EIP-712 message the user signs. uint256 fields are decimal strings. */
export interface DelegationTypedData {
  domain: { name: string; version: string }
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: "Delegation"
  message: Record<string, string>
}

export interface PreparedDelegation {
  delegationId: string
  delegateAddress: string
  typedData: DelegationTypedData
}

export type SizingMode = { type: "proportional" } | { type: "fixed"; usdPerTrade: number }

export interface Subscription {
  id: string
  leaderId: string
  status: "active" | "paused" | "stopped"
  allocationUsd: number
  sizing: SizingMode
  venues: string[]
  kinds: MarketKind[]
  symbols?: string[]
  maxLeverage: number
  maxOrderUsd: number
  maxSlippageBps: number
  signerRef: string
  createdAt: number
}

export interface CopyOrder {
  id: string
  subscriptionId: string
  eventId: string
  status: "filled" | "skipped" | "failed"
  reason?: string
  venue: string
  kind: MarketKind
  symbol: string
  side: "buy" | "sell"
  size: number
  price: number
  ts: number
}

export interface GrantInput {
  masterAddress: string
  venue: "hyperliquid"
  kinds: MarketKind[]
  symbols: string[]
  maxOrderUsd: number
  maxLeverage: number
  maxDailyNotionalUsd: number
  expiresInDays: number
}

export interface SubscriptionInput {
  leaderId: string
  signerRef: string
  allocationUsd: number
  sizing: SizingMode
  venues: string[]
  kinds: MarketKind[]
  symbols?: string[]
  maxLeverage: number
  maxOrderUsd: number
  maxSlippageBps: number
}
