"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Exchange01Icon,
  CreditCardIcon,
  CoinsSwapIcon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"

interface BalanceSectionProps {
  coins: CoinData[]
  prices: Record<string, number>
}

export function BalanceSection({ coins, prices }: BalanceSectionProps) {
  const topCoins = React.useMemo(() => {
    const priority = ["BTC", "ETH", "SOL", "USDT", "BNB"]
    const sorted = [...coins].sort((a, b) => {
      const ai = priority.indexOf(a.symbol)
      const bi = priority.indexOf(b.symbol)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return b.marketCap - a.marketCap
    })
    return sorted.slice(0, 8)
  }, [coins])

  const [selectedSymbol, setSelectedSymbol] = React.useState(topCoins[0]?.symbol ?? "BTC")
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const selectedCoin = topCoins.find((c) => c.symbol === selectedSymbol) ?? topCoins[0]

  const priceFormatted = selectedCoin
    ? selectedCoin.price.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
    : "$0.00"

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const actions = [
    { label: "Deposit", icon: Exchange01Icon, href: "/deposit" },
    { label: "Withdraw", icon: CreditCardIcon, href: "/withdraw" },
    { label: "Swap", icon: CoinsSwapIcon, href: "/swap" },
    { label: "Transfer", icon: ArrowDown01Icon, href: "/transfer" },
  ]

  return (
    <div className="rounded-2xl bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Crypto selector */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent/50 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              {selectedCoin?.image ? (
                <img src={selectedCoin.image} alt={selectedSymbol} className="h-5 w-5 rounded-full" />
              ) : (
                <span className="text-base font-bold text-primary">{selectedSymbol[0]}</span>
              )}
              <span>{selectedSymbol}</span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl bg-popover p-1.5 shadow-xl">
                {topCoins.map((coin) => (
                  <button
                    key={coin.symbol}
                    onClick={() => { setSelectedSymbol(coin.symbol); setIsOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent ${
                      selectedSymbol === coin.symbol ? "bg-accent" : ""
                    }`}
                  >
                    {coin.image ? (
                      <img src={coin.image} alt={coin.symbol} className="h-5 w-5 rounded-full" />
                    ) : (
                      <span className="text-base font-bold text-primary">{coin.symbol[0]}</span>
                    )}
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{coin.symbol}</span>
                      <span className="text-xs text-muted-foreground">{coin.name}</span>
                    </div>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price */}
          <span className="text-3xl font-bold tracking-tight tabular-nums">
            {priceFormatted}
          </span>
        </div>

        {/* Quick actions inline */}
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <HugeiconsIcon icon={action.icon} className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">{action.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
