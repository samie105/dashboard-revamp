"use client"

/**
 * Receive — the deposit modal.
 *
 * LANDSCAPE on desktop, stacked on a phone, and the switch is a real layout
 * change rather than the same column squeezed wider: on desktop the QR sits
 * left and everything you might *do* (copy, share, explorer, the network
 * warning) sits right, so the two halves are "scan this" and "or use this".
 * On a phone that pairing has nowhere to go, so it becomes the order you
 * actually work in — pick the chain, see the code, then the address.
 *
 * The chain picker is a CHIP RAIL, not the dropdown the reference uses. With
 * six destinations a dropdown hides five of them behind a click and adds a
 * popover inside a dialog for nothing; the rail shows every chain and its
 * balance at once. It scrolls horizontally when it must.
 *
 * The QR has no white plate — see components/preview/qr-code.tsx for how that
 * is done and what it costs.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  Tick02Icon,
  Shield01Icon,
  LinkSquare02Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { Eyebrow, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QrCode } from "@/components/preview/qr-code"
import { CHAIN_GROUPS, formatUSD, type ChainGroup } from "@/components/wallet-unauth/wallet-data"

type Tab = "address" | "request"

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
  return { copied, copy, reset: () => setCopied(false) }
}

/* ── The chain rail ───────────────────────────────────────────────────────── */

function ChainRail({
  value,
  onChange,
}: {
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
        {CHAIN_GROUPS.map((c) => {
          const active = c.key === value
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-left transition-all active:scale-[0.97] motion-reduce:active:scale-100",
                active
                  ? "bg-primary/[0.14] ring-1 ring-primary/45"
                  : "bg-surface-sunken ring-1 ring-transparent hover:bg-accent/60",
              )}
            >
              <CoinAvatar symbol={c.symbol} size="md" />
              <span className="flex flex-col leading-tight">
                <span className={cn("text-[13px]", active ? "font-semibold text-foreground" : "font-medium")}>
                  {c.name}
                </span>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
                  {formatUSD(c.value, { compact: true })}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── The QR panel ─────────────────────────────────────────────────────────── */

function QrPanel({ chain, payload }: { chain: ChainGroup; payload: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-sunken p-5">
      {/* No white plate. The symbol is drawn in the foreground ink straight
          onto the pane, so the modal's own surface is its background. */}
      <div className="w-full max-w-[13.5rem]">
        <QrCode value={payload} title={`${chain.name} deposit address`} />
      </div>
      <div className="flex items-center gap-2.5">
        <CoinAvatar symbol={chain.symbol} size="md" />
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">{chain.name}</span>
          <span className="text-[11.5px] text-muted-foreground">Scan to copy address</span>
        </span>
      </div>
    </div>
  )
}

/* ── The address panel ────────────────────────────────────────────────────── */

function AddressPanel({ chain }: { chain: ChainGroup }) {
  const [full, setFull] = React.useState(false)
  const { copied, copy } = useCopy()

  // A new chain means a new address; the old "shown in full" state is about
  // the address you were looking at, not this one.
  React.useEffect(() => setFull(false), [chain.key])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 rounded-2xl bg-surface-sunken p-4">
        <Eyebrow className="text-[11px]">Your address</Eyebrow>
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 font-mono text-[13.5px] leading-snug text-foreground/90",
              full ? "break-all" : "truncate",
            )}
          >
            {full ? chain.address : truncate(chain.address)}
          </span>
          <button
            type="button"
            onClick={() => copy(chain.address)}
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

        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => copy(chain.address)}
            className={cn(
              "ws-icon-mono inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold transition-colors",
              copied
                ? "bg-credit-chip text-credit"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="h-4 w-4" />
            {copied ? "Copied" : "Copy address"}
          </button>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken px-4 text-[13.5px] font-semibold ring-1 ring-border/60 transition-colors hover:bg-accent/60"
          >
            Share
          </button>
        </div>

        <button
          type="button"
          className="ws-icon-mono inline-flex items-center gap-1.5 self-start text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View on explorer
          <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3" />
        </button>
      </div>

      {/* The one warning that matters. Warning tone, never gold: gold is brand
          and primary action, and "you may lose this money" is neither. */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-warning-chip p-4">
        <HugeiconsIcon icon={Shield01Icon} className="ws-icon-mono mt-px h-4 w-4 shrink-0 text-warning" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold text-warning">{chain.name} network only</span>
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            Sending on an unsupported network may lose the funds permanently. Credits after{" "}
            {chain.confirmations} confirmation{chain.confirmations > 1 ? "s" : ""}; minimum {chain.minimum}.
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Payment request ──────────────────────────────────────────────────────── */

function RequestPanel({ chain }: { chain: ChainGroup }) {
  const [amount, setAmount] = React.useState("")
  const { copied, copy } = useCopy()

  // The same string the QR encodes, so the code and the link can never
  // disagree about how much is being asked for.
  const link = `https://worldstreetgold.com/pay/${chain.key}/${chain.address}${
    amount ? `?amount=${encodeURIComponent(amount)}` : ""
  }`

  return (
    <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] sm:items-start sm:gap-5">
      <QrPanel chain={chain} payload={link} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface-sunken p-4">
          <Eyebrow className="text-[11px]">Amount (optional)</Eyebrow>
          <div className="flex items-center gap-2 rounded-xl bg-card/60 px-3 ring-1 ring-border/50 focus-within:ring-primary/45">
            <span className="text-[15px] text-muted-foreground">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Amount to request"
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] tabular-nums outline-none placeholder:text-muted-foreground"
            />
          </div>
          <span className="text-[11.5px] text-muted-foreground">
            Leave blank to let the sender choose.
          </span>
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface-sunken p-4">
          <Eyebrow className="text-[11px]">Payment link</Eyebrow>
          <span className="break-all font-mono text-[12px] leading-snug text-muted-foreground">{link}</span>
          <button
            type="button"
            onClick={() => copy(link)}
            className={cn(
              "ws-icon-mono mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold transition-colors",
              copied ? "bg-credit-chip text-credit" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="h-4 w-4" />
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── The modal ────────────────────────────────────────────────────────────── */

export function ReceiveModal({
  open,
  onOpenChange,
  initialChain,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialChain?: string
}) {
  const [tab, setTab] = React.useState<Tab>("address")
  const [key, setKey] = React.useState(initialChain ?? CHAIN_GROUPS[0].key)
  const chain = CHAIN_GROUPS.find((c) => c.key === key) ?? CHAIN_GROUPS[0]

  // Opening from a specific chain's row should land on that chain, not on
  // whichever one was left selected last time.
  React.useEffect(() => {
    if (open && initialChain) setKey(initialChain)
  }, [open, initialChain])

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      {/* sm:max-w-3xl is what makes it landscape — the house default is
          max-w-sm, which is the everyday portrait card. */}
      <ResponsiveModalContent className="gap-5 p-5 sm:max-w-3xl sm:p-6">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Receive crypto</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Choose a network, then share your address.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <Segmented
          grow
          options={[
            { key: "address", label: "Wallet address" },
            { key: "request", label: "Payment request" },
          ]}
          value={tab}
          onChange={setTab}
        />

        <ChainRail value={key} onChange={setKey} />

        {tab === "address" ? (
          // Landscape from `sm` up: scan on the left, act on the right.
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] sm:items-start sm:gap-5">
            <QrPanel chain={chain} payload={chain.address} />
            <AddressPanel chain={chain} />
          </div>
        ) : (
          <RequestPanel chain={chain} />
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/** The rail's Deposit pill and the chain picker both open the same modal, so
 *  the open state lives in one hook rather than in each call site. */
export function useReceiveModal() {
  const [open, setOpen] = React.useState(false)
  const [chain, setChain] = React.useState<string | undefined>(undefined)
  const openFor = React.useCallback((key?: string) => {
    setChain(key)
    setOpen(true)
  }, [])
  return {
    open,
    setOpen,
    openFor,
    render: <ReceiveModal open={open} onOpenChange={setOpen} initialChain={chain} />,
  }
}

/** Small gold-outline affordance used next to an address elsewhere on the page. */
export function ReceiveButton({ onClick, label = "Receive" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ws-icon-mono inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
