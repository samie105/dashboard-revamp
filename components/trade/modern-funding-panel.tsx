"use client"

/**
 * Trading-account money doors (spec §6, §10).
 *
 * Three actions that share nothing but a currency, so they share no form:
 *
 *  · **Deposit** bridges USDC out of the self-custodial wallet. It is the only
 *    one that is slow, the only one that is multi-transaction, and the only one
 *    that can be interrupted by a page reload — so it is the only one with a
 *    staged checklist and a resume record.
 *  · **Transfer** moves USDC between the Spot and Perps balances. One signature,
 *    one venue call, instant.
 *  · **Withdraw** sends USDC back to the wallet's OWN address. It states that
 *    destination rather than asking for one — the flow cannot send money
 *    anywhere the user doesn't already control.
 *
 * Spec §10 requires these stay distinct: a blended form with a mode switch was
 * the previous shape, and it let a user type an amount under one meaning and
 * submit it under another.
 *
 * What is load-bearing here beyond the layout:
 *
 *  · **The idempotency key is sticky per ATTEMPT, not per request.** It's minted
 *    when a modal opens and reused by every retry inside that attempt, so a
 *    retry after a network blip re-reaches the SAME backend operation instead of
 *    starting a second deposit. A new key is minted only when the user
 *    explicitly starts over. The CTA is `busy` while a submission is in flight,
 *    which is what stops the double-click before the key ever matters.
 *  · **A deposit outlives this component.** The intent ids, the amount and the
 *    start time are written to `ws:funding-pending:{userId}` before the first
 *    signature and cleared on a terminal state, so a reload mid-bridge comes
 *    back to the same status screen rather than to an empty form and a silent
 *    on-chain transfer.
 *  · **Crediting is a DELTA, never an absolute.** The trading balance at the
 *    moment the deposit started is the baseline; a balance that merely happens
 *    to exceed the deposit amount proves nothing.
 */

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { AddressPill, SectionMessage } from "@/components/crypto/primitives"
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"
import {
  AmountField,
  AnnouncementBanner,
  DetailPanel,
  FlowCta,
  InlineNotice,
  StatusScreen,
  useElapsed,
  useStageProgress,
} from "@/components/ui/flow"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { Segmented, type SegmentedOption } from "@/components/ui/system"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  describeCryptoError,
  existingOperationIdFrom,
  FUNDING_STAGES,
  fundingStageIndex,
  type CryptoTransactionIntent,
  type CryptoWalletAccount,
  type CryptoWalletDetails,
  type CryptoWalletPackageDocument,
  type HyperliquidAccount,
} from "@/lib/crypto-backend"
import { signEvmIntent, signHyperliquidIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { cn } from "@/lib/utils"

/* ── Copy Deck ─────────────────────────────────────────────────────────── */

/** `funding.notInstant` — the promise the UI must never break (spec §10). */
const NOT_INSTANT = "Bridge deposits are not instant — they usually take a few minutes to arrive."
const SLOW_BRIDGE =
  "The bridge is taking longer than usual. Your funds are safe — the deposit continues in the background."
/** How long a bridge may run before the wait itself needs explaining. */
const SLOW_AFTER_MS = 10 * 60_000

/* ── The resume record ─────────────────────────────────────────────────── */

const RECORD_PREFIX = "ws:funding-pending:"
/**
 * A record this old is not a deposit anyone is still waiting on — it's a tab
 * that was closed a week ago. Reopening a status screen for it would be noise,
 * and the intent ids behind it may no longer resolve.
 */
const RECORD_MAX_AGE_MS = 24 * 60 * 60 * 1_000

export type FundingPendingRecord = { intentIds: string[]; amount: number; startedAt: number }

function recordKey(userId: string) {
  return `${RECORD_PREFIX}${userId}`
}

/**
 * Every read is defensive. This value comes back from a store the user, another
 * tab, or an older build of this app can all write — a shape check that trusts
 * `JSON.parse` would let a malformed record crash the trade page on mount.
 */
function readPendingRecord(userId: string): FundingPendingRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(recordKey(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const value = parsed as Partial<FundingPendingRecord>
    const intentIds = Array.isArray(value.intentIds)
      ? value.intentIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
    const amount = typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount > 0 ? value.amount : null
    const startedAt =
      typeof value.startedAt === "number" && Number.isFinite(value.startedAt) && value.startedAt > 0 ? value.startedAt : null
    if (intentIds.length === 0 || amount === null || startedAt === null) return null
    if (Date.now() - startedAt > RECORD_MAX_AGE_MS) return null
    return { intentIds, amount, startedAt }
  } catch {
    return null
  }
}

function writePendingRecord(userId: string, record: FundingPendingRecord) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(recordKey(userId), JSON.stringify(record))
  } catch {
    // A full or blocked store costs the resume, not the deposit. Never throw
    // between creating intents and signing them.
  }
}

function clearPendingRecord(userId: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(recordKey(userId))
  } catch {
    /* see writePendingRecord */
  }
}

/* ── Small shared helpers ──────────────────────────────────────────────── */

/**
 * The three status sets a retry has to tell apart. All three are ALLOWLISTS,
 * and the default for anything not named is "leave it alone".
 *
 * That direction matters more than the membership. The backend owns this
 * vocabulary and is free to grow it without asking this client — a `broadcast`
 * or `relaying` status could arrive tomorrow. Written as a denylist of
 * already-sent statuses, an unrecognised one would fall through to "re-sign and
 * re-submit", which for an EVM transaction means broadcasting a second time
 * against money that is already moving. Written this way, an unknown status is
 * skipped and reported, which costs at worst a wait.
 */

/** Dead ends. Never re-signed: a `failed` intent has a consumed nonce or a
 *  reverted call, and spec §13 says an expired intent is REPLACED, never
 *  reused. Both route the user to "Start a new deposit" (a new key), which is
 *  the only honest retry for a leg that died. */
const DEAD_STATUSES = new Set(["failed", "expired"])

/** Known to be un-sent — the intent exists and no transaction went out under
 *  it, so signing it is the thing that was missing. `signed` belongs here: it
 *  sits before `submitted` in the backend's own ordering, and EVM signing is
 *  deterministic, so re-signing yields the identical raw transaction. */
const RESIGNABLE_STATUSES = new Set(["created", "simulated", "validated", "signed"])

/** Known to be on their way. Skipped — as is EVERY status in none of the three
 *  sets, which is the whole point (see above). */
const ALREADY_SENT = new Set(["submitted", "pending", "confirmed"])

function parseAmount(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatUsdc(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Everything the trading account holds, across both balances.
 *
 * Deliberately the SUM: a deposit lands wherever the venue decides to put it,
 * and the question this answers is only "did the money arrive", not "where".
 * Returns null when the account has no balances yet — an absent balance must
 * never read as zero, or the first poll would look like a withdrawal.
 */
function tradingTotal(account: HyperliquidAccount | undefined | null): number | null {
  const balances = account?.balances
  if (!balances) return null
  const perps = Number(balances.perpsAccountValueUsdc)
  const spot = Number(balances.spotUsdc)
  if (!Number.isFinite(perps) || !Number.isFinite(spot)) return null
  return perps + spot
}

function tradingAccountKey(userId: string) {
  return [...cryptoQueryKeys.all, "trading-account", userId] as const
}

/** One poll for all three flows — React Query dedupes the observers. */
function useTradingAccount(userId: string, { enabled, fast }: { enabled: boolean; fast: boolean }) {
  return useQuery({
    queryKey: tradingAccountKey(userId),
    queryFn: ({ signal }) => cryptoBackendClient.getHyperliquidAccount(signal),
    enabled,
    refetchInterval: fast ? 5_000 : enabled ? 20_000 : false,
    staleTime: 2_000,
  })
}

/** The trigger row's pills, in the trade header's own idiom. */
function TriggerPill({
  label,
  tone,
  onClick,
  vividTarget,
  vividLabel,
}: {
  label: string
  tone: "primary" | "quiet"
  onClick: () => void
  vividTarget: string
  vividLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-vivid-target={vividTarget}
      data-vivid-label={vividLabel}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 sm:py-2 sm:text-sm",
        tone === "primary"
          ? "bg-primary font-bold text-primary-foreground hover:bg-primary/90"
          : "bg-surface-sunken font-semibold hover:bg-accent",
      )}
    >
      {label}
    </button>
  )
}

type FlowKey = "deposit" | "transfer" | "withdraw"

type FlowProps = {
  userId: string
  wallet: CryptoWalletDetails
  packageValue: CryptoWalletPackageDocument
  evm: CryptoWalletAccount | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opens the unlock dialog and RESUMES the interrupted action afterwards —
   *  a lapsed DEK must never cost the user their place in the flow. */
  requestUnlock: (resume: () => void) => void
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

export function ModernFundingPanel({
  userId,
  wallet,
  packageValue,
  className,
}: {
  userId: string
  wallet: CryptoWalletDetails
  packageValue: CryptoWalletPackageDocument
  className?: string
}) {
  const evm = wallet.accounts.find((account) => account.chainFamily === "evm" && account.state === "active")
  const [openFlow, setOpenFlow] = React.useState<FlowKey | null>(null)
  const [unlockOpen, setUnlockOpen] = React.useState(false)
  const resumeAfterUnlock = React.useRef<(() => void) | null>(null)

  const requestUnlock = React.useCallback((resume: () => void) => {
    resumeAfterUnlock.current = resume
    setUnlockOpen(true)
  }, [])

  /** A pending deposit re-opens its own status screen (see DepositFlow). */
  const resumeDeposit = React.useCallback(() => setOpenFlow("deposit"), [])

  const shared = { userId, wallet, packageValue, evm, requestUnlock }

  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-2", className)}>
      <TriggerPill
        label="Deposit"
        tone="primary"
        onClick={() => setOpenFlow("deposit")}
        vividTarget="trade-fund-button"
        vividLabel="Open the deposit modal — bridge USDC from the wallet into the trading account"
      />
      <TriggerPill
        label="Transfer"
        tone="quiet"
        onClick={() => setOpenFlow("transfer")}
        vividTarget="trade-transfer-button"
        vividLabel="Open the transfer modal — move USDC between the Spot and Perps balances"
      />
      <TriggerPill
        label="Withdraw"
        tone="quiet"
        onClick={() => setOpenFlow("withdraw")}
        vividTarget="trade-withdraw-button"
        vividLabel="Open the withdraw modal — send USDC from the trading account back to the wallet"
      />

      {/* All three stay mounted: a deposit keeps polling with its modal closed,
          and closing a flow must not throw away what it already knows. */}
      <DepositFlow
        {...shared}
        open={openFlow === "deposit"}
        onOpenChange={(next) => setOpenFlow(next ? "deposit" : null)}
        onResume={resumeDeposit}
      />
      <TransferFlow {...shared} open={openFlow === "transfer"} onOpenChange={(next) => setOpenFlow(next ? "transfer" : null)} />
      <WithdrawFlow
        {...shared}
        open={openFlow === "withdraw"}
        onOpenChange={(next) => setOpenFlow(next ? "withdraw" : null)}
        // Withdrawals debit Perps, so money sitting in Spot has to be moved
        // first. The withdraw screen hands the user straight to the flow that
        // does it rather than describing a dead end.
        onSwitchToTransfer={() => setOpenFlow("transfer")}
      />

      <WalletUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={() => {
          const resume = resumeAfterUnlock.current
          resumeAfterUnlock.current = null
          resume?.()
        }}
      />
    </div>
  )
}

/* ── Deposit (bridge) ──────────────────────────────────────────────────── */

function DepositFlow({
  userId,
  wallet,
  packageValue,
  evm,
  open,
  onOpenChange,
  onResume,
  requestUnlock,
}: FlowProps & { onResume: () => void }) {
  const [phase, setPhase] = React.useState<"form" | "status">("form")
  const [amount, setAmount] = React.useState("")
  const [attemptKey, setAttemptKey] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const [duplicateWithoutId, setDuplicateWithoutId] = React.useState(false)
  /** What a retry that signed nothing has to say for itself. */
  const [retryNote, setRetryNote] = React.useState<string | null>(null)
  const [intentIds, setIntentIds] = React.useState<string[]>([])
  /**
   * Intents THIS session has already submitted.
   *
   * The status poll can lag a submit that has demonstrably landed (the submit
   * call returned a transaction record), and for a beat it still answers
   * `created`. Without this, that beat renders "this deposit was never signed"
   * over a transaction already on its way, and offers a button to send it
   * again. Local knowledge outranks a stale read.
   */
  const [submittedIds, setSubmittedIds] = React.useState<string[]>([])
  /** The amount this attempt was CREATED with — the form string can be edited
   *  under a running deposit, the committed figure can't. */
  const [committedAmount, setCommittedAmount] = React.useState<number | null>(null)
  const [startedAt, setStartedAt] = React.useState<number | null>(null)
  const [baseline, setBaseline] = React.useState<number | null>(null)
  const [baselineReady, setBaselineReady] = React.useState<boolean | null>(null)
  /** Sticky: a balance that dipped after crediting has still credited. */
  const [credited, setCredited] = React.useState(false)

  /* The key is minted on OPEN and survives every retry of this attempt. */
  React.useEffect(() => {
    if (open && phase === "form" && attemptKey === null) setAttemptKey(crypto.randomUUID())
  }, [open, phase, attemptKey])

  /* Resume: a deposit left in flight owns this screen the moment the trade
     page mounts, before the user asks for it. */
  const resumeChecked = React.useRef(false)
  React.useEffect(() => {
    if (resumeChecked.current) return
    resumeChecked.current = true
    const record = readPendingRecord(userId)
    if (!record) return
    setIntentIds(record.intentIds)
    setCommittedAmount(record.amount)
    setAmount(String(record.amount))
    setStartedAt(record.startedAt)
    setPhase("status")
    onResume()
  }, [userId, onResume])

  const intentsQuery = useQuery({
    queryKey: [...cryptoQueryKeys.all, "funding-deposit-intents", userId, intentIds.join("|")] as const,
    queryFn: async ({ signal }) => {
      // allSettled, not all: one unreachable intent must not blank the status
      // of the others. A read that didn't land is "unknown", which claims no
      // progress — never a status.
      const settled = await Promise.allSettled(intentIds.map((id) => cryptoBackendClient.getIntent(id, signal)))
      return settled.map((entry) => (entry.status === "fulfilled" ? String(entry.value.status ?? "unknown") : "unknown"))
    },
    enabled: phase === "status" && intentIds.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.length === 0) return 5_000
      // Once every intent is terminal there is nothing left for this poll to
      // learn — the account poll carries the rest of the story.
      return data.every((status) => status === "confirmed" || DEAD_STATUSES.has(status)) ? false : 5_000
    },
  })

  const statuses = React.useMemo(() => intentsQuery.data ?? [], [intentsQuery.data])
  const anyDead = statuses.some((status) => DEAD_STATUSES.has(status))
  const allConfirmed = statuses.length > 0 && statuses.every((status) => status === "confirmed")
  const inFlight = phase === "status" && !credited && !anyDead

  /**
   * Intents that exist with nothing sent under them.
   *
   * Two doors lead here and both used to dead-end: a reload DURING signing
   * (the resume record is written before the first signature, on purpose — an
   * unrecorded signature is far worse than a recorded unsigned one), and a
   * duplicate adopted from `DUPLICATE_REQUEST`, which reaches the status screen
   * without this device having signed anything. Both left a status screen that
   * said "bridging" forever, offered no action, and — past ten minutes — told
   * the user their funds were safely on their way when nothing had been sent
   * at all. This is what makes that state nameable and actionable.
   */
  const awaitingSignature = statuses.filter(
    // Index-aligned with `intentIds`: the poll maps over it in order, and a
    // changed id list refetches under its own key rather than mixing sets.
    (status, index) => RESIGNABLE_STATUSES.has(status) && !submittedIds.includes(intentIds[index]),
  ).length
  const needsSignature = awaitingSignature > 0 && !busy
  const nothingSent = needsSignature && awaitingSignature === statuses.length

  // The bridge clock only runs while there is a bridge. A deposit waiting on a
  // signature must never reach the slow-bridge notice, whose whole sentence
  // ("your funds are safe — the deposit continues in the background") is false
  // for money that never left.
  const elapsed = useElapsed(inFlight && !needsSignature ? startedAt : null)
  const slow = inFlight && !needsSignature && elapsed >= SLOW_AFTER_MS

  // A bridge that has already outrun the ten-minute mark is not about to be
  // caught by a faster poll — it backs off rather than stopping, because the
  // screen is still promising to update itself.
  const accountQuery = useTradingAccount(userId, {
    enabled: open || inFlight,
    fast: inFlight && !slow && !needsSignature,
  })

  /**
   * Crediting — a DELTA against the balance this deposit started from.
   *
   * The delta rule is the verdict: the trading total has to have risen by
   * (near enough) the deposited amount. The 1% tolerance covers rounding and
   * any bridge-side deduction; it can only delay a verdict, never invent one.
   *
   * The `ready` flip is corroboration, not proof, and is deliberately weaker
   * than it looks. An account can go `ready` for reasons that have nothing to
   * do with this deposit — lazy provisioning on first use, or the same user
   * funding from another device — so on its own it would celebrate a bridge
   * that is still running. It therefore only counts alongside a balance that
   * actually MOVED UP (`delta > 0`): money arrived, and the account became
   * usable. What that pair still can't distinguish is a credit from somewhere
   * else landing in the same window, which is a much smaller lie than the one
   * an ungated flip would tell.
   */
  React.useEffect(() => {
    if (phase !== "status" || credited) return
    const account = accountQuery.data
    if (!account) return
    const total = tradingTotal(account)
    if (baseline === null) {
      // First reading of a resumed deposit (or of one whose account poll hadn't
      // answered yet when it started). Anything credited BEFORE this point is
      // invisible to us — that's why we never claim it.
      if (total !== null) {
        setBaseline(total)
        setBaselineReady(account.ready)
      }
      return
    }
    const target = committedAmount ?? 0
    const delta = total === null ? null : total - baseline
    if (delta === null) return
    const arrived = target > 0 && delta >= target * 0.99
    const readyFlipped = baselineReady === false && account.ready === true && delta > 0
    if (arrived || readyFlipped) setCredited(true)
  }, [accountQuery.data, phase, credited, baseline, baselineReady, committedAmount])

  /* Terminal states own no resume record. */
  React.useEffect(() => {
    if (phase === "status" && (credited || anyDead)) clearPendingRecord(userId)
  }, [phase, credited, anyDead, userId])

  const rawIndex = fundingStageIndex({ intentStatuses: statuses, accountCredited: credited })
  const progress = useStageProgress(rawIndex, attemptKey ?? "none")
  // A local sign/submit error the poll has since overtaken is not a failure —
  // if every intent confirmed, the money left the wallet whatever we caught.
  const localFailure = error !== null && !allConfirmed
  const state: "processing" | "success" | "failure" = credited ? "success" : anyDead || localFailure ? "failure" : "processing"
  const activeIndex = credited ? FUNDING_STAGES.length : progress.index

  const described = error ? describeCryptoError(error) : null
  const value = parseAmount(amount)
  const blocker = !evm?.canonicalAddress
    ? "Your wallet isn't ready yet"
    : amount.trim().length === 0
      ? "Enter an amount"
      : value === null
        ? "Enter a valid amount"
        : null

  /**
   * Signs and submits only the intents KNOWN to be un-sent, and reports what it
   * left behind so the caller can say so out loud.
   *
   * Anything not in `RESIGNABLE_STATUSES` is skipped — already sent, dead, or a
   * status this build has never heard of. A retry that signs nothing is a valid
   * outcome here, not a silent no-op: `retryAttempt` turns it into a sentence.
   */
  async function submitPending(intents: CryptoTransactionIntent[]) {
    if (!evm) throw new Error("Your wallet doesn't have an active account for this network yet")
    let signedCount = 0
    let skippedUnknown = 0
    for (const intent of intents) {
      const status = String(intent.status)
      if (!RESIGNABLE_STATUSES.has(status)) {
        if (!ALREADY_SENT.has(status) && !DEAD_STATUSES.has(status)) skippedUnknown += 1
        continue
      }
      const signed = await signEvmIntent(userId, wallet.id, packageValue, intent, evm.id)
      await cryptoBackendClient.submitIntent(intent.id, signed)
      setSubmittedIds((current) => (current.includes(intent.id) ? current : [...current, intent.id]))
      signedCount += 1
    }
    return { signedCount, skippedUnknown }
  }

  /**
   * Create-or-resume, one path.
   *
   * The idempotency key is what makes it one path: with the attempt's key the
   * create call returns the SAME intents it returned the first time (§8.4 —
   * a replay answers with the existing operation), so a retry after a failed
   * signature re-signs the leftovers instead of opening a second deposit.
   */
  async function runDeposit() {
    if (busy) return
    const amountValue = parseAmount(amount)
    if (!amountValue || !evm?.canonicalAddress) return
    // Normally minted when the modal opened; minted here only if a press beat
    // that effect, and stored either way so every retry reuses this one key.
    const key = attemptKey ?? crypto.randomUUID()
    if (key !== attemptKey) setAttemptKey(key)
    if (!getUnlockedWalletState(userId, wallet.id)) {
      requestUnlock(() => void runDeposit())
      return
    }
    setBusy(true)
    setError(null)
    setDuplicateWithoutId(false)
    let created: CryptoTransactionIntent[]
    try {
      const result = await cryptoBackendClient.createHyperliquidDepositIntents({
        amount: amountValue,
        idempotencyKey: key,
      })
      created = result.intents
    } catch (cause) {
      // No intents means nothing is in flight: the form is the only honest
      // screen, and it's where the error can still be acted on.
      //
      // A DUPLICATE_REQUEST is the sticky key doing its job — this attempt
      // already exists. If the service names it, adopt it and show the status
      // screen of the operation already running; if it doesn't (which is the
      // documented behaviour today), say plainly that nothing was sent twice
      // rather than offering a "View status" button pointing at nothing.
      const duplicate = describeCryptoError(cause).action === "view-existing"
      const existingId = duplicate ? existingOperationIdFrom(cause) : null
      if (existingId) {
        adopt([existingId], amountValue)
        setBusy(false)
        return
      }
      setDuplicateWithoutId(duplicate)
      setError(cause)
      setBusy(false)
      return
    }

    adopt(
      created.map((intent) => intent.id),
      amountValue,
    )
    try {
      await submitPending(created)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  /** Adopt an attempt's intents: record first, then screen. */
  function adopt(ids: string[], amountValue: number) {
    const began = startedAt ?? Date.now()
    setIntentIds(ids)
    setCommittedAmount(amountValue)
    setStartedAt(began)
    if (baseline === null) {
      const total = tradingTotal(accountQuery.data)
      if (total !== null) {
        setBaseline(total)
        setBaselineReady(accountQuery.data?.ready ?? null)
      }
    }
    writePendingRecord(userId, { intentIds: ids, amount: amountValue, startedAt: began })
    setPhase("status")
  }

  /**
   * Retry THIS attempt — the same intents, only the leftovers signed.
   *
   * Deliberately keyed on the intent IDS rather than the idempotency key, so it
   * works for a deposit RESUMED from localStorage too: that record carries the
   * ids but not the key, and minting a fresh key here to "retry" would open a
   * second deposit, which is the exact thing the key exists to prevent.
   */
  async function retryAttempt() {
    if (busy || intentIds.length === 0 || !evm) return
    if (!getUnlockedWalletState(userId, wallet.id)) {
      requestUnlock(() => void retryAttempt())
      return
    }
    setBusy(true)
    setError(null)
    setRetryNote(null)
    try {
      const settled = await Promise.all(intentIds.map((id) => cryptoBackendClient.getIntent(id)))
      const { signedCount, skippedUnknown } = await submitPending(settled)
      await intentsQuery.refetch()
      // A retry that signed nothing must SAY so. Silence here reads as a dead
      // button, and the alternative — signing something we aren't sure is
      // un-sent — is a second broadcast.
      if (signedCount === 0) {
        setRetryNote(
          skippedUnknown > 0
            ? "Nothing was re-signed: a step is in a state this app doesn't recognise, so it was left alone rather than sent twice. This screen updates as the network reports back."
            : "Nothing needed re-signing — every step is already with the network. This screen updates as they land.",
        )
      }
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  /** A deliberate second deposit — the one thing that earns a new key. */
  function startNewAttempt() {
    clearPendingRecord(userId)
    setPhase("form")
    setAttemptKey(null)
    setIntentIds([])
    setCommittedAmount(null)
    setStartedAt(null)
    setBaseline(null)
    setBaselineReady(null)
    setCredited(false)
    setError(null)
    setDuplicateWithoutId(false)
    setRetryNote(null)
    setSubmittedIds([])
  }

  /** Stop tracking. The deposit itself continues wherever it had got to. */
  function dismiss() {
    clearPendingRecord(userId)
    startNewAttempt()
    setAmount("")
    onOpenChange(false)
  }

  /**
   * Escape, the backdrop and the X all land here. A deposit still bridging
   * keeps every bit of its state, so reopening the modal returns to the same
   * status screen; only a FINISHED one is cleared away, so the next open is a
   * genuinely new attempt with a new key.
   */
  function handleOpenChange(next: boolean) {
    if (!next && (credited || anyDead)) {
      startNewAttempt()
      setAmount("")
    }
    onOpenChange(next)
  }

  const figure = committedAmount !== null ? `${formatUsdc(committedAmount)} USDC` : undefined
  const failedStage = FUNDING_STAGES[Math.min(activeIndex, FUNDING_STAGES.length - 1)]?.label ?? ""

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Fund trading account</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Bridge USDC from your self-custody wallet into your trading account.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {phase === "status" ? (
          <div className="flex flex-col gap-4">
            <StatusScreen
              state={state}
              direction="in"
              // Nothing is "in transit" when nothing was signed — the core
              // shows a plain pulse instead of a figure it would be lying about.
              figure={nothingSent ? undefined : figure}
              headline={
                state === "success"
                  ? "Deposit credited"
                  : state === "failure"
                    ? "Deposit didn't finish"
                    : needsSignature
                      ? nothingSent
                        ? "Finish your deposit"
                        : "One step still needs signing"
                      : "Bridging your deposit"
              }
              caption={
                state === "success"
                  ? "Your trading account has the funds."
                  : state === "failure"
                    ? `It stopped at “${failedStage}”.`
                    : needsSignature
                      ? nothingSent
                        ? "This deposit was never signed, so nothing has left your wallet yet."
                        : "The other steps are already with the network. Sign the last one to finish."
                      : NOT_INSTANT
              }
              // The checklist stays up through a failure: which stage it
              // reached is the most useful thing on the screen.
              stages={[...FUNDING_STAGES]}
              activeIndex={activeIndex}
              stageStartedAt={state === "processing" ? progress.since : null}
              reference={intentIds[0] ?? null}
              // The retry's own answer outranks the bridge notice: it's the
              // reply to a button the user just pressed.
              notice={retryNote ?? (state === "processing" && slow ? SLOW_BRIDGE : null)}
              // "Updates automatically" is a promise about something being in
              // flight. Slowness never withdraws it; waiting on a signature
              // does, because nothing is running to update from.
              autoUpdating={state === "processing" && !needsSignature}
              primary={
                state === "success"
                  ? { label: "Done", onClick: dismiss }
                  : state === "failure"
                    ? described?.action === "unlock"
                      ? { label: "Unlock and continue", onClick: () => requestUnlock(() => void retryAttempt()) }
                      : anyDead
                        ? { label: "Start a new deposit", onClick: startNewAttempt }
                        : { label: "Try again", onClick: () => void retryAttempt() }
                    : needsSignature
                      ? {
                          label: nothingSent ? "Sign and continue" : "Sign the remaining step",
                          onClick: () => void retryAttempt(),
                        }
                      : undefined
              }
              secondary={state === "success" ? undefined : { label: "Dismiss", onClick: dismiss }}
            />
            {state === "failure" && error ? <SectionMessage error={error} /> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <AmountField value={amount} onChange={setAmount} unit="USDC" autoFocus={open} />
            <InlineNotice tone="warning">{NOT_INSTANT}</InlineNotice>
            {error ? (
              <div className="flex flex-col gap-1.5">
                <SectionMessage
                  error={error}
                  onAction={
                    duplicateWithoutId
                      ? undefined
                      : (action) => {
                          // A service-side "unlock" verdict can arrive while the
                          // local DEK still looks live, so runDeposit's own
                          // check wouldn't catch it.
                          if (action === "unlock") requestUnlock(() => void runDeposit())
                          else void runDeposit()
                        }
                  }
                />
                {duplicateWithoutId ? (
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    The service didn&apos;t say which deposit, so there&apos;s nothing to open here. Nothing was sent
                    twice — check your trading balance in a moment.
                  </p>
                ) : null}
              </div>
            ) : null}
            <FlowCta
              label={busy ? "Signing on this device…" : (blocker ?? "Deposit USDC")}
              onClick={() => void runDeposit()}
              disabled={Boolean(blocker)}
              busy={busy}
            />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/* ── Transfer (Spot ↔ Perps) ───────────────────────────────────────────── */

type Direction = "toPerps" | "toSpot"

const DIRECTIONS: readonly SegmentedOption<Direction>[] = [
  { key: "toPerps", label: "Spot → Perps" },
  { key: "toSpot", label: "Perps → Spot" },
]

const TRANSFER_STAGES = [{ key: "moved", label: "Funds moved" }]

function TransferFlow({ userId, wallet, packageValue, evm, open, onOpenChange, requestUnlock }: FlowProps) {
  const queryClient = useQueryClient()
  const [direction, setDirection] = React.useState<Direction>("toPerps")
  const [amount, setAmount] = React.useState("")
  const [attemptKey, setAttemptKey] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<"form" | "status">("form")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const [reference, setReference] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    if (open && phase === "form" && attemptKey === null) setAttemptKey(crypto.randomUUID())
  }, [open, phase, attemptKey])

  const accountQuery = useTradingAccount(userId, { enabled: open, fast: false })
  const balances = accountQuery.data?.balances ?? null
  const maxSpend = balances ? (direction === "toPerps" ? balances.spotUsdc : balances.perpsWithdrawableUsdc) : null

  const value = parseAmount(amount)
  const overspend = value !== null && maxSpend !== null && value > maxSpend
  const blocker = !evm?.canonicalAddress
    ? "Your wallet isn't ready yet"
    : amount.trim().length === 0
      ? "Enter an amount"
      : value === null
        ? "Enter a valid amount"
        : overspend
          ? "Not enough in that balance"
          : null

  async function runTransfer() {
    if (busy) return
    const amountValue = parseAmount(amount)
    if (!amountValue || !evm) return
    // Sticky for this attempt: "Try again" below re-enters here and must reach
    // the same operation, not open a second transfer.
    const key = attemptKey ?? crypto.randomUUID()
    if (key !== attemptKey) setAttemptKey(key)
    if (!getUnlockedWalletState(userId, wallet.id)) {
      requestUnlock(() => void runTransfer())
      return
    }
    setBusy(true)
    setError(null)
    setPhase("status")
    try {
      const intent = await cryptoBackendClient.createHyperliquidIntent({
        type: "usdClassTransfer",
        amount: amountValue,
        toPerp: direction === "toPerps",
        idempotencyKey: key,
      })
      setReference(intent.id)
      const signatures = await signHyperliquidIntent(userId, wallet.id, packageValue, evm.id, intent.steps)
      const result = await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
      if (DEAD_STATUSES.has(String(result.status))) {
        throw new Error("The venue rejected this transfer. Nothing was moved.")
      }
      setDone(true)
      void queryClient.invalidateQueries({ queryKey: tradingAccountKey(userId) })
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setPhase("form")
    setAmount("")
    setError(null)
    setReference(null)
    setDone(false)
    setAttemptKey(null)
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  /** Escape / backdrop / X. A finished transfer is cleared so the next open is
   *  a fresh attempt with a fresh key; one still in flight keeps its screen. */
  function handleOpenChange(next: boolean) {
    if (!next && (done || error)) reset()
    onOpenChange(next)
  }

  const state: "processing" | "success" | "failure" = done ? "success" : error ? "failure" : "processing"
  const described = error ? describeCryptoError(error) : null

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Move funds</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Move USDC between your Spot and Perps balances. Both stay inside your trading account.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {phase === "status" ? (
          <div className="flex flex-col gap-4">
            <StatusScreen
              state={state}
              figure={value !== null ? `${formatUsdc(value)} USDC` : undefined}
              headline={state === "success" ? "Funds moved" : state === "failure" ? "Transfer didn't go through" : "Moving your funds"}
              caption={
                state === "success"
                  ? `Your ${direction === "toPerps" ? "Perps" : "Spot"} balance updates in a moment.`
                  : state === "failure"
                    ? "Nothing was moved — both balances are unchanged."
                    : "Signing on this device, then asking the venue to move it."
              }
              stages={TRANSFER_STAGES}
              activeIndex={state === "success" ? TRANSFER_STAGES.length : 0}
              stageStartedAt={null}
              reference={reference}
              autoUpdating={false}
              primary={
                state === "success"
                  ? { label: "Done", onClick: close }
                  : state === "failure"
                    ? described?.action === "unlock"
                      ? { label: "Unlock and continue", onClick: () => requestUnlock(() => void runTransfer()) }
                      : { label: "Try again", onClick: () => void runTransfer() }
                    : undefined
              }
              secondary={state === "processing" ? undefined : { label: "Close", onClick: close }}
            />
            {state === "failure" && error ? <SectionMessage error={error} /> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Segmented
              grow
              size="sm"
              options={DIRECTIONS}
              value={direction}
              // The max is a property of the direction: an amount typed
              // against the Spot balance cannot survive a flip to Perps.
              onChange={(next) => {
                setDirection(next)
                setAmount("")
              }}
            />
            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDC"
              autoFocus={open}
              maxSpend={maxSpend}
              hint={maxSpend !== null ? `${formatUsdc(maxSpend)} USDC available` : undefined}
              problem={overspend ? `You only have ${formatUsdc(maxSpend ?? 0)} USDC there.` : null}
            />
            <FlowCta
              label={busy ? "Signing on this device…" : (blocker ?? "Move funds")}
              onClick={() => void runTransfer()}
              disabled={Boolean(blocker)}
              busy={busy}
            />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/* ── Withdraw ──────────────────────────────────────────────────────────── */

const WITHDRAW_STAGES = [{ key: "sent", label: "Withdrawal sent" }]

function WithdrawFlow({
  userId,
  wallet,
  packageValue,
  evm,
  open,
  onOpenChange,
  requestUnlock,
  onSwitchToTransfer,
}: FlowProps & { onSwitchToTransfer: () => void }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = React.useState("")
  const [attemptKey, setAttemptKey] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<"form" | "status">("form")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const [reference, setReference] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    if (open && phase === "form" && attemptKey === null) setAttemptKey(crypto.randomUUID())
  }, [open, phase, attemptKey])

  const accountQuery = useTradingAccount(userId, { enabled: open, fast: false })
  /**
   * The cap is the PERPS balance, and the copy on this screen has to say so.
   *
   * `withdraw3` debits Perps — the venue's native semantics, and what the
   * previous implementation of this product did explicitly: its spot-withdraw
   * route ran `usdClassTransfer(amount, toPerp: true)` FIRST and only then
   * `withdraw3` (`docs/archive/PROJECT.md` §"Spot Withdraw"). The self-custody
   * backend docs don't cover the venue layer at all, so that is the strongest
   * evidence in the repo — flagged in the task report as a backend-confirmation
   * ask.
   *
   * The panel treats Spot and Perps as distinct balances everywhere else
   * (TransferFlow exists precisely to move between them), so a cap that
   * silently ignored Spot would read as a bug. It doesn't ignore it: it names
   * the balance it spends and points at the flow that fills it.
   */
  const balances = accountQuery.data?.balances ?? null
  const maxSpend = balances?.perpsWithdrawableUsdc ?? null
  const spotIdle = balances?.spotUsdc ?? 0
  /** The only destination this flow can reach: the wallet's own address. */
  const destination = evm?.canonicalAddress ?? ""

  const value = parseAmount(amount)
  const overspend = value !== null && maxSpend !== null && value > maxSpend
  // Money is sitting in Spot that this flow cannot spend — either because
  // Perps is empty, or because the amount asked for is more than Perps holds.
  const suggestTransfer = spotIdle > 0 && (((maxSpend ?? 0) < 0.01) || overspend)
  const blocker = !destination
    ? "Your wallet isn't ready yet"
    : amount.trim().length === 0
      ? "Enter an amount"
      : value === null
        ? "Enter a valid amount"
        : overspend
          ? "More than your Perps balance"
          : null

  async function runWithdraw() {
    if (busy) return
    const amountValue = parseAmount(amount)
    if (!amountValue || !evm || !destination) return
    /** Sticky for this attempt — see TransferFlow. */
    const key = attemptKey ?? crypto.randomUUID()
    if (key !== attemptKey) setAttemptKey(key)
    if (!getUnlockedWalletState(userId, wallet.id)) {
      requestUnlock(() => void runWithdraw())
      return
    }
    setBusy(true)
    setError(null)
    setPhase("status")
    try {
      const intent = await cryptoBackendClient.createHyperliquidIntent({
        type: "withdraw3",
        amount: amountValue,
        destination,
        idempotencyKey: key,
      })
      setReference(intent.id)
      const signatures = await signHyperliquidIntent(userId, wallet.id, packageValue, evm.id, intent.steps)
      const result = await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
      if (DEAD_STATUSES.has(String(result.status))) {
        throw new Error("The venue rejected this withdrawal. Nothing left your trading account.")
      }
      setDone(true)
      void queryClient.invalidateQueries({ queryKey: tradingAccountKey(userId) })
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setPhase("form")
    setAmount("")
    setError(null)
    setReference(null)
    setDone(false)
    setAttemptKey(null)
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  /** Escape / backdrop / X — see TransferFlow. */
  function handleOpenChange(next: boolean) {
    if (!next && (done || error)) reset()
    onOpenChange(next)
  }

  const state: "processing" | "success" | "failure" = done ? "success" : error ? "failure" : "processing"
  const described = error ? describeCryptoError(error) : null

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Withdraw from trading account</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Withdrawals come out of your Perps balance and go back to your own self-custody wallet address — this flow
            can&apos;t send anywhere else.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {phase === "status" ? (
          <div className="flex flex-col gap-4">
            <StatusScreen
              state={state}
              direction="out"
              figure={value !== null ? `${formatUsdc(value)} USDC` : undefined}
              headline={
                state === "success" ? "Withdrawal sent" : state === "failure" ? "Withdrawal didn't go through" : "Sending your withdrawal"
              }
              caption={
                state === "success"
                  ? "It's on its way to your wallet. Arrival isn't instant."
                  : state === "failure"
                    ? "Nothing left your trading account."
                    : "Signing on this device, then asking the venue to release it."
              }
              stages={WITHDRAW_STAGES}
              activeIndex={state === "success" ? WITHDRAW_STAGES.length : 0}
              stageStartedAt={null}
              reference={reference}
              autoUpdating={false}
              primary={
                state === "success"
                  ? { label: "Done", onClick: close }
                  : state === "failure"
                    ? described?.action === "unlock"
                      ? { label: "Unlock and continue", onClick: () => requestUnlock(() => void runWithdraw()) }
                      : { label: "Try again", onClick: () => void runWithdraw() }
                    : undefined
              }
              secondary={state === "processing" ? undefined : { label: "Close", onClick: close }}
            />
            {state === "failure" && error ? <SectionMessage error={error} /> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {suggestTransfer ? (
              <AnnouncementBanner
                title="That USDC is in your Spot balance"
                detail={`Withdrawals come out of Perps. Move your ${formatUsdc(spotIdle)} USDC across first, then withdraw it.`}
                action={{ label: "Move funds", onClick: onSwitchToTransfer }}
              />
            ) : null}
            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDC"
              autoFocus={open}
              maxSpend={maxSpend}
              hint={maxSpend !== null ? `${formatUsdc(maxSpend)} USDC withdrawable from Perps` : undefined}
              problem={overspend ? `Your Perps balance holds ${formatUsdc(maxSpend ?? 0)} USDC right now.` : null}
            />
            <DetailPanel
              rows={[
                { label: "Amount", value: value !== null ? `${formatUsdc(value)} USDC` : "—" },
                // The debited balance is named on the receipt, not just in the
                // prose — this is the row that makes the cap make sense.
                { label: "From", value: "Perps balance" },
                {
                  label: "To your wallet",
                  value: destination ? <AddressPill address={destination} /> : "Not ready",
                },
              ]}
            />
            <InlineNotice tone="warning">
              Withdrawals aren&apos;t instant — they usually take a few minutes to arrive.
            </InlineNotice>
            <FlowCta
              label={busy ? "Signing on this device…" : (blocker ?? "Withdraw USDC")}
              onClick={() => void runWithdraw()}
              disabled={Boolean(blocker)}
              busy={busy}
            />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
