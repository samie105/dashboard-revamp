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
  chainFamily: "evm" | "solana" | "sui" | "ton" | "tron" | "intertrain" | string
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

export type CryptoWalletDetails = CryptoWallet & {
  accounts: CryptoWalletAccount[]
}

export interface CryptoNetwork {
  id: string
  family: string
  name: string
  environment: string
  chainId?: number
  cluster?: string
  nativeAsset: string
  capabilities: Record<string, boolean> & { balance?: boolean }
  metadata?: {
    protocolChainId?: string
    rpcUrl?: string
    explorerUrl?: string
    nativeAssetName?: string
    nativeAssetDecimals?: number
    [key: string]: unknown
  }
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
  simulationResult?: {
    ok: boolean
    error?: string
    gasEstimate?: string
    logs?: unknown[]
  }
  [key: string]: unknown
}

export interface CryptoSpotIntentPlan {
  intents: CryptoTransactionIntent[]
  requiresApproval?: boolean
}

export interface CryptoTransactionRecord {
  id: string
  status: string
  txHash?: string
  chainFamily?: string
  networkId?: string
  fromAddress?: string
  toAddress?: string
  direction?: "incoming" | "outgoing" | "internal"
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

export type FiatCapabilityStatus =
  | "disabled"
  | "blocked"
  | "discovery_only"
  | "available"
  | "unavailable"

export type BridgeWithdrawalChannel = "ach" | "ach_same_day" | "wire" | "fednow"

export interface BridgeWithdrawalChannelCapability {
  channel: BridgeWithdrawalChannel
  routeId: string
  paymentRail: string
  status: FiatCapabilityStatus
  requiresOwnedExternalAccount: true
}

export interface FiatProviderReadiness {
  provider: "onswitch" | "bridge"
  environment: "sandbox" | "production"
  baseUrl: string
  enabled: boolean
  keyConfigured: boolean
  configured: boolean
  keyEnvironmentValid: boolean
  accountApproved: boolean
  webhookConfigured: boolean
  complianceApproved: boolean
  discoveryAvailable: boolean
  operationAvailable: boolean
  blockingReasons: string[]
}

export interface FiatCapabilitySnapshot {
  generatedAt: string
  cacheExpiresAt: string
  environment: "sandbox" | "production"
  enabled: boolean
  availability: "disabled" | "blocked" | "discovery_only" | "available"
  rollout: { allowlisted: boolean }
  readiness: {
    environment: "sandbox" | "production"
    featureEnabled: boolean
    productionApproved: boolean
    complianceApproved: boolean
    ready: boolean
    blockingReasons: string[]
    providers: {
      onswitch: FiatProviderReadiness
      bridge: FiatProviderReadiness
    }
  }
  providers: {
    onswitch: {
      status: FiatCapabilityStatus
      directions: {
        onrampEnabled: boolean
        offrampEnabled: boolean
      }
      coverage: Array<{
        countryCode: string
        currencyCode: string
        channels: string[]
        directions: Array<"onramp" | "offramp">
        enabled: boolean
        settlementCurrency?: string
        countryName?: string
      }>
      assets: Array<{
        providerAssetId: string
        symbol: string
        decimals?: number
        chain: string
        address?: string
        onrampSupported: boolean
        offrampSupported: boolean
      }>
      lastFetchedAt?: string
      error?: string
    }
    bridge: {
      status: FiatCapabilityStatus
      routes: Array<{
        id: string
        provider: "bridge"
        direction: "onramp" | "offramp"
        fiatCurrency: "USD"
        paymentRail: string
        accountType: "virtual_account" | "external_bank_account" | "liquidation_address"
        requiresCustomerKyc: boolean
        requiresOwnedExternalAccount: boolean
        status: FiatCapabilityStatus
        notes: string[]
      }>
      /** Backend-authoritative wallet networks that can receive Bridge USDC. */
      supportedNetworks: Array<{
        networkId: string
        networkName: string
        paymentRail: string
        asset: "USDC"
      }>
      /** Null means the deployment has no safe default and the CTA stays off. */
      defaultNetworkId: string | null
      defaultNetworkSource: "configured" | "first_supported" | "none"
      /** Backend-authoritative withdrawal-channel contract. */
      withdrawalChannels?: BridgeWithdrawalChannelCapability[]
      account: {
        customerRequired: true
        kycRequired: true
        supportedFiat: ["USD"]
        virtualAccountsEnabled: boolean
        withdrawalsEnabled: boolean
        liquidationEnabled: boolean
      }
    }
  }
  assetRoutes: Array<{
    provider: "onswitch"
    providerAssetId: string
    symbol: string
    decimals?: number
    providerChain: string
    providerAddress?: string
    localNetworkId?: string
    walletReady: boolean
    status: "wallet_ready" | "network_disabled" | "wallet_capability_missing" | "unsupported_network"
    onrampSupported: boolean
    offrampSupported: boolean
  }>
}

export interface FiatQuote {
  id: string
  provider: "onswitch" | "bridge"
  direction: "onramp" | "offramp"
  country: string
  currency: string
  channel: string
  exactOutput?: boolean
  sourceAmount: string
  sourceCurrency: string
  destinationAmount: string
  destinationCurrency: string
  asset: string
  network: string
  providerRate?: string
  providerFee?: string
  worldstreetFee?: string
  expectedSettlementSeconds?: number
  expiresAt: string
  state: "active" | "accepted" | "expired" | "superseded" | string
  acceptedAt?: string
  createdAt: string
  updatedAt: string
}

export interface FiatOrder {
  id: string
  publicReference: string
  provider: "onswitch" | "bridge"
  direction: "onramp" | "offramp"
  country: string
  currency: string
  channel: string
  asset: string
  network: string
  beneficiaryId?: string
  quoteId?: string
  localCryptoIntentId?: string
  transactionRecordId?: string
  expectedDepositAmount?: string
  observedDepositAmount?: string
  observedDepositAsset?: string
  observedDepositNetwork?: string
  observedDepositTxHash?: string
  cryptoIntentPreparation?: {
    state: "pending" | "blocked" | string
    code?: string
    message?: string
    updatedAt?: string
  }
  providerStatus?: string
  state: string
  providerDisplay?: Record<string, unknown>
  cryptoIntent?: CryptoTransactionIntent
  failureReason?: string
  reviewReason?: string
  refundReason?: string
  expiresAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface FiatVirtualAccount {
  id: string
  provider: "bridge"
  walletId: string
  networkId: string
  asset: string
  destinationAddress: string
  status: string
  providerStatus?: string
  depositInstructions?: Record<string, unknown>
  lastSyncedAt?: string
  createdAt: string
  updatedAt: string
}

export interface FiatVirtualAccountActivity {
  id: string
  virtualAccountId: string
  providerStatus: string
  amount: string
  currency: string
  destinationTxHash?: string
  sourcePaymentRail?: string
  occurredAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * Fiat compliance customer record.
 *
 * Guide §7 GET /fiat/compliance illustrative response
 * (docs/fiat-frontend-integration-guide.md lines 440-460). The provider
 * customer id (`id`) MUST NOT be rendered in the UI (guide §7:
 * "Never accept a customer ID from another user or expose provider
 * customer IDs in the UI").
 */
export interface FiatCustomer {
  id: string
  provider: "onswitch" | "bridge"
  status: string
  country: string
  kycStatus: string
  tosStatus: string
  endorsements: Record<string, string>
  termsAcceptedAt?: string
  lastSyncedAt?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Bridge hosted KYC link returned by POST /fiat/compliance/bridge/kyc-link
 * (guide §7 lines 475-497). The url MUST be validated as `https:` before
 * being opened (guide §7 hosted KYC + CLAUDE.md fiat-ramp rules).
 */
export interface FiatKycLink {
  url: string
  tosUrl: string
  kycStatus: string
  tosStatus: string
}

export interface FiatKycLinkResult {
  customer: FiatCustomer
  kycLink: FiatKycLink
}

/**
 * Fiat institution (bank / payment institution) discovery record.
 *
 * Guide §8 GET /fiat/institutions (lines 558-572): "The exact data shape
 * is provider-controlled and can evolve, so render known fields
 * defensively and preserve the selected provider identifier exactly
 * when posting the beneficiary payload." Everything except `id` is
 * optional and unknown extra fields are permitted via the index
 * signature.
 */
export interface FiatInstitution {
  id: string
  name?: string
  code?: string
  country?: string
  currency?: string
  channel?: string
  [key: string]: unknown
}

/** Safe validation metadata returned by GET /fiat/beneficiary-requirements. */
export interface FiatBeneficiaryRequirement {
  path: string
  required: boolean
  regex?: string
  example?: string
}

/**
 * Fiat beneficiary (user-owned offramp destination).
 *
 * Guide §8 GET /fiat/beneficiaries (lines 578-602). A beneficiary MUST
 * only be selectable when both `status === "verified"` and
 * `ownershipStatus === "verified"` (guide §8, CLAUDE.md hard rules,
 * checkpoint CP7).
 */
export interface FiatBeneficiary {
  id: string
  provider: "onswitch" | "bridge"
  direction: "onramp" | "offramp"
  country: string
  currency: string
  channel: string
  holderType: string
  holderName: string
  maskedAccount: string
  ownershipStatus: string
  verificationMethod?: string
  verificationReason?: string | null
  status: string
  verifiedAt?: string
  createdAt: string
  updatedAt: string
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
  authorizationMethod:
    | "clerk-session"
    | "recovery-secret"
    | "clerk-mfa"
    | string
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
  simulation: {
    ok: boolean
    error?: string
    gasEstimate?: string
    logs?: unknown[]
  }
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
  status:
    | "quoted"
    | "prepared"
    | "submitted"
    | "confirmed"
    | "failed"
    | "expired"
    | string
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

export interface WalletTradingSession {
  id: string
  accountId: string
  chainFamily: "evm" | "solana" | string
  permissions: {
    networkIds: string[]
    allowedTargets: string[]
    allowedOperations: string[]
    maxTransactionValue?: string
    maxDailyValue?: string
    maxRequestsPerMinute?: number
  }
  status: "active" | "revoked" | "expired" | string
  issuedAt?: string
  expiresAt: string
  lastUsedAt?: string
}

export interface HyperliquidTradingAgent {
  id: string
  agentAddress: string
  agentName?: string
  status: "pending" | "active" | "revoked" | string
  encryptedKeyMaterial: {
    ciphertext: string
    iv: string
    aad: string
    dekVersion: number
    encoding: "base64url"
  }
  permissions: {
    network: "mainnet"
    markets: string[]
    maxOrderUsd?: string
    maxDailyNotionalUsd?: string
    maxLeverage?: number
  }
  approvedAt?: string
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
  signerAddress?: string
}

export interface HyperliquidAccount {
  ready: boolean
  address?: string
  balances: {
    perpsWithdrawableUsdc: number
    perpsAccountValueUsdc: number
    spotUsdc: number
    spotUsdcHold?: number
    spotTokens?: Array<{
      symbol: string
      total: number
      hold: number
      available: number
    }>
  } | null
  positions: Array<Record<string, unknown>>
  openOrders: Array<Record<string, unknown>>
}

/* ── Launchpad (backend: src/api/routes/launchpad.ts) ───────────────────── */

export type LaunchpadStatus =
  | "draft"
  | "deploying"
  | "live"
  | "graduating"
  | "graduated"
  | "failed"

export interface LaunchpadToken {
  launchId: string
  status: LaunchpadStatus
  chainFamily: "solana"
  networkId: string
  creatorAddress: string
  name: string
  symbol: string
  description?: string
  iconUrl?: string
  links?: { website?: string; x?: string; telegram?: string }
  mint?: string
  poolAddress?: string
  allocation: { creatorBps: number; creatorLamports?: string }
  /** On-chain curve state, refreshed by the reconciler. Absent until live. */
  curve?: {
    solRaised: string
    progressBps: number
    graduationLamports: string
    refreshedAt: string
  }
  /** Where the liquidity went at graduation. */
  graduation?: { migratedAt: string; ammPoolAddress: string; txHash?: string }
  createdAt: string
  updatedAt: string
}

export type LaunchpadTradeSide = "buy" | "sell"

/** Every figure comes from the curve program's own math, server-side. */
export interface LaunchpadQuote {
  side: LaunchpadTradeSide
  /** Lamports on a buy; token base units on a sell. */
  amountIn: string
  /** Token base units on a buy; lamports on a sell — after the platform fee. */
  expectedOut: string
  minimumOut: string
  platformFeeLamports: string
  /** In the input asset: lamports on a buy, token base units on a sell. */
  curveFee: string
  priceImpactBps: number
  expiresAt: string
}

/** The create form's figures, read from the on-chain config (GET /launchpad/terms). */
export interface LaunchpadTerms {
  graduationLamports: string
  totalSupply: string
  curveSupply?: string
  tokenDecimals: number
  tradingFeeBps: number
  creatorBps: number
  maxCreatorBps: number
  /** What the creator's allocation costs, quoted by the curve program. */
  creatorLamports: string
  creatorTokens: string
  /** Measured on devnet; the deploy simulation is the final check. */
  networkRentLamports: string
  networkId: string
}

export type LaunchpadAvailability = Record<
  "solana" | "ethereum" | "intertrain",
  { state: "live" | "paused" | "soon"; reason?: string }
>

export interface LaunchpadDraftInput {
  name: string
  symbol: string
  description?: string
  creatorBps: number
  links?: { website?: string; x?: string; telegram?: string }
  idempotencyKey?: string
  networkId?: LaunchpadNetworkId
}

export type LaunchpadNetworkId = "solana-devnet" | "solana-mainnet-beta"
export type LaunchpadFeedFilter = "all" | "new" | "near" | "graduated"

/** The curve's shape (GET /launchpad/tokens/:id/curve) — a function of SOL
 *  raised, not price history. */
export interface LaunchpadCurve {
  points: Array<{ solRaised: string; price: number }>
  current: { solRaised: string; price: number } | null
  graduationLamports: string
  tokenDecimals: number
}
