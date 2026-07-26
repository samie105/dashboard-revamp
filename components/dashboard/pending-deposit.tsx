"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight01Icon, Alert02Icon } from "@hugeicons/core-free-icons"

/**
 * Banner copy per deposit status.
 *
 * `payment_failed` is deliberately included: it is NOT terminal. /api/deposit/verify
 * accepts a failed deposit and can move it to payment_confirmed — a charge marked
 * failed before it settled recovers on a re-verify. Dropping it from the banner
 * would quietly remove that retry path, so it stays and gets honest copy instead.
 */
const STATUS_COPY: Record<
  string,
  { title: (amount: number) => string; subtitle: string; failed?: boolean }
> = {
  payment_failed: {
    title: (amount) => `Your deposit of ${amount} USDT didn't go through`,
    subtitle: "Click here to retry verification, or start a new deposit",
    failed: true,
  },
  payment_confirmed: {
    title: (amount) => `Your deposit of ${amount} USDT is on the way`,
    subtitle: "Payment confirmed — your USDT is being sent",
  },
  sending_usdt: {
    title: (amount) => `Your deposit of ${amount} USDT is on the way`,
    subtitle: "Payment confirmed — your USDT is being sent",
  },
}

const DEFAULT_COPY = {
  title: (amount: number) => `You have a pending deposit of ${amount} USDT`,
  subtitle: "Click here to verify your payment and receive your USDT",
  failed: false,
}

export function PendingDeposit() {
  const [pendingDeposit, setPendingDeposit] = useState<{
    _id: string
    usdtAmount: number
    status: string
  } | null>(null)

  useEffect(() => {
    const checkPending = async () => {
      try {
        const res = await fetch("/api/deposit/pending")
        const data = await res.json()
        if (data.success && data.deposit) {
          setPendingDeposit(data.deposit)
        }
      } catch {
        // ignore
      }
    }
    checkPending()
  }, [])

  if (!pendingDeposit) return null

  const copy = STATUS_COPY[pendingDeposit.status] ?? DEFAULT_COPY
  const failed = Boolean(copy.failed)

  return (
    <Link href="/deposit">
      <div
        className={
          failed
            ? "flex items-center justify-between gap-4 p-4 bg-linear-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl cursor-pointer hover:border-amber-500/40 transition-colors"
            : "flex items-center justify-between gap-4 p-4 bg-linear-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl cursor-pointer hover:border-emerald-500/40 transition-colors"
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={
              failed
                ? "w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"
                : "w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"
            }
          >
            <HugeiconsIcon
              icon={failed ? Alert02Icon : ArrowDown01Icon}
              className={failed ? "h-5 w-5 text-amber-500" : "h-5 w-5 text-emerald-500"}
            />
          </div>
          <div>
            <p className="text-sm font-semibold">{copy.title(pendingDeposit.usdtAmount)}</p>
            <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className={failed ? "h-5 w-5 text-amber-500 shrink-0" : "h-5 w-5 text-emerald-500 shrink-0"}
        />
      </div>
    </Link>
  )
}
