/**
 * Binance symbol mapping for SpotV2.
 */

// ── Binance symbol mapping ───────────────────────────────────────────────

const SYMBOL_OVERRIDES: Record<string, string> = {
  pol: "polusdt",
}

/** Convert a SpotV2 symbol (e.g. "BTC") to a Binance lowercase stream symbol ("btcusdt"). */
export function toBinanceSymbol(symbol: string): string {
  const lower = symbol.toLowerCase()
  return SYMBOL_OVERRIDES[lower] ?? `${lower}usdt`
}
