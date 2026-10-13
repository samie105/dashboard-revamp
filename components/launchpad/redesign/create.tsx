"use client"

/**
 * The preview's "Launch a token" (components/launchpad-unauth/create.tsx) on
 * the real launch: five steps — Chain · Identity · Story · Allocation ·
 * Review — beside a live card ("how buyers will see it") and the bill; then
 * the launch's own status screen at ?launch=<id>.
 *
 * Everything that matters is the old page's (components/launchpad/
 * create-launch.tsx), moved verbatim into useLaunchForm / useLaunchStatus:
 * the field rules (mirroring the server's), the terms read from the on-chain
 * config, availability and the pause, the in-flight launch, draft → deploy →
 * sign on this device → submit, and the status polling and retry.
 *
 * Swapped for real data:
 *  · the bill is the terms endpoint's own figures — the allocation the curve
 *    program quotes, network rent, the signature fee — and says there's no
 *    creation fee (the preview's 0.02 SOL was an assumption);
 *  · links take full https:// URLs, the server's rule;
 *  · the network (devnet / mainnet) is chosen on the Chain step;
 *  · the status screen follows the launch from the server, never a timer.
 * Not carried over: the icon upload (the launch API has no icon field), the
 * draft kept across reloads, the ticker-overlap note, and the reviewer-only
 * state switcher.
 */

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft01Icon, ArrowRight02Icon, Cancel01Icon, Rocket01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Rise } from "@/components/ui/system"
import { DashScope } from "@/components/dash"
import { Icon, Panel, PanelTitle, SLIDE } from "@/components/dashboard/redesign/ui"
import type { LaunchpadToken } from "@/lib/crypto-backend/types"
import { cardView, lamportsToSol, type LaunchCardView } from "@/lib/launchpad-view"
import { fromBaseUnits } from "../live-curve-ticket"
import { isDevnet, NetworkBadge, NetworkSwitch } from "../network"
import { useLaunchForm, useLaunchStatus } from "../create-launch"
import { LaunchCard } from "./discovery"
import { PausedNotice } from "./ui"

const SOL = 9
const STEPS = ["Chain", "Identity", "Story", "Allocation", "Review"] as const
type StepIndex = 0 | 1 | 2 | 3 | 4
const SHELL = "ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6"

export function CreateLaunchPage() {
  const params = useSearchParams()
  const launchId = params.get("launch")
  return launchId ? <StatusPage launchId={launchId} /> : <CreatePage />
}

/* ── Form bits ────────────────────────────────────────────────────────── */

function inputCls(error: boolean) {
  return cn(
    "h-12 w-full min-w-0 rounded-xl border bg-foreground/[0.025] px-3.5 text-[14.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/55",
    error ? "border-debit/55 focus:border-debit" : "border-foreground/[0.08] hover:border-foreground/[0.14] focus:border-primary/45",
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

function StepHead({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
      <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function Stepper({ step, reached, valid, onJump }: { step: StepIndex; reached: StepIndex; valid: boolean[]; onJump: (s: StepIndex) => void }) {
  return (
    <ol className="relative flex items-start justify-between">
      <span aria-hidden className="absolute left-[18px] right-[18px] top-[17px] h-[2px] rounded-full bg-foreground/[0.07]" />
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
                current
                  ? "scale-110 border-primary bg-primary text-primary-foreground shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
                  : done
                    ? "border-primary bg-card text-primary"
                    : reachable
                      ? "border-foreground/25 bg-card text-foreground"
                      : "border-foreground/[0.08] bg-card text-muted-foreground/50",
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

/* ── The bill and the curve ───────────────────────────────────────────── */

function CostCard({ f }: { f: ReturnType<typeof useLaunchForm> }) {
  const sol = (v: bigint | null) => (v === null ? "…" : `${fromBaseUnits(v.toString(), SOL, 4)} SOL`)
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <PanelTitle className="text-[15px]">What it costs</PanelTitle>
      {f.terms.error && !f.t ? (
        <p role="alert" className="text-[12.5px] text-debit">
          Couldn&apos;t read the launch terms. Try again in a moment.
        </p>
      ) : (
        <dl className="flex flex-col gap-2 text-[12.5px]">
          {[
            { k: `Your allocation (${(f.form.creatorBps / 100).toFixed(1)}%)`, v: sol(f.allocationLamports) },
            { k: "Network rent", v: sol(f.rentLamports) },
            { k: "Network fee", v: "0.000005 SOL" },
          ].map((r) => (
            <div key={r.k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className="font-semibold tabular-nums text-foreground">{r.v}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t border-foreground/[0.06] pt-3">
            <dt className="font-semibold text-foreground">Total</dt>
            <dd className="font-display text-[18px] font-semibold tabular-nums text-foreground">{sol(f.total)}</dd>
          </div>
        </dl>
      )}
      <span className="text-[11.5px] leading-relaxed text-muted-foreground">
        No creation fee. Your allocation is quoted by the curve program at the launch price, so this is what the launch transaction buys. Solana checks the whole bill before you sign.
      </span>
    </Panel>
  )
}

function CurveTermsCard({ f }: { f: ReturnType<typeof useLaunchForm> }) {
  const t = f.t
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <PanelTitle className="text-[15px]">The curve</PanelTitle>
      <dl className="flex flex-col gap-2 text-[12.5px]">
        {[
          { k: "Total supply", v: t ? fromBaseUnits(t.totalSupply, t.tokenDecimals, 0) : "…" },
          { k: "Sold on the curve", v: t?.curveSupply ? fromBaseUnits(t.curveSupply, t.tokenDecimals, 0) : "…" },
          { k: "Graduates at", v: t ? `${fromBaseUnits(t.graduationLamports, SOL, 0)} SOL raised` : "…" },
          { k: "Fee on every trade", v: t ? `${t.tradingFeeBps / 100}%` : "…" },
          { k: "Liquidity after graduation", v: "Locked permanently" },
        ].map((r) => (
          <div key={r.k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{r.k}</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">{r.v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/** The draft as the feed would show it once live. */
function draftView(f: ReturnType<typeof useLaunchForm>): LaunchCardView {
  const target = f.t ? lamportsToSol(f.t.graduationLamports) : null
  return {
    id: "draft",
    name: f.form.name.trim() || "Your token",
    symbol: f.form.symbol.trim().replace(/^\$/, "").toUpperCase() || "TICKER",
    description: f.form.description.trim() || null,
    iconUrl: null,
    mint: null,
    status: "live",
    rawStatus: "live",
    progressBps: 0,
    solRaised: 0,
    graduationSol: target,
    remainingSol: target,
    creatorBps: f.form.creatorBps,
    createdAt: "",
  }
}

/* ── The form ─────────────────────────────────────────────────────────── */

function CreatePage() {
  const f = useLaunchForm()
  const { form, set, problems, paused } = f
  const [step, setStep] = React.useState<StepIndex>(0)
  const [reached, setReached] = React.useState<StepIndex>(0)
  const [tried, setTried] = React.useState<Record<number, boolean>>({})
  const [dir, setDir] = React.useState(1)
  const symbol = form.symbol.trim().replace(/^\$/, "").toUpperCase()
  const linkProblem = problems.website ?? problems.x ?? problems.telegram
  const maxBps = f.t?.maxCreatorBps ?? 2000

  const valid = [
    !paused,
    form.name.trim().length >= 2 && symbol.length >= 2 && !problems.name && !problems.symbol,
    !problems.description && !linkProblem,
    true,
    f.canLaunch,
  ]

  const go = (to: StepIndex) => {
    setDir(to > step ? 1 : -1)
    setStep(to)
    setReached((r) => (to > r ? to : r))
  }
  const next = () => {
    setTried((t) => ({ ...t, [step]: true }))
    if (!valid[step] || step >= 4) return
    go((step + 1) as StepIndex)
  }

  // The old page's button ladder, unchanged.
  const launchLabel =
    f.busy === "draft"
      ? "Saving…"
      : f.busy === "deploy"
        ? "Building the launch…"
        : f.busy === "sign"
          ? "Signing…"
          : paused
            ? "Solana launches are paused"
            : Object.keys(problems).length > 0
              ? "Fix the fields marked in red"
              : f.total !== null && f.complete
                ? `Launch for ${fromBaseUnits(f.total.toString(), SOL, 4)} SOL`
                : "Fill in a name and symbol"

  const checks = [
    { label: "Name is 2–32 characters", ok: form.name.trim().length >= 2 && !problems.name },
    { label: "Ticker is 2–10 letters or digits, not a reserved asset", ok: symbol.length >= 2 && !problems.symbol },
    { label: "Description is 500 characters at most", ok: !problems.description },
    { label: "Links are full https:// addresses", ok: !linkProblem },
    { label: "Launch terms read from the network", ok: Boolean(f.t) && f.t?.creatorBps === form.creatorBps },
  ]

  const slide = {
    initial: (d: number) => ({ opacity: 0, x: 24 * d }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: -24 * d }),
  }

  return (
    <DashScope className={SHELL}>
      <Rise>
        <div className="flex flex-col gap-2 px-1">
          <Link href="/launchpad" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            <Icon icon={ArrowLeft01Icon} className="size-3.5" strokeWidth={2} />
            All launches
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground md:text-[32px]">Launch a token</h1>
            {f.networkId && <NetworkBadge networkId={f.networkId} className="px-2 py-0.5 text-[10px]" />}
          </div>
          <p className="max-w-[64ch] text-[14px] leading-relaxed text-muted-foreground">
            Four short steps. Your token starts on a bonding curve and graduates to the open market once the curve fills — the preview and the cost update as you go.
          </p>
        </div>
      </Rise>

      {isDevnet(f.networkId) && (
        <p className="rounded-2xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-foreground/85">
          <span className="font-semibold text-warning">You&apos;re on devnet.</span> Tokens launched here are for testing and have no value. They&apos;re paid for with devnet SOL, which is free from the Solana faucet.
        </p>
      )}

      {f.inFlight && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] px-4 py-3">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
            <span className="relative size-2.5 rounded-full bg-primary" />
          </span>
          <span className="min-w-0 flex-1 text-[13.5px]">
            <span className="font-semibold">${f.inFlight.symbol} is still launching.</span>
          </span>
          <Link href={`/launchpad/create?launch=${encodeURIComponent(f.inFlight.launchId)}`} className="ds-gold flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold">
            Open it
          </Link>
        </motion.div>
      )}

      <PausedNotice availability={f.availability.data} />

      <Rise delay={60}>
        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel className="flex min-w-0 flex-col">
            <div className="flex flex-col gap-5 border-b border-foreground/[0.06] p-5 md:px-7 md:pt-6">
              <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
              <Stepper step={step} reached={reached} valid={valid} onJump={go} />
            </div>

            <div className="relative min-h-[380px] overflow-hidden p-5 md:p-7">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div key={step} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-5">
                  {step === 0 && (
                    <>
                      <StepHead title="Where will it live?" body="Pick a chain for the token and its bonding curve, and the network to launch on. More chains are coming." />
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Chain">
                        {(["solana", "ethereum", "intertrain"] as const).map((key) => {
                          const a = f.availability.data?.[key]
                          const on = key === "solana"
                          const off = a ? a.state !== "live" : key !== "solana"
                          const label = key === "solana" ? "Solana" : key === "ethereum" ? "Ethereum" : "Intertrain"
                          return (
                            <button
                              key={key}
                              type="button"
                              role="radio"
                              aria-checked={on && !off}
                              aria-disabled={off || undefined}
                              className={cn(
                                "relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors",
                                off ? "cursor-not-allowed border-foreground/[0.05] opacity-50" : on ? "border-primary/60" : "border-foreground/[0.08]",
                              )}
                            >
                              {on && !off && <motion.span layoutId="create-chain" transition={SLIDE} className="absolute inset-0 rounded-2xl bg-primary/[0.07]" />}
                              <span className="relative flex w-full items-center justify-between">
                                <span className="text-[15px] font-semibold text-foreground">{label}</span>
                                {on && !off && <Icon icon={Tick02Icon} className="size-4 text-primary" strokeWidth={2.6} />}
                                {off && <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{a?.state === "paused" ? "Paused" : "Soon"}</span>}
                              </span>
                              <span className="relative text-[12px] text-muted-foreground">
                                {key === "solana" ? (a?.state === "paused" ? "Paused by operations" : "Fast, low fees · live now") : a?.state === "paused" ? "Paused by operations" : "Not available yet"}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {f.network.networks.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-3">
                          <span className="flex flex-col">
                            <span className="text-[13px] font-semibold text-foreground">Network</span>
                            <span className="text-[12px] text-muted-foreground">Devnet tokens are for testing and have no value.</span>
                          </span>
                          <NetworkSwitch
                            networks={f.network.networks}
                            networkId={f.networkId}
                            onChange={(next) => {
                              f.network.setNetworkId(next)
                              f.resetIntentKey() // another network, another launch
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <StepHead title="Name your token" body="What people will search for and see in the feed." />
                      <Field label="Name" aside={`${form.name.trim().length}/32`} error={(tried[1] || form.name) && problems.name ? `Use ${problems.name}.` : tried[1] && form.name.trim().length < 2 ? "Use 2–32 characters." : undefined}>
                        <input autoFocus value={form.name} maxLength={32} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ember" className={inputCls(Boolean(problems.name) || (Boolean(tried[1]) && form.name.trim().length < 2))} />
                      </Field>
                      <Field
                        label="Ticker"
                        error={problems.symbol ? (problems.symbol.includes("reserved") ? `$${symbol} is a listed asset and can't be used.` : "Use 2–10 letters or digits.") : tried[1] && symbol.length < 2 ? "Use 2–10 letters or digits." : undefined}
                        hint="2–10 letters or digits."
                      >
                        <span className="relative">
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14.5px] font-semibold text-muted-foreground">$</span>
                          <input
                            value={form.symbol}
                            maxLength={11}
                            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                            placeholder="EMBR"
                            className={cn(inputCls(Boolean(problems.symbol) || (Boolean(tried[1]) && symbol.length < 2)), "pl-7 font-semibold uppercase tracking-[0.04em]")}
                          />
                        </span>
                      </Field>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <StepHead title="Tell people what it is" body="Shown on the card and the token page. Links are optional and never checked by us." />
                      <Field label="Description" aside={`${form.description.length}/500`} error={problems.description ? "Keep it to 500 characters." : undefined}>
                        <textarea
                          autoFocus
                          value={form.description}
                          maxLength={500}
                          rows={4}
                          onChange={(e) => set("description", e.target.value)}
                          placeholder="What is this, and who is it for?"
                          className={cn(inputCls(Boolean(problems.description)), "h-auto resize-none py-3 leading-relaxed")}
                        />
                      </Field>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Field label="Website" error={problems.website ? "Use a full https:// address." : undefined}>
                          <input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" className={inputCls(Boolean(problems.website))} />
                        </Field>
                        <Field label="X" error={problems.x ? "Use a full https:// address." : undefined}>
                          <input value={form.x} onChange={(e) => set("x", e.target.value)} placeholder="https://x.com/…" className={inputCls(Boolean(problems.x))} />
                        </Field>
                        <Field label="Telegram" error={problems.telegram ? "Use a full https:// address." : undefined}>
                          <input value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="https://t.me/…" className={inputCls(Boolean(problems.telegram))} />
                        </Field>
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <StepHead
                        title="Buy some for yourself?"
                        body="Optional. Bought off the curve at the launch price, in the same transaction that creates the token. There is no vesting: everyone can see your share, and you can sell it."
                      />
                      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] p-5">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <span className="font-display text-[40px] font-semibold leading-none tabular-nums text-foreground">{(form.creatorBps / 100).toFixed(1)}%</span>
                          <span className="text-right text-[13px] tabular-nums text-muted-foreground">
                            {form.creatorBps === 0 ? (
                              "None — a fair launch"
                            ) : f.t && f.t.creatorBps === form.creatorBps ? (
                              <>
                                {fromBaseUnits(f.t.creatorTokens, f.t.tokenDecimals, 0)} tokens for <span className="font-semibold text-foreground">{fromBaseUnits(f.t.creatorLamports, SOL, 4)} SOL</span>
                              </>
                            ) : (
                              "Quoting…"
                            )}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={maxBps}
                          step={50}
                          value={form.creatorBps}
                          onChange={(e) => set("creatorBps", Number(e.target.value))}
                          aria-label="Creator allocation"
                          className="dash-range w-full"
                          style={{ "--fill": `${(form.creatorBps / maxBps) * 100}%` } as React.CSSProperties}
                        />
                        <div className="grid grid-cols-5 gap-1.5">
                          {[0, 500, 1000, 1500, 2000].map((b) => (
                            <button
                              key={b}
                              type="button"
                              disabled={b > maxBps}
                              onClick={() => set("creatorBps", b)}
                              className={cn(
                                "h-8 rounded-lg border text-[12px] font-semibold tabular-nums transition-colors disabled:opacity-40",
                                form.creatorBps === b ? "border-primary/55 bg-primary/[0.1] text-primary" : "border-foreground/[0.07] text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {b === 0 ? "None" : `${b / 100}%`}
                            </button>
                          ))}
                        </div>
                      </div>
                      {form.creatorBps >= 1000 && (
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
                        <LaunchCard v={draftView(f)} now={0} preview />
                      </div>
                      <dl className="flex flex-col divide-y divide-foreground/[0.05] rounded-2xl border border-foreground/[0.07]">
                        {[
                          { k: "Chain", v: `Solana${f.networkId ? ` · ${isDevnet(f.networkId) ? "Devnet" : "Mainnet"}` : ""}`, step: 0 },
                          { k: "Name & ticker", v: `${form.name.trim() || "—"} · $${symbol || "—"}`, step: 1 },
                          { k: "Description", v: form.description.trim() || "None", step: 2 },
                          { k: "Links", v: [form.website, form.x, form.telegram].filter((x) => x.trim()).join(" · ") || "None", step: 2 },
                          {
                            k: "Your allocation",
                            v: form.creatorBps ? `${(form.creatorBps / 100).toFixed(1)}% · ${f.allocationLamports === null ? "…" : `${fromBaseUnits(f.allocationLamports.toString(), SOL, 4)} SOL`}` : "None",
                            step: 3,
                          },
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
                          <li key={c.label} className="flex items-center gap-2.5 text-[12.5px]">
                            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-credit/[0.14] text-credit" : "bg-debit/[0.14] text-debit")}>
                              <Icon icon={c.ok ? Tick02Icon : Cancel01Icon} className="size-3" strokeWidth={2.6} />
                            </span>
                            <span className={c.ok ? "text-foreground/85" : "text-muted-foreground"}>{c.label}</span>
                          </li>
                        ))}
                      </ul>
                      {f.error && (
                        <p role="alert" className="rounded-xl border border-debit/25 bg-debit/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-debit">
                          {f.error}
                        </p>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-foreground/[0.06] p-4 md:px-7">
              {step > 0 ? (
                <button type="button" onClick={() => go((step - 1) as StepIndex)} className="flex h-12 items-center gap-2 rounded-xl border border-foreground/[0.09] px-4 text-[14px] font-semibold text-foreground/85 transition-colors hover:text-foreground">
                  <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
                  Back
                </button>
              ) : (
                <Link href="/launchpad" className="flex h-12 items-center px-2 text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
                  Cancel
                </Link>
              )}
              {step < 4 ? (
                <button type="button" onClick={next} className={cn("flex h-12 items-center gap-2 rounded-xl px-6 text-[14.5px] font-semibold", valid[step] ? "ds-gold" : "border border-foreground/[0.08] bg-foreground/[0.04] text-muted-foreground")}>
                  Continue
                  <Icon icon={ArrowRight02Icon} className="size-4" strokeWidth={2} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={f.launch}
                  disabled={!f.canLaunch}
                  className={cn("flex h-12 items-center gap-2 rounded-xl px-6 text-[14.5px] font-semibold", f.canLaunch ? "ds-gold" : "border border-foreground/[0.08] bg-foreground/[0.04] text-muted-foreground")}
                >
                  {f.busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <Icon icon={Rocket01Icon} className="size-[18px]" strokeWidth={2} />}
                  {launchLabel}
                </button>
              )}
            </div>
          </Panel>

          <aside className="hidden min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:flex xl:self-start">
            <div className="flex flex-col gap-2">
              <span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">How buyers will see it</span>
              <LaunchCard v={draftView(f)} now={0} preview />
            </div>
            <CostCard f={f} />
            <CurveTermsCard f={f} />
          </aside>
          {step === 4 && (
            <div className="flex flex-col gap-4 xl:hidden">
              <CostCard f={f} />
              <CurveTermsCard f={f} />
            </div>
          )}
        </div>
      </Rise>
      {f.signer.dialog}
    </DashScope>
  )
}

/* ── The launch's own status screen ───────────────────────────────────── */

const STAGES = ["Signed on this device", "Sent to Solana", "Confirmed: token and curve created", "Open for trading"]

function StatusPage({ launchId }: { launchId: string }) {
  const st = useLaunchStatus(launchId)
  const l: LaunchpadToken | undefined = st.launch.data

  if (!l) {
    return (
      <DashScope className={SHELL}>
        <Link href="/launchpad/create" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Icon icon={ArrowLeft01Icon} className="size-3.5" strokeWidth={2} />
          Launch a token
        </Link>
        {st.launch.error ? (
          <Panel className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-[15px] font-semibold text-foreground">We couldn&apos;t find this launch</p>
            <p className="text-[13px] text-muted-foreground">Check the link, or start a new launch.</p>
          </Panel>
        ) : (
          <span className="skel h-[460px] rounded-[20px]" aria-label="Loading your launch" />
        )}
      </DashScope>
    )
  }

  const onChain = l.status === "live" || l.status === "graduating" || l.status === "graduated"
  const failed = l.status === "failed"
  const inFlight = !onChain && !failed && l.status !== "draft"
  const active = onChain ? STAGES.length : failed ? 2 : l.status === "draft" ? 0 : 2
  const headline = onChain ? `$${l.symbol} is live` : failed ? "The launch didn't go through" : l.status === "draft" ? "Not launched yet" : `Creating $${l.symbol}`
  const caption = onChain
    ? `The curve is open and $${l.symbol} can be bought and sold.${l.allocation.creatorBps > 0 ? ` Your ${(l.allocation.creatorBps / 100).toFixed(1)}% is in your wallet.` : ""}`
    : failed
      ? `${(l as LaunchpadToken & { failureReason?: string }).failureReason ?? "Nothing was created."} A launch is all or nothing: nothing was taken except, at most, the network fee.`
      : l.status === "draft"
        ? "It was saved but never signed. Continue to sign it."
        : "It's with Solana. You can close this page: the launch carries on, and this screen picks it up when you come back."

  return (
    <DashScope className={SHELL}>
      <Link href="/launchpad" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
        <Icon icon={ArrowLeft01Icon} className="size-3.5" strokeWidth={2} />
        All launches
      </Link>
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel className="flex flex-col items-center gap-6 p-6 text-center md:p-10">
          <span className="relative flex size-20 items-center justify-center">
            {inFlight && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
            <span className={cn("relative flex size-20 items-center justify-center rounded-full", onChain ? "bg-credit/[0.14] text-credit" : failed ? "bg-debit/[0.14] text-debit" : "bg-primary/[0.12] text-primary")}>
              {onChain ? <Icon icon={Tick02Icon} className="size-9" strokeWidth={2.4} /> : failed ? <Icon icon={Cancel01Icon} className="size-9" strokeWidth={2.4} /> : <span className="size-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />}
            </span>
          </span>
          <div className="flex max-w-[56ch] flex-col gap-2">
            <span className="flex items-center justify-center gap-2">
              <NetworkBadge networkId={l.networkId} className="px-2 py-0.5 text-[10px]" />
            </span>
            <h2 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-foreground">{headline}</h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">{caption}</p>
          </div>

          <ol className="flex w-full max-w-[420px] flex-col gap-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4 text-left">
            {STAGES.map((s, i) => {
              const state = failed && i === 2 ? "failed" : i < active ? "done" : i === active ? "current" : "todo"
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                      state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
                      state === "current" && "border-primary/50 bg-primary/[0.1]",
                      state === "failed" && "border-debit/40 bg-debit/[0.12] text-debit",
                      state === "todo" && "border-foreground/[0.1]",
                    )}
                  >
                    {state === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : state === "failed" ? <Icon icon={Cancel01Icon} className="size-3" strokeWidth={2.6} /> : state === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : null}
                  </span>
                  <span className={cn("text-[13.5px] font-medium", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s}</span>
                </li>
              )
            })}
          </ol>

          <div className="flex flex-wrap justify-center gap-2.5">
            {onChain && (
              <Link href={`/launchpad/${encodeURIComponent(l.launchId)}`} className="ds-gold flex h-11 items-center rounded-xl px-5 text-[14px] font-semibold">
                Open ${l.symbol}
              </Link>
            )}
            {(failed || l.status === "draft") && (
              <button type="button" onClick={st.continueOrRetry} disabled={st.busy} className="ds-gold flex h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold disabled:opacity-60">
                {st.busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
                {st.busy ? "Working…" : failed ? "Try again" : "Continue"}
              </button>
            )}
            {(onChain || failed) && (
              <Link href="/launchpad/create" className="flex h-11 items-center rounded-xl border border-foreground/[0.09] px-5 text-[14px] font-semibold text-foreground/85 hover:text-foreground">
                Launch another
              </Link>
            )}
            {inFlight && (
              <Link href="/launchpad" className="flex h-11 items-center text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                Leave this page — the launch carries on
              </Link>
            )}
          </div>
          {l.status === "deploying" && (
            <p className="text-[12px] text-muted-foreground">
              Closed the signing step before finishing?{" "}
              <button type="button" onClick={st.continueOrRetry} disabled={st.busy} className="font-semibold text-primary hover:opacity-80">
                Continue signing
              </button>
            </p>
          )}
          {st.error && (
            <p role="alert" className="w-full max-w-[420px] rounded-xl border border-debit/25 bg-debit/[0.06] px-3.5 py-3 text-[12.5px] text-debit">
              {st.error}
            </p>
          )}
        </Panel>

        <aside className="flex min-w-0 flex-col gap-2 xl:self-start">
          <span className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">{onChain ? "Your launch" : "How it will appear once live"}</span>
          <LaunchCard v={cardView(l)} now={0} preview />
        </aside>
      </div>
      {st.signer.dialog}
    </DashScope>
  )
}
