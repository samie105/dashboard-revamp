/**
 * Worldstreet crypto backend — internal client.
 *
 * This is NOT a published package and no registry scope is claimed for it.
 * It is vendored: copy this file into the consuming app (for example
 * `src/lib/cryptoClient.ts`) and import it by relative path.
 *
 * Being a copy, it can drift from the backend it talks to. The parts that
 * matter most are the ones the server validates strictly and will reject
 * outright: the wallet package schema, and the per-family signed-transaction
 * encoding. Record the origin when you copy it, so a mismatch is traceable:
 *
 *   vendored from worldstreet-crypto-backend @ 5a886608a2daa16ea38ee7ebe04ee754b8e5d837
 *
 * Canonical source: `sdk/src/index.ts` in worldstreet-crypto-backend.
 * Integration guide: `docs/frontend-integration.md` in the same repo.
 */

export type ClerkTokenProvider = () => string | undefined | Promise<string | undefined>

export type Wallet = {
  id: string
  userId: string
  status: string
  version: number
  securityVersion: number
  provisioningMode: string
  createdAt: string
  updatedAt: string
}

export type WalletAccount = {
  id: string
  walletId: string
  chainFamily: 'evm' | 'solana' | string
  keyAlgorithm: string
  keyType: string
  state: string
  publicKey?: string
  canonicalAddress?: string
  addresses?: Array<{ id: string; networkId: string; address: string; isCanonical: boolean }>
}

export type WalletDetails = Wallet & { accounts: WalletAccount[] }
export type Network = { id: string; family: string; name: string; environment: string; chainId?: number; cluster?: string; nativeAsset: string; capabilities: Record<string, boolean> }
export type WalletPackage = Record<string, unknown>
export type PasskeyOptions = Record<string, unknown>
export type PasskeyResponse = Record<string, unknown>
export type WalletSession = Record<string, unknown> & { id: string; status: string; expiresAt: string }
export type Balance = Record<string, unknown>
export type TransactionIntent = Record<string, unknown> & { id: string; status: string }
export type TransactionRecord = Record<string, unknown> & { id: string; status: string }

export type TransferInput = {
  accountId: string
  networkId: string
  asset: { kind: 'native' | 'token'; identifier: string }
  to: string
  amount: string
  idempotencyKey?: string
}

export type CreateSessionInput = {
  accountId: string
  chainFamily: 'evm' | 'solana'
  networkIds: string[]
  allowedTargets?: string[]
  allowedOperations?: string[]
  maxTransactionValue?: string
  maxDailyValue?: string
  maxRequestsPerMinute?: number
  ttlSeconds?: number
}

export class CryptoApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly details?: unknown) {
    super(message)
    this.name = 'CryptoApiError'
  }
}

export class WorldstreetCryptoClient {
  private readonly baseUrl: string
  private readonly getClerkToken: ClerkTokenProvider
  private readonly fetcher: typeof fetch

  constructor(options: { baseUrl: string; getClerkToken: ClerkTokenProvider; apiBasePath?: string; fetcher?: typeof fetch }) {
    this.baseUrl = `${options.baseUrl.replace(/\/$/, '')}${options.apiBasePath ?? '/v1'}`
    this.getClerkToken = options.getClerkToken
    this.fetcher = options.fetcher ?? fetch
  }

  async createWallet(): Promise<Wallet> { return this.request<Wallet>('/wallets', { method: 'POST' }) }
  async createWalletWithAccounts(chainFamilies: string[] = ['evm', 'solana']): Promise<{ wallet: Wallet; accounts: WalletAccount[] }> {
    const wallet = await this.createWallet()
    const accounts = await Promise.all(chainFamilies.map((chainFamily) => this.prepareAccount({ chainFamily })))
    return { wallet, accounts }
  }
  async getWallet(): Promise<WalletDetails> { return this.request<WalletDetails>('/wallets/me') }
  async listNetworks(): Promise<Network[]> { return this.request<Network[]>('/networks') }
  async prepareAccount(input: { chainFamily: string; keyAlgorithm?: string; keyType?: string }): Promise<WalletAccount> {
    return this.request<WalletAccount>('/wallets/me/accounts/prepare', { method: 'POST', body: JSON.stringify(input) })
  }
  async getWalletPackage(): Promise<WalletPackage> { return this.request<WalletPackage>('/wallets/me/package') }
  async commitWalletPackage(walletPackage: WalletPackage, walletAuthorizationToken: string, rotate = false): Promise<WalletPackage> {
    return this.request<WalletPackage>(rotate ? '/wallets/me/rotate' : '/wallets/me/package', { method: 'POST', body: JSON.stringify(walletPackage) }, { walletAuthorizationToken })
  }

  async createPasskeyRegistrationOptions(): Promise<{ ceremonyId: string; options: PasskeyOptions }> { return this.request('/passkeys/registration/options', { method: 'POST' }) }
  async verifyPasskeyRegistration(ceremonyId: string, response: PasskeyResponse): Promise<Record<string, unknown>> {
    return this.request('/passkeys/registration/verify', { method: 'POST', body: JSON.stringify({ ceremonyId, response }) })
  }
  async createPasskeyAuthenticationOptions(): Promise<{ ceremonyId: string; options: PasskeyOptions }> { return this.request('/passkeys/authentication/options', { method: 'POST' }) }
  async verifyPasskeyAuthentication(ceremonyId: string, response: PasskeyResponse): Promise<{ walletAuthorizationToken: string; expiresIn: number }> {
    return this.request('/passkeys/authentication/verify', { method: 'POST', body: JSON.stringify({ ceremonyId, response }) })
  }

  async createTradingSession(input: CreateSessionInput, walletAuthorizationToken: string): Promise<{ session: WalletSession; token: string }> {
    return this.request('/wallets/me/sessions', { method: 'POST', body: JSON.stringify(input) }, { walletAuthorizationToken })
  }
  async listTradingSessions(): Promise<WalletSession[]> { return this.request('/wallets/me/sessions') }
  async revokeTradingSession(sessionId: string, walletAuthorizationToken: string): Promise<void> {
    await this.request(`/wallets/me/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: 'POST' }, { walletAuthorizationToken })
  }
  async revokeAllTradingSessions(walletAuthorizationToken: string): Promise<void> {
    await this.request('/wallets/me/sessions/revoke-all', { method: 'POST' }, { walletAuthorizationToken })
  }

  async createTransferIntent(input: TransferInput, walletSessionToken?: string): Promise<TransactionIntent> {
    const result = await this.request<{ data: TransactionIntent; existing: boolean }>('/transactions/intents', { method: 'POST', body: JSON.stringify(input) }, { walletSessionToken, rawEnvelope: true })
    return result.data
  }
  async simulateIntent(intentId: string): Promise<{ validation: Record<string, unknown>; simulation: Record<string, unknown> }> {
    return this.request(`/transactions/intents/${encodeURIComponent(intentId)}/simulate`, { method: 'POST' })
  }
  async submitIntent(intentId: string, signedTransaction: string, walletSessionToken?: string): Promise<TransactionRecord> {
    return this.request(`/transactions/intents/${encodeURIComponent(intentId)}/submit`, { method: 'POST', body: JSON.stringify({ signedTransaction }) }, { walletSessionToken })
  }
  async getIntent(intentId: string): Promise<TransactionIntent> { return this.request(`/transactions/intents/${encodeURIComponent(intentId)}`) }
  async getTransaction(transactionId: string): Promise<TransactionRecord> { return this.request(`/transactions/${encodeURIComponent(transactionId)}`) }
  async listTransactions(limit = 50): Promise<TransactionRecord[]> { return this.request(`/transactions?limit=${encodeURIComponent(String(limit))}`) }
  async getBalances(accountId: string, networkId: string, assets: string[] = []): Promise<Balance[]> {
    const query = new URLSearchParams({ networkId })
    if (assets.length > 0) query.set('assets', assets.join(','))
    return this.request(`/wallets/me/accounts/${encodeURIComponent(accountId)}/balances?${query.toString()}`)
  }

  private async request<T>(path: string, init: RequestInit = {}, options: { walletAuthorizationToken?: string; walletSessionToken?: string; rawEnvelope?: boolean } = {}): Promise<T> {
    const clerkToken = await this.getClerkToken()
    if (!clerkToken) throw new CryptoApiError('CLERK_TOKEN_MISSING', 'A Clerk token is required', 401)
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${clerkToken}`)
    headers.set('accept', 'application/json')
    if (init.body !== undefined) headers.set('content-type', 'application/json')
    if (options.walletAuthorizationToken) headers.set('x-wallet-authorization', options.walletAuthorizationToken)
    if (options.walletSessionToken) headers.set('x-wallet-session-token', options.walletSessionToken)
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers })
    const body = await response.json().catch(() => undefined) as { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } }
    if (!response.ok || body.success === false) {
      throw new CryptoApiError(body.error?.code ?? 'API_ERROR', body.error?.message ?? `Crypto API request failed (${response.status})`, response.status, body.error?.details)
    }
    return (options.rawEnvelope ? body : body.data) as T
  }
}
