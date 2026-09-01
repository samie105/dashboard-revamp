import { isAddress } from "viem"
import bs58 from "bs58"

export type AddressCheck = { ok: true } | { ok: false; problem: string }

export function validateAddress(family: string, address: string): AddressCheck {
  const trimmed = address.trim()
  if (!trimmed) return { ok: false, problem: "Enter a destination address." }
  switch (family) {
    case "evm":
      return isAddress(trimmed, { strict: false })
        ? { ok: true }
        : { ok: false, problem: "That doesn't look like a valid Ethereum-style address." }
    case "solana": {
      try {
        return bs58.decode(trimmed).length === 32
          ? { ok: true }
          : { ok: false, problem: "That doesn't look like a valid Solana address." }
      } catch {
        return { ok: false, problem: "That doesn't look like a valid Solana address." }
      }
    }
    case "sui":
      return /^0x[0-9a-fA-F]{64}$/.test(trimmed)
        ? { ok: true }
        : { ok: false, problem: "Sui addresses are 0x followed by 64 hex characters." }
    case "ton":
      return /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/.test(trimmed)
        ? { ok: true }
        : { ok: false, problem: "That doesn't look like a valid TON address." }
    case "tron":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)
        ? { ok: true }
        : { ok: false, problem: "Tron addresses start with T and are 34 characters." }
    default:
      // Unknown family: be permissive locally, let the backend's validation rule.
      return trimmed.length >= 16 ? { ok: true } : { ok: false, problem: "Unrecognized address format." }
  }
}

export function toBaseUnits(amount: string, decimals: number): string | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim())
  if (!match || decimals < 0) return null
  const [, whole, fraction = ""] = match
  if (fraction.length > decimals) return null
  return (BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0")).toString()
}

export function validateAmount(input: { amount: string; decimals: number; availableBaseUnits?: string }):
  | { ok: true; baseUnits: string }
  | { ok: false; problem: string } {
  const baseUnits = toBaseUnits(input.amount, input.decimals)
  if (baseUnits === null) {
    return { ok: false, problem: input.amount.trim() ? `Use at most ${input.decimals} decimal places.` : "Enter an amount." }
  }
  if (BigInt(baseUnits) === BigInt(0)) return { ok: false, problem: "Amount must be more than zero." }
  if (input.availableBaseUnits !== undefined && BigInt(baseUnits) > BigInt(input.availableBaseUnits)) {
    return { ok: false, problem: "Amount exceeds your available balance." }
  }
  return { ok: true, baseUnits }
}
