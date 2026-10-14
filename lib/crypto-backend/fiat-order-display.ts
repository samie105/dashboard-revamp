import type { FiatOrder } from "./types"

type Leg = { amount?: string; currency: string }

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function stringValue(...values: unknown[]): string | undefined {
  const stringValue = values.find((value): value is string => typeof value === "string" && value.trim().length > 0)
  if (stringValue) return stringValue.trim()
  const numberValue = values.find((value): value is number => typeof value === "number" && Number.isFinite(value))
  return numberValue?.toString()
}

function providerInstruction(order: FiatOrder): Record<string, unknown> | undefined {
  const display = record(order.providerDisplay)
  if (!display) return undefined
  for (const key of ["paymentInstructions", "payment_instructions", "deposit", "source_deposit_instructions"]) {
    const candidate = record(display[key])
    if (candidate) return candidate
  }
  return display
}

export function fiatOrderFiatLeg(order: FiatOrder): Leg | undefined {
  if (order.direction === "onramp") {
    const instructions = providerInstruction(order)
    return {
      amount: stringValue(instructions?.amount, order.sourceAmount),
      currency: stringValue(instructions?.currency, order.sourceCurrency, order.currency) ?? order.currency,
    }
  }

  return {
    amount: stringValue(order.destinationAmount),
    currency: order.currency,
  }
}

export function cryptoAssetSymbol(asset: string | undefined, fallback = "Crypto"): string {
  const value = asset?.trim()
  if (!value) return fallback
  const last = value.split(":").at(-1)?.trim()
  return last ? last.toUpperCase() : value.toUpperCase()
}

export function networkLabel(network: string | undefined): string {
  const value = network?.trim()
  if (!value) return "network unavailable"
  const labels: Record<string, string> = {
    "solana-mainnet-beta": "Solana",
    "ethereum-mainnet": "Ethereum",
    "arbitrum-one": "Arbitrum One",
    "tron-mainnet": "Tron",
    "sui-mainnet": "Sui",
    "ton-mainnet": "TON",
  }
  return labels[value] ?? value.replace(/-mainnet(-beta)?$/, "").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

export function fiatOrderCryptoLeg(order: FiatOrder): Leg & { network: string; symbol: string } {
  const asset = order.observedDepositAsset ?? order.asset
  const network = order.observedDepositNetwork ?? order.network
  const symbol = cryptoAssetSymbol(order.destinationCurrency, cryptoAssetSymbol(asset))
  return {
    amount: order.direction === "onramp"
      ? stringValue(order.destinationAmount)
      : stringValue(order.observedDepositAmount, order.expectedDepositAmount),
    currency: symbol,
    network,
    symbol,
  }
}

export function formatFiatOrderAmount(amount: string | undefined, currency: string): string | null {
  if (!amount) return null
  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) return `${amount} ${currency}`
  return `${parsed.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${currency}`
}
