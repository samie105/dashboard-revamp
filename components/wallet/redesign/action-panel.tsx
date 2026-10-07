"use client"

/**
 * The preview's "Move funds" panel (components/wallet-unauth/action-panel.tsx)
 * on the real wallet. The tab lives in the URL exactly as in the preview
 * (`?action=deposit|withdraw|transfer`, optional `&asset=`), so a balance
 * row's Deposit / Withdraw lands here on the right tab.
 *
 * Swapped for real data:
 *  · Deposit — the wallet's own addresses, one per chain family (the same
 *    accounts the old deposit modal read), with the QR and copy. Nothing in
 *    the app knows a per-network minimum or confirmation count, so those two
 *    cells show "—" rather than a guess; the explorer link the old modal had
 *    is kept.
 *  · Withdraw — the preview's form (asset dropdown, recipient address,
 *    amount, network fee / you receive / arrives in, review button) drawn on
 *    the real send ceremony (SendFlow's renderForm): same validation, intent,
 *    review, local signing and status screens. The fee is only known once the
 *    review has a quote, so the summary says so; arrival time isn't known.
 *  · Transfer — Spot (this wallet) ↔ Futures (the trading account), on the
 *    real funding flow (HyperliquidFundingClient's render): USDC on Arbitrum
 *    One in, withdrawable USDC out. Earn is listed and marked coming soon.
 *  While a send or transfer is in flight the other tabs are locked, the way
 *  the old modals refused to be dismissed.
 */

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowDataTransferVerticalIcon,
  ArrowDown01Icon,
  ArrowLeftRightIcon,
  Copy01Icon,
  Download04Icon,
  LinkSquare02Icon,
  Tick02Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { COIN_IMAGES } from "@/lib/coin-images"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QrCode } from "@/components/ui/qr-code"
import { SendFlow, type SendFormRenderProps } from "@/components/crypto/send/SendFlow"
import { HyperliquidFundingClient, type FundingView } from "@/components/fund/hyperliquid-funding-client"
import { AmountField, AssetSelect, FieldLabel, Note, PrimaryButton, type AssetOption } from "@/components/wallet/redesign/move-parts"
import { Icon, Panel, PanelTitle, SLIDE, type IconSvg } from "@/components/dashboard/redesign/ui"
import { type AccountKey, parseWalletAction, transferMode, venueToAccount, walletActionHref, withdrawCtaLabel, type WalletAction } from "@/lib/wallet-view"

/** One chain family's receiving address. */
export type DepositChain = {
  key: string
  name: string
  caption: string
  symbol: string
  icon?: string
  address: string
  explorer?: { name: string; url: string }
}

const ACTIONS: { key: WalletAction; label: string; icon: IconSvg }[] = [
  { key: "deposit", label: "Deposit", icon: Download04Icon },
  { key: "withdraw", label: "Withdraw", icon: Upload04Icon },
  { key: "transfer", label: "Transfer", icon: ArrowLeftRightIcon },
]

function useWalletAction() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = params.get("action")
  const action = parseWalletAction(raw)
  const asset = params.get("asset") ?? undefined
  const from = params.get("from") === "futures" ? ("futures" as const) : ("spot" as const)

  const setAction = React.useCallback(
    (next: WalletAction) => router.replace(walletActionHref(pathname, next), { scroll: false }),
    [router, pathname],
  )
  return { action, asset, from, explicit: raw !== null, setAction }
}

/* ── Small parts ───────────────────────────────────────────────────────── */

function useCopy() {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  return {
    copied,
    copy: (text: string) => {
      navigator.clipboard?.writeText(text).catch(() => {})
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
    },
  }
}

/* ── Deposit ──────────────────────────────────────────────────────────── */

function truncateAddress(a: string) {
  return a.length <= 26 ? a : `${a.slice(0, 12)}…${a.slice(-10)}`
}

function DepositPane({
  chains,
  initialKey,
  loading,
  missingNetworks,
  onAddNetworks,
}: {
  chains: DepositChain[]
  initialKey?: string
  loading: boolean
  missingNetworks: boolean
  onAddNetworks: () => void
}) {
  const fallback = chains[0]?.key ?? ""
  const initial = initialKey && chains.some((c) => c.key === initialKey) ? initialKey : fallback
  const [chainKey, setChainKey] = React.useState(initial)
  React.useEffect(() => setChainKey(initial), [initial])
  const chain = chains.find((c) => c.key === chainKey) ?? chains[0]
  const { copied, copy } = useCopy()

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-label="Loading your addresses">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <span key={i} className="skel h-11 rounded-xl" />)}
        </div>
        <span className="skel h-[260px] rounded-2xl" />
        <span className="skel h-12 rounded-xl" />
      </div>
    )
  }

  if (!chain) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-foreground/[0.07] bg-foreground/[0.025] px-6 py-10 text-center">
        <span className="text-[14.5px] font-semibold text-foreground">Wallet setup required</span>
        <span className="max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
          Your deposit addresses appear here once your wallet finishes setting up.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <FieldLabel aside="One address per network">Network</FieldLabel>
        <div role="radiogroup" aria-label="Network" className="grid grid-cols-3 gap-2">
          {chains.map((c) => {
            const on = c.key === chain.key
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChainKey(c.key)}
                className={cn(
                  "relative flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 text-[12.5px] font-semibold transition-colors",
                  on ? "border-primary/55 text-foreground" : "border-foreground/[0.07] text-muted-foreground hover:border-foreground/[0.14] hover:text-foreground",
                )}
              >
                {on && <motion.span layoutId="deposit-chain" transition={SLIDE} className="absolute inset-0 rounded-xl bg-primary/[0.08]" />}
                <CoinAvatar symbol={c.symbol} src={c.icon} size="sm" className="relative" />
                <span className="relative truncate">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-foreground/[0.07] bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklab,var(--primary)_7%,transparent),transparent_60%)] p-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={chain.key}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="size-[176px] text-foreground"
          >
            <QrCode value={chain.address} title={`${chain.name} deposit address`} className="size-full" />
          </motion.div>
        </AnimatePresence>
        <span className="text-center text-[12px] font-medium text-muted-foreground">{chain.caption}</span>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel
          aside={
            chain.explorer ? (
              <a href={chain.explorer.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                View on {chain.explorer.name}
                <Icon icon={LinkSquare02Icon} className="size-3" />
              </a>
            ) : undefined
          }
        >
          Your {chain.name} address
        </FieldLabel>
        <button
          type="button"
          onClick={() => copy(chain.address)}
          title={chain.address}
          className="group flex h-12 items-center gap-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] px-3.5 text-left transition-colors hover:border-primary/35"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{truncateAddress(chain.address)}</span>
          <span className={cn("flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors", copied ? "text-credit" : "text-primary")}>
            <Icon icon={copied ? Tick02Icon : Copy01Icon} className="size-4" />
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        {[
          { k: "Minimum deposit", v: "—" },
          { k: "Credited after", v: "—" },
        ].map((d) => (
          <div key={d.k} className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-3.5 py-2.5">
            <dt className="text-[11.5px] text-muted-foreground">{d.k}</dt>
            <dd className="text-[13px] font-semibold tabular-nums text-foreground">{d.v}</dd>
          </div>
        ))}
      </dl>

      <Note tone="warning">
        Send only {chain.caption.split(" · ").join(", ")} assets to this address. Sending on any other network may lose the funds permanently.
      </Note>

      {missingNetworks && (
        <Note>
          Some networks aren&apos;t set up on this wallet yet —{" "}
          <button type="button" onClick={onAddNetworks} className="font-semibold text-primary hover:opacity-85">
            add them
          </button>
          .
        </Note>
      )}
    </div>
  )
}

/* ── Withdraw ─────────────────────────────────────────────────────────── */

function WithdrawForm(f: SendFormRenderProps) {
  const options: AssetOption[] = f.assetChoices.map((c) => ({
    key: `${c.networkId}|${c.assetKey}`,
    symbol: c.symbol,
    logo: c.logo,
    network: c.networkLabel,
    name: c.networkLabel,
    amount: c.amount,
  }))
  const value = options.find((o) => o.key === `${f.networkId}|${f.assetKey}`)
  const networkLabel = f.networkOptions.find((n) => n.key === f.networkId)?.label
  const n = Number(f.amount)
  const label = withdrawCtaLabel(f.ctaLabel)

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {f.networkNotice}
        <Note>Nothing to withdraw yet. Deposit to one of your addresses first.</Note>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <AssetSelect
        options={options}
        value={value}
        disabled={f.disabled}
        onChange={(key) => {
          const [networkId, assetKey] = key.split("|")
          f.onPick(networkId, assetKey)
        }}
      />

      {f.networkNotice}

      <div className="flex flex-col gap-2">
        <FieldLabel aside={networkLabel}>Recipient address</FieldLabel>
        <input
          value={f.to}
          onChange={(e) => f.onToChange(e.target.value)}
          onBlur={f.onToBlur}
          disabled={f.disabled || !value}
          placeholder={value ? `Paste a ${networkLabel ?? ""} address` : "Choose an asset first"}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={f.addressProblem ? true : undefined}
          className={cn(
            "h-12 rounded-xl border bg-foreground/[0.025] px-3.5 font-mono text-[13px] text-foreground outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground/60 focus:border-primary/45 disabled:opacity-50",
            f.addressProblem ? "border-debit/50" : "border-foreground/[0.08]",
          )}
        />
        {f.addressProblem && <p className="px-0.5 text-[12px] text-debit">{f.addressProblem}</p>}
      </div>

      {f.selfSend && <Note tone="warning">You&apos;re sending to this wallet&apos;s own address.</Note>}

      <AmountField
        value={f.amount}
        onChange={f.onAmountChange}
        max={value ? f.maxSpend : null}
        symbol={f.symbol || "—"}
        maxDecimals={f.decimals}
        problem={f.amountProblem}
        approx={f.amountApprox}
        hint={f.amountHint}
        disabled={f.disabled || !value}
      />

      <dl className="flex flex-col gap-2 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-3.5 py-3 text-[12.5px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Network fee</dt>
          <dd className="font-semibold text-foreground">{value ? "Shown on review" : "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">You receive</dt>
          <dd className="font-semibold tabular-nums text-foreground">{n > 0 && f.symbol ? `${f.amount} ${f.symbol}` : "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Arrives in</dt>
          <dd className="font-semibold text-foreground">—</dd>
        </div>
      </dl>

      {f.errorSlot}

      <PrimaryButton disabled={f.ctaDisabled} busy={f.ctaBusy} onClick={f.onSubmit}>
        {label}
      </PrimaryButton>
    </div>
  )
}

function WithdrawPane({ asset, onInFlightChange, onSent }: { asset?: string; onInFlightChange: (v: boolean) => void; onSent: () => void }) {
  // SendFlow holds one transfer; "back to wallet" from its status screen
  // starts a fresh one here instead of leaving the page.
  const [round, setRound] = React.useState(0)
  const close = React.useCallback(() => {
    onInFlightChange(false)
    onSent()
    setRound((r) => r + 1)
  }, [onInFlightChange, onSent])
  React.useEffect(() => () => onInFlightChange(false), [onInFlightChange])
  return (
    <SendFlow
      key={`${round}:${asset ?? ""}`}
      bare
      initialAsset={asset}
      onClose={close}
      onInFlightChange={onInFlightChange}
      renderForm={(props) => <WithdrawForm {...props} />}
    />
  )
}

/* ── Transfer ─────────────────────────────────────────────────────────── */

type Account = AccountKey
const ACCOUNT_OPTIONS: { key: Account; label: string; soon?: boolean }[] = [
  { key: "spot", label: "Spot" },
  { key: "futures", label: "Futures" },
  { key: "earn", label: "Earn (coming soon)", soon: true },
]

function AccountCard({ label, account, onChange, exclude, disabled }: { label: string; account: Account; onChange: (k: Account) => void; exclude: Account; disabled?: boolean }) {
  return (
    <label className="flex flex-1 flex-col gap-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] px-3.5 py-2.5 transition-colors focus-within:border-primary/45 hover:border-foreground/[0.14]">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <span className="relative flex items-center">
        <select
          value={account}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as Account)}
          className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-[14.5px] font-semibold text-foreground outline-none disabled:cursor-not-allowed [&>option]:bg-popover"
        >
          {ACCOUNT_OPTIONS.filter((a) => a.key !== exclude).map((a) => (
            <option key={a.key} value={a.key} disabled={a.soon}>
              {a.label}
            </option>
          ))}
        </select>
        <Icon icon={ArrowDown01Icon} className="pointer-events-none absolute right-0 size-4 text-muted-foreground" strokeWidth={2} />
      </span>
    </label>
  )
}

const plain = venueToAccount

function TransferForm({ v, spotUsdc }: { v: FundingView; spotUsdc: number | null }) {
  const max = v.isDeposit ? spotUsdc : v.withdrawable
  const option: AssetOption = {
    key: "usdc",
    symbol: "USDC",
    logo: COIN_IMAGES.USDC,
    network: "Arbitrum One",
    name: v.isDeposit ? "USD Coin · Arbitrum One" : "USD Coin · Futures",
    amount: max === null ? "—" : String(max),
  }
  const label = v.busy ? "Signing and submitting…" : v.blocker ?? (v.pendingDeposit ? "Resume transfer" : "Transfer")
  return (
    <div className="flex flex-col gap-4">
      <AssetSelect options={[option]} value={option} onChange={() => {}} />
      <AmountField
        value={v.amount}
        onChange={v.setAmount}
        max={max}
        symbol="USDC"
        maxDecimals={v.isDeposit ? 6 : 2}
        hint={v.isDeposit ? "Minimum 5 USDC" : null}
        disabled={v.busy || v.pendingDeposit}
      />
      <Note>
        {v.isDeposit
          ? "Moves USDC from this wallet on Arbitrum One into your Futures account."
          : "Moves withdrawable USDC from your Futures account back to this wallet on Arbitrum One."}
      </Note>
      {v.progress && <Note>{plain(v.progress)}</Note>}
      {v.message && <Note tone="error">{plain(v.message)}</Note>}
      {v.withdrawalFailed && <Note tone="error">This withdrawal failed. Your Futures balance was not settled.</Note>}
      {v.withdrawalRelayed && <Note>Withdrawal relayed. Your wallet balance will update after settlement.</Note>}
      {v.futuresUnreadable && <Note tone="warning">We can’t verify the latest Futures balance right now. Nothing will be submitted until it is available.</Note>}
      {v.success && <Note tone="success">{plain(v.success)}</Note>}
      <PrimaryButton disabled={Boolean(v.blocker)} busy={v.busy} onClick={v.submit}>
        {label}
      </PrimaryButton>
    </div>
  )
}

function TransferPane({ initialFrom, spotUsdc, onInFlightChange }: { initialFrom: "spot" | "futures"; spotUsdc: number | null; onInFlightChange: (v: boolean) => void }) {
  const [from, setFrom] = React.useState<Account>(initialFrom)
  const [to, setTo] = React.useState<Account>(initialFrom === "spot" ? "futures" : "spot")
  const [spin, setSpin] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    setFrom(initialFrom)
    setTo(initialFrom === "spot" ? "futures" : "spot")
  }, [initialFrom])
  const report = React.useCallback(
    (v: boolean) => {
      setBusy(v)
      onInFlightChange(v)
    },
    [onInFlightChange],
  )
  React.useEffect(() => () => onInFlightChange(false), [onInFlightChange])

  const swap = () => {
    setFrom(to)
    setTo(from)
    setSpin((s) => s + 180)
  }
  const mode = transferMode(from, to)

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <AccountCard label="From" account={from} exclude={to} disabled={busy} onChange={setFrom} />
        <button
          type="button"
          onClick={swap}
          disabled={busy}
          aria-label="Swap accounts"
          className="absolute left-1/2 top-1/2 z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/[0.1] bg-card text-primary shadow-[0_6px_16px_-4px_rgb(0_0_0/0.35)] transition-colors hover:border-primary/45 disabled:opacity-50"
        >
          <motion.span animate={{ rotate: spin }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="flex">
            <Icon icon={ArrowDataTransferVerticalIcon} className="size-4 sm:rotate-90" strokeWidth={2} />
          </motion.span>
        </button>
        <AccountCard label="To" account={to} exclude={from} disabled={busy} onChange={setTo} />
      </div>

      {mode ? (
        <HyperliquidFundingClient
          key={mode}
          mode={mode}
          onInFlightChange={report}
          render={(v) => <TransferForm v={v} spotUsdc={spotUsdc} />}
        />
      ) : (
        <Note>Earn is coming soon. Pick Spot and Futures to move funds between them.</Note>
      )}
    </div>
  )
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

export function ActionPanel({
  className,
  chains,
  chainForAsset,
  loading,
  missingNetworks,
  onAddNetworks,
  onSent,
  spotUsdc,
}: {
  className?: string
  chains: DepositChain[]
  /** Which chain family holds a symbol, for `?asset=` on Deposit. */
  chainForAsset: (symbol: string) => string | undefined
  loading: boolean
  missingNetworks: boolean
  onAddNetworks: () => void
  /** A send finished (or was left) — balances are stale. */
  onSent: () => void
  /** The wallet's USDC on Arbitrum One — what can move into Futures. */
  spotUsdc: number | null
}) {
  const { action, asset, from, explicit, setAction } = useWalletAction()
  const ref = React.useRef<HTMLElement>(null)
  const first = React.useRef(true)
  const [inFlight, setInFlight] = React.useState(false)

  // Arriving from a table action: on a phone the panel can be below the
  // fold, so bring it up — only if it isn't already in view.
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      if (!explicit) return
    }
    const el = ref.current
    if (!el || el.offsetParent === null) return
    const top = el.getBoundingClientRect().top
    if (top < 60 || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [action, asset, explicit])

  return (
    <Panel ref={ref} className={cn("scroll-mt-4 flex flex-col gap-5 overflow-visible p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between px-0.5">
        <PanelTitle className="text-[16px]">Move funds</PanelTitle>
        <span className="text-[12px] font-medium text-muted-foreground">Only you can sign</span>
      </div>

      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.025] p-1">
        {ACTIONS.map((a) => {
          const on = a.key === action
          const locked = inFlight && !on
          return (
            <button
              key={a.key}
              role="tab"
              type="button"
              aria-selected={on}
              disabled={locked}
              title={locked ? "Finish the transfer in progress first" : undefined}
              onClick={() => setAction(a.key)}
              className={cn(
                "relative flex h-10 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
                on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground ",
              )}
            >
              {on && <motion.span layoutId="wallet-action" transition={SLIDE} className="ds-gold absolute inset-0 rounded-xl" />}
              <Icon icon={a.icon} className="relative size-4" strokeWidth={on ? 2 : 1.8} />
              <span className="relative">{a.label}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={action}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {action === "deposit" && (
            <DepositPane
              chains={chains}
              initialKey={asset ? chainForAsset(asset) : undefined}
              loading={loading}
              missingNetworks={missingNetworks}
              onAddNetworks={onAddNetworks}
            />
          )}
          {action === "withdraw" && <WithdrawPane asset={asset} onInFlightChange={setInFlight} onSent={onSent} />}
          {action === "transfer" && <TransferPane initialFrom={from} spotUsdc={spotUsdc} onInFlightChange={setInFlight} />}
        </motion.div>
      </AnimatePresence>
    </Panel>
  )
}
