import { CryptoBackendError } from "./errors"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"
import { devMockFetch } from "@/lib/dev-mock-fetch"
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
} from "./types"

type RequestOptions = {
  walletAuthorizationToken?: string
  walletSessionToken?: string
  unwrap?: boolean
  signal?: AbortSignal
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
  private readonly fetcher: typeof fetch

  constructor(options: { basePath?: string; fetcher?: typeof fetch } = {}) {
    this.basePath = (options.basePath ?? DEFAULT_BASE_PATH).replace(/\/$/, "")
    // Window.fetch is an invocation-sensitive method in some browsers. Keep
    // the default client safe when it is stored and called later as a function.
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
  }

  async getHealth(signal?: AbortSignal): Promise<CryptoServiceHealth> {
    return this.request<CryptoServiceHealth>("/health", {}, { unwrap: false, signal })
  }

  async getReady(signal?: AbortSignal): Promise<CryptoServiceHealth> {
    return this.request<CryptoServiceHealth>("/ready", {}, { unwrap: false, signal })
  }

  async getWallet(signal?: AbortSignal): Promise<CryptoWalletDetails> {
    return this.request<CryptoWalletDetails>("/wallets/me", {}, { signal })
  }

  async listNetworks(signal?: AbortSignal): Promise<CryptoNetwork[]> {
    return this.request<CryptoNetwork[]>("/networks", {}, { signal })
  }

  async listBalances(
    accountId: string,
    networkId: string,
    assets: string[] = [],
    signal?: AbortSignal,
  ): Promise<CryptoBalance[]> {
    const query = new URLSearchParams({ networkId })
    if (assets.length > 0) query.set("assets", assets.join(","))
    return this.request<CryptoBalance[]>(
      `/wallets/me/accounts/${encodeURIComponent(accountId)}/balances?${query.toString()}`,
      {},
      { signal },
    )
  }

  async listBalanceSnapshot(refresh = false, signal?: AbortSignal): Promise<CryptoBalanceSnapshot> {
    const query = refresh ? "?refresh=1" : ""
    return this.request<CryptoBalanceSnapshot>(`/wallets/me/balances${query}`, {}, { signal })
  }

  async listTransactions(limit = 50, signal?: AbortSignal): Promise<CryptoTransactionRecord[]> {
    return this.request<CryptoTransactionRecord[]>(
      `/transactions?limit=${encodeURIComponent(String(limit))}`,
      {},
      { signal },
    )
  }

  async getIntent(intentId: string, signal?: AbortSignal): Promise<CryptoTransactionIntent> {
    return this.request<CryptoTransactionIntent>(`/transactions/intents/${encodeURIComponent(intentId)}`, {}, { signal })
  }

  async getTransaction(transactionId: string, signal?: AbortSignal): Promise<CryptoTransactionRecord> {
    return this.request<CryptoTransactionRecord>(`/transactions/${encodeURIComponent(transactionId)}`, {}, { signal })
  }

  async createWallet(): Promise<CryptoWallet> {
    return this.request<CryptoWallet>("/wallets", { method: "POST" })
  }

  async authorizeWallet(): Promise<WalletAuthorizationResult> {
    return this.request<WalletAuthorizationResult>("/wallets/me/authorize", { method: "POST" })
  }

  async startRecoveryAuthorization(): Promise<RecoveryAuthorizationStartResult> {
    return this.request<RecoveryAuthorizationStartResult>("/wallets/me/authorize/recovery/start", { method: "POST" })
  }

  async completeRecoveryAuthorization(input: { authorizationId: string; recoveryPublicKey: string; signature: string }): Promise<WalletAuthorizationResult> {
    return this.request<WalletAuthorizationResult>("/wallets/me/authorize/recovery", { method: "POST", body: JSON.stringify(input) })
  }

  async prepareAccount(input: { chainFamily: string; keyAlgorithm?: string; keyType?: string }): Promise<CryptoWalletAccount> {
    return this.request<CryptoWalletAccount>("/wallets/me/accounts/prepare", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async getWalletPackage(): Promise<CryptoWalletPackageDocument> {
    return this.request<CryptoWalletPackageDocument>("/wallets/me/package")
  }

  async createPasskeyRegistrationOptions(): Promise<PasskeyRegistrationOptions> {
    return this.request<PasskeyRegistrationOptions>("/passkeys/registration/options", { method: "POST" })
  }

  async verifyPasskeyRegistration(ceremonyId: string, response: Record<string, unknown>): Promise<PasskeyRegistrationResult> {
    return this.request<PasskeyRegistrationResult>("/passkeys/registration/verify", {
      method: "POST",
      body: JSON.stringify({ ceremonyId, response }),
    })
  }

  async createPasskeyAuthenticationOptions(): Promise<PasskeyAuthenticationOptions> {
    return this.request<PasskeyAuthenticationOptions>("/passkeys/authentication/options", { method: "POST" })
  }

  async verifyPasskeyAuthentication(
    ceremonyId: string,
    response: Record<string, unknown>,
  ): Promise<PasskeyAuthenticationResult> {
    return this.request<PasskeyAuthenticationResult>("/passkeys/authentication/verify", {
      method: "POST",
      body: JSON.stringify({ ceremonyId, response }),
    })
  }

  async getRecoveryStatus(): Promise<RecoveryStatus> {
    return this.request<RecoveryStatus>("/recovery/status")
  }

  async startRecovery(): Promise<RecoveryStartResult> {
    return this.request<RecoveryStartResult>("/recovery/start", { method: "POST" })
  }

  async completeRecovery(input: {
    recoveryId: string
    recoveryPublicKey: string
    signature: string
    package: CryptoWalletPackage
  }) {
    return this.request<{ packageVersion?: number; status: string }>("/recovery/complete", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async listDevices(): Promise<Device[]> {
    return this.request<Device[]>("/devices")
  }

  async startDeviceEnrollment(
    input: { label: string; platform?: string; publicKey: string; keyAgreementPublicKey?: string },
    walletAuthorizationToken: string,
  ) {
    return this.request<{ deviceId: string; ceremonyId: string; challenge: string }>("/devices/enrollment/start", {
      method: "POST",
      body: JSON.stringify(input),
    }, { walletAuthorizationToken })
  }

  async completeDeviceEnrollment(
    input: { deviceId: string; ceremonyId: string; signature: string },
    walletAuthorizationToken: string,
  ) {
    return this.request<{ deviceId: string; status: string }>("/devices/enrollment/complete", {
      method: "POST",
      body: JSON.stringify(input),
    }, { walletAuthorizationToken })
  }

  async revokeDevice(deviceId: string, walletAuthorizationToken: string) {
    return this.request<{ deviceId: string; status: string }>(
      `/devices/${encodeURIComponent(deviceId)}/revoke`,
      { method: "POST" },
      { walletAuthorizationToken },
    )
  }

  async commitWalletPackage(
    walletPackage: CryptoWalletPackage,
    walletAuthorizationToken: string,
    rotate = false,
  ): Promise<CryptoWalletPackageDocument> {
    return this.request<CryptoWalletPackageDocument>(rotate ? "/wallets/me/rotate" : "/wallets/me/package", {
      method: "POST",
      body: JSON.stringify(walletPackage),
    }, { walletAuthorizationToken })
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
    walletSessionToken?: string,
  ): Promise<CryptoTransactionIntent> {
    const response = await this.request<{ data: CryptoTransactionIntent; existing: boolean }>(
      "/transactions/intents",
      { method: "POST", body: JSON.stringify(input) },
      { walletSessionToken, unwrap: false },
    )
    return response.data
  }

  async simulateIntent(intentId: string, signal?: AbortSignal): Promise<CryptoIntentSimulation> {
    return this.request<CryptoIntentSimulation>(`/transactions/intents/${encodeURIComponent(intentId)}/simulate`, {
      method: "POST",
    }, { signal })
  }

  async submitIntent(intentId: string, signedTransaction: string, signal?: AbortSignal): Promise<CryptoTransactionRecord> {
    return this.request<CryptoTransactionRecord>(`/transactions/intents/${encodeURIComponent(intentId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ signedTransaction }),
    }, { signal })
  }

  async getSponsorshipConfig(signal?: AbortSignal): Promise<SponsorshipConfig> {
    return this.request<SponsorshipConfig>("/sponsorship/config", {}, { signal })
  }

  async quoteSponsorship(input: {
    accountId: string
    networkId: string
    operation: "native-transfer" | "token-transfer" | "contract-call"
    intentId?: string
  }, signal?: AbortSignal): Promise<SponsorshipOperation> {
    return this.request<SponsorshipOperation>("/sponsorship/quote", {
      method: "POST",
      body: JSON.stringify(input),
    }, { signal })
  }

  async prepareSponsorship(operationId: string, intentId: string, signal?: AbortSignal): Promise<SponsorshipOperation> {
    return this.request<SponsorshipOperation>(`/sponsorship/operations/${encodeURIComponent(operationId)}/prepare`, {
      method: "POST",
      body: JSON.stringify({ intentId }),
    }, { signal })
  }

  async submitSponsorship(operationId: string, signedPayload: Record<string, unknown>, signal?: AbortSignal) {
    return this.request<{ operation: SponsorshipOperation; txHash?: string; providerStatus: string }>(`/sponsorship/operations/${encodeURIComponent(operationId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ signedPayload }),
    }, { signal })
  }

  async getSponsorshipStatus(operationId: string, signal?: AbortSignal): Promise<SponsorshipOperation> {
    return this.request<SponsorshipOperation>(`/sponsorship/operations/${encodeURIComponent(operationId)}`, {}, { signal })
  }

  async getHyperliquidMarkets(signal?: AbortSignal): Promise<HyperliquidMarkets> {
    return this.request<HyperliquidMarkets>("/trading/hyperliquid/markets", {}, { signal })
  }

  async getHyperliquidAccount(signal?: AbortSignal): Promise<HyperliquidAccount> {
    return this.request<HyperliquidAccount>("/trading/hyperliquid/account", {}, { signal })
  }

  async createHyperliquidIntent(input: Record<string, unknown>, signal?: AbortSignal): Promise<HyperliquidIntent> {
    return this.request<HyperliquidIntent>("/trading/hyperliquid/intents", {
      method: "POST",
      body: JSON.stringify(input),
    }, { signal })
  }

  async submitHyperliquidIntent(intentId: string, signatures: Array<{ r: string; s: string; v: number }>, signal?: AbortSignal) {
    return this.request<{ intentId: string; status: string; results: unknown[] }>(`/trading/hyperliquid/intents/${encodeURIComponent(intentId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ signatures }),
    }, { signal })
  }

  async getIntertrainUsdcBridgeStatus(signal?: AbortSignal) {
    return this.request<{ enabled: boolean; available: boolean; sourceNetworks: string[]; destinationNetwork: string; asset: string; reason?: string; paused?: boolean }>("/bridge/intertrain/usdc/status", {}, { signal })
  }

  async createIntertrainUsdcBridgeIntents(input: { accountId: string; amount: string; idempotencyKey?: string }, signal?: AbortSignal) {
    return this.request<{ intents: CryptoTransactionIntent[] }>("/bridge/intertrain/usdc/intents", { method: "POST", body: JSON.stringify(input) }, { signal })
  }

  async listHyperliquidAgents(signal?: AbortSignal) {
    return this.request<HyperliquidTradingAgent[]>("/trading/hyperliquid/agents", {}, { signal })
  }

  async registerHyperliquidAgent(input: Omit<HyperliquidTradingAgent, "id" | "status" | "approvedAt" | "revokedAt">, walletAuthorizationToken: string, signal?: AbortSignal) {
    return this.request<HyperliquidTradingAgent>("/trading/hyperliquid/agents", { method: "POST", body: JSON.stringify(input) }, { walletAuthorizationToken, signal })
  }

  async revokeHyperliquidAgent(address: string, walletAuthorizationToken: string, signal?: AbortSignal) {
    return this.request<HyperliquidTradingAgent>(`/trading/hyperliquid/agents/${encodeURIComponent(address)}/revoke`, { method: "POST" }, { walletAuthorizationToken, signal })
  }

  async createTradingSession(input: {
    accountId: string
    chainFamily: "evm" | "solana"
    networkIds: string[]
    allowedTargets?: string[]
    allowedOperations?: string[]
    maxTransactionValue?: string
    maxDailyValue?: string
    maxRequestsPerMinute?: number
    ttlSeconds?: number
  }, walletAuthorizationToken: string) {
    return this.request<{ session: WalletTradingSession; token: string }>("/wallets/me/sessions", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        // Delegated sessions are deliberately limited to trading operations.
        allowedOperations: input.allowedOperations ?? ["transfer"],
      }),
    }, { walletAuthorizationToken })
  }

  async listTradingSessions() {
    return this.request<WalletTradingSession[]>("/wallets/me/sessions")
  }

  async revokeTradingSession(sessionId: string, walletAuthorizationToken: string) {
    await this.request(`/wallets/me/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: "POST" }, { walletAuthorizationToken })
  }

  async revokeAllTradingSessions(walletAuthorizationToken: string) {
    await this.request("/wallets/me/sessions/revoke-all", { method: "POST" }, { walletAuthorizationToken })
  }

  async getHyperliquidIntent(intentId: string, signal?: AbortSignal): Promise<HyperliquidIntent> {
    return this.request<HyperliquidIntent>(`/trading/hyperliquid/intents/${encodeURIComponent(intentId)}`, {}, { signal })
  }

  async createModernSpotIntent(input: {
    networkId: "ethereum-mainnet" | "arbitrum-one"
    sellToken: string
    buyToken: string
    sellAmountBaseUnits: string
    slippagePercentage?: number
    idempotencyKey?: string
  }, signal?: AbortSignal): Promise<CryptoTransactionIntent> {
    return this.request<CryptoTransactionIntent>("/trading/spot/evm/intents", {
      method: "POST",
      body: JSON.stringify(input),
    }, { signal })
  }

  async createModernLifiSwapIntent(input: {
    sourceNetworkId: "ethereum-mainnet" | "arbitrum-one" | "solana-mainnet-beta" | "sui-mainnet"
    destinationNetworkId: "ethereum-mainnet" | "arbitrum-one" | "solana-mainnet-beta" | "sui-mainnet"
    sellToken: string
    buyToken: string
    sellAmountBaseUnits: string
    slippagePercentage?: number
    idempotencyKey?: string
  }, signal?: AbortSignal): Promise<CryptoTransactionIntent> {
    return this.request<CryptoTransactionIntent>("/trading/spot/lifi/intents", {
      method: "POST", body: JSON.stringify(input),
    }, { signal })
  }

  async getModernSpotMarkets(signal?: AbortSignal) {
    return this.request<{ markets: Array<{ id: string; symbol: string; quote: string; networkId: "ethereum-mainnet" | "arbitrum-one" | "solana-mainnet-beta"; venue: "0x" | "jupiter"; chartSymbol: string; chartSupported: boolean; price?: number; icon?: string | null; sellToken?: string; buyToken?: string; inputMint?: string; outputMint?: string; baseDecimals?: number; quoteDecimals?: number }> }>("/trading/spot/markets", {}, { signal })
  }

  async createModernSolanaSpotIntent(input: {
    inputMint: string
    outputMint: string
    amountBaseUnits: string
    slippageBps?: number
    idempotencyKey?: string
  }, signal?: AbortSignal): Promise<CryptoTransactionIntent> {
    return this.request<CryptoTransactionIntent>("/trading/spot/solana/intents", {
      method: "POST", body: JSON.stringify(input),
    }, { signal })
  }

  async createHyperliquidDepositIntents(input: { amount: number; idempotencyKey?: string }, signal?: AbortSignal) {
    return this.request<{ networkId: string; amount: number; intents: CryptoTransactionIntent[] }>("/trading/hyperliquid/deposit/intents", {
      method: "POST", body: JSON.stringify(input),
    }, { signal })
  }

  private async request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set("accept", "application/json")
    if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json")
    if (options.walletAuthorizationToken) headers.set("x-wallet-authorization", options.walletAuthorizationToken)
    if (options.walletSessionToken) headers.set("x-wallet-session-token", options.walletSessionToken)

    const endpoint = `${this.basePath}${path}`
    let response: Response
    try {
      response = await this.fetcher(endpoint, {
        ...init,
        credentials: "include",
        headers,
        cache: "no-store",
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      if (process.env.NODE_ENV !== "production") {
        console.error("[crypto-backend] request failed before receiving a response", {
          endpoint,
          method: init.method ?? "GET",
          reason,
        })
      }
      throw new CryptoBackendError(
        `Crypto backend request failed before a response (${init.method ?? "GET"} ${endpoint}): ${reason}`,
        0,
        "CRYPTO_BACKEND_UNREACHABLE",
        { endpoint, method: init.method ?? "GET", reason },
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
    if (!response.ok || payload.success === false) {
      if (response.status === 401 && !options._retried && typeof window !== "undefined") {
        // clerk-js refreshes the session cookie as a side effect of getToken().
        try {
          await (window as { Clerk?: { session?: { getToken?: (o?: { skipCache?: boolean }) => Promise<string | null> } } }).Clerk?.session?.getToken?.({ skipCache: true })
        } catch {}
        return this.request<T>(path, init, { ...options, _retried: true })
      }
      throw new CryptoBackendError(
        payload.error?.message ?? `Crypto backend request failed (${response.status})`,
        response.status,
        payload.error?.code ?? "CRYPTO_API_ERROR",
        payload.error?.details,
        requestId,
      )
    }

    if (options.unwrap === false) return body as T
    return payload.data as T
  }
}

// Dev-only bypass (see lib/dev-auth-bypass.ts): answer from the in-browser
// mock instead of the proxy route. The mock is stateful and the route is
// serverless once deployed, so a round trip could — and did — land on an
// instance that had never heard of the wallet. Keeping the state in the tab
// that owns it removes the failure mode rather than narrowing it.
export const cryptoBackendClient = new CryptoBackendClient(
  DEV_AUTH_BYPASS && typeof window !== "undefined" ? { fetcher: devMockFetch } : {},
)
