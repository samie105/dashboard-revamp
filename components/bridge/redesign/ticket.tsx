"use client"

/**
 * The preview's bridge form (components/bridge-unauth/ticket.tsx) on the real
 * bridge. Same anatomy: source picker, destination lanes, the send / receive
 * boxes, the breakdown, a button that names its blocker, and a staged screen
 * after.
 *
 * Swapped for real data:
 *  · there is ONE lane — USDC on Arbitrum One → WSK on Intertrain, 1:1 — so
 *    the source picker and the lane list each hold one entry (the source list
 *    is the bridge status's own `sourceNetworks`);
 *  · the backend publishes no fee, min/max or ETA for it, so those read "—"
 *    rather than a guess; Balance is the wallet's real Arbitrum USDC;
 *  · the staged screen reads the ledger: signed → confirming on Arbitrum →
 *    minting on Intertrain, with no percentage and no countdown, because the
 *    ledger carries neither.
 * Kept from the old page (components/bridge/intertrain-usdc-bridge-client.tsx,
 * now unused): the blocker ladder, the destination account choice, the
 * submit loop (approval wait, nonce / fee / approval-pending recovery with a
 * fresh idempotency key), the unlock-and-resume, and every notice.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown01Icon, ArrowDownDoubleIcon, Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import { Figure, Icon, Panel, SLIDE } from "@/components/dashboard/redesign/ui"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { formatCryptoAmount, useCryptoBalances } from "@/hooks/crypto/useCryptoBalances"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { CryptoBackendError, cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { signEvmIntent } from "@/lib/crypto-wallet"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { NETWORK_ICON } from "@/lib/networks"
import { acceptAmountInput } from "@/lib/wallet-view"
import { BRIDGE_STAGES, bridgeRows, stageOf } from "@/lib/bridge-view"

export const SOURCE = { id: "arbitrum-one", name: "Arbitrum One", asset: "USDC", mark: "ARB", icon: NETWORK_ICON.arbitrum }
export const DEST = { id: "intertrain", name: "Intertrain", asset: "WSK", mark: "WSK", icon: NETWORK_ICON.intertrain }

export function useBridgeStatus() {
  return useQuery({
    queryKey: ["crypto", "intertrain-bridge", "status"],
    queryFn: ({ signal }) => cryptoBackendClient.getIntertrainUsdcBridgeStatus(signal),
    refetchInterval: 30_000,
  })
}

/** The wallet's USDC on Arbitrum One, or null while unknown. */
export function useArbitrumUsdc(): number | null {
  const balances = useCryptoBalances()
  return React.useMemo(() => {
    const row = balances.balances.find((b) => b.networkId === SOURCE.id && b.symbol.toUpperCase() === "USDC")
    if (!row) return balances.isLoading ? null : 0
    const n = Number(formatCryptoAmount(row.amountBaseUnits, row.decimals))
    return Number.isFinite(n) ? n : null
  }, [balances.balances, balances.isLoading])
}

/* ── Source chain picker ──────────────────────────────────────────────── */

function SourcePicker({ balance, sources }: { balance: number | null; sources: number }) {
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
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-16 w-full items-center gap-3 rounded-2xl border bg-foreground/[0.025] px-4 text-left transition-colors",
          open ? "border-primary/45" : "border-foreground/[0.08] hover:border-foreground/[0.14]",
        )}
      >
        <CoinAvatar symbol={SOURCE.mark} src={SOURCE.icon} size="lg" className="size-9 ring-1 ring-foreground/10" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[11.5px] font-medium text-muted-foreground">From</span>
          <span className="truncate text-[15px] font-semibold text-foreground">{SOURCE.name}</span>
        </span>
        <span className="text-[12px] text-muted-foreground">1 lane</span>
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
            className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-foreground/[0.08] bg-popover/98 p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)] backdrop-blur-xl"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-xl bg-primary/[0.08] px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.05]"
              >
                <CoinAvatar symbol={SOURCE.mark} src={SOURCE.icon} size="lg" className="size-8 ring-1 ring-foreground/10" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-[13.5px] font-semibold text-foreground">{SOURCE.name}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">To {DEST.name}</span>
                </span>
                <span className="text-[12px] tabular-nums text-muted-foreground">
                  <Figure mask="••••">{balance !== null && balance > 0 ? `${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${SOURCE.asset}` : "—"}</Figure>
                </span>
              </button>
            </li>
            {sources === 0 && <li className="px-2.5 py-2 text-[12px] text-muted-foreground">The bridge hasn&apos;t published its sources yet.</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Progress (after confirm) ─────────────────────────────────────────── */

function BridgeProgress({ amount, placedAt, message, onReset }: { amount: string; placedAt: number; message: string; onReset: () => void }) {
  const { records } = useLedgerRecords(50)
  // The deposit this screen is about: the newest one written since it was
  // placed (a minute's grace for clock skew). Until the ledger lists it, the
  // signature is done and Arbitrum is the wait.
  const row = React.useMemo(() => {
    const { inFlight, done } = bridgeRows(records)
    return [...inFlight, ...done]
      .filter((r) => r.at && Date.parse(r.at) >= placedAt - 60_000)
      .sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""))[0]
  }, [records, placedAt])
  const stage = row ? stageOf(row.status) : 1
  const failed = stage === -1

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="flex items-center gap-3">
          <CoinAvatar symbol={SOURCE.mark} src={SOURCE.icon} size="lg" className="size-11 ring-1 ring-foreground/10" />
          <span className="relative h-1 w-20 overflow-hidden rounded-full bg-foreground/[0.08]">
            <motion.span
              animate={{ x: failed ? "0%" : ["-100%", "100%"] }}
              transition={failed ? { duration: 0.3 } : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              className={cn("absolute inset-0 rounded-full", failed ? "bg-debit" : "bg-gradient-to-r from-transparent via-primary to-transparent")}
            />
          </span>
          <CoinAvatar symbol={DEST.mark} src={DEST.icon} size="lg" className="size-11 ring-1 ring-foreground/10" />
        </div>
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">{failed ? "Bridge failed" : "Bridging…"}</span>
        <span className="text-[13.5px] tabular-nums text-muted-foreground">
          {amount} {SOURCE.asset} on {SOURCE.name} → <span className="font-semibold text-credit">{amount} {DEST.asset}</span> on {DEST.name}
        </span>
        <span className="text-[12.5px] text-muted-foreground">{failed ? "The ledger reports this deposit failed." : message}</span>
      </div>

      <ol className="flex flex-col gap-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
        {BRIDGE_STAGES.map((s, i) => {
          const state = failed ? (i === 0 ? "done" : "todo") : i < stage ? "done" : i === stage ? "current" : "todo"
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
                  state === "current" && "border-primary/50 bg-primary/[0.1]",
                  state === "todo" && "border-foreground/[0.1]",
                )}
              >
                {state === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : state === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={cn("text-[13.5px] font-semibold", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s.label}</span>
                <span className="text-[12px] text-muted-foreground">{s.detail}</span>
                <span className="relative h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  {state === "done" && <span className="absolute inset-0 rounded-full bg-credit/70" />}
                  {state === "current" && (
                    <motion.span
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
                    />
                  )}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/transactions" className="flex h-12 items-center justify-center rounded-xl border border-foreground/[0.08] text-[14px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary">
          View history
        </Link>
        <button type="button" onClick={onReset} className="ds-gold h-12 rounded-xl text-[14px] font-semibold">
          Bridge more
        </button>
      </div>
      <p className="-mt-2 text-center text-[11.5px] text-muted-foreground">It is safe to leave this page — the bridge carries on.</p>
    </motion.div>
  )
}

/* ── Ticket ───────────────────────────────────────────────────────────── */

const amountClass =
  "min-w-0 flex-1 bg-transparent font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30 sm:text-[34px]"

export function BridgeTicket() {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const qc = useQueryClient()
  const balance = useArbitrumUsdc()
  const [amount, setAmount] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<{ tone: "progress" | "error"; text: string } | null>(null)
  const [unlock, setUnlock] = React.useState(false)
  const resume = React.useRef<(() => void) | null>(null)
  const [placed, setPlaced] = React.useState<null | { amount: string; at: number; message: string }>(null)
  const status = useBridgeStatus()
  const pkg = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })
  const account = wallet.data?.accounts.find((a) => a.chainFamily === "evm" && a.state === "active")
  const [selectedDestination, setSelectedDestination] = React.useState("")
  const destinations = wallet.data?.accounts.filter((a) => a.chainFamily === "intertrain" && a.state === "active" && a.canonicalAddress) ?? []
  const destination = destinations.find((a) => a.id === selectedDestination) ?? (destinations.length === 1 ? destinations[0] : undefined)
  const value = Number(amount)
  const valid = Number.isFinite(value) && value > 0
  // The old page's blocker ladder, unchanged.
  const blocker = !isCryptoBackendEnabled
    ? "Modern wallet backend is not enabled"
    : !wallet.data
      ? "Create your modern wallet first"
      : !account
        ? "Your modern wallet has no active EVM account"
        : destinations.length === 0
          ? "Add an active Intertrain account first"
          : !destination
            ? "Select an Intertrain destination"
            : status.isLoading
              ? "Checking bridge status…"
              : !status.data?.available
                ? status.data?.reason ?? "Bridge unavailable"
                : !valid
                  ? "Enter an amount"
                  : null

  // The old page's submit, unchanged — only its last line moves the ticket
  // to the staged screen instead of leaving a notice under the form.
  async function submit() {
    if (!destination) {
      setNotice({ tone: "error", text: "Select your Intertrain destination account first." })
      return
    }
    if (blocker || busy || !user?.userId || !wallet.data?.id || !pkg.data || !account) return
    if (!getUnlockedWalletState(user.userId, wallet.data.id)) {
      resume.current = () => void submit()
      setUnlock(true)
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      let idempotencyKey = crypto.randomUUID()
      let completed = false
      for (let recoveryAttempt = 0; recoveryAttempt < 4 && !completed; recoveryAttempt += 1) {
        try {
          const { intents } = await cryptoBackendClient.createIntertrainUsdcBridgeIntents({ accountId: account.id, destinationAccountId: destination.id, amount, idempotencyKey })
          if (intents.length === 0) throw new Error("The bridge returned no transaction intent")
          let approvalSubmitted = false
          for (const intent of intents) {
            const signed = await signEvmIntent(user.userId, wallet.data.id, pkg.data, intent, account.id)
            await cryptoBackendClient.submitIntent(intent.id, signed)
            approvalSubmitted ||= String(intent.normalizedSummary?.action) === "bridge-approve"
          }
          if (approvalSubmitted) {
            setNotice({ tone: "progress", text: "USDC approval submitted. Waiting for Arbitrum confirmation before depositing…" })
            await new Promise((resolve) => setTimeout(resolve, 8_000))
            idempotencyKey = crypto.randomUUID()
          } else completed = true
        } catch (error) {
          const recoverable = error instanceof CryptoBackendError && ["NONCE_STALE", "FEE_TOO_LOW", "BRIDGE_APPROVAL_PENDING"].includes(error.code)
          if (!recoverable || recoveryAttempt === 3) throw error
          // The signed intent cannot be edited. Prepare a new intent with a
          // fresh idempotency key so the backend re-reads nonce, allowance,
          // and fees before asking the user to sign again.
          idempotencyKey = crypto.randomUUID()
          if (error instanceof CryptoBackendError && error.code === "BRIDGE_APPROVAL_PENDING") {
            setNotice({ tone: "progress", text: "USDC approval is still confirming on Arbitrum. Waiting before depositing…" })
            await new Promise((resolve) => setTimeout(resolve, 8_000))
          } else setNotice({ tone: "progress", text: "Arbitrum state changed while preparing the bridge. Refreshing the transaction…" })
        }
      }
      if (!completed) throw new Error("The USDC approval was submitted but has not confirmed yet. Try again after it is mined.")
      setPlaced({ amount, at: Date.now(), message: "USDC deposit submitted. WSK will appear after Arbitrum finality and Intertrain consensus minting." })
      setAmount("")
      setNotice(null)
      await qc.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(user.userId) })
    } catch (e) {
      setNotice({ tone: "error", text: formatWalletActionError(e, "arbitrum", "USDC") })
    } finally {
      setBusy(false)
    }
  }

  const live = status.data?.available === true
  const n = valid ? value : 0
  const shortAddress = (a?: string) => (a ? `${a.slice(0, 10)}…${a.slice(-8)}` : "")

  return (
    <Panel className="overflow-visible p-4 sm:p-6">
      <AnimatePresence mode="wait" initial={false}>
        {placed ? (
          <BridgeProgress key="progress" amount={placed.amount} placedAt={placed.at} message={placed.message} onReset={() => setPlaced(null)} />
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-[18px] font-semibold tracking-[-0.01em]">Bridge</span>
              <span className="text-[12px] font-medium text-muted-foreground">Move assets between chains</span>
            </div>

            <SourcePicker balance={balance} sources={status.data?.sourceNetworks?.length ?? 1} />

            <div className="flex flex-col gap-2">
              <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">To</span>
              <div role="radiogroup" aria-label="Destination" className="flex flex-col gap-2">
                <button type="button" role="radio" aria-checked className="relative flex items-center gap-3 rounded-2xl border border-primary/55 p-3 text-left transition-colors">
                  <motion.span layoutId="bridge-lane" transition={SLIDE} className="absolute inset-0 rounded-2xl bg-primary/[0.06]" />
                  <CoinAvatar symbol={DEST.mark} src={DEST.icon} size="lg" className="relative size-9 ring-1 ring-foreground/10" />
                  <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[14px] font-semibold text-foreground">
                      {DEST.name}
                      <span className="ml-1.5 font-medium text-muted-foreground">
                        {SOURCE.asset} → {DEST.asset}
                      </span>
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {destination ? `Into ${shortAddress(destination.canonicalAddress)}` : "via the verified bridge contract"}
                    </span>
                  </span>
                  <span className="relative flex flex-col items-end leading-tight">
                    <span className={cn("text-[12.5px] font-semibold", live ? "text-credit" : "text-muted-foreground")}>
                      {status.isLoading ? "Checking…" : live ? "Live" : status.data?.paused ? "Paused" : "Unavailable"}
                    </span>
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">1:1</span>
                  </span>
                </button>
              </div>

              {destinations.length > 1 && (
                <label className="flex flex-col gap-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] px-3.5 py-2.5 transition-colors focus-within:border-primary/45 hover:border-foreground/[0.14]">
                  <span className="text-[11.5px] font-medium text-muted-foreground">Receive WSK in</span>
                  <span className="relative flex items-center">
                    <select
                      value={destination?.id ?? ""}
                      onChange={(event) => setSelectedDestination(event.target.value)}
                      className="w-full cursor-pointer appearance-none bg-transparent pr-6 font-mono text-[13.5px] font-semibold text-foreground outline-none [&>option]:bg-popover"
                    >
                      <option value="">Select an Intertrain account</option>
                      {destinations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {shortAddress(item.canonicalAddress)}
                        </option>
                      ))}
                    </select>
                    <Icon icon={ArrowDown01Icon} className="pointer-events-none absolute right-0 size-4 text-muted-foreground" strokeWidth={2} />
                  </span>
                </label>
              )}
            </div>

            <div className="relative flex flex-col gap-2">
              <div className="flex flex-col gap-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4 transition-colors focus-within:border-primary/40 sm:p-5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-medium text-muted-foreground">You send</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Figure mask="••••">{`Balance ${balance === null ? "—" : balance.toLocaleString("en-US", { maximumFractionDigits: 6 })}`}</Figure>
                    <button
                      type="button"
                      onClick={() => balance !== null && setAmount(String(balance))}
                      disabled={!balance || busy}
                      className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary hover:bg-primary/20 disabled:opacity-40"
                    >
                      Max
                    </button>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    inputMode="decimal"
                    aria-label="Amount to bridge"
                    data-vivid-target="flow-amount"
                    data-vivid-label="The amount to move, in USDC"
                    value={amount}
                    disabled={busy}
                    onChange={(e) => {
                      const next = acceptAmountInput(e.target.value, 6)
                      if (next !== null) setAmount(next)
                    }}
                    placeholder="0"
                    className={amountClass}
                  />
                  <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/[0.09] bg-foreground/[0.04] pl-1.5 pr-3.5">
                    <CoinAvatar symbol={SOURCE.asset} size="lg" className="size-8 ring-1 ring-foreground/10" />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[14px] font-semibold">{SOURCE.asset}</span>
                      <span className="text-[10.5px] text-muted-foreground">{SOURCE.name}</span>
                    </span>
                  </span>
                </div>
                <div className="text-[12px] tabular-nums text-muted-foreground">USDC is deposited through the verified bridge contract.</div>
              </div>

              <span className="absolute left-1/2 top-[calc(50%-4px)] z-10 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-card bg-muted text-primary">
                <Icon icon={ArrowDownDoubleIcon} className="size-4" strokeWidth={2} />
              </span>

              <div className="flex flex-col gap-3 rounded-2xl border border-foreground/[0.05] bg-foreground/[0.015] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-medium text-muted-foreground">You receive</span>
                  <span className="text-muted-foreground">on {DEST.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(amountClass, "truncate", n === 0 && "text-muted-foreground/30")}>{n > 0 ? amount : "0"}</span>
                  <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/[0.09] bg-foreground/[0.04] pl-1.5 pr-3.5">
                    <CoinAvatar symbol={DEST.mark} src={DEST.icon} size="lg" className="size-8 ring-1 ring-foreground/10" />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[14px] font-semibold">{DEST.asset}</span>
                      <span className="text-[10.5px] text-muted-foreground">{DEST.name}</span>
                    </span>
                  </span>
                </div>
                <div className="text-[12px] text-muted-foreground">1 {SOURCE.asset} = 1 {DEST.asset}</div>
              </div>
            </div>

            <dl className="flex flex-col gap-2.5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] px-4 py-3.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Bridge fee</dt>
                <dd className="font-semibold tabular-nums text-foreground">—</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Gas on {DEST.name}</dt>
                <dd className="font-semibold tabular-nums text-foreground">—</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Estimated time</dt>
                <dd className="font-semibold tabular-nums text-foreground">—</dd>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-foreground/[0.06] pt-3">
                <dt className="font-semibold text-foreground">You receive</dt>
                <dd className="font-display text-[15px] font-semibold tabular-nums text-foreground">{n > 0 ? `${amount} ${DEST.asset}` : "—"}</dd>
              </div>
            </dl>

            {notice && (
              <div
                className={cn(
                  "rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed",
                  notice.tone === "progress" ? "border-warning/25 bg-warning/[0.06] text-foreground/80" : "border-debit/25 bg-debit/[0.06] text-foreground/80",
                )}
              >
                {notice.text}
              </div>
            )}

            <button
              type="button"
              disabled={!!blocker || busy}
              aria-busy={busy || undefined}
              onClick={() => void submit()}
              // The old page's Vivid control identity (FlowCta's control prop),
              // kept: same target, same guard, same spoken label.
              data-vivid-target="bridge-submit"
              data-vivid-guard=""
              aria-label={`Bridge USDC to Intertrain — ${busy ? "Signing and submitting…" : blocker ?? `Bridge to ${DEST.name}`}`}
              data-vivid-label={`Bridge USDC to Intertrain: ${busy ? "Signing and submitting…" : blocker ?? `Bridge to ${DEST.name}`}.`}
              className={cn(
                "flex h-[52px] items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-colors",
                blocker ? "border border-foreground/[0.07] bg-foreground/[0.04] text-muted-foreground" : "ds-gold disabled:opacity-60",
              )}
            >
              {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
              {busy ? "Signing and submitting…" : blocker ?? `Bridge to ${DEST.name}`}
            </button>
            <p className="-mt-2 text-center text-[11.5px] text-muted-foreground">You sign on this device — your key never leaves it.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <WalletUnlockDialog
        open={unlock}
        onOpenChange={setUnlock}
        onUnlocked={() => {
          setUnlock(false)
          resume.current?.()
          resume.current = null
        }}
        action="hyperliquid-deposit"
      />
    </Panel>
  )
}
