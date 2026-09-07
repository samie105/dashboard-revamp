import { CryptoBackendError } from "@/lib/crypto-backend"

const feeAsset: Record<string, string> = {
  ethereum: "ETH",
  arbitrum: "ETH",
  solana: "SOL",
  sui: "SUI",
  ton: "TON",
  tron: "TRX",
}

export function formatWalletActionError(error: unknown, chain?: string, asset?: string): string {
  const code = error instanceof CryptoBackendError ? error.code : ""
  const raw = error instanceof Error ? error.message : String(error)
  const errorDetails = error instanceof CryptoBackendError && error.details && typeof error.details === "object"
    ? error.details as Record<string, unknown>
    : undefined
  const details = error instanceof CryptoBackendError && error.details !== undefined ? JSON.stringify(error.details) : ""
  const text = `${raw} ${details}`.toLowerCase()
  const fee = feeAsset[chain ?? ""]
  if (code === "INSUFFICIENT_ALLOWANCE" || text.includes("allowance")) return `Approve enough ${asset ?? "tokens"} first, wait for confirmation, then try again.`
  if (code === "FEE_TOO_LOW" || /max fee per gas less than block base fee|transaction underpriced/i.test(text)) return "The network fee changed before submission. Refresh and try again."
  if (code === "INSUFFICIENT_FUNDS" || /insufficient funds|insufficient balance|not enough .*gas|insufficient lamports|exceeds balance|max fee per gas less than block base fee/.test(text)) {
    const reportedAsset = typeof errorDetails?.asset === "string" ? errorDetails.asset : undefined
    if (reportedAsset && reportedAsset.toUpperCase() === fee) return `Not enough ${fee} to pay the network fee. Add ${fee} and try again.`
    if (reportedAsset && asset && reportedAsset.toUpperCase() === asset.toUpperCase()) return `Not enough ${asset} for this transaction. Add funds and try again.`
    return fee ? `Not enough ${asset ?? "funds"} or ${fee} for network fees. Add funds and try again.` : "Not enough balance to cover this transaction and its network fees."
  }
  if (code === "INSUFFICIENT_GAS") return fee ? `Not enough ${fee} to pay the network fee.` : "Not enough native balance to pay the network fee."
  if (code === "USER_REJECTED" || /user rejected|user denied|rejected the request|denied request/.test(text)) return "You cancelled the wallet approval. Nothing was sent."
  if (code === "ROUTER_DISABLED" || code === "NO_QUOTE" || code === "QUOTE_EXPIRED") return "This route is temporarily unavailable. Refresh the price and try again."
  if (code === "ACCOUNT_NOT_READY") return `Your ${chain ? chain : "wallet"} account is not ready for this action yet.`
  return raw || "Transaction failed. Nothing was sent."
}
