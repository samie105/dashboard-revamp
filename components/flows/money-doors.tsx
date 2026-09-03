"use client"

/**
 * The front door — WHICH money is moving, asked before "how much".
 *
 * On the crypto dashboard "deposit" is genuinely two different moves that
 * happen to share a word: topping the trading account up out of the Dollar
 * Account, and receiving coins somebody is sending you from another app. They
 * have different sources, different waiting times and different failure modes,
 * so the modal asks once rather than guessing — and the same question mirrored
 * gives us withdraw.
 *
 * This is a STEP inside the money-flow modal, never a popup of its own. A
 * chooser that opened a second dialog would put two backdrops, two focus traps
 * and two ways to dismiss on screen for one decision, which is a bug this
 * branch has already had to fix twice.
 *
 * Deep links keep their old behaviour: openFlow("fund") and the /fund, /buy,
 * /sell routes still land straight on a flow. The chooser only exists for the
 * dashboard's two ambiguous buttons.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  DollarCircleIcon,
  QrCodeIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { FlowHeader } from "@/components/ui/flow"

/** Which way the money is going. The only thing a caller has to know. */
export type MoneyDirection = "deposit" | "withdraw"

/** The two doors behind each direction. "cash" is the custodial Dollar
 *  Account ↔ trading account transfer; "crypto" is the wallet's own coins
 *  arriving from, or leaving for, somewhere outside Worldstreet. */
export type DoorKey = "cash" | "crypto"

type Door = {
  key: DoorKey
  title: string
  detail: string
  icon: typeof DollarCircleIcon
}

/**
 * The copy is the product here. "From your Dollar Account" and "From crypto"
 * are the words the owner used, and the dollar-account line is his sentence
 * verbatim — it is the one place we explain how the two products connect, so
 * it does not get paraphrased into something vaguer.
 */
const DOORS: Record<MoneyDirection, readonly Door[]> = {
  deposit: [
    {
      key: "cash",
      title: "From your Dollar Account",
      detail: "Fund directly from your Dollar Account into your trading account.",
      icon: DollarCircleIcon,
    },
    {
      key: "crypto",
      title: "From crypto",
      detail: "Show the addresses that receive coins sent to you from another app or wallet.",
      icon: QrCodeIcon,
    },
  ],
  withdraw: [
    {
      key: "cash",
      title: "To your Dollar Account",
      detail: "Move money out of your trading account and back into your Dollar Account.",
      icon: DollarCircleIcon,
    },
    {
      key: "crypto",
      title: "Send crypto out",
      detail: "Send coins from your Worldstreet wallet to any address you choose.",
      icon: SentIcon,
    },
  ],
}

const HEADINGS: Record<MoneyDirection, { title: string; subtitle: string }> = {
  deposit: { title: "Add money", subtitle: "Two ways in — pick where the money is coming from." },
  withdraw: { title: "Take money out", subtitle: "Two ways out — pick where the money should go." },
}

export function DoorChooser({
  direction,
  onPick,
}: {
  direction: MoneyDirection
  onPick: (door: DoorKey) => void
}) {
  const heading = HEADINGS[direction]
  return (
    // Same column padding as BuySellClient's and FundClient's modal bodies, so
    // stepping from the chooser into a flow doesn't shift the left edge.
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <FlowHeader
        className="ws-casc ws-casc-1"
        direction={direction === "deposit" ? "in" : "out"}
        title={heading.title}
        subtitle={heading.subtitle}
      />

      <div className="mt-5 flex flex-col gap-2.5">
        {DOORS[direction].map((door, i) => (
          <button
            key={door.key}
            type="button"
            onClick={() => onPick(door.key)}
            className={cn(
              "ws-casc group flex w-full items-center gap-3.5 rounded-2xl bg-surface-sunken/70 px-4 py-4 text-left",
              "ring-1 ring-border/25 transition-all",
              "hover:bg-accent/60 hover:ring-foreground/[0.10]",
              "active:scale-[0.985] motion-reduce:active:scale-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              i === 0 ? "ws-casc-2" : "ws-casc-3",
            )}
          >
            {/* The sanctioned gold chip (DS §03 — ListRow / ActionPill form).
                Gold here is the brand mark on a wallet verb, not a data
                colour; direction lives in the header badge above, once. */}
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.12]">
              <HugeiconsIcon icon={door.icon} className="h-[18px] w-[18px] text-primary" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold leading-tight">{door.title}</span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">{door.detail}</span>
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </button>
        ))}
      </div>

      {/* Nothing has been committed yet, and saying so removes the main reason
          people hesitate on a screen that looks like it might already be
          moving their money. Worded to stay true of BOTH doors: the receive
          side has no confirm step to promise, because it never moves anything
          — it only shows you where money can arrive. */}
      <p className="ws-casc ws-casc-4 mt-4 text-[12px] leading-relaxed text-subtle">
        Picking one just shows you the next step — nothing moves yet.
      </p>
    </div>
  )
}
