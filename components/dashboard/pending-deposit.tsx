"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

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

  return (
    <Link href="/deposit">
      <div className="flex items-center justify-between gap-4 p-4 bg-linear-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl cursor-pointer hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              You have a pending deposit of {pendingDeposit.usdtAmount} USDT
            </p>
            <p className="text-xs text-muted-foreground">
              Click here to verify your payment and receive your USDT
            </p>
          </div>
        </div>
        <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5 text-emerald-500 shrink-0" />
      </div>
    </Link>
  )
}
