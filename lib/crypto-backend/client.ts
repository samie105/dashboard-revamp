import { CryptoBackendError } from "./errors"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"
import { FIAT_MOCKS_ENABLED } from "@/lib/fiat-mocks"
import type {
  CryptoBalance,
  CryptoBalanceSnapshot,
  Device,
  WalletTradingSession,
  HyperliquidMarkets,
  HyperliquidAccount,
  HyperliquidIntent,
  HyperliquidTradingAgent,
  CryptoNetwork,
  CryptoServiceHealth,
  CryptoTransactionIntent,
  LaunchpadAvailability,
  LaunchpadCurve,
  LaunchpadDraftInput,
  LaunchpadFeedFilter,
  LaunchpadNetworkId,
  LaunchpadQuote,
  LaunchpadTerms,
  LaunchpadToken,
  LaunchpadTradeSide,
  CryptoSpotIntentPlan,
  CryptoTransactionRecord,
  CryptoWalletPackageDocument,
  CryptoWallet,
  CryptoWalletAccount,
  CryptoWalletDetails,
  CryptoWalletPackage,
  WalletAuthorizationResult,
  RecoveryAuthorizationStartResult,
  CryptoIntentSimulation,
  PasskeyAuthenticationOptions,
  PasskeyAuthenticationResult,
  PasskeyRegistrationOptions,
  PasskeyRegistrationResult,
  RecoveryStartResult,
  RecoveryStatus,
  SponsorshipConfig,
  SponsorshipOperation,
  FiatBeneficiary,
  FiatBeneficiaryRequirement,
  FiatCapabilitySnapshot,
  FiatCustomer,
  FiatInstitution,
  FiatKycLinkResult,
  FiatQuote,
  FiatOrder,
  FiatVirtualAccountActivity,
  FiatVirtualAccount,
} from "./types"

type RequestOptions = {
  walletAuthorizationToken?: string
  walletSessionToken?: string
  unwrap?: boolean
  signal?: AbortSignal
  idempotencyKey?: string
  /** Internal: set once a request has already been retried after a 401. */
  _retried?: boolean
}

type ErrorPayload = {
  success?: boolean
  requestId?: string
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

const DEFAULT_BASE_PATH = "/api/crypto"

export class CryptoBackendClient {
  private readonly basePath: string
  private fetcher: typeof fetch

  constructor(options: { basePath?: string; fetcher?: typeof fetch } = {}) {
    this.basePath = (options.basePath ?? DEFAULT_BASE_PATH).replace(/\/$/, "")
    // Window.fetch is an invocation-sensitive method in some browsers. Keep
    // the default client safe when it is stored and called later as a function.
    // The dev-mock fetcher is loaded lazily below in ensureFetcher() so the
    // mock modules (fixtures, responder, wallet state) don't ship to prod.
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    this.fetcherInjected = options.fetcher !== undefined
  }

  /**
   * Return the fetcher to use for the next request. On first call this
   * kicks off the (possibly async) dev-mock resolution and CACHES THE
   * PROMISE — concurrent callers await the same one, so no request slips
   * past to the real fetch while the mock module is still loading.
   *
   * An injected fetcher (constructor `options.fetcher`) is never
   * replaced; tests pass their own fetch and get it back verbatim.
   */
  private ensureFetcher(): Promise<typeof fetch> {
    if (!this.fetcherResolution) {
      this.fetcherResolution = this.resolveFetcher()
    }
    return this.fetcherResolution
  }

  private async resolveFetcher(): Promise<typeof fetch> {
    if (this.fetcherInjected) return this.fetcher
    if (typeof window === "undefined") return this.fetcher
    if (!DEV_AUTH_BYPASS && !FIAT_MOCKS_ENABLED) return this.fetcher
    try {
      const mockModule = await import("@/lib/dev-mock-fetch")
      this.fetcher = mockModule.devMockFetch
    } catch {
      // Mock module failed to load — keep the real fetcher. Any dev with
      // the flag on will see the mock not activating, which is the right
      // failure mode compared with breaking real requests.
    }
    return this.fetcher
  }

  private readonly fetcherInjected: boolean
  private fetcherResolution: Promise<typeof fetch> | undefined

  async getHealth(signal?: AbortSignal): Promise<CryptoServiceHealth> {
    return this.request<CryptoServiceHealth>(
      "/health",
      {},
      { unwrap: false, signal }
    )
  }

  async getReady(signal?: AbortSignal): Promise<CryptoServiceHealth> {
    return this.request<CryptoServiceHealth>(
      "/ready",
      {},
      { unwrap: false, signal }
    )
  }

  async getWallet(signal?: AbortSignal): Promise<CryptoWalletDetails> {
    return this.request<CryptoWalletDetails>("/wallets/me", {}, { signal })
  }

  /** The dashboard's Insights strip: monthly activity counts, and the market
   *  Fear & Greed reading. `fearGreed` is null when that upstream is down —
   *  the whole response still succeeds. */
  async getInsights(months?: number, signal?: AbortSignal) {
    const query = months === undefined ? "" : `?months=${months}`
    return this.request<{
      activity: {
        months: Array<{
          month: string
          total: number
          sent: number
          received: number
          swapped: number
          bridged: number
          failed: number
        }>
        total: number
        from: string | null
        to: string | null
      }
      fearGreed: {
        value: number
        classification: string
        recordedAt: string
      } | null
    }>(`/insights${query}`, {}, { signal })
  }

  async listNetworks(signal?: AbortSignal): Promise<CryptoNetwork[]> {
    return this.request<CryptoNetwork[]>("/networks", {}, { signal })
  }

  async getFiatConfig(signal?: AbortSignal): Promise<FiatCapabilitySnapshot> {
    return this.request<FiatCapabilitySnapshot>("/fiat/config", {}, { signal })
  }

  /* ── §7 Compliance ─────────────────────────────────────────────── */

  async getFiatCompliance(signal?: AbortSignal): Promise<FiatCustomer[]> {
    return this.request<FiatCustomer[]>("/fiat/compliance", {}, { signal })
  }

  /**
   * Guide §7 POST /fiat/compliance/customer — used when the integration
   * has the required profile fields (Bridge direct creation requires a
   * complete profile). Prefer `createBridgeKycLink` for Bridge unless
   * the operator has explicitly approved a direct profile workflow.
   */
  async createFiatCustomer(
    input: {
      // Guide §7 lines 506-520 show these fields but not which are
      // required (open question 21), so only `provider` is mandatory here.
      provider: "onswitch" | "bridge"
      legalName?: string
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      country?: string
      birthDate?: string
      residentialAddress?: { country?: string; city?: string }
    },
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<FiatCustomer> {
    return this.request<FiatCustomer>(
      "/fiat/compliance/customer",
      { method: "POST", body: JSON.stringify(input) },
      { signal, idempotencyKey },
    )
  }

  /**
   * Guide §7 POST /fiat/compliance/bridge/kyc-link — the normal Bridge
   * onboarding path. Returns `{ customer, kycLink }`; the caller must
   * validate `kycLink.url.startsWith("https:")` before opening it.
   */
  async createBridgeKycLink(
    input: { legalName: string; email: string; country: string },
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<FiatKycLinkResult> {
    return this.request<FiatKycLinkResult>(
      "/fiat/compliance/bridge/kyc-link",
      { method: "POST", body: JSON.stringify(input) },
      { signal, idempotencyKey },
    )
  }

  /**
   * Guide §7 POST /fiat/compliance/bridge/sync — refresh the user's
   * Bridge customer/endorsement state. No request body; no idempotency
   * key required (guide §6.2 route table).
   */
  async syncBridgeCompliance(signal?: AbortSignal): Promise<FiatCustomer> {
    return this.request<FiatCustomer>(
      "/fiat/compliance/bridge/sync",
      { method: "POST" },
      { signal },
    )
  }

  /* ── §8 Institutions and beneficiaries ─────────────────────────── */

  async listFiatInstitutions(
    query: { country: string; currency: string; channel: string },
    signal?: AbortSignal,
  ): Promise<FiatInstitution[]> {
    const params = new URLSearchParams({
      country: query.country,
      currency: query.currency,
      channel: query.channel,
    })
    return this.request<FiatInstitution[]>(
      `/fiat/institutions?${params.toString()}`,
      {},
      { signal },
    )
  }

  async listFiatBeneficiaryRequirements(
    query: { country: string; currency?: string; channel?: string; holderType?: string },
    signal?: AbortSignal,
  ): Promise<FiatBeneficiaryRequirement[]> {
    const params = new URLSearchParams({ country: query.country })
    if (query.currency) params.set("currency", query.currency)
    if (query.channel) params.set("channel", query.channel)
    if (query.holderType) params.set("holderType", query.holderType)
    return this.request<FiatBeneficiaryRequirement[]>(
      `/fiat/beneficiary-requirements?${params.toString()}`,
      {},
      { signal },
    )
  }

  async listFiatBeneficiaries(signal?: AbortSignal): Promise<FiatBeneficiary[]> {
    return this.request<FiatBeneficiary[]>("/fiat/beneficiaries", {}, { signal })
  }

  /**
   * Guide §8 POST /fiat/beneficiaries — creates a user-owned offramp
   * beneficiary. The provider-specific `providerPayload` MUST come from
   * the institution's dynamic requirements; raw account details must
   * never be logged or persisted in the browser (guide §15).
   */
  async createFiatBeneficiary(
    input: {
      provider: "onswitch" | "bridge"
      direction: "onramp" | "offramp"
      country: string
      currency: string
      channel: string
      holderName: string
      holderType: string
      providerPayload: Record<string, unknown>
    },
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<FiatBeneficiary> {
    return this.request<FiatBeneficiary>(
      "/fiat/beneficiaries",
      { method: "POST", body: JSON.stringify(input) },
      { signal, idempotencyKey },
    )
  }

  /**
   * Guide §8 DELETE /fiat/beneficiaries/:id — deactivates an owned
   * beneficiary. Guide gives no example response body; the client
   * returns whatever `data` field the envelope carries.
   */
  async deleteFiatBeneficiary(
    beneficiaryId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this.request<unknown>(
      `/fiat/beneficiaries/${encodeURIComponent(beneficiaryId)}`,
      { method: "DELETE" },
      { signal, idempotencyKey },
    )
  }

  async createFiatQuote(input: {
    provider: "onswitch"
    direction: "onramp" | "offramp"
    country: string
    currency?: string
    channel?: string
    amount: string
    asset: string
    network: string
    exactOutput?: boolean
  }, idempotencyKey: string, signal?: AbortSignal): Promise<FiatQuote> {
    return this.request<FiatQuote>("/fiat/quotes", { method: "POST", body: JSON.stringify(input) }, { signal, idempotencyKey })
  }

  async getFiatQuote(quoteId: string, signal?: AbortSignal): Promise<FiatQuote> {
    return this.request<FiatQuote>(`/fiat/quotes/${encodeURIComponent(quoteId)}`, {}, { signal })
  }

  async createFiatOrder(input: {
    provider: "onswitch"
    walletId: string
    quoteId: string
    holderName?: string
    beneficiaryId?: string
  } | {
    provider: "bridge"
    walletId: string
    networkId: string
    asset: string
    amount: string
    beneficiaryId: string
    channel: "ach" | "ach_same_day" | "wire" | "fednow"
  }, idempotencyKey: string, signal?: AbortSignal): Promise<FiatOrder> {
    return this.request<FiatOrder>("/fiat/orders", { method: "POST", body: JSON.stringify(input) }, { signal, idempotencyKey })
  }

  async listFiatOrders(limit = 50, signal?: AbortSignal): Promise<FiatOrder[]> {
    return this.request<FiatOrder[]>(`/fiat/orders?limit=${encodeURIComponent(String(limit))}`, {}, { signal })
  }

  async getFiatOrder(orderId: string, signal?: AbortSignal): Promise<FiatOrder> {
    return this.request<FiatOrder>(`/fiat/orders/${encodeURIComponent(orderId)}`, {}, { signal })
  }

  async confirmFiatOrder(orderId: string, transactionHash: string, idempotencyKey: string, signal?: AbortSignal): Promise<FiatOrder> {
    return this.request<FiatOrder>(`/fiat/orders/${encodeURIComponent(orderId)}/confirm`, { method: "POST", body: JSON.stringify({ transactionHash }) }, { signal, idempotencyKey })
  }

  async discardFiatOrder(orderId: string, idempotencyKey: string, signal?: AbortSignal): Promise<FiatOrder> {
    return this.request<FiatOrder>(`/fiat/orders/${encodeURIComponent(orderId)}/discard`, { method: "POST", body: JSON.stringify({ orderId }) }, { signal, idempotencyKey })
  }

  async createBridgeVirtualAccount(input: { walletId: string; networkId: string; asset?: string }, idempotencyKey: string, signal?: AbortSignal): Promise<FiatVirtualAccount> {
    return this.request<FiatVirtualAccount>("/fiat/bridge/virtual-accounts", { method: "POST", body: JSON.stringify(input) }, { signal, idempotencyKey })
  }

  async listBridgeVirtualAccounts(signal?: AbortSignal): Promise<FiatVirtualAccount[]> {
    return this.request<FiatVirtualAccount[]>("/fiat/bridge/virtual-accounts", {}, { signal })
  }

  async getBridgeVirtualAccount(accountId: string, signal?: AbortSignal): Promise<FiatVirtualAccount> {
    return this.request<FiatVirtualAccount>(`/fiat/bridge/virtual-accounts/${encodeURIComponent(accountId)}`, {}, { signal })
  }

  async listBridgeVirtualAccountActivity(accountId: string, limit = 100, signal?: AbortSignal): Promise<FiatVirtualAccountActivity[]> {
    return this.request<FiatVirtualAccountActivity[]>(`/fiat/bridge/virtual-accounts/${encodeURIComponent(accountId)}/activity?limit=${encodeURIComponent(String(limit))}`, {}, { signal })
  }

  async listBalances(
    accountId: string,
    networkId: string,
    assets: string[] = [],
    signal?: AbortSignal
  ): Promise<CryptoBalance[]> {
    const query = new URLSearchParams({ networkId })
    if (assets.length > 0) query.set("assets", assets.join(","))
    return this.request<CryptoBalance[]>(
      `/wallets/me/accounts/${encodeURIComponent(accountId)}/balances?${query.toString()}`,
      {},
      { signal }
    )
  }

  async listBalanceSnapshot(
    refresh = false,
    signal?: AbortSignal
  ): Promise<CryptoBalanceSnapshot> {
    const query = refresh ? "?refresh=1" : ""
    return this.request<CryptoBalanceSnapshot>(
      `/wallets/me/balances${query}`,
      {},
      { signal }
    )
  }

  async listTransactions(
    limit = 50,
    signal?: AbortSignal
  ): Promise<CryptoTransactionRecord[]> {
    return this.request<CryptoTransactionRecord[]>(
      `/transactions?limit=${encodeURIComponent(String(limit))}`,
      {},
      { signal }
    )
  }

  async getIntent(
    intentId: string,
    signal?: AbortSignal
  ): Promise<CryptoTransactionIntent> {
    return this.request<CryptoTransactionIntent>(
      `/transactions/intents/${encodeURIComponent(intentId)}`,
      {},
      { signal }
    )
  }

  async getTransaction(
    transactionId: string,
    signal?: AbortSignal
  ): Promise<CryptoTransactionRecord> {
    return this.request<CryptoTransactionRecord>(
      `/transactions/${encodeURIComponent(transactionId)}`,
      {},
      { signal }
    )
  }

  async createWallet(): Promise<CryptoWallet> {
    return this.request<CryptoWallet>("/wallets", { method: "POST" })
  }

  async authorizeWallet(): Promise<WalletAuthorizationResult> {
    return this.request<WalletAuthorizationResult>("/wallets/me/authorize", {
      method: "POST",
    })
  }

  async startRecoveryAuthorization(): Promise<RecoveryAuthorizationStartResult> {
    return this.request<RecoveryAuthorizationStartResult>(
      "/wallets/me/authorize/recovery/start",
      { method: "POST" }
    )
  }

  async completeRecoveryAuthorization(input: {
    authorizationId: string
    recoveryPublicKey: string
    signature: string
  }): Promise<WalletAuthorizationResult> {
    return this.request<WalletAuthorizationResult>(
      "/wallets/me/authorize/recovery",
      { method: "POST", body: JSON.stringify(input) }
    )
  }

  async prepareAccount(input: {
    chainFamily: string
    keyAlgorithm?: string
    keyType?: string
  }): Promise<CryptoWalletAccount> {
    return this.request<CryptoWalletAccount>("/wallets/me/accounts/prepare", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async getWalletPackage(): Promise<CryptoWalletPackageDocument> {
    return this.request<CryptoWalletPackageDocument>("/wallets/me/package")
  }

  async createPasskeyRegistrationOptions(): Promise<PasskeyRegistrationOptions> {
    return this.request<PasskeyRegistrationOptions>(
      "/passkeys/registration/options",
      { method: "POST" }
    )
  }

  async verifyPasskeyRegistration(
    ceremonyId: string,
    response: Record<string, unknown>
  ): Promise<PasskeyRegistrationResult> {
    return this.request<PasskeyRegistrationResult>(
      "/passkeys/registration/verify",
      {
        method: "POST",
        body: JSON.stringify({ ceremonyId, response }),
      }
    )
  }

  async createPasskeyAuthenticationOptions(): Promise<PasskeyAuthenticationOptions> {
    return this.request<PasskeyAuthenticationOptions>(
      "/passkeys/authentication/options",
      { method: "POST" }
    )
  }

  async verifyPasskeyAuthentication(
    ceremonyId: string,
    response: Record<string, unknown>
  ): Promise<PasskeyAuthenticationResult> {
    return this.request<PasskeyAuthenticationResult>(
      "/passkeys/authentication/verify",
      {
        method: "POST",
        body: JSON.stringify({ ceremonyId, response }),
      }
    )
  }

  async getRecoveryStatus(): Promise<RecoveryStatus> {
    return this.request<RecoveryStatus>("/recovery/status")
  }

  async startRecovery(): Promise<RecoveryStartResult> {
    return this.request<RecoveryStartResult>("/recovery/start", {
      method: "POST",
    })
  }

  async completeRecovery(input: {
    recoveryId: string
    recoveryPublicKey: string
    signature: string
    package: CryptoWalletPackage
  }) {
    return this.request<{ packageVersion?: number; status: string }>(
      "/recovery/complete",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    )
  }

  async listDevices(): Promise<Device[]> {
    return this.request<Device[]>("/devices")
  }

  async startDeviceEnrollment(
    input: {
      label: string
      platform?: string
      publicKey: string
      keyAgreementPublicKey?: string
    },
    walletAuthorizationToken: string
  ) {
    return this.request<{
      deviceId: string
      ceremonyId: string
      challenge: string
    }>(
      "/devices/enrollment/start",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { walletAuthorizationToken }
    )
  }

  async completeDeviceEnrollment(
    input: { deviceId: string; ceremonyId: string; signature: string },
    walletAuthorizationToken: string
  ) {
    return this.request<{ deviceId: string; status: string }>(
      "/devices/enrollment/complete",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { walletAuthorizationToken }
    )
  }

  async revokeDevice(deviceId: string, walletAuthorizationToken: string) {
    return this.request<{ deviceId: string; status: string }>(
      `/devices/${encodeURIComponent(deviceId)}/revoke`,
      { method: "POST" },
      { walletAuthorizationToken }
    )
  }

  async commitWalletPackage(
    walletPackage: CryptoWalletPackage,
    walletAuthorizationToken: string,
    rotate = false
  ): Promise<CryptoWalletPackageDocument> {
    return this.request<CryptoWalletPackageDocument>(
      rotate ? "/wallets/me/rotate" : "/wallets/me/package",
      {
        method: "POST",
        body: JSON.stringify(walletPackage),
      },
      { walletAuthorizationToken }
    )
  }

  async createTransferIntent(
    input: {
      accountId: string
      networkId: string
      asset: { kind: "native" | "token"; identifier: string }
      to: string
      amount: string
      idempotencyKey?: string
    },
    walletSessionToken?: string
  ): Promise<CryptoTransactionIntent> {
    const response = await this.request<{
      data: CryptoTransactionIntent
      existing: boolean
    }>(
      "/transactions/intents",
      { method: "POST", body: JSON.stringify(input) },
      { walletSessionToken, unwrap: false }
    )
    return response.data
  }

  async simulateIntent(
    intentId: string,
    signal?: AbortSignal
  ): Promise<CryptoIntentSimulation> {
    return this.request<CryptoIntentSimulation>(
      `/transactions/intents/${encodeURIComponent(intentId)}/simulate`,
      {
        method: "POST",
      },
      { signal }
    )
  }

  async submitIntent(
    intentId: string,
    signedTransaction: string,
    signal?: AbortSignal
  ): Promise<CryptoTransactionRecord> {
    return this.request<CryptoTransactionRecord>(
      `/transactions/intents/${encodeURIComponent(intentId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ signedTransaction }),
      },
      { signal }
    )
  }

  async getSponsorshipConfig(signal?: AbortSignal): Promise<SponsorshipConfig> {
    return this.request<SponsorshipConfig>(
      "/sponsorship/config",
      {},
      { signal }
    )
  }

  async quoteSponsorship(
    input: {
      accountId: string
      networkId: string
      operation:
        | "native-transfer"
        | "token-transfer"
        | "contract-call"
        | "hyperliquid-deposit"
      intentId?: string
    },
    signal?: AbortSignal
  ): Promise<SponsorshipOperation> {
    return this.request<SponsorshipOperation>(
      "/sponsorship/quote",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
  }

  async prepareSponsorship(
    operationId: string,
    intentId: string,
    signal?: AbortSignal
  ): Promise<SponsorshipOperation> {
    return this.request<SponsorshipOperation>(
      `/sponsorship/operations/${encodeURIComponent(operationId)}/prepare`,
      {
        method: "POST",
        body: JSON.stringify({ intentId }),
      },
      { signal }
    )
  }

  async submitSponsorship(
    operationId: string,
    signedPayload: Record<string, unknown>,
    signal?: AbortSignal
  ) {
    return this.request<{
      operation: SponsorshipOperation
      txHash?: string
      providerStatus: string
    }>(
      `/sponsorship/operations/${encodeURIComponent(operationId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ signedPayload }),
      },
      { signal }
    )
  }

  async getSponsorshipStatus(
    operationId: string,
    signal?: AbortSignal
  ): Promise<SponsorshipOperation> {
    return this.request<SponsorshipOperation>(
      `/sponsorship/operations/${encodeURIComponent(operationId)}`,
      {},
      { signal }
    )
  }

  async getHyperliquidMarkets(
    signal?: AbortSignal
  ): Promise<HyperliquidMarkets> {
    return this.request<HyperliquidMarkets>(
      "/trading/hyperliquid/markets",
      {},
      { signal }
    )
  }

  async getHyperliquidAccount(
    signal?: AbortSignal
  ): Promise<HyperliquidAccount> {
    return this.request<HyperliquidAccount>(
      "/trading/hyperliquid/account",
      {},
      { signal }
    )
  }

  async createHyperliquidIntent(
    input: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<HyperliquidIntent> {
    return this.request<HyperliquidIntent>(
      "/trading/hyperliquid/intents",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
  }

  async submitHyperliquidIntent(
    intentId: string,
    signatures: Array<{ r: string; s: string; v: number }>,
    signal?: AbortSignal
  ) {
    return this.request<{
      intentId: string
      status: string
      results: unknown[]
    }>(
      `/trading/hyperliquid/intents/${encodeURIComponent(intentId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ signatures }),
      },
      { signal }
    )
  }

  async syncTransactions(signal?: AbortSignal): Promise<{ started: boolean }> {
    return this.request<{ started: boolean }>(
      "/transactions/sync",
      { method: "POST" },
      { signal }
    )
  }

  async getIntertrainUsdcBridgeStatus(signal?: AbortSignal) {
    return this.request<{
      enabled: boolean
      available: boolean
      sourceNetworks: string[]
      destinationNetwork: string
      asset: string
      reason?: string
      paused?: boolean
    }>("/bridge/intertrain/usdc/status", {}, { signal })
  }

  async createIntertrainUsdcBridgeIntents(
    input: {
      accountId: string
      destinationAccountId: string
      amount: string
      idempotencyKey?: string
    },
    signal?: AbortSignal
  ) {
    return this.request<{ intents: CryptoTransactionIntent[] }>(
      "/bridge/intertrain/usdc/intents",
      { method: "POST", body: JSON.stringify(input) },
      { signal }
    )
  }

  async listHyperliquidAgents(signal?: AbortSignal) {
    return this.request<HyperliquidTradingAgent[]>(
      "/trading/hyperliquid/agents",
      {},
      { signal }
    )
  }

  async registerHyperliquidAgent(
    input: Omit<
      HyperliquidTradingAgent,
      "id" | "status" | "approvedAt" | "revokedAt"
    >,
    walletAuthorizationToken: string,
    signal?: AbortSignal
  ) {
    return this.request<HyperliquidTradingAgent>(
      "/trading/hyperliquid/agents",
      { method: "POST", body: JSON.stringify(input) },
      { walletAuthorizationToken, signal }
    )
  }

  async revokeHyperliquidAgent(
    address: string,
    walletAuthorizationToken: string,
    signal?: AbortSignal
  ) {
    return this.request<HyperliquidTradingAgent>(
      `/trading/hyperliquid/agents/${encodeURIComponent(address)}/revoke`,
      { method: "POST" },
      { walletAuthorizationToken, signal }
    )
  }

  async createTradingSession(
    input: {
      accountId: string
      chainFamily: "evm" | "solana"
      networkIds: string[]
      allowedTargets?: string[]
      allowedOperations?: string[]
      maxTransactionValue?: string
      maxDailyValue?: string
      maxRequestsPerMinute?: number
      ttlSeconds?: number
    },
    walletAuthorizationToken: string
  ) {
    return this.request<{ session: WalletTradingSession; token: string }>(
      "/wallets/me/sessions",
      {
        method: "POST",
        body: JSON.stringify({
          ...input,
          // Delegated sessions are deliberately limited to trading operations.
          allowedOperations: input.allowedOperations ?? ["transfer"],
        }),
      },
      { walletAuthorizationToken }
    )
  }

  async listTradingSessions() {
    return this.request<WalletTradingSession[]>("/wallets/me/sessions")
  }

  async revokeTradingSession(
    sessionId: string,
    walletAuthorizationToken: string
  ) {
    await this.request(
      `/wallets/me/sessions/${encodeURIComponent(sessionId)}/revoke`,
      { method: "POST" },
      { walletAuthorizationToken }
    )
  }

  async revokeAllTradingSessions(walletAuthorizationToken: string) {
    await this.request(
      "/wallets/me/sessions/revoke-all",
      { method: "POST" },
      { walletAuthorizationToken }
    )
  }

  async getHyperliquidIntent(
    intentId: string,
    signal?: AbortSignal
  ): Promise<HyperliquidIntent> {
    return this.request<HyperliquidIntent>(
      `/trading/hyperliquid/intents/${encodeURIComponent(intentId)}`,
      {},
      { signal }
    )
  }

  async createModernSpotIntent(
    input: {
      networkId: "ethereum-mainnet" | "arbitrum-one"
      sellToken: string
      buyToken: string
      sellAmountBaseUnits: string
      slippagePercentage?: number
      idempotencyKey?: string
    },
    signal?: AbortSignal
  ): Promise<CryptoSpotIntentPlan> {
    const result = await this.request<
      CryptoTransactionIntent | CryptoSpotIntentPlan
    >(
      "/trading/spot/evm/intents",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
    return Array.isArray((result as { intents?: unknown }).intents)
      ? (result as CryptoSpotIntentPlan)
      : {
          intents: [result as CryptoTransactionIntent],
          requiresApproval: false,
        }
  }

  async createModernLifiSwapIntent(
    input: {
      sourceNetworkId:
        | "ethereum-mainnet"
        | "arbitrum-one"
        | "solana-mainnet-beta"
        | "sui-mainnet"
        | "tron-mainnet"
      destinationNetworkId:
        | "ethereum-mainnet"
        | "arbitrum-one"
        | "solana-mainnet-beta"
        | "sui-mainnet"
        | "tron-mainnet"
      sellToken: string
      buyToken: string
      sellAmountBaseUnits: string
      slippagePercentage?: number
      idempotencyKey?: string
    },
    signal?: AbortSignal
  ): Promise<CryptoSpotIntentPlan> {
    const result = await this.request<
      CryptoTransactionIntent | CryptoSpotIntentPlan
    >(
      "/trading/spot/lifi/intents",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
    return Array.isArray((result as { intents?: unknown }).intents)
      ? (result as CryptoSpotIntentPlan)
      : {
          intents: [result as CryptoTransactionIntent],
          requiresApproval: false,
        }
  }

  async createModernProviderSwapIntent(
    input: {
      sourceNetworkId:
        | "ethereum-mainnet"
        | "arbitrum-one"
        | "solana-mainnet-beta"
        | "ton-mainnet"
        | "tron-mainnet"
      destinationNetworkId:
        | "ethereum-mainnet"
        | "arbitrum-one"
        | "solana-mainnet-beta"
        | "ton-mainnet"
        | "tron-mainnet"
      sellToken: string
      buyToken: string
      sellAmountBaseUnits: string
      slippagePercentage?: number
      idempotencyKey?: string
    },
    signal?: AbortSignal
  ): Promise<CryptoTransactionIntent> {
    return this.request<CryptoTransactionIntent>(
      "/trading/spot/provider/intents",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
  }

  /**
   * The spot registry. `limit`/`offset` are optional and the unpaginated call
   * is unchanged — the trade screen takes the whole catalogue once and
   * searches it locally, so it must stay able to.
   *
   * The backend sorts by liquidity descending, so `{ limit: n }` alone is
   * "the n most traded markets", which is what a summary card wants instead
   * of two thousand rows it will slice to six.
   */
  async getModernSpotMarkets(
    options?: { limit?: number; offset?: number },
    signal?: AbortSignal
  ) {
    const params = new URLSearchParams()
    if (options?.limit !== undefined) params.set("limit", String(options.limit))
    if (options?.offset !== undefined)
      params.set("offset", String(options.offset))
    const query = params.toString()
    return this.request<{
      total?: number
      markets: Array<{
        id: string
        symbol: string
        quote: string
        networkId: "ethereum-mainnet" | "arbitrum-one" | "solana-mainnet-beta"
        venue: "0x" | "jupiter"
        chartSymbol: string
        chartSupported: boolean
        price?: number
        icon?: string | null
        sellToken?: string
        buyToken?: string
        inputMint?: string
        outputMint?: string
        baseDecimals?: number
        quoteDecimals?: number
      }>
    }>(
      query ? `/trading/spot/markets?${query}` : "/trading/spot/markets",
      {},
      { signal }
    )
  }

  async createModernSolanaSpotIntent(
    input: {
      inputMint: string
      outputMint: string
      amountBaseUnits: string
      slippageBps?: number
      idempotencyKey?: string
    },
    signal?: AbortSignal
  ): Promise<CryptoTransactionIntent> {
    return this.request<CryptoTransactionIntent>(
      "/trading/spot/solana/intents",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
  }

  async createHyperliquidDepositIntents(
    input: { amount: number; idempotencyKey?: string },
    signal?: AbortSignal
  ) {
    return this.request<{
      networkId: string
      amount: number
      intents: CryptoTransactionIntent[]
      sponsorship: SponsorshipOperation
    }>(
      "/trading/hyperliquid/deposit/intents",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
  }

  /* ── Launchpad ─────────────────────────────────────────────────────── */

  async getLaunchpadAvailability(signal?: AbortSignal) {
    return this.request<LaunchpadAvailability>(
      "/launchpad/availability",
      {},
      { signal }
    )
  }

  async getLaunchpadNetworks(signal?: AbortSignal) {
    return this.request<{
      networks: Array<{ networkId: LaunchpadNetworkId; label: string }>
      defaultNetworkId: LaunchpadNetworkId
    }>("/launchpad/networks", {}, { signal })
  }

  async getLaunchpadTerms(
    creatorBps: number,
    networkId: LaunchpadNetworkId,
    signal?: AbortSignal
  ) {
    const query = new URLSearchParams({
      creatorBps: String(creatorBps),
      networkId,
    })
    return this.request<LaunchpadTerms>(
      `/launchpad/terms?${query}`,
      {},
      { signal }
    )
  }

  async listLaunchpadTokens(
    networkId: LaunchpadNetworkId,
    filter: LaunchpadFeedFilter = "all",
    signal?: AbortSignal
  ) {
    const query = new URLSearchParams({ networkId, filter })
    return this.request<LaunchpadToken[]>(
      `/launchpad/tokens?${query}`,
      {},
      { signal }
    )
  }

  async createLaunchDraft(input: LaunchpadDraftInput, signal?: AbortSignal) {
    return this.request<LaunchpadToken>(
      "/launchpad/launches",
      { method: "POST", body: JSON.stringify(input) },
      { signal }
    )
  }

  /** Idempotent: a deploy already in flight returns its existing intent. */
  async deployLaunch(
    launchId: string,
    input: { idempotencyKey?: string } = {},
    signal?: AbortSignal
  ) {
    return this.request<{
      launch: LaunchpadToken
      intent: CryptoTransactionIntent
    }>(
      `/launchpad/launches/${encodeURIComponent(launchId)}/deploy`,
      { method: "POST", body: JSON.stringify(input) },
      { signal }
    )
  }

  /** The caller's own launch, in any state — including draft and failed. */
  async getMyLaunch(launchId: string, signal?: AbortSignal) {
    return this.request<LaunchpadToken & { failureReason?: string }>(
      `/launchpad/launches/${encodeURIComponent(launchId)}`,
      {},
      { signal }
    )
  }

  async listMyLaunches(signal?: AbortSignal) {
    return this.request<Array<LaunchpadToken & { failureReason?: string }>>(
      "/launchpad/launches",
      {},
      { signal }
    )
  }

  async getLaunchpadToken(launchId: string, signal?: AbortSignal) {
    return this.request<{
      success: true
      data: LaunchpadToken
      platformFeeBps: number
      tokenDecimals: number
    }>(
      `/launchpad/tokens/${encodeURIComponent(launchId)}`,
      {},
      { signal, unwrap: false }
    )
  }

  async getLaunchpadCurve(launchId: string, signal?: AbortSignal) {
    return this.request<LaunchpadCurve>(
      `/launchpad/tokens/${encodeURIComponent(launchId)}/curve`,
      {},
      { signal }
    )
  }

  async quoteLaunchpadTrade(
    launchId: string,
    input: { side: LaunchpadTradeSide; amount: string; slippageBps: number },
    signal?: AbortSignal
  ) {
    return this.request<LaunchpadQuote>(
      `/launchpad/tokens/${encodeURIComponent(launchId)}/quote`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
  }

  async createLaunchpadTradeIntent(
    launchId: string,
    input: {
      side: LaunchpadTradeSide
      amount: string
      slippageBps: number
      idempotencyKey?: string
    },
    signal?: AbortSignal
  ) {
    return this.request<{
      intent: CryptoTransactionIntent
      quote?: LaunchpadQuote
    }>(
      `/launchpad/tokens/${encodeURIComponent(launchId)}/trade`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { signal }
    )
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {}
  ): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set("accept", "application/json")
    if (init.body !== undefined && !headers.has("content-type"))
      headers.set("content-type", "application/json")
    if (options.walletAuthorizationToken)
      headers.set("x-wallet-authorization", options.walletAuthorizationToken)
    if (options.walletSessionToken)
      headers.set("x-wallet-session-token", options.walletSessionToken)
    if (options.idempotencyKey)
      headers.set("idempotency-key", options.idempotencyKey)

    const endpoint = `${this.basePath}${path}`
    const fetcher = await this.ensureFetcher()
    let response: Response
    try {
      response = await fetcher(endpoint, {
        ...init,
        credentials: "include",
        headers,
        cache: "no-store",
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error
      const reason =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error)
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "[crypto-backend] request failed before receiving a response",
          {
            endpoint,
            method: init.method ?? "GET",
            reason,
          }
        )
      }
      throw new CryptoBackendError(
        `Crypto backend request failed before a response (${init.method ?? "GET"} ${endpoint}): ${reason}`,
        0,
        "CRYPTO_BACKEND_UNREACHABLE",
        { endpoint, method: init.method ?? "GET", reason }
      )
    }

    const rawBody = await response.text()
    let body: unknown
    try {
      body = rawBody ? JSON.parse(rawBody) : undefined
    } catch {
      body = undefined
    }

    const payload = (body ?? {}) as ErrorPayload & { data?: T }
    const requestId = response.headers.get("x-request-id") ?? payload.requestId
    if (path.startsWith("/wallets/me/balances")) {
      console.info("[crypto-backend] balance response", {
        status: response.status,
        requestId,
      })
    }
    if (!response.ok || payload.success === false) {
      if (
        response.status === 401 &&
        !options._retried &&
        typeof window !== "undefined"
      ) {
        // clerk-js refreshes the session cookie as a side effect of getToken().
        try {
          await (
            window as {
              Clerk?: {
                session?: {
                  getToken?: (o?: {
                    skipCache?: boolean
                  }) => Promise<string | null>
                }
              }
            }
          ).Clerk?.session?.getToken?.({ skipCache: true })
        } catch {}
        return this.request<T>(path, init, { ...options, _retried: true })
      }
      throw new CryptoBackendError(
        payload.error?.message ??
          `Crypto backend request failed (${response.status})`,
        response.status,
        payload.error?.code ?? "CRYPTO_API_ERROR",
        payload.error?.details,
        requestId,
        response.headers.get("retry-after") ?? undefined
      )
    }

    if (options.unwrap === false) return body as T
    return payload.data as T
  }
}

// The dev-mock fetcher is selected lazily inside CryptoBackendClient's
// ensureFetcher() when DEV_AUTH_BYPASS or FIAT_MOCKS_ENABLED is on, so its
// modules (fixtures, responder, wallet state) never ship in a production
// bundle. Both flags compile to `false` under NODE_ENV=production and the
// dynamic import is guarded on them.
export const cryptoBackendClient = new CryptoBackendClient()
