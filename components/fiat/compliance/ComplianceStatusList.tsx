"use client"

/**
 * Read-only compliance state (guide §7). Display only: nothing here decides
 * whether the user is approved (docs/FIAT_RAMP_CONTEXT.md, "no frontend
 * compliance gate"). The provider customer id is never rendered; the view
 * model from describeComplianceRecord doesn't carry it.
 */

import { DetailPanel } from "@/components/ui/flow"
import { describeComplianceRecord } from "@/lib/crypto-backend/fiat-compliance"
import type { FiatCustomer } from "@/lib/crypto-backend/types"

const PROVIDER_LABEL: Record<FiatCustomer["provider"], string> = {
  bridge: "Bridge (USD)",
  onswitch: "OnSwitch (local currency)",
}

const humanize = (value: string | null | undefined) => value?.replace(/_/g, " ") || "Unavailable"

export function ComplianceStatusList({ records }: { records: FiatCustomer[] | undefined }) {
  if (!records || records.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No verification on file yet.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => {
        const view = describeComplianceRecord(record)
        return (
          <div key={view.provider}>
            <p className="mb-1 text-[13px] font-medium">{PROVIDER_LABEL[view.provider]}</p>
            <DetailPanel
              rows={[
                { label: "Status", value: humanize(view.status) },
                { label: "Identity check", value: humanize(view.kycStatus) },
                { label: "Terms", value: humanize(view.tosStatus) },
                ...view.endorsements.map((endorsement) => ({
                  label: `Endorsement: ${humanize(endorsement.name)}`,
                  value: humanize(endorsement.status),
                })),
                ...(view.lastSyncedAt
                  ? [{ label: "Last checked", value: new Date(view.lastSyncedAt).toLocaleString() }]
                  : []),
              ]}
            />
          </div>
        )
      })}
    </div>
  )
}
