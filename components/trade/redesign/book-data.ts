"use client"

/**
 * Data for the book panel that the trade screen didn't load before.
 *
 *  · useSpotBook: a spot market's order book, from the futures venue when it
 *    lists the coin (spot itself trades through pools, which have no book).
 *    Polled every 3s, like the futures book. A coin the venue doesn't list
 *    answers "none", and the panel says the market has no order book.
 *  · useTape: recent trades. Futures: the venue's own prints, every 3s.
 *    Spot: the token's pool trades through /api/charts/trades, every 8s
 *    (the route caches for 8s, so faster would only re-read its cache).
 */

import * as React from "react"

import { fetchHlOrderBook, fetchHlRecentTrades, type HlOrderBook, type TapeFill } from "@/lib/hl-public"

/** The venue's name for a spot symbol: wrapped majors trade as the coin. */
function venueCoin(symbol: string) {
  const s = symbol.toUpperCase()
  return /^W(ETH|BTC|SOL)$/.test(s) ? s.slice(1) : s
}

export function useSpotBook(symbol: string | null) {
  const [book, setBook] = React.useState<HlOrderBook | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "none">("loading")
  React.useEffect(() => {
    setBook(null)
    if (!symbol) {
      setState("none")
      return
    }
    setState("loading")
    let cancelled = false
    let had = false
    const coin = venueCoin(symbol)
    const load = () =>
      fetchHlOrderBook(coin, 22)
        .then((b) => {
          if (cancelled) return
          if (!b || (b.bids.length === 0 && b.asks.length === 0)) {
            if (!had) setState("none")
            return
          }
          had = true
          setBook(b)
          setState("ready")
        })
        .catch(() => {
          if (!cancelled && !had) setState("none")
        })
    void load()
    const id = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [symbol])
  return { book, state }
}

export type TapeSource = { kind: "venue"; coin: string } | { kind: "pool"; networkId: string; token: string } | null

export function useTape(source: TapeSource) {
  const [trades, setTrades] = React.useState<TapeFill[] | null>(null)
  const key = source ? JSON.stringify(source) : ""
  React.useEffect(() => {
    setTrades(null)
    if (!source) {
      setTrades([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        let next: TapeFill[]
        if (source.kind === "venue") {
          next = await fetchHlRecentTrades(source.coin)
        } else {
          const url = new URL("/api/charts/trades", window.location.origin)
          url.searchParams.set("network", source.networkId)
          url.searchParams.set("token", source.token)
          const res = await fetch(url)
          if (!res.ok) throw new Error(String(res.status))
          next = ((await res.json()) as { trades?: TapeFill[] }).trades ?? []
        }
        if (!cancelled) setTrades(next.slice(0, 40))
      } catch {
        // Keep the last tape through a wobble; an empty first answer shows the empty state.
        if (!cancelled) setTrades((t) => t ?? [])
      }
    }
    void load()
    const id = setInterval(load, source.kind === "venue" ? 3000 : 8000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return trades
}
