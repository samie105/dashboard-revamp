export class CryptoBackendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "CRYPTO_BACKEND_ERROR",
    public readonly details?: unknown,
    public readonly requestId?: string,
    /** Raw Retry-After response header, when the backend sent one (guide §12.1, 429). */
    public readonly retryAfter?: string
  ) {
    super(message)
    this.name = "CryptoBackendError"
  }
}
