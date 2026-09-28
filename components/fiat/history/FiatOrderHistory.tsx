"use client"

/**
 * Fiat order history and recovery.
 *
 * The list is deliberately built from the backend's user-scoped order
 * resource. Provider display blobs are never rendered here; only normalized
 * order fields and the safe crypto-intent summary are shown.
 */

import * as React from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { Button } from "@/components/ui/button"
import { CardHeader, CardShell, EmptyState, SectionRule, SkeletonRows } from "@/components/ui/system"
import { useFiatOrderPoll } from "@/hooks/crypto/useFiatOrderPoll"
import { useFiatOrders } from "@/hooks/crypto/useFiatOrders"
import {
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import { FIAT_ORDER_PAUSE_STATES, FIAT_ORDER_TERMINAL_STATES } from "@/lib/crypto-backend/fiat-poll-schedule"
import type { FiatOrder } from "@/lib/crypto-backend/types"
import { savePendingFlow, type PendingFlowKind } from "@/lib/pending-flow"
import { CARD_HUE } from "@/components/ui/surface"

const FIAT_HISTORY_LIMIT = 50

function providerLabel(provider: FiatOrder["provider"]): string {
  return provider === "bridge" ? "Bridge" : "OnSwitch"
}

function directionLabel(order: FiatOrder): string {
  if (order.direction === "onramp") return `Buy ${order.asset} with ${order.currency}`
  return `Sell ${order.asset} for ${order.currency}`
}

function stateLabel(state: string): string {
  return state
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function stateClass(state: string): string {
  if (state === "completed") return "bg-foreground/[0.07] text-muted-foreground"
  if (FIAT_ORDER_TERMINAL_STATES.has(state)) return "bg-debit-chip text-debit"
  if (FIAT_ORDER_PAUSE_STATES.has(state)) return "bg-warning-chip text-warning"
  return "bg-warning-chip text-warning"
}

function formatAmount(value: string | undefined, currency: string): string | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${value} ${currency}`
  return `${parsed.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${currency}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Date unavailable"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function recoveryFor(order: FiatOrder): { kind: PendingFlowKind; href: string; label: string } | null {
  if (FIAT_ORDER_TERMINAL_STATES.has(order.state) || FIAT_ORDER_PAUSE_STATES.has(order.state)) return null
  if (order.provider === "bridge" && order.direction === "offramp") {
    return { kind: "fiat-bridge-sell", href: "/sell", label: "Continue USD withdrawal" }
  }
  if (order.provider === "onswitch" && order.direction === "offramp") {
    return { kind: "fiat-sell", href: "/sell", label: "Continue local withdrawal" }
  }
  if (order.provider === "onswitch" && order.direction === "onramp") {
    return { kind: "fiat-buy", href: "/buy", label: "Continue fiat deposit" }
  }
  return null
}

export function FiatOrderHistory() {
  const { isLoaded, isSignedIn } = useAuth()
  const orders = useFiatOrders(FIAT_HISTORY_LIMIT)

  if (!isCryptoBackendEnabled || !isLoaded || !isSignedIn) return null

  const sortedOrders = [...(orders.data ?? [])].sort(
    (a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt),
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionRule label="Fiat orders" note="Provider status and recovery" />
      <CardShell className={CARD_HUE}>
        <CardHeader
          title="Fiat orders"
          subtitle={orders.isLoading ? "Loading…" : `${sortedOrders.length} ${sortedOrders.length === 1 ? "order" : "orders"}`}
          right={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void orders.refetch()}
            >
              Refresh
            </Button>
          }
        />

        {orders.isLoading ? (
          <SkeletonRows rows={4} label="Loading fiat orders" />
        ) : orders.error ? (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <FiatErrorDetail error={describeFiatError(orders.error)} />
            <Button variant="outline" className="self-start" onClick={() => void orders.refetch()}>Try again</Button>
          </div>
        ) : sortedOrders.length === 0 ? (
          <EmptyState
            title="No fiat orders yet"
            description="OnSwitch and Bridge deposits or withdrawals will appear here once you start one."
            ctas={[{ label: "Start a fiat flow", href: "/buy" }]}
          />
        ) : (
          <div className="flex flex-col">
            {sortedOrders.map((order) => <FiatOrderRow key={order.id} order={order} />)}
          </div>
        )}
      </CardShell>
    </div>
  )
}

function FiatOrderRow({ order }: { order: FiatOrder }) {
  const router = useRouter()
  const [expanded, setExpanded] = React.useState(false)
  const detail = useFiatOrderPoll(expanded ? order.id : undefined)
  const current = detail.data ?? order
  const recovery = recoveryFor(current)
  const expected = formatAmount(current.expectedDepositAmount, current.currency)
  const observed = formatAmount(current.observedDepositAmount, current.asset)
  const reason = current.failureReason ?? current.reviewReason ?? current.refundReason

  function continueOrder() {
    if (!recovery) return
    savePendingFlow(recovery.kind, current.id)
    router.push(recovery.href)
  }

  return (
    <div className="border-t border-border/10 first:border-t-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/25"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold ${current.direction === "onramp" ? "bg-credit-chip text-credit" : "bg-debit-chip text-debit"}`}>
          {current.direction === "onramp" ? "↓" : "↑"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold">{directionLabel(current)}</span>
          <span className="truncate text-[12.5px] text-muted-foreground">
            {[providerLabel(current.provider), current.channel, formatDate(current.updatedAt || current.createdAt)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-[12.5px] tabular-nums text-muted-foreground sm:block">
          {expected ?? observed ?? "—"}
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${stateClass(current.state)}`}>
          {stateLabel(current.state)}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border/10 bg-foreground/[0.02] px-4 py-4">
          {detail.isLoading && <p className="text-[12.5px] text-muted-foreground">Refreshing this order…</p>}
          {Boolean(detail.error) && <FiatErrorDetail error={describeFiatError(detail.error)} />}

          <dl className="grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
            <OrderDetail label="Reference" value={current.publicReference} />
            <OrderDetail label="Created" value={formatDate(current.createdAt)} />
            <OrderDetail label="Network" value={current.network} />
            <OrderDetail label="Asset" value={current.asset} />
            <OrderDetail label="Currency" value={current.currency} />
            <OrderDetail label="Payment rail" value={current.channel} />
            {expected && <OrderDetail label="Expected fiat deposit" value={expected} />}
            {observed && <OrderDetail label="Observed crypto deposit" value={observed} />}
            {current.observedDepositTxHash && <OrderDetail label="Deposit transaction" value={current.observedDepositTxHash} />}
          </dl>

          {reason && <p className="text-[12.5px] text-muted-foreground">{reason}</p>}

          {recovery && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={continueOrder}>{recovery.label}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrderDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 border-b border-border/10 pb-1.5 last:border-0 sm:justify-start sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium sm:text-left">{value}</dd>
    </div>
  )
}
