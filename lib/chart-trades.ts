/**
 * A DEX pool's trades (GeckoTerminal /pools/{pool}/trades) as the trades tape
 * shows them, priced in OUR token whichever side of the pool it sits on.
 * Pure, so it is tested without a request.
 */

import type { TapeFill } from "@/lib/hl-public"

type GeckoTrade = {
  id?: string
  attributes?: {
    tx_hash?: string
    kind?: string
    block_timestamp?: string
    from_token_address?: string
    to_token_address?: string
    from_token_amount?: string
    to_token_amount?: string
    price_from_in_usd?: string
    price_to_in_usd?: string
  }
}

export function normalizeGeckoTrades(rows: readonly GeckoTrade[] | undefined, token: string, limit = 40): TapeFill[] {
  const ours = token.toLowerCase()
  const out: TapeFill[] = []
  for (const row of rows ?? []) {
    const a = row.attributes
    if (!a) continue
    // Selling our token = it left the trader's hands (from); buying = it arrived (to).
    const sold = a.from_token_address?.toLowerCase() === ours
    const bought = a.to_token_address?.toLowerCase() === ours
    if (!sold && !bought) continue
    const price = Number(sold ? a.price_from_in_usd : a.price_to_in_usd)
    const size = Number(sold ? a.from_token_amount : a.to_token_amount)
    const time = Date.parse(a.block_timestamp ?? "")
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || !Number.isFinite(time)) continue
    out.push({ id: row.id ?? a.tx_hash ?? `${time}-${out.length}`, side: sold ? "sell" : "buy", price, size, time })
    if (out.length >= limit) break
  }
  return out.sort((x, y) => y.time - x.time)
}
