export interface CryptoWallet {
  id: string
  userId: string
  status: string
  version: number
  securityVersion: number
  provisioningMode: string
  createdAt: string
  updatedAt: string
}

export interface CryptoWalletAccount {
  id: string
  walletId: string
  chainFamily: "evm" | "solana" | "sui" | "ton" | "tron" | string
  keyAlgorithm: string
  keyType: string
  state: string
  publicKey?: string
  canonicalAddress?: string
  addresses?: Array<{
    id: string
    networkId: string
    address: string
    isCanonical: boolean
  }>
}

export type CryptoWalletDetails = CryptoWallet & { accounts: CryptoWalletAccount[] }

export interface CryptoNetwork {
  id: string
  family: string
  name: string
  environment: string
  chainId?: number
  cluster?: string
  nativeAsset: string
  capabilities: Record<string, boolean> & { balance?: boolean }
}

export interface CryptoAssetReference {
  kind: "native" | "token"
  identifier: string
}

export interface CryptoBalance {
  asset: CryptoAssetReference
  amountBaseUnits: string
  decimals: number
  symbol: string
  name?: string
  logo?: string
}

export interface CryptoBalanceSnapshotItem {
  accountId: string
  networkId: string
  networkName: string
  family: string
  address: string
  status: "ready" | "unavailable" | string
  balances: CryptoBalance[]
  error?: { code?: string; message?: string }
}

export interface CryptoBalanceSnapshot {
  generatedAt: string
  cachedUntil?: string
  results: CryptoBalanceSnapshotItem[]
}

export interface CryptoTransactionIntent {
  id: string
  status: string
  chainFamily?: "evm" | "solana" | string
  networkId?: string
  accountId?: string
  walletId?: string
  normalizedSummary?: {
    action?: string
    chainFamily?: string
    networkId?: string
    from?: string
    to?: string
    asset?: CryptoAssetReference
    amount?: string
    [key: string]: unknown
  }
  unsignedTransaction?: {
    family: string
    networkId: string
    from: string
    to: string
    payload: Record<string, unknown>
  }
  expiresAt?: string
  validationResult?: { ok: boolean; errors: string[]; warnings: string[] }
  simulationResult?: { ok: boolean; error?: string; gasEstimate?: string; logs?: unknown[] }
  [key: string]: unknown
}

export interface CryptoTransactionRecord {
  id: string
  status: string
  txHash?: string
  chainFamily?: string
  networkId?: string
  fromAddress?: string
  toAddress?: string
  assetSummary?: CryptoAssetReference
  /**
   * The intent's `normalizedSummary`, denormalised onto the record at
   * broadcast: action, amount, the two tokens, the router. Older records are
   * filled in from their intent by the backend on read, so this is present
   * for anything that was a real intent — but it stays optional, because a
   * client must not assume a field a deployed backend may predate.
   */
  summary?: Record<string, unknown>
  createdAt?: string
  submittedAt?: string
  confirmedAt?: string
  failedAt?: string
  [key: string]: unknown
}

export interface CryptoServiceHealth {
  success: boolean
  service: string
  status: string
  dependencies?: Record<string, string>
}

export type CryptoWalletPackage = Record<string, unknown>

export interface CryptoWalletPackageDocument extends CryptoWalletPackage {
  id: string
  walletId: string
  version: number
  baseVersion: number
  securityVersion: number
  format: "worldstreet-wallet-package" | string
  status: string
  accounts: unknown[]
  envelopes: unknown[]
}

export interface WalletAuthorizationResult {
  walletAuthorizationToken: string
  expiresIn: number
  authorizationMethod: "clerk-session" | "recovery-secret" | "clerk-mfa" | string
}

export interface RecoveryAuthorizationStartResult {
  authorizationId: string
  challenge: string
  recoveryPublicKey: string
}

export interface PasskeyRegistrationOptions {
  ceremonyId: string
  options: Record<string, unknown>
}

export interface PasskeyRegistrationResult {
  credentialId?: string
  prfSupport?: "unknown" | "supported" | "unsupported"
  walletAuthorizationToken: string
  expiresIn: number
}

export interface PasskeyAuthenticationOptions {
  ceremonyId: string
  options: Record<string, unknown>
}

export interface PasskeyAuthenticationResult {
  walletAuthorizationToken: string
  expiresIn: number
}

export interface CryptoIntentSimulation {
  validation: { ok: boolean; errors: string[]; warnings: string[] }
  simulation: { ok: boolean; error?: string; gasEstimate?: string; logs?: unknown[] }
}

export interface SponsorshipConfig {
  enabled: boolean
  provider: string
  allowedNetworks: string[]
  allowedOperations: string[]
  maxGasUsd: number
  dailyUserLimitUsd: number
  supportedFamilies: string[]
}

export interface SponsorshipOperation {
  id: string
  walletId: string
  accountId: string
  networkId: string
  chainFamily: "evm" | "solana" | string
  operation: "native-transfer" | "token-transfer" | "contract-call" | string
  providerOperationId?: string
  quote?: {
    sponsor?: { address?: string; estimatedCostUsd?: string | number }
    [key: string]: unknown
  }
  estimatedCostUsd?: number
  policyVersion?: string
  signingPayload?: Record<string, unknown>
  status: "quoted" | "prepared" | "submitted" | "confirmed" | "failed" | "expired" | string
  expiresAt: string
  providerStatus?: string
  txHash?: string
  providerError?: string
}

export interface RecoveryStatus {
  configured: boolean
  configuredAt?: string
}

export interface RecoveryStartResult {
  recoveryId: string
  challenge: string
  walletVersion: number
  securityVersion: number
}

export interface Device {
  id: string
  label: string
  platform?: string
  status: "pending" | "active" | "revoked" | string
  lastSeenAt?: string
  createdAt?: string
  revokedAt?: string
}

export interface HyperliquidMarket {
  symbol: string
  price: number
  maxLeverage?: number
  szDecimals?: number
  onlyIsolated?: boolean
  coinName?: string
}

export interface HyperliquidMarkets {
  venue: "Hyperliquid"
  environment: "mainnet" | "testnet"
  futures: HyperliquidMarket[]
  /** Spot is intentionally supplied by the Worldstreet spot router. */
  spot: HyperliquidMarket[]
  spotVenue: string
  minOrderUsd: number
}

export interface HyperliquidIntentStep {
  kind: string
  action: Record<string, unknown>
  signingMode?: "l1" | "user"
  types?: Record<string, Array<{ name: string; type: string }>>
  nonce: number
  expiresAfter?: number
}

export interface HyperliquidIntent {
  id: string
  walletId: string
  accountId: string
  address: string
  intentType: string
  request: Record<string, unknown>
  steps: HyperliquidIntentStep[]
  status: string
  expiresAt: string
  summary?: Record<string, unknown>
}

export interface HyperliquidAccount {
  ready: boolean
  address?: string
  balances: {
    perpsWithdrawableUsdc: number
    perpsAccountValueUsdc: number
    spotUsdc: number
    spotUsdcHold?: number
    spotTokens?: Array<{ symbol: string; total: number; hold: number; available: number }>
  } | null
  positions: Array<Record<string, unknown>>
  openOrders: Array<Record<string, unknown>>
}
