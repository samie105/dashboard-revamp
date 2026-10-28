"use client"

/**
 * Drill-down and table tools for the admin console: the detail drawers for a
 * transaction and a user, a compact labelled select for filters and sorting,
 * and CSV download. Everything shown is what the backend already sent for the
 * row (masked user labels, safe text); links render only when https.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"

import { NeutralButton, StatusBadge } from "@/components/dash"
import { adminData } from "@/lib/admin/source"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { AdminActivity, AdminUserRow } from "@/lib/admin/types"
import { ACTIVITY_LABEL, safeExternalUrl, STATUS_TONE, timeAgo, toCsv } from "@/lib/admin/view"
import { usd } from "@/lib/num"

const fullDate = (at: string | null) =>
  at ? new Date(at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Never"

function DetailRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col divide-y divide-foreground/[0.06] rounded-2xl border border-foreground/[0.06]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3 text-[13px]">
          <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
          <dd className="min-w-0 break-all text-right font-medium text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ActivitySheet({ activity, onClose }: { activity: AdminActivity | null; onClose: () => void }) {
  const link = safeExternalUrl(activity?.explorerUrl)
  return (
    <Sheet open={activity !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-5 p-5 sm:max-w-md">
        {activity && (
          <>
            <SheetHeader className="p-0">
              <SheetTitle className="font-display text-[18px]">{ACTIVITY_LABEL[activity.type]} · {usd(activity.amountUsd)}</SheetTitle>
              <SheetDescription>{fullDate(activity.at)}</SheetDescription>
            </SheetHeader>
            <DetailRows
              rows={[
                { label: "Status", value: <StatusBadge tone={STATUS_TONE[activity.status]} label={activity.status} /> },
                { label: "User", value: activity.userLabel },
                { label: "Type", value: ACTIVITY_LABEL[activity.type] },
                { label: "Network", value: activity.networkLabel },
                { label: "Amount", value: usd(activity.amountUsd) },
                { label: "Reference", value: <span className="font-mono text-[12px]">{activity.id}</span> },
                ...(activity.txHash ? [{ label: "Transaction", value: <span className="font-mono text-[12px]">{activity.txHash}</span> }] : []),
              ]}
            />
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary hover:underline">
                View on block explorer
                <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" strokeWidth={1.8} />
              </a>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function UserSheet({ user, periodText, onClose }: { user: AdminUserRow | null; periodText: string; onClose: () => void }) {
  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-5 p-5 sm:max-w-md">
        {user && (
          <>
            <SheetHeader className="p-0">
              <SheetTitle className="font-display text-[18px]">{user.userLabel}</SheetTitle>
              <SheetDescription>User ID <span className="font-mono">{user.id}</span></SheetDescription>
            </SheetHeader>
            <DetailRows
              rows={[
                { label: "Status", value: <StatusBadge tone={user.status === "active" ? "success" : "neutral"} label={user.status} /> },
                { label: "Joined", value: fullDate(user.joinedAt) },
                { label: "Last active", value: user.lastActiveAt ? `${fullDate(user.lastActiveAt)} (${timeAgo(user.lastActiveAt)})` : "Never" },
                { label: "Wallets", value: user.wallets },
                { label: "Volume, all time", value: usd(user.volumeUsd) },
              ]}
            />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              &ldquo;Active&rdquo; means active in {periodText}. The full email and account actions aren&rsquo;t shown here; they belong to the backend&rsquo;s admin tools.
            </p>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** A small labelled native select: keyboard, screen reader and phone pickers come for free. */
export function MiniSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { key: T; label: string }[]; onChange: (v: T) => void }) {
  const id = React.useId()
  return (
    <span className="flex items-center gap-1.5 text-[12.5px]">
      <label htmlFor={id} className="text-muted-foreground">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 rounded-full border border-foreground/[0.08] bg-foreground/[0.025] px-2.5 text-[12.5px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </span>
  )
}

/**
 * Download rows as a CSV file (built by lib/admin/view.ts toCsv, which
 * neutralises formulas), then tell the backend so the export lands in the
 * audit log. That report is best effort and never blocks the download.
 */
export function CsvButton({ filename, header, rows, label = "Export CSV" }: { filename: string; header: string[]; rows: (string | number | null)[][]; label?: string }) {
  const download = () => {
    const blob = new Blob([`﻿${toCsv(header, rows)}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    void adminData.recordEvent({ action: "exported", target: filename }).catch(() => {})
  }
  return (
    <NeutralButton onClick={download} disabled={rows.length === 0}>
      <HugeiconsIcon icon={Download04Icon} className="size-4" strokeWidth={1.8} />
      {label}
    </NeutralButton>
  )
}
