"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"

const USDT_IMAGE = "https://coin-images.coingecko.com/coins/images/325/small/Tether.png"

export function TokenSearchModal({
  open,
  onClose,
  coins,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  coins: CoinData[]
  onSelect: (symbol: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, onClose])

  React.useEffect(() => {
    if (open) setSearch("")
  }, [open])

  if (!open) return null

  const filtered = coins
    .filter((c) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => b.volume24h - a.volume24h)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20">
      <div ref={ref} className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/30 p-4">
          <h3 className="text-sm font-semibold">Select Trading Pair</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
            />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pairs…"
              className="w-full rounded-xl bg-accent/50 py-2.5 pl-9 pr-3 text-sm outline-none focus:bg-accent"
            />
          </div>
          <div className="max-h-72 overflow-y-auto slim-scroll">
            {filtered.map((coin) => {
              const pos = coin.change24h >= 0
              return (
                <button
                  key={coin.symbol}
                  onClick={() => {
                    onSelect(coin.symbol)
                    onClose()
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center shrink-0">
                    {coin.image && (
                      <img
                        src={coin.image}
                        alt=""
                        className="h-7 w-7 rounded-full ring-2 ring-card"
                      />
                    )}
                    <img
                      src={USDT_IMAGE}
                      alt=""
                      className="h-5 w-5 rounded-full ring-2 ring-card -ml-2"
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {coin.symbol}/USDT
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {coin.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">
                      $
                      {coin.price.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p
                      className={`text-xs tabular-nums ${pos ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {pos ? "+" : ""}
                      {coin.change24h.toFixed(2)}%
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
