"use client"

/**
 * Stage 2 — creating a launch.
 *
 * LANDSCAPE, the shape the futures money doors already use: what you fill in
 * on the left; on the right, continuously, what you are about to make and what
 * it will cost. The right pane is the point. A creator should never press
 * "Launch" and then find out the total — every change to the form moves the
 * card and the bill in the same frame.
 *
 * The card on the right is the real discovery card (`LaunchCard`), fed the
 * draft. Not a lookalike: what the creator sees while typing is what buyers
 * will see.
 *
 * ── What this stage exists to settle ──────────────────────────────────────
 * Every rule below is a PROPOSAL, visible so it can be argued with:
 *   · the fee model (creation fee, trading fee) — marked est.
 *   · the 20% allocation cap
 *   · the symbol rules, including the reserved-symbol list
 *   · whether an icon is required (here: recommended, not required)
 * The checks list on the right states each rule in words, so a reviewer can
 * disagree with a specific line rather than with "the validation".
 *
 * ── On "initial buy" ──────────────────────────────────────────────────────
 * The plan listed "creator allocation" and "initial buy" separately. On a
 * curve they are one thing: the creator's allocation IS a pre-buy off the
 * curve, at the launch price, in the launch transaction. Offering both would
 * give the creator two controls for one number. There is one slider.
 */

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CardShell, Segmented } from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { LaunchCard } from "@/components/launchpad-unauth/launch-card"
import { Assumed } from "@/components/launchpad-unauth/parts"
import {
  CHAIN_LABEL,
  CHAIN_ORDER,
  useAvailability,
  type ChainKey,
} from "@/components/launchpad-unauth/availability"
import { PausedNotice } from "@/components/launchpad-unauth/availability-ui"
import {
  LaunchLifecycle,
  ResumeBanner,
} from "@/components/launchpad-unauth/launch-lifecycle"
import {
  clearPending,
  savePending,
  usePendingLaunch,
} from "@/components/launchpad-unauth/pending-launch"
import {
  CREATE_FEE_SOL,
  MAX_CREATOR_BPS,
  NETWORK_RENT_SOL,
  SOL_USD,
  TRADE_FEE_BPS,
  creatorAllocation,
  draftAsLaunch,
  fmtPct,
  fmtSol,
  fmtTokens,
  fmtUsd,
  validateDraft,
  type Draft,
} from "@/components/launchpad-unauth/launch-data"

type Chain = ChainKey

/* The chain options follow the availability switch. A disabled option's
   reason is on hover (Segmented's own behaviour), and a PAUSED chain also
   shows its reason in full beneath the picker — hover does not exist on a
   phone, and "why can't I launch" is not a question to hide. */
function chainOptions(availability: ReturnType<typeof useAvailability>) {
  return CHAIN_ORDER.map((key) => {
    const a = availability[key]
    return {
      key,
      label: CHAIN_LABEL[key],
      disabled: a.state !== "live",
      disabledReason:
        a.state === "paused"
          ? `${CHAIN_LABEL[key]} launches are paused`
          : `${CHAIN_LABEL[key]} launches aren't available yet`,
    }
  })
}

const ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const ICON_MAX_BYTES = 1_000_000

const EMPTY: Draft = {
  name: "",
  symbol: "",
  description: "",
  website: "",
  x: "",
  telegram: "",
  creatorBps: 0,
}

export function CreateWorkspace() {
  const [chain, setChain] = React.useState<Chain>("solana")
  const [draft, setDraft] = React.useState<Draft>(EMPTY)
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = React.useState(false)
  const [iconError, setIconError] = React.useState<string | null>(null)
  /* "form" until a valid Launch is pressed, then the lifecycle. The launch
     itself is recorded in pending-launch, so it outlives this component. */
  const [phase, setPhase] = React.useState<"form" | "lifecycle">("form")
  const pending = usePendingLaunch()
  const availability = useAvailability()
  const paused = availability.solana.state === "paused"
  const fileRef = React.useRef<HTMLInputElement>(null)

  // Object URLs hold the file in memory until revoked. Replacing the icon or
  // leaving the page releases the previous one.
  React.useEffect(() => {
    const url = draft.iconUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [draft.iconUrl])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }
  const touch = (key: string) => setTouched((t) => ({ ...t, [key]: true }))

  const checks = validateDraft(draft)
  const blocking = checks.filter((c) => c.blocking && !c.ok)
  // A valid draft still cannot launch onto a paused chain.
  const canLaunch = blocking.length === 0 && !paused
  /** Errors appear once a field has been left, or after a launch attempt —
   *  never while someone is still typing their first letter. */
  const show = (key: string) => attempted || touched[key]
  const failed = (key: string) => checks.find((c) => c.key === key && !c.ok)

  const allocation = creatorAllocation(draft.creatorBps)
  const tradeFeeOnPreBuy = (allocation.sol * TRADE_FEE_BPS) / 10_000
  const totalSol =
    CREATE_FEE_SOL + NETWORK_RENT_SOL + allocation.sol + tradeFeeOnPreBuy

  const pickIcon = (file: File | undefined) => {
    setIconError(null)
    if (!file) return
    if (!ICON_TYPES.includes(file.type)) {
      setIconError("Use a PNG, JPG, WebP or GIF.")
      return
    }
    if (file.size > ICON_MAX_BYTES) {
      setIconError("Keep the icon under 1 MB.")
      return
    }
    set("iconUrl", URL.createObjectURL(file))
  }

  const onLaunch = () => {
    setAttempted(true)
    if (!canLaunch) return
    savePending({ draft, state: "signing", startedAt: Date.now() })
    setPhase("lifecycle")
  }

  if (phase === "lifecycle") {
    return (
      <LaunchLifecycle
        draft={draft}
        totalSol={totalSol}
        // A failed launch is abandoned when you go back to edit it: the next
        // Launch is a new attempt, exactly as it would be on chain.
        onEdit={() => {
          clearPending()
          setPhase("form")
        }}
        onStartOver={() => {
          clearPending()
          setDraft(EMPTY)
          setTouched({})
          setAttempted(false)
          setPhase("form")
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ResumeBanner
        onResume={
          pending
            ? () => {
                setDraft({ ...pending.draft })
                setPhase("lifecycle")
              }
            : undefined
        }
      />
      <CardShell className={CARD_HUE}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          {/* ══ The form ═══════════════════════════════════════════════════ */}
          <form
            className="flex min-w-0 flex-col gap-7 p-5 sm:p-6 lg:p-7"
            onSubmit={(e) => {
              e.preventDefault()
              onLaunch()
            }}
            noValidate
          >
            <Section
              title="Chain"
              hint="Where the token and its curve will live. More chains are coming."
            >
              <div className="scrollbar-none min-w-0 overflow-x-auto">
                <Segmented
                  options={chainOptions(availability)}
                  value={chain}
                  onChange={setChain}
                />
              </div>
              <PausedNotice compact />
            </Section>

            <Section
              title="Identity"
              hint="What people will search for and see in the feed."
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* Icon */}
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      "group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full transition-colors",
                      draft.iconUrl
                        ? "ring-1 ring-border/50"
                        : "border-2 border-dashed border-foreground/20 bg-foreground/[0.03] hover:border-primary/50 hover:bg-primary/[0.04]"
                    )}
                    aria-label={draft.iconUrl ? "Replace icon" : "Add an icon"}
                  >
                    {draft.iconUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={draft.iconUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11.5px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                          Replace
                        </span>
                      </>
                    ) : (
                      <span className="flex flex-col items-center gap-1 text-muted-foreground">
                        <svg
                          aria-hidden
                          viewBox="0 0 20 20"
                          className="h-5 w-5"
                        >
                          <path
                            d="M10 5v10M5 10h10"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-[11px] font-semibold">Icon</span>
                      </span>
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ICON_TYPES.join(",")}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      pickIcon(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                  <span
                    className={cn(
                      "max-w-[8rem] text-center text-[11px]",
                      iconError ? "text-debit" : "text-muted-foreground"
                    )}
                  >
                    {iconError ?? "Square, under 1 MB"}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <Field
                    label="Name"
                    counter={`${draft.name.length}/32`}
                    error={
                      show("name") && failed("name")
                        ? "Use 2 to 32 characters."
                        : undefined
                    }
                  >
                    <input
                      value={draft.name}
                      maxLength={32}
                      onChange={(e) => set("name", e.target.value)}
                      onBlur={() => touch("name")}
                      placeholder="e.g. Quartz Owl"
                      className={inputCls(
                        Boolean(show("name") && failed("name"))
                      )}
                    />
                  </Field>

                  <Field
                    label="Symbol"
                    counter={`${draft.symbol.length}/10`}
                    error={symbolError(draft.symbol, show("symbol"), checks)}
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[14px] font-semibold text-muted-foreground">
                        $
                      </span>
                      <input
                        value={draft.symbol}
                        maxLength={10}
                        // Uppercase and strip as you type, rather than rejecting on
                        // submit: the rule is simple enough to just enforce.
                        onChange={(e) =>
                          set(
                            "symbol",
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, "")
                          )
                        }
                        onBlur={() => touch("symbol")}
                        placeholder="QOWL"
                        className={cn(
                          inputCls(
                            Boolean(
                              symbolError(draft.symbol, show("symbol"), checks)
                            )
                          ),
                          "pl-7 font-semibold tracking-[0.04em]"
                        )}
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </Section>

            <Section
              title="Description"
              hint="Shown on the card and the token page. Say what it is, plainly."
            >
              <Field
                label="Description"
                hideLabel
                counter={`${draft.description.length}/280`}
                error={
                  show("description") && failed("description")
                    ? "Keep it to 280 characters."
                    : undefined
                }
              >
                <textarea
                  value={draft.description}
                  maxLength={280}
                  rows={3}
                  onChange={(e) => set("description", e.target.value)}
                  onBlur={() => touch("description")}
                  placeholder="What is this, and who is it for?"
                  className={cn(
                    inputCls(false),
                    "h-auto resize-none py-3 leading-relaxed"
                  )}
                />
              </Field>
            </Section>

            <Section
              title="Links"
              hint="Optional. Shown on the token page, and never checked by us — the page says so."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field
                  label="Website"
                  error={
                    show("links") &&
                    draft.website &&
                    !/^https:\/\//i.test(draft.website)
                      ? "Starts with https://"
                      : undefined
                  }
                >
                  <input
                    value={draft.website}
                    onChange={(e) => set("website", e.target.value)}
                    onBlur={() => touch("links")}
                    placeholder="https://"
                    inputMode="url"
                    className={inputCls(false)}
                  />
                </Field>
                <Field label="X">
                  <input
                    value={draft.x}
                    onChange={(e) => set("x", e.target.value.replace(/^@/, ""))}
                    onBlur={() => touch("links")}
                    placeholder="handle"
                    className={inputCls(false)}
                  />
                </Field>
                <Field label="Telegram">
                  <input
                    value={draft.telegram}
                    onChange={(e) =>
                      set("telegram", e.target.value.replace(/^@/, ""))
                    }
                    onBlur={() => touch("links")}
                    placeholder="handle"
                    className={inputCls(false)}
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Your allocation"
              hint="Tokens you buy for yourself at launch, off the same curve as everyone else. There is no vesting — they are yours to sell at any time, and buyers will see exactly how much you took."
            >
              <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.04] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-[28px] leading-none font-medium tabular-nums">
                      {fmtPct(draft.creatorBps)}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      of curve supply
                    </span>
                  </span>
                  <span className="text-right text-[12px] text-muted-foreground tabular-nums">
                    {draft.creatorBps === 0
                      ? "No pre-buy"
                      : `${fmtTokens(allocation.tokens)} tokens`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_CREATOR_BPS}
                  step={50}
                  value={draft.creatorBps}
                  onChange={(e) => set("creatorBps", Number(e.target.value))}
                  aria-label="Creator allocation, percent of curve supply"
                  aria-valuetext={`${fmtPct(draft.creatorBps)}, costing ${fmtSol(allocation.sol, 3)}`}
                  className="w-full cursor-pointer"
                  style={{ accentColor: "var(--primary)" }}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>None</span>
                  <span className="inline-flex items-center">
                    Cap {fmtPct(MAX_CREATOR_BPS)}
                    <Assumed note="LAUNCHPAD_MAX_CREATOR_BPS is a proposal, not a decision" />
                  </span>
                </div>
                {draft.creatorBps > 0 && (
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    Costs{" "}
                    <span className="font-semibold text-foreground">
                      {fmtSol(allocation.sol, 3)}
                    </span>{" "}
                    ({fmtUsd(allocation.usd)}) at the launch price. The price
                    rises as the curve fills, so the same share bought later
                    would cost more — which is exactly why buyers are shown this
                    number.
                  </p>
                )}
              </div>
            </Section>

            {/* On a phone the summary follows the form; this submit sits at the
              end of the form so the action is where the reader finishes. The
              desktop CTA lives in the summary pane. */}
            <button type="submit" className="sr-only">
              Launch token
            </button>
          </form>

          {/* ══ What you're making, and what it costs ══════════════════════ */}
          <aside className="flex min-w-0 flex-col gap-4 border-t border-border/40 p-5 sm:p-6 lg:border-t-0 lg:border-l lg:p-7">
            <div className="flex flex-col gap-2">
              <PaneLabel>Preview</PaneLabel>
              <LaunchCard launch={draftAsLaunch(draft)} />
            </div>

            <div className="flex flex-col gap-2.5 rounded-2xl bg-foreground/[0.05] p-4">
              <PaneLabel>Cost to launch</PaneLabel>
              <dl className="flex flex-col gap-2 text-[12.5px]">
                <CostRow
                  label="Creation fee"
                  value={fmtSol(CREATE_FEE_SOL, 3)}
                  assumed="fee model undecided (open question #3)"
                />
                <CostRow
                  label="Network rent"
                  value={`~${fmtSol(NETWORK_RENT_SOL, 3)}`}
                  assumed="estimate; the real figure comes from simulating the transaction"
                />
                <CostRow
                  label="Your allocation"
                  value={
                    draft.creatorBps === 0 ? "—" : fmtSol(allocation.sol, 4)
                  }
                />
                {draft.creatorBps > 0 && (
                  <CostRow
                    label={`Trading fee (${fmtPct(TRADE_FEE_BPS)})`}
                    value={fmtSol(tradeFeeOnPreBuy, 4)}
                    assumed="fee model undecided (open question #3)"
                  />
                )}
              </dl>
              <div className="flex items-baseline justify-between gap-3 border-t border-border/40 pt-2.5">
                <span className="text-[13px] font-semibold">Total</span>
                <span className="flex flex-col items-end">
                  <span className="text-[15px] font-semibold tabular-nums">
                    {fmtSol(totalSol, 4)}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground tabular-nums">
                    ≈ {fmtUsd(totalSol * SOL_USD)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.05] p-4">
              <PaneLabel>Checks</PaneLabel>
              <ul className="flex flex-col gap-1.5">
                {checks.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-start gap-2 text-[12.5px]"
                  >
                    <CheckMark
                      state={c.ok ? "ok" : c.blocking ? "fail" : "optional"}
                    />
                    <span
                      className={
                        c.ok
                          ? "text-muted-foreground"
                          : c.blocking
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      {c.label}
                      {!c.blocking && !c.ok && (
                        <span className="text-muted-foreground/70">
                          {" "}
                          — recommended
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onLaunch}
                className={cn(
                  "flex h-12 w-full items-center justify-center rounded-full text-[14px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                  canLaunch
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-foreground/[0.08] text-muted-foreground"
                )}
              >
                {paused
                  ? "Solana launches are paused"
                  : canLaunch
                    ? `Launch $${draft.symbol} for ${fmtSol(totalSol, 3)}`
                    : attempted
                      ? `${blocking.length} ${blocking.length === 1 ? "thing" : "things"} to fix first`
                      : "Launch token"}
              </button>
              <span className="text-center text-[11.5px] leading-relaxed text-muted-foreground">
                You sign on this device. Nothing is sent until you do, and a
                launch can&apos;t be edited once it&apos;s live.
              </span>
            </div>

            <Link
              href={PREVIEW_ROUTES.launchpad}
              className="text-center text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to launches
            </Link>
          </aside>
        </div>
      </CardShell>
    </div>
  )
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function inputCls(error: boolean) {
  return cn(
    "h-11 w-full min-w-0 rounded-xl bg-foreground/[0.05] px-3.5 text-[14px] ring-1 transition-shadow outline-none placeholder:text-muted-foreground/60",
    error
      ? "ring-debit/60 focus-visible:ring-debit"
      : "ring-transparent focus-visible:ring-primary/45"
  )
}

/** The symbol has three separate failure reasons; name the one that applies. */
function symbolError(
  symbol: string,
  visible: boolean | undefined,
  checks: ReturnType<typeof validateDraft>
) {
  if (!visible) return undefined
  const fail = (k: string) => checks.some((c) => c.key === k && !c.ok)
  if (fail("symbol")) return "Use 2 to 10 letters or digits."
  if (fail("reserved")) return `$${symbol} is a listed asset and can't be used.`
  if (fail("taken")) return `$${symbol} has already been launched here.`
  return undefined
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[14.5px] font-semibold">{title}</h2>
        {hint && (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  hideLabel,
  counter,
  error,
  children,
}: {
  label: string
  hideLabel?: boolean
  counter?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span
        className={cn(
          "flex items-baseline justify-between gap-2",
          hideLabel && "sr-only"
        )}
      >
        <span className="text-[12.5px] font-medium">{label}</span>
        {counter && (
          <span className="text-[11px] text-muted-foreground/70 tabular-nums">
            {counter}
          </span>
        )}
      </span>
      {children}
      {hideLabel && counter && (
        <span className="self-end text-[11px] text-muted-foreground/70 tabular-nums">
          {counter}
        </span>
      )}
      {error && <span className="text-[11.5px] text-debit">{error}</span>}
    </label>
  )
}

function PaneLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </span>
  )
}

function CostRow({
  label,
  value,
  assumed,
}: {
  label: string
  value: string
  assumed?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="inline-flex items-center text-muted-foreground">
        {label}
        {assumed && <Assumed note={assumed} />}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function CheckMark({ state }: { state: "ok" | "fail" | "optional" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
        state === "ok" && "bg-credit-chip text-credit",
        state === "fail" && "bg-foreground/[0.08] text-muted-foreground",
        state === "optional" && "border border-dashed border-foreground/25"
      )}
    >
      {state === "ok" && (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
          <path
            d="M2.5 6.2 4.9 8.5 9.5 3.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}
