"use client"

/**
 * WalletAddresses — where to send money so it arrives here.
 *
 * The other tabs on the portfolio answer "what do I hold"; this one answers
 * "what do I give someone who wants to pay me". It was the old `/portfolio`
 * page's Wallets tab, kept whole when Assets and Portfolio were merged: the
 * holdings screen showed one chain's address at a time behind a dropdown, and
 * the list of every address with a copy control had nowhere else to go.
 *
 * The chain list arrives as a prop rather than being declared again here — the
 * merged client already owns one, and two lists of the same six chains is how
 * they come to disagree.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Chart01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  Loading03Icon,
  Shield01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { useWallet } from "@/components/wallet-provider"

export type AddressChain = {
  key: string
  name: string
  symbol: string
  icon: string
}

function truncAddr(addr: string) {
  if (!addr || addr.length < 14) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function WalletAddresses({ chains }: { chains: readonly AddressChain[] }) {
  const { addresses, tradingWallet, walletsGenerated, isLoading } = useWallet()
  const [copiedAddr, setCopiedAddr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!copiedAddr) return
    const id = setTimeout(() => setCopiedAddr(null), 1500)
    return () => clearTimeout(id)
  }, [copiedAddr])

  const copyAddr = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setCopiedAddr(text),
      () => {
        /* A clipboard the browser withheld costs the convenience, not the
           address — it is on screen and selectable either way. */
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Loading your addresses…</p>
      </div>
    )
  }

  if (!walletsGenerated) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/50">
          <HugeiconsIcon icon={Wallet01Icon} className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-[15px] font-semibold">No addresses yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Your address on each chain appears here once your wallet is set up.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Trading wallet — the one address that isn't a chain, so it leads. */}
      <div className="rounded-2xl bg-surface-sunken/70 p-4 ring-1 ring-primary/20">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <HugeiconsIcon icon={Chart01Icon} className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[15px] font-semibold leading-tight">Trading wallet</p>
              <p className="text-[13px] text-muted-foreground">Where your spot orders settle</p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
              tradingWallet?.address
                ? "bg-credit-chip text-credit"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {tradingWallet?.address ? "Active" : "Not set up"}
          </span>
        </div>
        {tradingWallet?.address ? (
          <button
            onClick={() => copyAddr(tradingWallet.address)}
            aria-label="Copy the trading wallet address"
            className="group flex w-full items-center justify-between rounded-xl bg-card px-3 py-2.5 ring-1 ring-border/40 transition-colors hover:ring-primary/40"
          >
            <code className="font-mono text-[13px] text-foreground/80">
              {truncAddr(tradingWallet.address)}
            </code>
            <HugeiconsIcon
              icon={copiedAddr === tradingWallet.address ? CheckmarkCircle01Icon : Copy01Icon}
              className={`h-3.5 w-3.5 transition-colors ${
                copiedAddr === tradingWallet.address
                  ? "text-credit"
                  : "text-muted-foreground group-hover:text-primary"
              }`}
            />
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/40 bg-card/50 px-3 py-3">
            <p className="text-[13px] text-muted-foreground">No trading wallet yet</p>
            <Link
              href="/trade"
              className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Set up
            </Link>
          </div>
        )}
      </div>

      {/* One row per chain. */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <HugeiconsIcon icon={Shield01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
          <Eyebrow>Chain addresses</Eyebrow>
        </div>
        <div className="divide-y divide-border/15 overflow-hidden rounded-2xl bg-surface-sunken/70">
          {chains.map((chain) => {
            // Arbitrum settles to the same account as Ethereum.
            const addrKey = chain.key === "arbitrum" ? "ethereum" : chain.key
            const addr = addresses?.[addrKey as keyof typeof addresses] ?? ""
            return (
              <div
                key={chain.key}
                className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:bg-accent/20"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <CoinAvatar src={chain.icon} symbol={chain.symbol} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">{chain.name}</p>
                    {addr ? (
                      <p className="truncate font-mono text-[12px] text-muted-foreground">
                        {truncAddr(addr)}
                      </p>
                    ) : (
                      <p className="text-[12px] text-muted-foreground/60">Not generated</p>
                    )}
                  </div>
                </div>
                {addr ? (
                  <button
                    onClick={() => copyAddr(addr)}
                    aria-label={`Copy your ${chain.name} address`}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                  >
                    <HugeiconsIcon
                      icon={copiedAddr === addr ? CheckmarkCircle01Icon : Copy01Icon}
                      className={`h-3.5 w-3.5 ${copiedAddr === addr ? "text-credit" : ""}`}
                    />
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[10.5px] text-muted-foreground">
                    Pending
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {addresses?.ethereum && addresses.ethereum === tradingWallet?.address && (
        <div className="flex items-center gap-2 rounded-xl bg-credit-chip px-3 py-2.5">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 shrink-0 text-credit" />
          <p className="text-[13px] text-credit">
            One account — your Ethereum address doubles as your trading wallet.
          </p>
        </div>
      )}
    </div>
  )
}
