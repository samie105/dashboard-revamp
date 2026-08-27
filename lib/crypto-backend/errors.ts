export class CryptoBackendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "CRYPTO_BACKEND_ERROR",
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = "CryptoBackendError"
  }
}
