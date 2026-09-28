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
import { AnnouncementBanner, DetailPanel, FlowCta, FlowSkeleton, RouteStrip } from "@/components/ui/flow"
import { Eyebrow } from "@/components/ui/system"
import { useFiatCompliance } from "@/hooks/crypto/useFiatCompliance"
import {
  useFiatVirtualAccountActivityPoll,
  useFiatVirtualAccountPoll,
} from "@/hooks/crypto/useFiatVirtualAccountPoll"
import { useCreateBridgeUsdAccount, useFiatVirtualAccounts } from "@/hooks/crypto/useFiatVirtualAccounts"
import {
  bridgeVirtualAccountNetworkId,
  bridgeVirtualAccountReadiness,
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
  walletNetworkIds,
  walletNetworkAddresses,
}: {
  config: FiatCapabilitySnapshot
  walletId: string | undefined
  walletNetworkIds?: readonly string[]
  walletNetworkAddresses?: Readonly<Record<string, string | undefined>>
}) {
  const accounts = useFiatVirtualAccounts()
  const compliance = useFiatCompliance()
  const kycRequired = isBridgeKycRequired(config, "virtual-account")
  const hasBridgeRecord = Boolean(complianceRecordFor(compliance.data, "bridge"))
  const [kycOpen, setKycOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-5">
      <RouteStrip
        direction="in"
        from={{ label: "Your bank", sub: "USD" }}
        to={{ label: "Worldstreet wallet", sub: "USDC" }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
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
            <CreateUsdAccount config={config} walletId={walletId} walletNetworkIds={walletNetworkIds} walletNetworkAddresses={walletNetworkAddresses} />
          )}
        </div>

        {kycRequired && (
          <aside className="rounded-2xl bg-surface-sunken/45 p-4 ring-1 ring-border/25">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow>Bridge identity check</Eyebrow>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {hasBridgeRecord
                    ? "Your Bridge record is on file. Open this section to continue or refresh verification."
                    : "Required before Bridge can issue USD bank details. OnSwitch local-currency buying does not use this check."}
                </p>
              </div>
              <Button variant="ghost" size="xs" onClick={() => setKycOpen((open) => !open)}>
                {kycOpen ? "Hide" : hasBridgeRecord ? "Review" : "Start"}
              </Button>
            </div>
            {kycOpen && (
              <div className="mt-4 border-t border-border/50 pt-4">
                <BridgeKycPanel kycRequired />
              </div>
            )}
          </aside>
        )}
      </div>
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

function CreateUsdAccount({
  config,
  walletId,
  walletNetworkIds,
  walletNetworkAddresses,
}: {
  config: FiatCapabilitySnapshot
  walletId: string | undefined
  walletNetworkIds?: readonly string[]
  walletNetworkAddresses?: Readonly<Record<string, string | undefined>>
}) {
  const create = useCreateBridgeUsdAccount()
  const readiness = bridgeVirtualAccountReadiness(config, walletId, walletNetworkAddresses)
  // Retain the explicit network helper as a compatibility fallback for a
  // rolling frontend/backend deploy where only network ids are available.
  const networkId = readiness.networkId ?? bridgeVirtualAccountNetworkId(config, walletNetworkIds)
  const refusal = create.error ? describeBridgeVirtualAccountRefusal(create.error) : null
  const ready = readiness.ready && Boolean(networkId && walletId)
  const readinessCopy = readiness.reason === "capability_unavailable"
    ? "USD deposits are not enabled for this deployment yet."
    : readiness.reason === "wallet_unavailable"
      ? "Set up your Worldstreet wallet before creating USD deposit details."
      : readiness.reason === "network_unavailable"
        ? "Bridge has not supplied a safe USDC destination network for this wallet."
        : readiness.reason === "wallet_address_unavailable"
          ? "Your wallet does not have an address on Bridge's selected USDC network yet."
          : null

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>Your USD account</Eyebrow>
      <p className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Get US bank details to send USD to. What you send arrives as USDC in your Worldstreet wallet.
      </p>
      {readinessCopy && <AnnouncementBanner title="USD deposits are unavailable" detail={readinessCopy} />}
      {refusal && <FiatErrorDetail error={refusal} />}
      <FlowCta
        label={
          create.isPending
            ? "Creating your USD account…"
            : !ready
              ? "USD account creation isn't available yet"
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
