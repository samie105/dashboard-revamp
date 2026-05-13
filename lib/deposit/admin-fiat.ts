import { type IDeposit } from "@/models/Deposit"

export const FIAT_DEPOSIT_NETWORKS = ["solana", "ethereum", "tron"] as const

export type FiatDepositNetwork = (typeof FIAT_DEPOSIT_NETWORKS)[number]

export interface AdminFiatAvailability {
  enabled: boolean
  available: number
  balance?: number
  reserved?: number
  reason?: string
}

export type AdminFiatAvailabilityResponse = {
  success: boolean
  token: "USDT"
  chains: Record<FiatDepositNetwork, AdminFiatAvailability>
}

type AdminReserveResponse = {
  success?: boolean
  adminDepositId?: string
  reservationExpiresAt?: string
  deposit?: {
    _id?: string
    id?: string
    expiresAt?: string
    disburseTxHash?: string
    status?: string
  }
}

type AdminExecuteResponse = AdminReserveResponse & {
  accepted?: boolean
  status?: string
  txHash?: string
}

type AdminStatusResponse = {
  _id?: string
  id?: string
  status?: string
  disburseTxHash?: string
  adminNotes?: string
}

export class AdminFiatError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "AdminFiatError"
    this.status = status
    this.code = code
  }
}

function adminConfig() {
  const baseUrl = process.env.ADMIN_BACKEND_URL?.replace(/\/+$/, "")
  const apiKey = process.env.ADMIN_BACKEND_API_KEY
  if (!baseUrl || !apiKey) {
    throw new AdminFiatError("Admin deposit service is not configured", 503, "ADMIN_NOT_CONFIGURED")
  }
  return { baseUrl, apiKey }
}

async function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { baseUrl, apiKey } = adminConfig()
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...((options.headers as Record<string, string>) || {}),
    },
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : `Admin deposit service returned ${response.status}`
    throw new AdminFiatError(message, response.status, body?.code)
  }

  return body as T
}

function adminDepositIdFrom(response: AdminReserveResponse | AdminExecuteResponse) {
  return response.adminDepositId || response.deposit?._id || response.deposit?.id
}

function reservationExpiryFrom(response: AdminReserveResponse | AdminExecuteResponse) {
  return response.reservationExpiresAt || response.deposit?.expiresAt
}

export async function getAdminFiatAvailability(): Promise<AdminFiatAvailabilityResponse> {
  return adminRequest<AdminFiatAvailabilityResponse>("/api/deposits/fiat/availability?token=USDT")
}

export async function reserveAdminFiatDeposit(input: {
  externalReference: string
  userId: string
  userWalletAddress: string
  chain: FiatDepositNetwork
  amount: number
  fiatCurrency: string
  fiatAmount: number
}) {
  const response = await adminRequest<AdminReserveResponse>("/api/deposits/fiat/reserve", {
    method: "POST",
    body: JSON.stringify({
      source: "fiat",
      externalReference: input.externalReference,
      fiatProvider: "flutterwave",
      fiatCurrency: input.fiatCurrency,
      fiatAmount: input.fiatAmount,
      walletType: "asset",
      userId: input.userId,
      userWalletAddress: input.userWalletAddress,
      chain: input.chain,
      requestedToken: "USDT",
      requestedAmount: input.amount,
    }),
  })

  const adminDepositId = adminDepositIdFrom(response)
  const reservationExpiresAt = reservationExpiryFrom(response)
  if (!adminDepositId || !reservationExpiresAt) {
    throw new AdminFiatError("Admin reservation response was incomplete", 502, "BAD_ADMIN_RESPONSE")
  }

  return { adminDepositId, reservationExpiresAt }
}

export async function cancelAdminFiatReservation(externalReference: string, reason: string) {
  if (!externalReference) return
  try {
    await adminRequest("/api/deposits/fiat/cancel", {
      method: "POST",
      body: JSON.stringify({ externalReference, reason }),
    })
  } catch (error) {
    console.error("[Deposit] Failed to cancel admin reservation:", error)
  }
}

export async function executeAdminFiatDisbursement(deposit: IDeposit) {
  const response = await adminRequest<AdminExecuteResponse>("/api/deposits/fiat/execute", {
    method: "POST",
    body: JSON.stringify({
      source: "fiat",
      externalReference: deposit.merchantTransactionReference,
      fiatProvider: "flutterwave",
      fiatCurrency: deposit.fiatCurrency,
      fiatAmount: deposit.fiatAmount,
      walletType: "asset",
      userId: deposit.userId,
      userWalletAddress: deposit.userWalletAddress,
      chain: deposit.network,
      requestedToken: "USDT",
      requestedAmount: deposit.usdtAmount,
    }),
  })

  return response
}

export async function syncAdminFiatStatus(deposit: IDeposit) {
  if (!deposit.adminDepositId) return deposit

  try {
    const adminDeposit = await adminRequest<AdminStatusResponse>(
      `/api/deposits/status/${encodeURIComponent(deposit.adminDepositId)}`,
    )
    if (adminDeposit.status === "completed" && adminDeposit.disburseTxHash) {
      deposit.status = "completed"
      deposit.txHash = adminDeposit.disburseTxHash
      deposit.deliveryError = undefined
      deposit.completedAt = deposit.completedAt || new Date()
      await deposit.save()
    }
  } catch (error) {
    console.error("[Deposit] Failed to sync admin disbursement status:", error)
  }

  return deposit
}

export function shouldRetryAdminExecute(deposit: IDeposit) {
  if (!["payment_confirmed", "sending_usdt"].includes(deposit.status)) return false
  if (deposit.txHash) return false
  if (!deposit.disbursementRequestedAt) return true
  return Date.now() - deposit.disbursementRequestedAt.getTime() > 60_000
}

export async function requestAdminDisbursement(deposit: IDeposit) {
  if (!shouldRetryAdminExecute(deposit)) return deposit

  await syncAdminFiatStatus(deposit)
  if (deposit.status === "completed") return deposit

  deposit.status = "sending_usdt"
  deposit.disbursementRequestedAt = new Date()
  deposit.deliveryError = undefined
  await deposit.save()

  try {
    const response = await executeAdminFiatDisbursement(deposit)
    const adminDepositId = adminDepositIdFrom(response)
    if (adminDepositId) deposit.adminDepositId = adminDepositId

    const txHash = response.txHash || response.deposit?.disburseTxHash
    if ((response.status === "completed" || response.deposit?.status === "completed") && txHash) {
      deposit.status = "completed"
      deposit.txHash = txHash
      deposit.completedAt = new Date()
    } else {
      deposit.status = "sending_usdt"
    }

    await deposit.save()
  } catch (error) {
    const adminError =
      error instanceof AdminFiatError
        ? error
        : new AdminFiatError(error instanceof Error ? error.message : "Admin execute failed", 500)

    const fatalCodes = new Set(["INSUFFICIENT_LIQUIDITY", "NO_DISBURSE_WALLET", "DISBURSEMENT_FAILED"])
    if (fatalCodes.has(adminError.code || "") || (adminError.status >= 400 && adminError.status < 500 && adminError.status !== 409)) {
      deposit.status = "delivery_failed"
      deposit.deliveryError = adminError.message
    } else {
      deposit.status = "payment_confirmed"
      deposit.deliveryError = `Disbursement request pending retry: ${adminError.message}`
    }
    await deposit.save()
  }

  return deposit
}

export async function repairFiatDisbursementIfNeeded(deposit: IDeposit) {
  if (!["payment_confirmed", "sending_usdt"].includes(deposit.status)) return deposit
  await syncAdminFiatStatus(deposit)
  if (deposit.status === "completed") return deposit
  return requestAdminDisbursement(deposit)
}
