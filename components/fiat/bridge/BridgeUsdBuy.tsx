"use client"

/**
 * Buy → USD via a Bridge virtual account. Guide §13 "Bridge USD onramp"
 * (lines 1168-1178): verify the route is available (the caller only renders
 * this when it is) → Bridge KYC → create the virtual account → show the
 * USD ACH/wire instructions → poll the account and activity → refresh the
 * wallet balance after reconciled activity.
 *
 * No frontend compliance gate (docs/FIAT_RAMP_CONTEXT.md): the KYC panel is
 * offered when /fiat/config says KYC is required, and the backend accepts or
 * refuses the create request. Deposit instructions are rendered as returned,
 * held in memory only, never logged.
 */

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { BridgeKycPanel } from "@/components/fiat/compliance/BridgeKycPanel"
import { FiatErrorDetail } from "@/components/fiat/shared/FiatErrorDetail"
import { refreshWalletBalances } from "@/components/fiat/shared/refreshWalletBalances"
import { SensitiveValue } from "@/components/fiat/shared/SensitiveValue"
import { Button } from "@/components/ui/button"
import { DetailPanel, FlowCta, FlowSkeleton, RouteStrip } from "@/components/ui/flow"
import { Eyebrow } from "@/components/ui/system"
import { useFiatCompliance } from "@/hooks/crypto/useFiatCompliance"
import {
  useFiatVirtualAccountActivityPoll,
  useFiatVirtualAccountPoll,
} from "@/hooks/crypto/useFiatVirtualAccountPoll"
import { useCreateBridgeUsdAccount, useFiatVirtualAccounts } from "@/hooks/crypto/useFiatVirtualAccounts"
import {
  BRIDGE_VIRTUAL_ACCOUNT_NETWORK_ID,
  completedActivityIds,
  depositInstructionRows,
  hasNewCompletedDelivery,
} from "@/lib/crypto-backend/fiat-bridge-onramp"
import { complianceRecordFor, describeBridgeVirtualAccountRefusal, isBridgeKycRequired } from "@/lib/crypto-backend/fiat-compliance"
import { humanizeValue } from "@/lib/crypto-backend/fiat-display"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import type { FiatCapabilitySnapshot, FiatVirtualAccount } from "@/lib/crypto-backend/types"

export function BridgeUsdBuy({
  config,
  walletId,
}: {
  config: FiatCapabilitySnapshot
  walletId: string | undefined
}) {
  const accounts = useFiatVirtualAccounts()
  const compliance = useFiatCompliance()
  const kycRequired = isBridgeKycRequired(config, "virtual-account")
  const hasBridgeRecord = Boolean(complianceRecordFor(compliance.data, "bridge"))
  const [showKyc, setShowKyc] = React.useState<boolean | null>(null)
  // Open by default only while there's no Bridge record to show; this is
  // layout, not a gate: the section is always reachable.
  const kycOpen = showKyc ?? !hasBridgeRecord

  return (
    <div className="flex flex-col gap-4">
      <RouteStrip
        direction="in"
        from={{ label: "Your bank", sub: "USD" }}
        to={{ label: "Worldstreet wallet", sub: "USDC" }}
      />

      {kycRequired && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Identity verification</Eyebrow>
            <Button variant="ghost" size="xs" onClick={() => setShowKyc(!kycOpen)}>
              {kycOpen ? "Hide" : "Show"}
            </Button>
          </div>
          {kycOpen && <BridgeKycPanel kycRequired />}
        </div>
      )}

      {accounts.isLoading ? (
        <FlowSkeleton />
      ) : accounts.error && !accounts.data ? (
        <>
          <FiatErrorDetail error={describeFiatError(accounts.error)} />
          <FlowCta label="Try again" onClick={() => void accounts.refetch()} />
        </>
      ) : accounts.data && accounts.data.length > 0 ? (
        accounts.data.map((account) => <UsdAccount key={account.id} account={account} />)
      ) : (
        <CreateUsdAccount walletId={walletId} />
      )}
    </div>
  )
}

/* ── One virtual account: deposit details + activity ──────────────────── */

function UsdAccount({ account: listed }: { account: FiatVirtualAccount }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.userId ?? "anonymous"
  // Guide §11 lines 982-984 / §10.2 line 888: poll the account and activity.
  const accountPoll = useFiatVirtualAccountPoll(listed.id)
  const activity = useFiatVirtualAccountActivityPoll(listed.id)
  const account = accountPoll.data ?? listed
  const rows = depositInstructionRows(account)

  // Guide lines 1177-1178: refresh the wallet balance after reconciled
  // activity shows a completed delivery (providerStatus "completed", team
  // decision 2026-09-28). React Query keeps `activity.data` referentially
  // stable while nothing changes, so this only runs on real updates.
  const lastCompleted = React.useRef<Set<string> | undefined>(undefined)
  React.useEffect(() => {
    const completed = completedActivityIds(activity.data)
    if (hasNewCompletedDelivery(lastCompleted.current, completed)) refreshWalletBalances(queryClient, userId)
    if (completed) lastCompleted.current = completed
  }, [activity.data, queryClient, userId])

  return (
    <>
      <div className="flex flex-col gap-2">
        <Eyebrow>Send USD to</Eyebrow>
        {rows.length > 0 ? (
          <DetailPanel
            rows={rows.map((row) => ({
              label: row.label,
              value: <SensitiveValue value={row.value} sensitive={row.sensitive} />,
            }))}
          />
        ) : (
          <p className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] text-muted-foreground">
            Deposit details aren&apos;t available yet. We&apos;ll keep checking.
          </p>
        )}
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          USD you send here arrives as {account.asset} on {account.networkId} in your Worldstreet wallet. This is a
          deposit address for your bank transfer, not a balance.
        </p>
        <DetailPanel rows={[{ label: "Account status", value: humanizeValue(account.status) }]} />
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow>Deposits</Eyebrow>
        {activity.isLoading ? (
          <div className="h-12 animate-pulse rounded-2xl bg-foreground/[0.05]" />
        ) : activity.error && !activity.data ? (
          <FiatErrorDetail error={describeFiatError(activity.error)} />
        ) : activity.data && activity.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {activity.data.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-sunken/70 px-4 py-3 ring-1 ring-border/25"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold tabular-nums text-credit">
                    +{item.amount} {item.currency}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {[item.sourcePaymentRail?.toUpperCase(), item.occurredAt ? new Date(item.occurredAt).toLocaleString() : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{humanizeValue(item.providerStatus)}</span>
              </li>
            ))}
          </ul>
        ) : (
          // Guide lines 886-887: an empty list means no reconciled activity
          // yet, not a failed payment.
          <p className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
            No deposits yet. Bank transfers show here once they&apos;ve been received.
          </p>
        )}
      </div>
    </>
  )
}

/* ── No account yet ───────────────────────────────────────────────────── */

function CreateUsdAccount({ walletId }: { walletId: string | undefined }) {
  const create = useCreateBridgeUsdAccount()
  const networkId = BRIDGE_VIRTUAL_ACCOUNT_NETWORK_ID
  const refusal = create.error ? describeBridgeVirtualAccountRefusal(create.error) : null
  const ready = Boolean(networkId && walletId)

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>Your USD account</Eyebrow>
      <p className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Get US bank details to send USD to. What you send arrives as USDC in your Worldstreet wallet.
      </p>
      {refusal && <FiatErrorDetail error={refusal} />}
      <FlowCta
        label={
          create.isPending
            ? "Creating your USD account…"
            : !networkId
              ? "Creating a USD account isn't available yet"
              : "Create USD account"
        }
        disabled={!ready || create.isPending}
        busy={create.isPending}
        onClick={() => {
          if (networkId && walletId) create.mutate({ walletId, networkId })
        }}
      />
    </div>
  )
}
