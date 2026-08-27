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
