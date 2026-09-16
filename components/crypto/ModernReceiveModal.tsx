"use client"

/**
 * Deposit — the wallet's own addresses, in the redesigned surface.
 *
 * LANDSCAPE on desktop, stacked on a phone, and the switch is a real layout
 * change rather than the same column squeezed wider: on desktop the QR sits
 * left and everything you might *do* (copy, explorer, the network warning)
 * sits right, so the two halves read as "scan this" and "or use this". On a
 * phone that pairing has nowhere to go, so it becomes the order you actually
 * work in — pick the network, see the code, then the address.
 *
 * The network picker is a CHIP RAIL rather than the list of rows this used to
 * stack inside a `max-w-md` card. Six destinations in a column pushed the
 * address itself below the fold on a phone; the rail shows every network at
 * once and scrolls sideways when it must.
 *
 * ── What is real here ─────────────────────────────────────────────────────
 * Addresses come from the modern wallet's own account list, mapped from each
 * account's chain family onto the wallet-record chain in lib/networks.ts. The
 * explorer link is that registry's real URL builder.
 *
 * What is NOT here: confirmation counts and minimum deposits. The preview
 * showed both because it was dummy data. Nothing in this app knows either
 * figure per network, and a made-up "credits after 12 confirmations" on a
 * screen where someone is about to move real money is the worst possible
 * place to guess. The warning says the one thing that is true and load-bearing
 * instead: right network only.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon, Shield01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { Eyebrow } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QrCode } from "@/components/ui/qr-code"
import { InlineNotice } from "@/components/ui/flow"
import { useCryptoContext } from "@/components/crypto/CryptoProvider"
import { NETWORKS, NETWORK_ICON, type NetworkMeta, type WalletChain } from "@/lib/networks"

const FAMILY_TO_CHAIN: Record<string, WalletChain> = {
  evm: "ethereum", solana: "solana", sui: "sui", ton: "ton", tron: "tron", intertrain: "intertrain",
}

/** Keep both ends visible: an address truncated from one side cannot be
 *  verified against the one you pasted, which is the whole point of showing
 *  it at all. */
function truncate(address: string) {
  return address.length <= 24 ? address : `${address.slice(0, 12)}…${address.slice(-10)}`
}

function useCopy() {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  React.useEffect(() => () => clearTimeout(timer.current), [])
  const copy = React.useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }, [])
  return { copied, copy }
}

/* ── The network rail ─────────────────────────────────────────────────────── */

function NetworkRail({
  networks,
  value,
  onChange,
}: {
  networks: NetworkMeta[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow className="text-[11px]">Network</Eyebrow>
      <div
        role="radiogroup"
        aria-label="Network"
        className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {networks.map((n) => {
          const active = n.key === value
          return (
            <button
              key={n.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(n.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-left transition-all active:scale-[0.97] motion-reduce:active:scale-100",
                active
                  ? "bg-primary/[0.14] ring-1 ring-primary/45"
                  : "bg-foreground/[0.05] ring-1 ring-transparent hover:bg-accent/60",
              )}
            >
              <CoinAvatar symbol={n.nativeSymbol} src={NETWORK_ICON[n.key]} size="md" />
              <span className="flex flex-col leading-tight">
                <span className={cn("text-[13px]", active ? "font-semibold text-foreground" : "font-medium")}>
                  {n.label}
                </span>
                <span className="text-[10.5px] text-muted-foreground">{n.nativeSymbol}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── The QR panel ─────────────────────────────────────────────────────────── */

function QrPanel({ network, address }: { network: NetworkMeta; address: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-foreground/[0.05] p-5">
      {/* No white plate. The symbol is drawn in the foreground ink straight
          onto the pane, so the modal's own surface is its background. */}
      <div className="w-full max-w-[13.5rem]">
        <QrCode value={address} title={`${network.label} deposit address`} />
      </div>
      <div className="flex items-center gap-2.5">
        <CoinAvatar symbol={network.nativeSymbol} src={NETWORK_ICON[network.key]} size="md" />
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">{network.label}</span>
          <span className="text-[11.5px] text-muted-foreground">Scan to copy address</span>
        </span>
      </div>
    </div>
  )
}

/* ── The address panel ────────────────────────────────────────────────────── */

function AddressPanel({ network, address }: { network: NetworkMeta; address: string }) {
  const [full, setFull] = React.useState(false)
  const { copied, copy } = useCopy()

  // A new network can mean a new address; the old "shown in full" state is
  // about the address you were looking at, not this one.
  React.useEffect(() => setFull(false), [network.key])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 rounded-2xl bg-foreground/[0.05] p-4">
        <Eyebrow className="text-[11px]">Your address</Eyebrow>
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 font-mono text-[13.5px] leading-snug text-foreground/90",
              full ? "break-all" : "truncate",
            )}
          >
            {full ? address : truncate(address)}
          </span>
          <button
            type="button"
            onClick={() => copy(address)}
            aria-label="Copy address"
            title="Copy address"
            className={cn(
              "ws-icon-mono shrink-0 transition-colors",
              copied ? "text-credit" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setFull((v) => !v)}
          className="self-start text-[12.5px] font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          {full ? "Hide full address" : "Show full address"}
        </button>

        <button
          type="button"
          onClick={() => copy(address)}
          className={cn(
            "ws-icon-mono mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold transition-colors",
            copied ? "bg-credit-chip text-credit" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="h-4 w-4" />
          {copied ? "Copied" : "Copy address"}
        </button>

        <a
          href={network.explorerUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="ws-icon-mono inline-flex items-center gap-1.5 self-start text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View on {network.explorerName}
          <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3" />
        </a>
      </div>

      {/* The one warning that matters. Warning tone, never gold: gold is brand
          and primary action, and "you may lose this money" is neither. */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-warning-chip p-4">
        <HugeiconsIcon icon={Shield01Icon} className="ws-icon-mono mt-px h-4 w-4 shrink-0 text-warning" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold text-warning">{network.label} network only</span>
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            Sending on any other network may lose the funds permanently. This address belongs to your
            WorldStreet wallet — only you can access money sent to it.
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── The modal ────────────────────────────────────────────────────────────── */

export function ModernReceiveModal({ open, onOpenChange, asset = null }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Restrict the rail to the networks one asset actually lives on. */
  asset?: string | null
}) {
  const { wallet } = useCryptoContext()

  const addresses = React.useMemo(() => {
    const map: Partial<Record<WalletChain, string>> = {}
    for (const account of wallet.data?.accounts ?? []) {
      const chain = FAMILY_TO_CHAIN[account.chainFamily]
      if (chain && account.canonicalAddress) map[chain] = account.canonicalAddress
    }
    return map
  }, [wallet.data])

  // A network with no address on this wallet is not an option — it is not an
  // error either, just a family this wallet was created before.
  const available = React.useMemo(
    () => NETWORKS.filter((n) => addresses[n.chain]),
    [addresses],
  )

  const [key, setKey] = React.useState<string>("")
  const network = available.find((n) => n.key === key) ?? available[0]
  const address = network ? (addresses[network.chain] ?? "") : ""

  // Older wallets (created before a chain family shipped) can hold keys on
  // fewer families than the wallet-record supports. Name it so the missing
  // option isn't a silent gap, and point at where it gets fixed.
  const provisionedFamilies = React.useMemo(
    () => new Set((wallet.data?.accounts ?? []).map((a) => a.chainFamily)),
    [wallet.data],
  )
  const showProvisioningNotice =
    Boolean(wallet.data) && provisionedFamilies.size < Object.keys(FAMILY_TO_CHAIN).length

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      {/* sm:max-w-3xl is what makes it landscape — the house default is the
          everyday portrait card, which is what this used to be. */}
      <ResponsiveModalContent className="gap-5 p-5 sm:max-w-3xl sm:p-6">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Deposit crypto</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {asset
              ? `Choose a network, then share your ${asset} address.`
              : "Choose a network, then share your address."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {!network ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-foreground/[0.05] px-6 py-10 text-center">
            <span className="text-[15px] font-semibold">Wallet setup required</span>
            <span className="max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
              Your deposit addresses appear here once your wallet finishes setting up.
            </span>
          </div>
        ) : (
          <>
            <NetworkRail networks={available} value={network.key} onChange={setKey} />
            {/* Landscape from `sm` up: scan on the left, act on the right. */}
            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] sm:items-start sm:gap-5">
              <QrPanel network={network} address={address} />
              <AddressPanel network={network} address={address} />
            </div>
          </>
        )}

        {showProvisioningNotice && (
          <InlineNotice tone="warning">
            Some networks aren&apos;t set up on this wallet yet — add them under{" "}
            <a href="#security" className="font-semibold underline underline-offset-2">Security</a>.
          </InlineNotice>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
