"use client"

/**
 * The bridge form.
 *
 * A bridge is chosen by LANE, not by token: where it leaves from, where it
 * lands, and what moves. So the form reads top-down in that order — source
 * chain, then a destination picked from the lanes that actually exist out of
 * it (each with its relay, fee and time, so they can be compared), then the
 * amount. Same anatomy as the swap and buy forms otherwise: amount boxes,
 * breakdown, a button that names its blocker, and a staged screen after.
 *
 * The lane lives in the workspace, because the lane card beside this form
 * shows its liquidity and limits.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown01Icon, ArrowDownDoubleIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import {
  CHAINS,
  ROUTES,
  STAGES,
  chainById,
  formatAmount,
  formatDuration,
  formatUSD,
  quoteRoute,
  routesFrom,
  type ChainId,
  type Route,
} from "@/components/bridge-unauth/bridge-data"
import { Figure, Icon, Panel, SLIDE } from "@/components/redesign/ui"

/** The coin mark that stands in for a chain. Intertrain gets its own WSK
 *  mark rather than borrowing USDC's. */
export function chainMark(id: ChainId) {
  return id === "intertrain" ? "WSK" : chainById(id).symbol
}

/** Source chains = chains with at least one lane out. */
const SOURCES = CHAINS.filter((c) => ROUTES.some((r) => r.from === c.id))

/* ── Source chain picker ──────────────────────────────────────────────── */

function SourcePicker({ value, onChange }: { value: ChainId; onChange: (id: ChainId) => void }) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)
  const chain = chainById(value)

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
          "flex h-16 w-full items-center gap-3 rounded-2xl border bg-white/[0.025] px-4 text-left transition-colors",
          open ? "border-primary/45" : "border-white/[0.08] hover:border-white/[0.14]",
        )}
      >
        <CoinAvatar symbol={chainMark(value)} size="lg" className="size-9 ring-1 ring-white/10" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[11.5px] font-medium text-muted-foreground">From</span>
          <span className="truncate text-[15px] font-semibold text-foreground">{chain.name}</span>
        </span>
        <span className="text-[12px] text-muted-foreground">{routesFrom(value).length} lane{routesFrom(value).length === 1 ? "" : "s"}</span>
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
            className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-white/[0.08] bg-[#141414]/98 p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl"
          >
            {SOURCES.map((c) => {
              const lanes = routesFrom(c.id)
              const held = lanes[0]?.balance ?? 0
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === value}
                    onClick={() => {
                      onChange(c.id)
                      setOpen(false)
                    }}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]", c.id === value && "bg-primary/[0.08]")}
                  >
                    <CoinAvatar symbol={chainMark(c.id)} size="lg" className="size-8 ring-1 ring-white/10" />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13.5px] font-semibold text-foreground">{c.name}</span>
                      <span className="truncate text-[11.5px] text-muted-foreground">
                        To {lanes.map((l) => chainById(l.to).name).join(", ")}
                      </span>
                    </span>
                    <span className="text-[12px] tabular-nums text-muted-foreground">
                      <Figure mask="••••">{held > 0 ? `${formatAmount(held, 2)} ${lanes[0].asset}` : "—"}</Figure>
                    </span>
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Progress (after confirm) ─────────────────────────────────────────── */

function BridgeProgress({ route, amount, receive, onReset }: { route: Route; amount: number; receive: number; onReset: () => void }) {
  const [stage, setStage] = React.useState(0)
  const [pct, setPct] = React.useState(0)

  // Demo time: each stage fills over ~1.6s. The middle (relay) one is the
  // long wait in real life, so it gets the most time here too.
  React.useEffect(() => {
    if (stage >= STAGES.length) return
    const span = stage === 1 ? 2200 : 1400
    const started = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(100, ((now - started) / span) * 100)
      setPct(p)
      if (p < 100) raf = requestAnimationFrame(tick)
      else {
        setStage((s) => s + 1)
        setPct(0)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stage])

  const done = stage >= STAGES.length
  const from = chainById(route.from)
  const to = chainById(route.to)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="flex items-center gap-3">
          <CoinAvatar symbol={chainMark(route.from)} size="lg" className="size-11 ring-1 ring-white/10" />
          <span className="relative h-1 w-20 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.span
              animate={{ x: done ? "0%" : ["-100%", "100%"] }}
              transition={done ? { duration: 0.3 } : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              className={cn("absolute inset-0 rounded-full", done ? "bg-credit" : "bg-gradient-to-r from-transparent via-primary to-transparent")}
            />
          </span>
          <CoinAvatar symbol={chainMark(route.to)} size="lg" className="size-11 ring-1 ring-white/10" />
        </div>
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">{done ? "Bridged" : "Bridging…"}</span>
        <span className="text-[13.5px] tabular-nums text-muted-foreground">
          {formatAmount(amount, 4)} {route.asset} on {from.name} → <span className="font-semibold text-credit">{formatAmount(receive, 4)} {route.receiveAsset}</span> on {to.name}
        </span>
        {done && <span className="text-[12.5px] text-muted-foreground">Demo only — nothing was sent.</span>}
      </div>

      <ol className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        {STAGES.map((s, i) => {
          const state = i < stage ? "done" : i === stage ? "current" : "todo"
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  state === "done" && "border-credit/40 bg-credit/[0.12] text-credit",
                  state === "current" && "border-primary/50 bg-primary/[0.1]",
                  state === "todo" && "border-white/[0.1]",
                )}
              >
                {state === "done" ? <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} /> : state === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex justify-between gap-2">
                  <span className={cn("text-[13.5px] font-semibold", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{s.label}</span>
                  {state === "current" && <span className="text-[12px] tabular-nums text-muted-foreground">{Math.round(pct)}%</span>}
                </span>
                <span className="text-[12px] text-muted-foreground">{s.detail(route)}</span>
                <span className="relative h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span
                    className={cn("absolute inset-y-0 left-0 rounded-full", state === "done" ? "bg-credit/70" : "bg-primary")}
                    style={{ width: `${state === "done" ? 100 : state === "current" ? pct : 0}%` }}
                  />
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={PREVIEW_ROUTES.transactions} className="flex h-12 items-center justify-center rounded-xl border border-white/[0.08] text-[14px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary">
          View history
        </Link>
        <button type="button" onClick={onReset} disabled={!done} className="dash-gold-btn h-12 rounded-xl text-[14px] font-semibold disabled:opacity-40">
          Bridge more
        </button>
      </div>
    </motion.div>
  )
}

/* ── Ticket ───────────────────────────────────────────────────────────── */

const amountClass =
  "min-w-0 flex-1 bg-transparent font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30 sm:text-[34px]"

export function BridgeTicket({ route, onRoute }: { route: Route; onRoute: (id: string) => void }) {
  const [amount, setAmount] = React.useState("")
  const [placed, setPlaced] = React.useState<null | { route: Route; amount: number; receive: number }>(null)
  const n = Number(amount) || 0
  const quote = quoteRoute(route, n)
  const from = chainById(route.from)
  const to = chainById(route.to)
  const lanes = routesFrom(route.from)
  const blocker = n <= 0 ? "Enter an amount" : quote.problem

  const pickSource = (id: ChainId) => {
    onRoute(routesFrom(id)[0].id)
    setAmount("")
  }

  return (
    // overflow-visible: the source picker's list drops below its row.
    <Panel className="overflow-visible p-4 sm:p-6">
      <AnimatePresence mode="wait" initial={false}>
        {placed ? (
          <BridgeProgress
            key="progress"
            route={placed.route}
            amount={placed.amount}
            receive={placed.receive}
            onReset={() => {
              setPlaced(null)
              setAmount("")
            }}
          />
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-[18px] font-semibold tracking-[-0.01em]">Bridge</span>
              <span className="text-[12px] font-medium text-muted-foreground">Move assets between chains</span>
            </div>

            <SourcePicker value={route.from} onChange={pickSource} />

            {/* Destinations — every lane out of the source, comparable at a glance. */}
            <div className="flex flex-col gap-2">
              <span className="px-0.5 text-[12.5px] font-semibold text-foreground/85">To</span>
              <div role="radiogroup" aria-label="Destination" className="flex flex-col gap-2">
                {lanes.map((l) => {
                  const on = l.id === route.id
                  const dest = chainById(l.to)
                  const eta = quoteRoute(l, 0).etaSeconds
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        onRoute(l.id)
                        setAmount("")
                      }}
                      className={cn("relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors", on ? "border-primary/55" : "border-white/[0.07] hover:border-white/[0.14]")}
                    >
                      {on && <motion.span layoutId="bridge-lane" transition={SLIDE} className="absolute inset-0 rounded-2xl bg-primary/[0.06]" />}
                      <CoinAvatar symbol={chainMark(l.to)} size="lg" className="relative size-9 ring-1 ring-white/10" />
                      <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="text-[14px] font-semibold text-foreground">
                          {dest.name}
                          <span className="ml-1.5 font-medium text-muted-foreground">
                            {l.asset}
                            {l.receiveAsset !== l.asset && ` → ${l.receiveAsset}`}
                          </span>
                        </span>
                        <span className="truncate text-[12px] text-muted-foreground">via {l.relay}</span>
                      </span>
                      <span className="relative flex flex-col items-end leading-tight">
                        <span className={cn("text-[12.5px] font-semibold", l.feePct === 0 ? "text-credit" : "text-foreground/85")}>
                          {l.feePct === 0 ? "No fee" : `${(l.feePct * 100).toFixed(2)}%`}
                        </span>
                        <span className="text-[11.5px] tabular-nums text-muted-foreground">~{formatDuration(eta)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="relative flex flex-col gap-2">
              <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:p-5", quote.problem && n > 0 ? "border-debit/40 bg-debit/[0.03]" : "border-white/[0.08] bg-white/[0.025] focus-within:border-primary/40")}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-medium text-muted-foreground">You send</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Figure mask="••••">{`Balance ${formatAmount(route.balance, 4)}`}</Figure>
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.min(route.balance, route.maxAmount)))}
                      disabled={route.balance === 0}
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                    placeholder="0"
                    className={amountClass}
                  />
                  <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] pl-1.5 pr-3.5">
                    <CoinAvatar symbol={route.asset} size="lg" className="size-8 ring-1 ring-white/10" />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[14px] font-semibold">{route.asset}</span>
                      <span className="text-[10.5px] text-muted-foreground">{from.name}</span>
                    </span>
                  </span>
                </div>
                <div className={cn("text-[12px] tabular-nums", quote.problem && n > 0 ? "font-semibold text-debit" : "text-muted-foreground")}>
                  {quote.problem && n > 0 ? quote.problem : `Min ${route.minAmount} · Max ${route.maxAmount.toLocaleString("en-US")} ${route.asset}`}
                </div>
              </div>

              <span className="absolute left-1/2 top-[calc(50%-4px)] z-10 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-[#0f0f0f] bg-[#1a1a1a] text-primary">
                <Icon icon={ArrowDownDoubleIcon} className="size-4" strokeWidth={2} />
              </span>

              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-medium text-muted-foreground">You receive</span>
                  <span className="text-muted-foreground">on {to.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(amountClass, "truncate", n === 0 && "text-muted-foreground/30")}>{n > 0 ? formatAmount(quote.receive, 4) : "0"}</span>
                  <span className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] pl-1.5 pr-3.5">
                    <CoinAvatar symbol={route.receiveAsset} size="lg" className="size-8 ring-1 ring-white/10" />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[14px] font-semibold">{route.receiveAsset}</span>
                      <span className="text-[10.5px] text-muted-foreground">{to.name}</span>
                    </span>
                  </span>
                </div>
                <div className="text-[12px] text-muted-foreground">{route.rate === 1 ? `1 ${route.asset} = 1 ${route.receiveAsset}` : `Rate ${route.rate}`}</div>
              </div>
            </div>

            <dl className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Bridge fee</dt>
                <dd className={cn("font-semibold tabular-nums", route.feePct === 0 ? "text-credit" : "text-foreground")}>
                  {route.feePct === 0 ? "Free" : n > 0 ? `${formatAmount(quote.bridgeFee, 6)} ${route.asset}` : `${(route.feePct * 100).toFixed(2)}%`}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Gas on {to.name}</dt>
                <dd className={cn("font-semibold tabular-nums", quote.destinationGasUsd === 0 ? "text-credit" : "text-foreground")}>
                  {quote.destinationGasUsd === 0 ? "Covered" : formatUSD(quote.destinationGasUsd)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Estimated time</dt>
                <dd className="font-semibold tabular-nums text-foreground">~{formatDuration(quote.etaSeconds)}</dd>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-white/[0.06] pt-3">
                <dt className="font-semibold text-foreground">You receive</dt>
                <dd className="font-display text-[15px] font-semibold tabular-nums text-foreground">
                  {n > 0 ? `${formatAmount(quote.receive, 4)} ${route.receiveAsset}` : "—"}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={!!blocker}
              onClick={() => setPlaced({ route, amount: n, receive: quote.receive })}
              className={cn(
                "flex h-[52px] items-center justify-center rounded-2xl text-[15px] font-semibold transition-colors",
                blocker ? "border border-white/[0.07] bg-white/[0.04] text-muted-foreground" : "dash-gold-btn",
              )}
            >
              {blocker ?? `Bridge to ${to.name}`}
            </button>
            <p className="-mt-2 text-center text-[11.5px] text-muted-foreground">Demo only — nothing is sent.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
