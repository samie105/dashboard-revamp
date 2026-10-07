/**
 * View-model helpers for the redesigned wallet page
 * (components/wallet/redesign). Pure, so the rules the screen depends on —
 * how a holding is valued, what a filter keeps, where a row's action links —
 * are tested rather than eyeballed.
 *
 * usdValueOf and asOfLabel are the same rules ModernWalletPage applies
 * (components/crypto/ModernWalletPage.tsx), copied here unchanged so the old
 * page can stay as it is.
 */

import { formatCryptoAmount, type CryptoBalanceResult } from "@/hooks/crypto/useCryptoBalances"

const STABLES = ["USDC", "USDT", "USDC.E", "USDT.E"]

export function usdValueOf(balance: CryptoBalanceResult, index: Record<string, number> | null): number | null {
  // Stablecoins are worth one dollar by contract; they must not drop out of
  // the total because the optional price request is late.
  if (STABLES.includes(balance.symbol.toUpperCase())) {
    const amount = Number(formatCryptoAmount(balance.amountBaseUnits, balance.decimals))
    return Number.isFinite(amount) ? amount : null
  }
  // WSK is mint-gated 1:1 against USD — a protocol invariant, not a quote.
  if (balance.symbol.toUpperCase() === "WSK") {
    if (!/^\d+$/.test(balance.amountBaseUnits) || balance.decimals < 0) return null
    const amount = Number(balance.amountBaseUnits) / 10 ** balance.decimals
    return Number.isFinite(amount) ? amount : null
  }
  const price = index?.[(balance.symbol ?? "").toUpperCase()]
  if (price === undefined || !Number.isFinite(price) || price <= 0) return null
  const amount = Number(formatCryptoAmount(balance.amountBaseUnits, balance.decimals))
  if (!Number.isFinite(amount)) return null
  return amount * price
}

export function asOfLabel(generatedAt: string | null): string | null {
  if (!generatedAt) return null
  const date = new Date(generatedAt)
  if (Number.isNaN(date.getTime())) return null
  return `As of ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
}

/* ── Move-funds panel URL state ──────────────────────────────────────────── */

export type WalletAction = "deposit" | "withdraw" | "transfer"

/** `?action=` → the tab. Anything unknown (or missing) is Deposit, as in the preview. */
export function parseWalletAction(raw: string | null): WalletAction {
  return raw === "withdraw" || raw === "transfer" ? raw : "deposit"
}

export function walletActionHref(pathname: string, action: WalletAction, asset?: string, from?: "spot" | "futures"): string {
  return `${pathname}?action=${action}${asset ? `&asset=${encodeURIComponent(asset)}` : ""}${from ? `&from=${from}` : ""}`
}

/* ── Balances table ──────────────────────────────────────────────────────── */

export type WalletRow = {
  key: string
  symbol: string
  logo?: string
  /** The network the holding sits on, e.g. "Arbitrum One". */
  network: string
  /** The chain family that network belongs to. */
  family: string
  /** Which account the row sits in — the table's tabs. */
  account: AccountKey
  /** Free to move, when it differs from the amount (Futures). */
  available?: string
  /** Held as margin, when there is any (Futures). */
  held?: string
  /** The amount as the wallet formats it. */
  amount: string
  /** USD value, or null when the feed can't price it. */
  value: number | null
  /** Share of the wallet's priced total, 0–100. */
  share: number | null
  /** 24h move of the asset, when the feed has one. */
  change?: number
}

export type BalanceFilter = { tab: string; query: string; hideZero: boolean }

/** A zero row is one with nothing in it: no amount, or a priced value of 0. */
export function isZeroRow(row: Pick<WalletRow, "amount" | "value">): boolean {
  const n = Number(row.amount)
  return !(Number.isFinite(n) && n > 0) || row.value === 0
}

export function filterBalanceRows(rows: WalletRow[], { tab, query, hideZero }: BalanceFilter): WalletRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (tab === "all" || r.account === tab) &&
      (!hideZero || !isZeroRow(r)) &&
      (!q || r.symbol.toLowerCase().includes(q) || r.network.toLowerCase().includes(q)),
  )
}

/** Rows per tab, honouring hide-zero but not the search — as the preview counts. */
export function countBalanceRows(rows: WalletRow[], tab: string, hideZero: boolean): number {
  return filterBalanceRows(rows, { tab, query: "", hideZero }).length
}

/* ── Accounts ──────────────────────────────────────────────────────────── */

export type AccountKey = "spot" | "futures" | "earn"

export const ACCOUNTS: { key: AccountKey; label: string; caption: string; soon?: boolean }[] = [
  { key: "spot", label: "Spot", caption: "Ready to trade" },
  { key: "futures", label: "Futures", caption: "Margin collateral" },
  { key: "earn", label: "Earn", caption: "Coming soon", soon: true },
]

/** The trading account's figures, as GET trading/hyperliquid/account returns them. */
export type FuturesBalance = { accountValue: number; withdrawable: number }

/**
 * The hero's account split and state grid, from the same figures so they
 * reconcile with the total: Spot is the wallet's priced holdings (all of it
 * free to move), Futures is the trading account's value, of which the
 * withdrawable part is available and the rest is margin in use. Futures that
 * can't be read is "—" and adds nothing; Earn is never counted.
 */
export function accountView(walletTotal: number, futures: FuturesBalance | null) {
  const futuresValue = futures ? Math.max(0, futures.accountValue) : null
  const withdrawable = futures ? Math.min(Math.max(0, futures.withdrawable), futuresValue ?? 0) : 0
  const parts = ACCOUNTS.map((a) => ({
    key: a.key,
    label: a.label,
    caption: a.caption,
    soon: a.soon,
    value: a.key === "spot" ? walletTotal : a.key === "futures" ? futuresValue : null,
  }))
  return {
    parts,
    total: walletTotal + (futuresValue ?? 0),
    state: {
      available: walletTotal + withdrawable,
      inOrder: 0,
      locked: futuresValue !== null ? futuresValue - withdrawable : 0,
    },
  }
}

/* ── Activity ────────────────────────────────────────────────────────────── */

export type ActivityFilter = "all" | "deposit" | "withdrawal" | "trade"

type ActivityRow = { kind: "trade" | "transfer"; direction: "in" | "out" | "neutral" }

/** Deposits and withdrawals are transfers in and out; trades are their own tab. */
export function filterActivity<T extends ActivityRow>(rows: T[], filter: ActivityFilter): T[] {
  if (filter === "all") return rows
  if (filter === "trade") return rows.filter((r) => r.kind === "trade")
  const direction = filter === "deposit" ? "in" : "out"
  return rows.filter((r) => r.kind === "transfer" && r.direction === direction)
}

/** The ledger's status word, bucketed the way the old movements list did. */
export function statusTone(status: string): "completed" | "pending" | "failed" {
  if (/fail|error|revert|cancel/i.test(status)) return "failed"
  if (/confirm|success|complete/i.test(status)) return "completed"
  return "pending"
}

/* ── Move funds ──────────────────────────────────────────────────────────── */

/**
 * The amount field's input rule — the same one components/ui/flow.tsx's
 * AmountField applies: digits and one dot, no run of leading zeros, never
 * more decimals than the asset has. Returns null to reject the keystroke.
 */
export function acceptAmountInput(raw: string, maxDecimals: number): string | null {
  if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return null
  const [whole = "", frac] = raw.split(".")
  const w = whole.replace(/^0+(?=\d)/, "")
  if (frac !== undefined && frac.length > maxDecimals) return null
  return frac !== undefined ? `${w || "0"}.${frac}` : w
}

/** A percentage chip's amount: floored to the asset's places (max 8), so it
 *  can never propose more than the balance. */
export function chipAmount(max: number, pct: number, maxDecimals: number): string {
  const places = Math.min(Math.max(maxDecimals, 0), 8)
  return String(Math.floor(max * pct * 10 ** places) / 10 ** places)
}

/** Which funding flow a From → To pair runs; null when it involves Earn. */
export function transferMode(from: AccountKey, to: AccountKey): "fund" | "withdraw" | null {
  if (from === "spot" && to === "futures") return "fund"
  if (from === "futures" && to === "spot") return "withdraw"
  return null
}

/** The send flow's button label, in the Withdraw panel's words. One dropdown
 *  picks network and asset together, so its two blockers read as one. */
export function withdrawCtaLabel(flowLabel: string): string {
  if (flowLabel === "Review transfer") return "Review withdrawal"
  if (flowLabel === "Choose a network") return "Choose an asset"
  return flowLabel
}

/** The funding flow names the venue; the wallet page names the account. */
export function venueToAccount<T extends string | null>(text: T): T {
  return (text ? text.replace(/Hyperliquid Futures|Hyperliquid/g, "Futures") : text) as T
}
