import {
  CryptoApiError,
  WorldstreetCryptoClient,
  type ClerkTokenProvider,
} from "./client"

export type AuthMe = {
  userId: string
  clerkUserId: string
  sessionId?: string
  claims?: Record<string, unknown>
}

export type CryptoApiOptions = {
  baseUrl: string
  getClerkToken: ClerkTokenProvider
  timeoutMs?: number
  fetcher?: typeof fetch
}

export function createTimeoutFetcher(
  timeoutMs: number,
  base: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs,
    )
    const signal = init?.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal
    try {
      return await base(input, { ...init, signal })
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Composition over the vendored client: `client` covers the 22 SDK routes,
 * this class adds the routes the SDK lacks (auth/me now; devices and
 * recovery arrive with Phase 2) and injects a timeout fetcher into both.
 */
export class CryptoApi {
  readonly client: WorldstreetCryptoClient
  private readonly baseUrl: string
  private readonly getClerkToken: ClerkTokenProvider
  private readonly fetcher: typeof fetch

  constructor(options: CryptoApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "")
    this.getClerkToken = options.getClerkToken
    this.fetcher = options.fetcher ?? createTimeoutFetcher(options.timeoutMs ?? 15_000)
    this.client = new WorldstreetCryptoClient({
      baseUrl: options.baseUrl,
      getClerkToken: options.getClerkToken,
      fetcher: this.fetcher,
    })
  }

  async getAuthMe(): Promise<AuthMe> {
    return this.request<AuthMe>("/v1/auth/me")
  }

  // Same envelope semantics as the vendored client's private request().
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getClerkToken()
    if (!token) {
      throw new CryptoApiError("CLERK_TOKEN_MISSING", "A Clerk token is required", 401)
    }
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${token}`)
    headers.set("accept", "application/json")
    if (init.body !== undefined) headers.set("content-type", "application/json")
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers })
    const body = (await response.json().catch(() => undefined)) as
      | {
          success?: boolean
          data?: T
          error?: { code?: string; message?: string; details?: unknown }
        }
      | undefined
    if (!response.ok || body?.success === false) {
      throw new CryptoApiError(
        body?.error?.code ?? "API_ERROR",
        body?.error?.message ?? `Crypto API request failed (${response.status})`,
        response.status,
        body?.error?.details,
      )
    }
    return body?.data as T
  }
}
