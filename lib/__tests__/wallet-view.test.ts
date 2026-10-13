import { describe, expect, it } from "vitest"

import type { CryptoBalanceResult } from "@/hooks/crypto/useCryptoBalances"
import {
  acceptAmountInput,
  chipAmount,
  transferMode,
  venueToAccount,
  withdrawCtaLabel,
  asOfLabel,
  countBalanceRows,
  filterActivity,
  filterBalanceRows,
  isZeroRow,
  parseWalletAction,
  accountView,
  statusTone,
  usdValueOf,
  walletActionHref,
  type WalletRow,
} from "@/lib/wallet-view"

function balance(symbol: string, amountBaseUnits: string, decimals: number): CryptoBalanceResult {
  return {
    symbol,
    amountBaseUnits,
    decimals,
    asset: { kind: "native", identifier: symbol },
    accountId: "acc",
    networkId: "net",
    networkName: "Net",
  } as unknown as CryptoBalanceResult
}

function row(over: Partial<WalletRow> & { symbol: string }): WalletRow {
  return {
    key: over.symbol + (over.network ?? ""),
    network: "Ethereum",
    family: "evm",
    account: "spot",
    amount: "1",
    value: 1,
    share: null,
    ...over,
  }
}

describe("usdValueOf", () => {
  it("values stablecoins at one dollar without a price", () => {
    expect(usdValueOf(balance("USDC", "2500000", 6), null)).toBe(2.5)
  })
  it("values WSK one-to-one", () => {
    expect(usdValueOf(balance("WSK", "3000000000000000000", 18), {})).toBe(3)
  })
  it("prices other assets from the index", () => {
    expect(usdValueOf(balance("ETH", "2000000000000000000", 18), { ETH: 3000 })).toBe(6000)
  })
  it("returns null when there is no price", () => {
    expect(usdValueOf(balance("ETH", "1", 18), {})).toBeNull()
    expect(usdValueOf(balance("ETH", "1", 18), { ETH: 0 })).toBeNull()
  })
})

describe("asOfLabel", () => {
  it("is null without a usable timestamp", () => {
    expect(asOfLabel(null)).toBeNull()
    expect(asOfLabel("not a date")).toBeNull()
  })
  it("labels a real timestamp", () => {
    expect(asOfLabel("2026-10-07T10:30:00Z")).toMatch(/^As of /)
  })
})

describe("move-funds URL state", () => {
  it("parses the action, defaulting to deposit", () => {
    expect(parseWalletAction("withdraw")).toBe("withdraw")
    expect(parseWalletAction("transfer")).toBe("transfer")
    expect(parseWalletAction("deposit")).toBe("deposit")
    expect(parseWalletAction(null)).toBe("deposit")
    expect(parseWalletAction("nonsense")).toBe("deposit")
  })
  it("builds a link with an optional, encoded asset", () => {
    expect(walletActionHref("/wallet/modern", "deposit")).toBe("/wallet/modern?action=deposit")
    expect(walletActionHref("/wallet/modern", "withdraw", "USDC.E")).toBe("/wallet/modern?action=withdraw&asset=USDC.E")
    expect(walletActionHref("/w", "deposit", "A&B")).toBe("/w?action=deposit&asset=A%26B")
    expect(walletActionHref("/w", "transfer", "USDC", "futures")).toBe("/w?action=transfer&asset=USDC&from=futures")
  })
})

describe("balance filters", () => {
  const rows = [
    row({ symbol: "ETH", family: "evm", network: "Arbitrum One" }),
    row({ symbol: "SOL", family: "solana", network: "Solana" }),
    row({ symbol: "USDC", family: "solana", network: "Solana", amount: "0", value: 0 }),
    row({ symbol: "TRUMP", family: "solana", network: "Solana", value: null }),
    row({ symbol: "USDC", family: "", network: "Trading account", account: "futures", value: 40 }),
  ]

  it("treats empty or zero-valued rows as zero, but not unpriced ones", () => {
    expect(isZeroRow({ amount: "0", value: 0 })).toBe(true)
    expect(isZeroRow({ amount: "5", value: 0 })).toBe(true)
    expect(isZeroRow({ amount: "5", value: null })).toBe(false)
  })

  it("filters by account tab", () => {
    expect(filterBalanceRows(rows, { tab: "futures", query: "", hideZero: false }).map((r) => r.symbol)).toEqual(["USDC"])
    expect(filterBalanceRows(rows, { tab: "earn", query: "", hideZero: false })).toEqual([])
  })

  it("hides zero rows when asked", () => {
    expect(filterBalanceRows(rows, { tab: "spot", query: "", hideZero: true }).map((r) => r.symbol)).toEqual(["ETH", "SOL", "TRUMP"])
  })

  it("searches symbol and network", () => {
    expect(filterBalanceRows(rows, { tab: "all", query: "arb", hideZero: false }).map((r) => r.symbol)).toEqual(["ETH"])
    expect(filterBalanceRows(rows, { tab: "all", query: " sol ", hideZero: true }).map((r) => r.symbol)).toEqual(["SOL", "TRUMP"])
  })

  it("counts per tab without the search", () => {
    expect(countBalanceRows(rows, "all", true)).toBe(4)
    expect(countBalanceRows(rows, "spot", false)).toBe(4)
    expect(countBalanceRows(rows, "futures", true)).toBe(1)
  })
})

describe("accountView", () => {
  it("splits Spot, Futures and Earn and reconciles the state grid with the total", () => {
    const v = accountView(1000, { accountValue: 400, withdrawable: 150 })
    expect(v.parts.map((p) => [p.key, p.value, Boolean(p.soon)])).toEqual([
      ["spot", 1000, false],
      ["futures", 400, false],
      ["earn", null, true],
    ])
    expect(v.total).toBe(1400)
    expect(v.state).toEqual({ available: 1150, inOrder: 0, locked: 250 })
    expect(v.state.available + v.state.inOrder + v.state.locked).toBe(v.total)
  })
  it("shows Futures as unknown and counts nothing when it can't be read", () => {
    const v = accountView(500, null)
    expect(v.parts[1].value).toBeNull()
    expect(v.total).toBe(500)
    expect(v.state).toEqual({ available: 500, inOrder: 0, locked: 0 })
  })
  it("never lets withdrawable exceed the account value", () => {
    const v = accountView(0, { accountValue: 100, withdrawable: 120 })
    expect(v.state).toEqual({ available: 100, inOrder: 0, locked: 0 })
  })
})

describe("activity", () => {
  const rows = [
    { id: "a", kind: "transfer" as const, direction: "in" as const },
    { id: "b", kind: "transfer" as const, direction: "out" as const },
    { id: "c", kind: "trade" as const, direction: "neutral" as const },
  ]
  it("maps deposits, withdrawals and trades", () => {
    expect(filterActivity(rows, "all").map((r) => r.id)).toEqual(["a", "b", "c"])
    expect(filterActivity(rows, "deposit").map((r) => r.id)).toEqual(["a"])
    expect(filterActivity(rows, "withdrawal").map((r) => r.id)).toEqual(["b"])
    expect(filterActivity(rows, "trade").map((r) => r.id)).toEqual(["c"])
  })
  it("buckets ledger statuses", () => {
    expect(statusTone("confirmed")).toBe("completed")
    expect(statusTone("Success")).toBe("completed")
    expect(statusTone("reverted")).toBe("failed")
    expect(statusTone("cancelled")).toBe("failed")
    expect(statusTone("broadcast")).toBe("pending")
  })
})

describe("move funds", () => {
  it("accepts amounts the way the flow's own field does", () => {
    expect(acceptAmountInput("12.5", 6)).toBe("12.5")
    expect(acceptAmountInput("0007", 6)).toBe("7")
    expect(acceptAmountInput("00.5", 6)).toBe("0.5")
    expect(acceptAmountInput(".5", 6)).toBe("0.5")
    expect(acceptAmountInput("", 6)).toBe("")
    expect(acceptAmountInput("1.2.3", 6)).toBeNull()
    expect(acceptAmountInput("1e5", 6)).toBeNull()
    expect(acceptAmountInput("-1", 6)).toBeNull()
    // never more decimals than the asset has
    expect(acceptAmountInput("1.123", 2)).toBeNull()
    expect(acceptAmountInput("1.12", 2)).toBe("1.12")
    expect(acceptAmountInput("5.", 0)).toBe("5.")
  })

  it("floors percentage chips so they never exceed the balance", () => {
    expect(chipAmount(10, 0.25, 2)).toBe("2.5")
    expect(chipAmount(0.005, 1, 2)).toBe("0")
    expect(chipAmount(0.005, 1, 18)).toBe("0.005")
    expect(chipAmount(1.239, 1, 2)).toBe("1.23")
    expect(Number(chipAmount(500.25, 0.75, 6))).toBeLessThanOrEqual(500.25 * 0.75)
  })

  it("runs the right funding flow for each From → To pair", () => {
    expect(transferMode("spot", "futures")).toBe("fund")
    expect(transferMode("futures", "spot")).toBe("withdraw")
    expect(transferMode("spot", "earn")).toBeNull()
    expect(transferMode("earn", "futures")).toBeNull()
  })

  it("words the withdraw button for one asset dropdown", () => {
    expect(withdrawCtaLabel("Review transfer")).toBe("Review withdrawal")
    expect(withdrawCtaLabel("Choose a network")).toBe("Choose an asset")
    expect(withdrawCtaLabel("Enter an amount")).toBe("Enter an amount")
  })

  it("keeps the venue's name out of the transfer messages", () => {
    expect(venueToAccount("Withdraw from Hyperliquid Futures to your wallet")).toBe("Withdraw from Futures to your wallet")
    expect(venueToAccount("100 USDC deposit submitted to Hyperliquid.")).toBe("100 USDC deposit submitted to Futures.")
    expect(venueToAccount(null)).toBeNull()
  })
})
