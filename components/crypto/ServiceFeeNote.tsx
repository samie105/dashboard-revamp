"use client"

/**
 * What the service fee will be, shown before the user approves anything.
 * Renders nothing when no fee applies to this network or amount.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"

export function ServiceFeeNote({
  family,
  amount,
  symbol,
  variant = "line",
}: {
  family: string
  amount: string
  symbol: string
  variant?: "line" | "row"
}) {
  const clean = amount.trim()
  const quote = useQuery({
    queryKey: ["crypto", "service-fee-quote", family, clean],
    queryFn: ({ signal }) => cryptoBackendClient.quoteServiceFee({ family, amount: clean }, signal),
    enabled: isCryptoBackendEnabled && Boolean(clean) && Number(clean) > 0,
    staleTime: 5 * 60_000,
  })
  const fee = quote.data?.fee
  if (!fee) return null

  if (variant === "row") {
    return (
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">Service fee ({fee.percent}%)</dt>
        <dd className="font-semibold tabular-nums text-foreground">{fee.amount} {symbol}</dd>
      </div>
    )
  }
  return (
    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
      Service fee ({fee.percent}%): <span className="font-semibold tabular-nums text-foreground">{fee.amount} {symbol}</span>. You&apos;ll approve it as a small separate transfer after this one is sent.
    </p>
  )
}
