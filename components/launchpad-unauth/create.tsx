"use client"

/**
 * Launch a token — a guided, five-step flow.
 *
 *   1 Chain · 2 Identity · 3 Story · 4 Allocation · 5 Review & launch
 *
 * One decision per screen, with Back / Continue, instead of one long sheet:
 * each step checks only its own fields, names the rule a field broke, and
 * won't let you past until it's right. The stepper lets you jump back to any
 * step you've reached, and Review lists everything with an Edit per section.
 *
 * It survives reloads. The whole draft — step, fields, the icon — lives in
 * draft-store.ts (localStorage), so closing the tab mid-way and coming back
 * lands you on the same step with the same answers. A launch in flight is
 * kept separately in pending-launch.ts and takes over the page until it
 * settles.
 *
 * Beside the steps (wide screens) the real discovery card, fed the draft, and
 * the bill — so what you're making and what it costs move as you type.
 *
 * Names and tickers may repeat: on Solana the MINT ADDRESS tells tokens apart.
 * The form mentions an overlap but doesn't block it. Listed assets (USDC…)
 * stay reserved — impersonation is a different problem from a shared word.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft01Icon, ArrowRight02Icon, Cancel01Icon, ImageAdd01Icon, InformationCircleIcon, Rocket01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { CHAIN_LABEL, CHAIN_ORDER, useAvailability } from "@/components/launchpad-unauth/availability"
import { IN_FLIGHT, clearPending, savePending, usePendingLaunch, type LifecycleState } from "@/components/launchpad-unauth/pending-launch"
import { STEPS, clearCreate, fileToDataUrl, saveCreate, useCreateState, type StepIndex } from "@/components/launchpad-unauth/draft-store"
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
  sameTicker,
  validateDraft,
  viewOf,
  type Draft,
} from "@/components/launchpad-unauth/launch-data"
import { LaunchCard } from "@/components/launchpad-unauth/discovery"
import { PausedNotice } from "@/components/launchpad-unauth/ui"
import { Icon, Panel, PanelTitle, SLIDE } from "@/components/redesign/ui"

const ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const ICON_MAX_BYTES = 1_000_000

/* ── Form bits ────────────────────────────────────────────────────────── */

function inputCls(error: boolean) {
  return cn(
    "h-12 w-full min-w-0 rounded-xl border bg-white/[0.025] px-3.5 text-[14.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/55",
    error ? "border-debit/55 focus:border-debit" : "border-white/[0.08] hover:border-white/[0.14] focus:border-primary/45",
  )
}

function Field({ label, error, hint, aside, children }: { label: string; error?: string; hint?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[13px] font-semibold text-foreground/90">{label}</span>
        {aside && <span className="text-[11.5px] tabular-nums text-muted-foreground">{aside}</span>}
      </span>
      {children}
      {error ? <span className="px-0.5 text-[12px] font-medium text-debit">{error}</span> : hint ? <span className="px-0.5 text-[12px] text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

const URL_OK = (v: string) => !v.trim() || /^https:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v.trim())
const HANDLE_OK = (v: string) => !v.trim() || /^@?[A-Za-z0-9_]{1,32}$/.test(v.trim())

/* ── Stepper ──────────────────────────────────────────────────────────── */

function Stepper({ step, reached, valid, onJump }: { step: StepIndex; reached: StepIndex; valid: boolean[]; onJump: (s: StepIndex) => void }) {
  return (
    <ol className="relative flex items-start justify-between">
      {/* The rail behind the dots, filling as you go. */}
      <span aria-hidden className="absolute left-[18px] right-[18px] top-[17px] h-[2px] rounded-full bg-white/[0.07]" />
      <motion.span
        aria-hidden
        className="absolute left-[18px] top-[17px] h-[2px] origin-left rounded-full bg-primary"
        initial={false}
        animate={{ width: `calc((100% - 36px) * ${step / (STEPS.length - 1)})` }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
      {STEPS.map((label, i) => {
        const idx = i as StepIndex
        const current = idx === step
        const done = idx < step || (idx <= reached && idx !== step && valid[idx])
        const reachable = idx <= reached
        return (
          <li key={label} className="relative z-10 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onJump(idx)}
              aria-current={current ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${label}`}
              className={cn(
                "flex size-9 items-center justify-center rounded-full border-2 font-display text-[13px] font-semibold transition-all duration-300",
                current ? "scale-110 border-primary bg-primary text-primary-foreground shadow-[0_0_0_5px_rgb(250_204_21/0.15)]" : done ? "border-primary bg-[#121212] text-primary" : reachable ? "border-white/25 bg-[#121212] text-foreground" : "border-white/[0.08] bg-[#121212] text-muted-foreground/50",
                reachable && !current && "hover:border-primary/70",
              )}
            >
              {done && !current ? <Icon icon={Tick02Icon} className="size-4" strokeWidth={2.6} /> : i + 1}
            </button>
            <span className={cn("text-[11.5px] font-semibold", current ? "text-foreground" : "hidden text-muted-foreground sm:block")}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/* ── Workspace ────────────────────────────────────────────────────────── */

export function CreateWorkspace() {
  const s = useCreateState()
  const { draft, chain, step, reached } = s
  const pending = usePendingLaunch()
  const availability = useAvailability()
  const paused = availability.solana.state === "paused"
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [tried, setTried] = React.useState<Record<number, boolean>>({})
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const [iconError, setIconError] = React.useState<string | null>(null)
  const [dir, setDir] = React.useState(1)
  // The store's server snapshot is the empty draft; hold the first frame
  // until the saved one is read, so a reload doesn't flash step 1.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const set = (patch: Partial<Draft>) => saveCreate({ draft: patch })
  const checks = validateDraft(draft)
  const failed = (k: string) => checks.some((c) => c.key === k && !c.ok)
  const show = (k: string, st: number) => !!tried[st] || !!touched[k]
  const symbol = draft.symbol.trim().toUpperCase()
  const twins = sameTicker(symbol)

  const allocation = creatorAllocation(draft.creatorBps)
  const preBuyFee = (allocation.sol * TRADE_FEE_BPS) / 10_000
  const totalSol = CREATE_FEE_SOL + NETWORK_RENT_SOL + allocation.sol + preBuyFee

  const valid = [
    availability[chain].state === "live",
    !failed("name") && !failed("symbol") && !failed("reserved"),
    !failed("description") && !failed("links"),
    !failed("allocation"),
    checks.every((c) => c.ok || !c.blocking) && !paused,
  ]

  const go = (to: StepIndex) => {
    setDir(to > step ? 1 : -1)
    saveCreate({ step: to })
  }
  const next = () => {
    setTried((t) => ({ ...t, [step]: true }))
    if (!valid[step] || step >= 4) return
    go((step + 1) as StepIndex)
  }

  const pickIcon = async (file: File | undefined) => {
    setIconError(null)
    if (!file) return
    if (!ICON_TYPES.includes(file.type)) return setIconError("Use a PNG, JPG, WebP or GIF.")
    if (file.size > ICON_MAX_BYTES) return setIconError("Keep the icon under 1 MB.")
    try {
      const url = await fileToDataUrl(file)
      if (!saveCreate({ draft: { iconUrl: url } })) setIconError("Couldn't save that icon — try a smaller image.")
    } catch {
      setIconError("Couldn't read that file.")
    }
  }

  const launch = () => {
    setTried((t) => ({ ...t, 4: true }))
    if (!valid[4]) return
    // pending-launch strips the icon itself (it lives in the create draft).
    const { iconUrl: _icon, ...rest } = draft
    void _icon
    savePending({ draft: rest, state: "signing", startedAt: Date.now() })
  }

  // A launch in flight (or just settled) owns the page — also after a reload.
  if (pending) {
    return (
      <Lifecycle
        draft={{ ...pending.draft, iconUrl: draft.iconUrl }}
        totalSol={totalSol}
        onEdit={() => {
          clearPending()
          saveCreate({ step: 4 })
        }}
        onDone={() => {
          clearPending()
          clearCreate()
        }}
      />
    )
  }

  if (!mounted) return <Panel className="h-[520px] animate-pulse" />

  const slide = {
    initial: (d: number) => ({ opacity: 0, x: 24 * d }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: -24 * d }),
  }

  return (
    <div className="flex flex-col gap-4">
      <PausedNotice />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="flex min-w-0 flex-col">
          <div className="flex flex-col gap-5 border-b border-white/[0.06] p-5 md:px-7 md:pt-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
              <span className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
                {s.savedAt && (
                  <span className="flex items-center gap-1.5">
                    <Icon icon={Tick02Icon} className="size-3.5 text-credit" strokeWidth={2.4} />
                    Draft saved
                  </span>
                )}
                {s.savedAt && (
                  <button
                    type="button"
                    onClick={() => {
                      clearCreate()
                      setTried({})
                      setTouched({})
                    }}
                    className="font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Start over
                  </button>
                )}
              </span>
            </div>
            <Stepper step={step} reached={reached} valid={valid} onJump={go} />
          </div>

          <div className="relative min-h-[380px] overflow-hidden p-5 md:p-7">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={step} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-5">
                {step === 0 && (
                  <>
                    <StepHead title="Where will it live?" body="Pick a chain for the token and its bonding curve. More chains are coming." />
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Chain">
                      {CHAIN_ORDER.map((key) => {
                        const a = availability[key]
                        const on = chain === key
                        const off = a.state !== "live"
                        return (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-disabled={off || undefined}
                            onClick={() => !off && saveCreate({ chain: key })}
                            className={cn(
                              "relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors",
                              off ? "cursor-not-allowed border-white/[0.05] opacity-50" : on ? "border-primary/60" : "border-white/[0.08] hover:border-white/[0.16]",
                            )}
                          >
                            {on && !off && <motion.span layoutId="create-chain" transition={SLIDE} className="absolute inset-0 rounded-2xl bg-primary/[0.07]" />}
                            <span className="relative flex w-full items-center justify-between">
                              <span className="text-[15px] font-semibold text-foreground">{CHAIN_LABEL[key]}</span>
                              {on && !off && <Icon icon={Tick02Icon} className="size-4 text-primary" strokeWidth={2.6} />}
                              {off && <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{a.state === "paused" ? "Paused" : "Soon"}</span>}
                            </span>
                            <span className="relative text-[12px] text-muted-foreground">{key === "solana" ? "Fast, low fees · live now" : a.state === "paused" ? "Paused by operations" : "Not available yet"}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <StepHead title="Name your token" body="What people will search for and see in the feed. You can add an icon now or later." />
                    <div className="flex flex-col gap-5 sm:flex-row">
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          aria-label={draft.iconUrl ? "Replace icon" : "Add an icon"}
                          className={cn(
                            "group relative flex size-[112px] items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-colors",
                            draft.iconUrl ? "border-transparent" : iconError ? "border-debit/50" : "border-white/[0.14] hover:border-primary/50",
                          )}
                        >
                          {draft.iconUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={draft.iconUrl} alt="" className="size-full object-cover" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[12px] font-semibold opacity-0 transition-opacity group-hover:opacity-100">Replace</span>
                            </>
                          ) : (
                            <span className="flex flex-col items-center gap-1.5 text-muted-foreground transition-colors group-hover:text-primary">
                              <Icon icon={ImageAdd01Icon} className="size-7" />
                              <span className="text-[12px] font-semibold">Add icon</span>
                            </span>
                          )}
                        </button>
                        <input ref={fileRef} type="file" accept={ICON_TYPES.join(",")} className="sr-only" onChange={(e) => void pickIcon(e.target.files?.[0])} />
                        <span className={cn("max-w-[130px] text-center text-[11px]", iconError ? "font-medium text-debit" : "text-muted-foreground")}>{iconError ?? "PNG, JPG, WebP, GIF · up to 1 MB"}</span>
                        {draft.iconUrl && (
                          <button type="button" onClick={() => set({ iconUrl: undefined })} className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-4">
                        <Field label="Name" aside={`${draft.name.trim().length}/32`} error={show("name", 1) && failed("name") ? "Use 2 to 32 characters." : undefined}>
                          <input autoFocus value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, name: true }))} placeholder="e.g. Golden Hour" className={inputCls(show("name", 1) && failed("name"))} />
                        </Field>
                        <Field
                          label="Ticker"
                          error={show("symbol", 1) ? (failed("symbol") ? "Use 2 to 10 letters or digits." : failed("reserved") ? `$${symbol} is a listed asset and can't be used.` : undefined) : undefined}
                          hint="2–10 letters or digits."
                        >
                          <span className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14.5px] font-semibold text-muted-foreground">$</span>
                            <input
                              value={draft.symbol}
                              maxLength={10}
                              onChange={(e) => set({ symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                              onBlur={() => setTouched((t) => ({ ...t, symbol: true }))}
                              placeholder="GLDHR"
                              className={cn(inputCls(show("symbol", 1) && (failed("symbol") || failed("reserved"))), "pl-7 font-semibold uppercase tracking-[0.04em]")}
                            />
                          </span>
                        </Field>
                        {twins.length > 0 && !failed("symbol") && !failed("reserved") && (
                          <p className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                            <Icon icon={InformationCircleIcon} className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>
                              {twins.length === 1 ? "Another token already uses" : `${twins.length} tokens already use`} <span className="font-semibold text-foreground">${symbol}</span> ({twins.map((t) => t.name).join(", ")}). That&apos;s allowed — on Solana each token has its own mint address, and buyers tell them apart by it.
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <StepHead title="Tell people what it is" body="Shown on the card and the token page. Links are optional and never checked by us — the page says so." />
                    <Field label="Description" aside={`${draft.description.trim().length}/280`} error={show("description", 2) && failed("description") ? "Keep it to 280 characters." : undefined}>
                      <textarea
                        autoFocus
                        value={draft.description}
                        rows={4}
                        onChange={(e) => set({ description: e.target.value })}
                        onBlur={() => setTouched((t) => ({ ...t, description: true }))}
                        placeholder="What is this, and who is it for?"
                        className={cn(inputCls(show("description", 2) && failed("description")), "h-auto resize-none py-3 leading-relaxed")}
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Field label="Website" error={show("website", 2) && !URL_OK(draft.website) ? "Use a full https:// address." : undefined}>
                        <input value={draft.website} onChange={(e) => set({ website: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, website: true }))} placeholder="https://" className={inputCls(show("website", 2) && !URL_OK(draft.website))} />
                      </Field>
                      <Field label="X" error={show("x", 2) && !HANDLE_OK(draft.x) ? "Letters, digits and _ only." : undefined}>
                        <input value={draft.x} onChange={(e) => set({ x: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, x: true }))} placeholder="@handle" className={inputCls(show("x", 2) && !HANDLE_OK(draft.x))} />
                      </Field>
                      <Field label="Telegram" error={show("telegram", 2) && !HANDLE_OK(draft.telegram) ? "Letters, digits and _ only." : undefined}>
                        <input value={draft.telegram} onChange={(e) => set({ telegram: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, telegram: true }))} placeholder="@handle" className={inputCls(show("telegram", 2) && !HANDLE_OK(draft.telegram))} />
                      </Field>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <StepHead
                      title="Buy some for yourself?"
                      body="Optional. You buy at the launch price, off the same curve as everyone else. No vesting — yours to sell any time — and buyers see exactly how much you took."
                    />
                    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <span className="font-display text-[40px] font-semibold leading-none tabular-nums text-foreground">{fmtPct(draft.creatorBps)}</span>
                        <span className="text-right text-[13px] tabular-nums text-muted-foreground">
                          {draft.creatorBps > 0 ? (
                            <>
                              {fmtTokens(allocation.tokens)} tokens for <span className="font-semibold text-foreground">{fmtSol(allocation.sol, 3)}</span>
                              <br />≈ {fmtUsd(allocation.usd)}
                            </>
                          ) : (
                            "None — a fair launch"
                          )}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={MAX_CREATOR_BPS}
                        step={50}
                        value={draft.creatorBps}
                        onChange={(e) => set({ creatorBps: Number(e.target.value) })}
                        aria-label="Creator allocation, percent of curve supply"
                        className="dash-range w-full"
                        style={{ "--fill": `${(draft.creatorBps / MAX_CREATOR_BPS) * 100}%` } as React.CSSProperties}
                      />
                      <div className="grid grid-cols-5 gap-1.5">
                        {[0, 500, 1000, 1500, 2000].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => set({ creatorBps: b })}
                            className={cn("h-8 rounded-lg border text-[12px] font-semibold tabular-nums transition-colors", draft.creatorBps === b ? "border-primary/55 bg-primary/[0.1] text-primary" : "border-white/[0.07] text-muted-foreground hover:text-foreground")}
                          >
                            {b === 0 ? "None" : fmtPct(b)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {draft.creatorBps >= 1000 && (
                      <p className="rounded-xl border border-warning/25 bg-warning/[0.06] px-3.5 py-3 text-[12.5px] leading-snug text-foreground/85">
                        Above 10% your card shows the allocation in amber — buyers read a large creator stake as a risk.
                      </p>
                    )}
                  </>
                )}

                {step === 4 && (
                  <>
                    <StepHead title="Review and launch" body="Check everything once. You can jump back to any step — nothing is lost." />
                    <div className="xl:hidden">
                      <LaunchCard launch={viewOf(draftAsLaunch(draft))} preview />
                    </div>
                    <dl className="flex flex-col divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07]">
                      {[
                        { k: "Chain", v: CHAIN_LABEL[chain], step: 0 },
                        { k: "Name & ticker", v: `${draft.name.trim() || "—"} · $${symbol || "—"}${draft.iconUrl ? " · icon added" : ""}`, step: 1 },
                        { k: "Description", v: draft.description.trim() || "None", step: 2 },
                        { k: "Links", v: [draft.website, draft.x, draft.telegram].filter((x) => x.trim()).join(" · ") || "None", step: 2 },
                        { k: "Your allocation", v: draft.creatorBps ? `${fmtPct(draft.creatorBps)} · ${fmtSol(allocation.sol, 3)}` : "None", step: 3 },
                      ].map((r) => (
                        <div key={r.k} className="flex items-start gap-3 px-4 py-3">
                          <dt className="w-[110px] shrink-0 text-[12.5px] text-muted-foreground">{r.k}</dt>
                          <dd className="min-w-0 flex-1 break-words text-[13px] font-medium text-foreground">{r.v}</dd>
                          <button type="button" onClick={() => go(r.step as StepIndex)} className="shrink-0 text-[12px] font-semibold text-primary hover:opacity-85">
                            Edit
                          </button>
                        </div>
                      ))}
                    </dl>
                    <ul className="flex flex-col gap-2">
                      {checks.map((c) => (
                        <li key={c.key} className="flex items-center gap-2.5 text-[12.5px]">
                          <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-credit/[0.14] text-credit" : c.blocking ? "bg-debit/[0.14] text-debit" : "bg-white/[0.06] text-muted-foreground")}>
                            {c.ok ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : c.blocking ? <Icon icon={Cancel01Icon} className="size-3" strokeWidth={2.6} /> : <span className="size-1.5 rounded-full bg-current" />}
                          </span>
                          <span className={c.ok ? "text-foreground/85" : "text-muted-foreground"}>
                            {c.label}
                            {!c.blocking && <span className="ml-1 text-[11px] text-muted-foreground/70">(recommended)</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer — Back / Continue, or Launch on the last step. */}
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] p-4 md:px-7">
            {step > 0 ? (
              <button type="button" onClick={() => go((step - 1) as StepIndex)} className="flex h-12 items-center gap-2 rounded-xl border border-white/[0.09] px-4 text-[14px] font-semibold text-foreground/85 transition-colors hover:text-foreground">
                <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
                Back
              </button>
            ) : (
              <Link href={PREVIEW_ROUTES.launchpad} className="flex h-12 items-center px-2 text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
                Cancel
              </Link>
            )}
            {step < 4 ? (
              <button type="button" onClick={next} className={cn("flex h-12 items-center gap-2 rounded-xl px-6 text-[14.5px] font-semibold", valid[step] ? "dash-gold-btn" : "border border-white/[0.08] bg-white/[0.04] text-muted-foreground")}>
                Continue
                <Icon icon={ArrowRight02Icon} className="size-4" strokeWidth={2} />
              </button>
            ) : (
              <button type="button" onClick={launch} disabled={paused} className={cn("flex h-12 items-center gap-2 rounded-xl px-6 text-[14.5px] font-semibold", valid[4] ? "dash-gold-btn" : "border border-white/[0.08] bg-white/[0.04] text-muted-foreground")}>
                <Icon icon={Rocket01Icon} className="size-[18px]" strokeWidth={2} />
                {paused ? "Launches are paused" : `Launch for ${fmtSol(totalSol, 3)}`}
              </button>
            )}
          </div>
        </Panel>

        {/* ── Beside the steps: the card and the bill, live ─────────────── */}
        <aside className="hidden min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:flex xl:self-start">
          <div className="flex flex-col gap-2">
            <span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">How buyers will see it</span>
            <LaunchCard launch={viewOf(draftAsLaunch(draft))} preview />
          </div>
          <CostCard allocationSol={allocation.sol} preBuyFee={preBuyFee} totalSol={totalSol} creatorBps={draft.creatorBps} />
        </aside>
        {/* Phone: the bill under the steps on Review, where it decides things. */}
        {step === 4 && (
          <div className="xl:hidden">
            <CostCard allocationSol={allocation.sol} preBuyFee={preBuyFee} totalSol={totalSol} creatorBps={draft.creatorBps} />
          </div>
        )}
      </div>
    </div>
  )
}

function StepHead({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
      <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function CostCard({ allocationSol, preBuyFee, totalSol, creatorBps }: { allocationSol: number; preBuyFee: number; totalSol: number; creatorBps: number }) {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <PanelTitle className="text-[15px]">What it costs</PanelTitle>
      <dl className="flex flex-col gap-2 text-[12.5px]">
        {[
          { k: "Creation fee", v: fmtSol(CREATE_FEE_SOL, 3), note: "est." },
          { k: "Network rent", v: fmtSol(NETWORK_RENT_SOL, 3), note: "est." },
          { k: "Your allocation", v: fmtSol(allocationSol, 3) },
          ...(creatorBps > 0 ? [{ k: `Trading fee (${fmtPct(TRADE_FEE_BPS)})`, v: fmtSol(preBuyFee, 4) }] : []),
        ].map((r) => (
          <div key={r.k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              {r.k}
              {"note" in r && r.note && <span className="ml-1.5 rounded bg-white/[0.06] px-1 text-[10px] font-semibold uppercase text-muted-foreground/80">{r.note}</span>}
            </dt>
            <dd className="font-semibold tabular-nums text-foreground">{r.v}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-white/[0.06] pt-3">
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="text-right">
            <span className="block font-display text-[18px] font-semibold tabular-nums text-foreground">{fmtSol(totalSol, 3)}</span>
            <span className="text-[11.5px] tabular-nums text-muted-foreground">≈ {fmtUsd(totalSol * SOL_USD)}</span>
          </dd>
        </div>
      </dl>
      <span className="text-[11.5px] text-muted-foreground">Demo — no token is created and nothing is charged.</span>
    </Panel>
  )
}

/* ── Lifecycle ────────────────────────────────────────────────────────── */

/* One transaction: either all of it lands or none of it does. */
const STAGES = ["Signed on this device", "Sent to Solana", "Confirmed — token and curve created", "Open for trading"]
const ACTIVE: Record<LifecycleState, number> = { signing: 0, confirming: 2, live: STAGES.length, failed: 2 }
const REVIEW: { key: LifecycleState; label: string }[] = [
  { key: "signing", label: "Signing" },
  { key: "confirming", label: "Confirming" },
  { key: "live", label: "Live" },
  { key: "failed", label: "Failed" },
]
/** Solana's base fee — a chain constant, not a preview assumption. */
const BASE_FEE_SOL = 0.000005

/**
 * After Launch. The states are stepped through by HAND, with a control that
 * says it isn't part of the product — never on a timer. A timer would be a
 * guessed duration dressed as progress, and it would never let "failed" be
 * reviewed at all. Every state is written to pending-launch, so closing the
 * tab mid-launch leaves a Resume on the pages you'd come back to.
 */
function Lifecycle({ draft, totalSol, onEdit, onDone }: { draft: Draft; totalSol: number; onEdit: () => void; onDone: () => void }) {
  const pending = usePendingLaunch()
  const state: LifecycleState = pending?.state ?? "signing"
  const symbol = draftAsLaunch(draft).symbol
  const setState = (next: LifecycleState) => savePending({ draft, state: next, startedAt: Date.now() })
  const inFlight = IN_FLIGHT.includes(state)
  const active = ACTIVE[state]

  const headline = state === "signing" ? "Waiting for your signature" : state === "confirming" ? `Creating $${symbol}` : state === "live" ? `$${symbol} is live` : "The launch didn't go through"

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Panel className="flex flex-col items-center gap-6 p-6 text-center md:p-10">
        <span className="relative flex size-20 items-center justify-center">
          {inFlight && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
          <span className={cn("relative flex size-20 items-center justify-center rounded-full", state === "live" ? "bg-credit/[0.14] text-credit" : state === "failed" ? "bg-debit/[0.14] text-debit" : "bg-primary/[0.12] text-primary")}>
            {state === "live" ? <Icon icon={Tick02Icon} className="size-9" strokeWidth={2.4} /> : state === "failed" ? <Icon icon={Cancel01Icon} className="size-9" strokeWidth={2.4} /> : <span className="size-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />}
          </span>
        </span>
        <div className="flex max-w-[56ch] flex-col gap-2">
          <span className="font-display text-[13px] font-semibold tabular-nums text-muted-foreground">{fmtSol(totalSol, 3)}</span>
          <h2 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-foreground">{headline}</h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {state === "signing" && "Approve the launch in your wallet. Nothing is sent until you do."}
            {state === "confirming" && (
              <>
                It&apos;s with Solana now. <span className="font-semibold text-foreground">You can close this page</span> — the launch carries on, and the launchpad will offer to bring you back.
              </>
            )}
            {state === "live" && `The curve is open and $${symbol} can be bought and sold.${draft.creatorBps > 0 ? ` Your ${fmtPct(draft.creatorBps)} allocation is in your wallet.` : ""}`}
            {state === "failed" &&
              `Solana didn't confirm it in time, so nothing was created. A launch is all or nothing: your creation fee${draft.creatorBps > 0 ? " and allocation" : ""} were never taken. Only the network fee for the attempt — ${BASE_FEE_SOL} SOL — was spent.`}
          </p>
        </div>

        <ol className="flex w-full max-w-[420px] flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left">
          {STAGES.map((s, i) => {
            const st = state === "failed" && i === 2 ? "failed" : i < active ? "done" : i === active ? "current" : "todo"
            return (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                    st === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
                    st === "current" && "border-primary/50 bg-primary/[0.1]",
                    st === "failed" && "border-debit/40 bg-debit/[0.12] text-debit",
                    st === "todo" && "border-white/[0.1]",
                  )}
                >
                  {st === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : st === "failed" ? <Icon icon={Cancel01Icon} className="size-3" strokeWidth={2.6} /> : st === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : null}
                </span>
                <span className={cn("text-[13.5px] font-medium", st === "todo" ? "text-muted-foreground" : "text-foreground")}>{s}</span>
              </li>
            )
          })}
        </ol>

        <div className="flex flex-wrap justify-center gap-2.5">
          {state === "failed" && (
            <>
              <button type="button" onClick={() => setState("signing")} className="dash-gold-btn h-11 rounded-xl px-5 text-[14px] font-semibold">
                Try again
              </button>
              <button type="button" onClick={onEdit} className="h-11 rounded-xl border border-white/[0.09] px-5 text-[14px] font-semibold text-foreground/85 hover:text-foreground">
                Edit the launch
              </button>
            </>
          )}
          {state === "live" && (
            <>
              {/* Finishing clears the saved draft and the launch record, so the
                  next visit to Create starts a fresh token. */}
              <Link href={PREVIEW_ROUTES.launchpad} onClick={onDone} className="dash-gold-btn flex h-11 items-center rounded-xl px-5 text-[14px] font-semibold">
                Back to launches
              </Link>
              <button type="button" onClick={onDone} className="h-11 rounded-xl border border-white/[0.09] px-5 text-[14px] font-semibold text-foreground/85 hover:text-foreground">
                Launch another
              </button>
            </>
          )}
          {inFlight && (
            <Link href={PREVIEW_ROUTES.launchpad} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">
              Leave this page — the launch carries on
            </Link>
          )}
        </div>
      </Panel>

      <aside className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">{state === "live" ? "Your launch" : "How it will appear once live"}</span>
          <LaunchCard launch={viewOf({ ...draftAsLaunch(draft), minutesAgo: state === "live" ? 0 : -1 })} preview />
        </div>
        {/* Plainly not the product — dashed and labelled, so a screenshot
            can't pass it off as a real control. */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-white/20 p-4">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Reviewer control — not part of the product</span>
          <span className="text-[12px] leading-relaxed text-muted-foreground">Step through the states the real launch would report. Leave it on one as long as you need.</span>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.06] p-1">
            {REVIEW.map((r) => (
              <button key={r.key} type="button" onClick={() => setState(r.key)} aria-pressed={state === r.key} className={cn("h-8 rounded-lg text-[11.5px] font-semibold transition-colors", state === r.key ? "bg-white/[0.09] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <Link href={PREVIEW_ROUTES.launchpad} className="inline-flex items-center gap-1.5 self-start px-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
          <Icon icon={ArrowLeft01Icon} className="size-3.5" strokeWidth={2} />
          All launches
        </Link>
      </aside>
    </div>
  )
}
