"use client"

/**
 * The wallet's action panel — Deposit, Withdraw, Transfer — in place of three
 * modals.
 *
 * The tab lives in the URL (`?action=deposit|withdraw|transfer`, plus an
 * optional `&asset=BTC`). That one decision is what ties the page together:
 *
 *  · the rail's Deposit / Withdraw / Transfer rows are links to these URLs,
 *    so the sidebar opens the right tab AND highlights the row you came in by
 *  · a table row's "Deposit" opens this panel with that coin's network chosen
 *  · the dashboard's quick actions land here, on the right tab
 *  · the back button walks back through the tabs you visited
 *
 * Nothing in this panel moves money. Every address is a real, well-formed
 * address nobody holds the key to (see wallet-data.ts) and every submit ends
 * in a "demo" notice.
 */

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import {
  Alert02Icon,
  ArrowDataTransferVerticalIcon,
  ArrowDown01Icon,
  Copy01Icon,
  Download04Icon,
  InformationCircleIcon,
  Tick02Icon,
  Upload04Icon,
  ArrowLeftRightIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { walletHref, type WalletAction } from "@/components/preview/routes"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { QrCode } from "@/components/ui/qr-code"
import {
  ACCOUNTS,
  BALANCE_ROWS,
  CHAIN_GROUPS,
  WITHDRAW_FEES,
  chainFor,
  formatAmount,
  formatUSD,
  type AccountKey,
  type BalanceRow,
} from "@/components/wallet-unauth/wallet-data"
import { Figure, Icon, Panel, PanelTitle, SLIDE, type IconSvg } from "@/components/redesign/ui"

/* ── URL state ─────────────────────────────────────────────────────────── */

export { walletHref }
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
  const action: WalletAction = raw === "withdraw" || raw === "transfer" ? raw : "deposit"
  const asset = params.get("asset") ?? undefined

  const setAction = React.useCallback(
    (next: WalletAction) => {
      // Switching tab drops the asset: "deposit BTC" → Withdraw should not
      // silently carry BTC into a form the person didn't ask for.
      router.replace(`${pathname}?action=${next}`, { scroll: false })
    },
    [router, pathname],
  )
  return { action, asset, explicit: raw !== null, setAction }
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

function FieldLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <span className="text-[12.5px] font-semibold text-foreground/85">{children}</span>
      {aside && <span className="text-[12px] text-muted-foreground">{aside}</span>}
    </div>
  )
}

function Note({ tone = "info", children }: { tone?: "info" | "warning"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed",
        tone === "warning" ? "border-warning/25 bg-warning/[0.06] text-foreground/80" : "border-white/[0.06] bg-white/[0.025] text-muted-foreground",
      )}
    >
      <Icon icon={tone === "warning" ? Alert02Icon : InformationCircleIcon} className={cn("mt-0.5 size-4", tone === "warning" ? "text-warning" : "text-muted-foreground")} />
      <span>{children}</span>
    </p>
  )
}

function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="dash-gold-btn flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
    >
      {children}
    </button>
  )
}

/** The demo's honest ending: a submit that says what would have happened. */
function DemoDone({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-7 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-credit/[0.12] text-credit">
        <Icon icon={Tick02Icon} className="size-6" strokeWidth={2.2} />
      </span>
      <p className="text-[14.5px] font-semibold text-foreground">{message}</p>
      <p className="text-[12.5px] text-muted-foreground">Demo only — nothing was sent and no balance changed.</p>
      <button type="button" onClick={onReset} className="mt-1 text-[13px] font-semibold text-primary hover:opacity-85">
        Start again
      </button>
    </motion.div>
  )
}

/* ── Asset picker ─────────────────────────────────────────────────────── */

function AssetSelect({
  rows,
  value,
  onChange,
  label = "Asset",
}: {
  rows: BalanceRow[]
  value: BalanceRow | undefined
  onChange: (row: BalanceRow) => void
  label?: string
}) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-14 items-center gap-3 rounded-xl border bg-white/[0.025] px-3.5 text-left transition-colors",
          open ? "border-primary/45" : "border-white/[0.08] hover:border-white/[0.14]",
        )}
      >
        {value ? (
          <>
            <CoinAvatar symbol={value.symbol} size="lg" className="size-8 ring-1 ring-white/10" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[14px] font-semibold text-foreground">{value.symbol}</span>
              <span className="truncate text-[12px] text-muted-foreground">{value.name}</span>
            </span>
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[13px] font-semibold tabular-nums text-foreground">
                <Figure mask="••••">{formatAmount(value.available)}</Figure>
              </span>
              <span className="text-[11.5px] text-muted-foreground">available</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-[13.5px] text-muted-foreground">Choose an asset</span>
        )}
        <Icon icon={ArrowDown01Icon} className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="slim-scroll absolute inset-x-0 top-full z-30 mt-1.5 max-h-[264px] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#141414]/98 p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl"
          >
            {rows.map((r) => (
              <li key={`${r.symbol}-${r.account}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value?.symbol === r.symbol}
                  onClick={() => {
                    onChange(r)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]",
                    value?.symbol === r.symbol && "bg-primary/[0.08]",
                  )}
                >
                  <CoinAvatar symbol={r.symbol} size="lg" className="size-7 ring-1 ring-white/10" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[13.5px] font-semibold">{r.symbol}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{r.network}</span>
                  </span>
                  <span className="text-[12.5px] font-medium tabular-nums text-muted-foreground">
                    <Figure mask="••••">{formatAmount(r.available)}</Figure>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Amount field ─────────────────────────────────────────────────────── */

function AmountField({ value, onChange, max, symbol, price }: { value: string; onChange: (v: string) => void; max: number; symbol: string; price: number }) {
  const n = Number(value)
  const over = n > max
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel aside={<Figure mask="••••">{`Max ${formatAmount(max)} ${symbol}`}</Figure>}>Amount</FieldLabel>
      <div
        className={cn(
          "flex h-14 items-center gap-2 rounded-xl border bg-white/[0.025] pl-3.5 pr-2 transition-colors focus-within:border-primary/45",
          over ? "border-debit/50" : "border-white/[0.08]",
        )}
      >
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent font-display text-[18px] font-semibold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
        />
        <span className="text-[13px] font-semibold text-muted-foreground">{symbol}</span>
        <button
          type="button"
          onClick={() => onChange(String(max))}
          className="h-8 rounded-lg bg-primary/[0.12] px-3 text-[12px] font-bold uppercase tracking-[0.04em] text-primary transition-colors hover:bg-primary/20"
        >
          Max
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex gap-1.5">
          {[25, 50, 75].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(String(Number(((max * p) / 100).toFixed(8))))}
              className="h-7 rounded-lg border border-white/[0.07] px-2.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {p}%
            </button>
          ))}
        </div>
        <span className={cn("text-[12px] tabular-nums", over ? "font-semibold text-debit" : "text-muted-foreground")}>
          {over ? "More than you have" : n > 0 ? `≈ ${formatUSD(n * price)}` : " "}
        </span>
      </div>
    </div>
  )
}

/* ── Deposit ──────────────────────────────────────────────────────────── */

function truncateAddress(a: string) {
  return a.length <= 26 ? a : `${a.slice(0, 12)}…${a.slice(-10)}`
}

function DepositPane({ asset }: { asset?: string }) {
  const initial = React.useMemo(() => {
    const row = asset ? BALANCE_ROWS.find((r) => r.symbol === asset) : undefined
    return (row && chainFor(row)?.key) ?? CHAIN_GROUPS[0].key
  }, [asset])
  const [chainKey, setChainKey] = React.useState(initial)
  React.useEffect(() => setChainKey(initial), [initial])
  const chain = CHAIN_GROUPS.find((c) => c.key === chainKey) ?? CHAIN_GROUPS[0]
  const { copied, copy } = useCopy()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <FieldLabel aside="One address per network">Network</FieldLabel>
        <div role="radiogroup" aria-label="Network" className="grid grid-cols-3 gap-2">
          {CHAIN_GROUPS.map((c) => {
            const on = c.key === chain.key
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChainKey(c.key)}
                className={cn(
                  "relative flex h-11 items-center justify-center gap-2 rounded-xl border text-[12.5px] font-semibold transition-colors",
                  on ? "border-primary/55 text-foreground" : "border-white/[0.07] text-muted-foreground hover:border-white/[0.14] hover:text-foreground",
                )}
              >
                {on && <motion.span layoutId="deposit-chain" transition={SLIDE} className="absolute inset-0 rounded-xl bg-primary/[0.08]" />}
                <CoinAvatar symbol={c.symbol} size="sm" className="relative" />
                <span className="relative">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.07] bg-[radial-gradient(120%_90%_at_50%_0%,rgb(250_204_21/0.06),transparent_60%)] p-5">
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
        <span className="text-[12px] font-medium text-muted-foreground">{chain.caption}</span>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Your {chain.name} address</FieldLabel>
        <button
          type="button"
          onClick={() => copy(chain.address)}
          title={chain.address}
          className="group flex h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-left transition-colors hover:border-primary/35"
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
          { k: "Minimum deposit", v: chain.minimum },
          { k: "Credited after", v: `${chain.confirmations} confirmation${chain.confirmations === 1 ? "" : "s"}` },
        ].map((d) => (
          <div key={d.k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
            <dt className="text-[11.5px] text-muted-foreground">{d.k}</dt>
            <dd className="text-[13px] font-semibold tabular-nums text-foreground">{d.v}</dd>
          </div>
        ))}
      </dl>

      <Note tone="warning">
        Send only {chain.networks.join(", ")} assets to this address. This is a demo address nobody controls — anything sent to it is lost.
      </Note>
    </div>
  )
}

/* ── Withdraw ─────────────────────────────────────────────────────────── */

const WITHDRAWABLE = BALANCE_ROWS.filter((r) => r.available > 0)

function WithdrawPane({ asset }: { asset?: string }) {
  const initial = React.useMemo(() => WITHDRAWABLE.find((r) => r.symbol === asset) ?? WITHDRAWABLE[0], [asset])
  const [row, setRow] = React.useState<BalanceRow>(initial)
  const [address, setAddress] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [done, setDone] = React.useState(false)
  React.useEffect(() => setRow(initial), [initial])

  const chain = chainFor(row)
  const fee = chain ? WITHDRAW_FEES[chain.key] : undefined
  const n = Number(amount)
  // The fee is charged in the chain's gas coin; when that IS the asset, it
  // comes out of the amount, otherwise the amount arrives whole.
  const feeInAsset = fee && fee.symbol === row.symbol ? fee.fee : 0
  const receive = Math.max(0, n - feeInAsset)
  const valid = address.trim().length >= 26 && n > 0 && n <= row.available

  if (done) {
    return <DemoDone message={`Withdrawal of ${formatAmount(n)} ${row.symbol} reviewed`} onReset={() => { setDone(false); setAmount(""); setAddress("") }} />
  }

  return (
    <div className="flex flex-col gap-4">
      <AssetSelect rows={WITHDRAWABLE} value={row} onChange={(r) => { setRow(r); setAmount("") }} />

      <div className="flex flex-col gap-2">
        <FieldLabel aside={chain ? `${chain.name} · ${chain.caption}` : undefined}>Recipient address</FieldLabel>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder={`Paste a ${chain?.name ?? ""} address`}
          spellCheck={false}
          className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 font-mono text-[13px] text-foreground outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground/60 focus:border-primary/45"
        />
      </div>

      <AmountField value={amount} onChange={setAmount} max={row.available} symbol={row.symbol} price={row.price} />

      <dl className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[12.5px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Network fee</dt>
          <dd className="font-semibold tabular-nums text-foreground">{fee ? `${fee.fee} ${fee.symbol}` : "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">You receive</dt>
          <dd className="font-semibold tabular-nums text-foreground">{n > 0 ? `${formatAmount(receive)} ${row.symbol}` : "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Arrives in</dt>
          <dd className="font-semibold text-foreground">{fee?.eta ?? "—"}</dd>
        </div>
      </dl>

      <PrimaryButton disabled={!valid} onClick={() => setDone(true)}>
        Review withdrawal
      </PrimaryButton>
    </div>
  )
}

/* ── Transfer ─────────────────────────────────────────────────────────── */

function AccountCard({ label, account, onChange, exclude }: { label: string; account: AccountKey; onChange: (k: AccountKey) => void; exclude: AccountKey }) {
  return (
    <label className="flex flex-1 flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 transition-colors focus-within:border-primary/45 hover:border-white/[0.14]">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <span className="relative flex items-center">
        <select
          value={account}
          onChange={(e) => onChange(e.target.value as AccountKey)}
          className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-[14.5px] font-semibold text-foreground outline-none [&>option]:bg-[#141414]"
        >
          {ACCOUNTS.filter((a) => a.key !== exclude).map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
        <Icon icon={ArrowDown01Icon} className="pointer-events-none absolute right-0 size-4 text-muted-foreground" strokeWidth={2} />
      </span>
    </label>
  )
}

function TransferPane({ asset }: { asset?: string }) {
  const [from, setFrom] = React.useState<AccountKey>("funding")
  const [to, setTo] = React.useState<AccountKey>("spot")
  const [spin, setSpin] = React.useState(0)
  const [amount, setAmount] = React.useState("")
  const [done, setDone] = React.useState(false)

  const rows = BALANCE_ROWS.filter((r) => r.account === from && r.available > 0)
  const preferred = rows.find((r) => r.symbol === asset) ?? rows[0]
  const [symbol, setSymbol] = React.useState(preferred?.symbol)
  const row = rows.find((r) => r.symbol === symbol) ?? rows[0]
  const n = Number(amount)
  const valid = !!row && n > 0 && n <= row.available

  const swap = () => {
    setFrom(to)
    setTo(from)
    setSpin((s) => s + 180)
    setAmount("")
  }

  if (done && row) {
    const label = (k: AccountKey) => ACCOUNTS.find((a) => a.key === k)?.label
    return <DemoDone message={`Moved ${formatAmount(n)} ${row.symbol} from ${label(from)} to ${label(to)}`} onReset={() => { setDone(false); setAmount("") }} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <AccountCard label="From" account={from} exclude={to} onChange={(k) => { setFrom(k); setAmount("") }} />
        <button
          type="button"
          onClick={swap}
          aria-label="Swap accounts"
          className="absolute left-1/2 top-1/2 z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.1] bg-[#171717] text-primary shadow-[0_6px_16px_-4px_rgb(0_0_0/0.7)] transition-colors hover:border-primary/45"
        >
          <motion.span animate={{ rotate: spin }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="flex">
            <Icon icon={ArrowDataTransferVerticalIcon} className="size-4 sm:rotate-90" strokeWidth={2} />
          </motion.span>
        </button>
        <AccountCard label="To" account={to} exclude={from} onChange={setTo} />
      </div>

      {row ? (
        <>
          <AssetSelect rows={rows} value={row} onChange={(r) => { setSymbol(r.symbol); setAmount("") }} />
          <AmountField value={amount} onChange={setAmount} max={row.available} symbol={row.symbol} price={row.price} />
          <Note>Transfers between your own accounts are instant and free.</Note>
          <PrimaryButton disabled={!valid} onClick={() => setDone(true)}>
            Transfer
          </PrimaryButton>
        </>
      ) : (
        <Note>Nothing available to move out of this account. Pick a different “From” account.</Note>
      )}
    </div>
  )
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

/**
 * The page renders one panel per breakpoint (under the hero on a phone, in
 * the side column on wide screens), so each copy gets its own LayoutGroup —
 * otherwise their sliding highlights share layoutIds and animate across the
 * page into each other.
 */
export function ActionPanel({ className, id }: { className?: string; id: string }) {
  return (
    <LayoutGroup id={id}>
      <ActionPanelInner className={className} />
    </LayoutGroup>
  )
}

function ActionPanelInner({ className }: { className?: string }) {
  const { action, asset, explicit, setAction } = useWalletAction()
  const ref = React.useRef<HTMLElement>(null)
  const first = React.useRef(true)

  // Arriving from a rail row or a table action: on a phone the panel can be
  // below the fold, so bring it up. Only when this copy is the visible one
  // (the page renders one per breakpoint) and only if it isn't already in view.
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
    // overflow-visible: the asset picker's list drops below its field and
    // must not be clipped at the panel edge.
    <Panel ref={ref} className={cn("scroll-mt-4 flex flex-col gap-5 overflow-visible p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between px-0.5">
        <PanelTitle className="text-[16px]">Move funds</PanelTitle>
        <span className="text-[12px] font-medium text-muted-foreground">Demo — nothing is sent</span>
      </div>

      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1">
        {ACTIONS.map((a) => {
          const on = a.key === action
          return (
            <button
              key={a.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setAction(a.key)}
              className={cn(
                "relative flex h-10 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold transition-colors duration-200",
                on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {on && <motion.span layoutId="wallet-action" transition={SLIDE} className="dash-gold-btn absolute inset-0 rounded-xl" />}
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
          {action === "deposit" && <DepositPane asset={asset} />}
          {action === "withdraw" && <WithdrawPane asset={asset} />}
          {action === "transfer" && <TransferPane asset={asset} />}
        </motion.div>
      </AnimatePresence>
    </Panel>
  )
}
