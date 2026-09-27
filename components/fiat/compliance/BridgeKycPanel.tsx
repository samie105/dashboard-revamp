"use client"

/**
 * Bridge hosted KYC (guide §7 lines 461-501, 525-541):
 * legalName / email / country → POST kyc-link → open kycLink.url in a new
 * tab (https only, noopener,noreferrer) → "I've finished" → POST sync →
 * refetch GET /fiat/compliance.
 *
 * Renders only when /fiat/config says KYC is required for the Bridge route
 * (guide §5). It never decides whether the user is approved and never locks
 * the virtual-account action; the backend accepts or refuses that request
 * (docs/FIAT_RAMP_CONTEXT.md, "no frontend compliance gate").
 *
 * The KYC link is held in memory only: never logged, never persisted.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { FlowCta, InlineNotice } from "@/components/ui/flow"
import { Input } from "@/components/ui/input"
import {
  useFiatCompliance,
  useFinishBridgeKyc,
  useStartBridgeKyc,
} from "@/hooks/crypto/useFiatCompliance"
import {
  complianceRecordFor,
  invalidFieldsFrom,
  openKycLink,
  safeKycUrl,
  type BridgeKycInput,
} from "@/lib/crypto-backend/fiat-compliance"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"
import { ComplianceStatusList } from "./ComplianceStatusList"

const FIELD_LABEL: Record<keyof BridgeKycInput, string> = {
  legalName: "Legal name",
  email: "Email",
  country: "Country (two-letter code, e.g. US)",
}

export function BridgeKycPanel({ kycRequired }: { kycRequired: boolean }) {
  const compliance = useFiatCompliance()
  const start = useStartBridgeKyc()
  const finish = useFinishBridgeKyc()
  const [form, setForm] = React.useState<BridgeKycInput>({ legalName: "", email: "", country: "" })
  const [link, setLink] = React.useState<string | null>(null)
  const [unsafeLink, setUnsafeLink] = React.useState(false)

  if (!kycRequired) return null

  const bridgeRecord = complianceRecordFor(compliance.data, "bridge")
  const invalid = new Set(invalidFieldsFrom(start.error))
  const incomplete = !form.legalName.trim() || !form.email.trim() || !form.country.trim()
  const startError = start.error && invalid.size === 0 ? describeFiatError(start.error) : null
  const finishError = finish.error ? describeFiatError(finish.error) : null

  async function begin() {
    setLink(null)
    setUnsafeLink(false)
    const result = await start.mutateAsync(form).catch(() => null)
    if (!result) return
    const safe = safeKycUrl(result.kycLink.url)
    if (!safe) {
      setUnsafeLink(true)
      return
    }
    setLink(safe)
    openKycLink(safe)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Bridge verifies your identity before it can give you USD bank details. Verification happens on
        Bridge&apos;s own page, which opens in a new tab.
      </div>

      {bridgeRecord && <ComplianceStatusList records={[bridgeRecord]} />}

      {(Object.keys(FIELD_LABEL) as Array<keyof BridgeKycInput>).map((field) => (
        <label key={field} className="flex flex-col gap-1 text-[13px]">
          <span>{FIELD_LABEL[field]}</span>
          <Input
            value={form[field]}
            type={field === "email" ? "email" : "text"}
            autoComplete={field === "email" ? "email" : field === "legalName" ? "name" : "country"}
            maxLength={field === "country" ? 2 : undefined}
            aria-invalid={invalid.has(field) || undefined}
            disabled={start.isPending}
            onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
          />
          {invalid.has(field) && <span className="text-destructive">Check this field.</span>}
        </label>
      ))}

      {startError && (
        <InlineNotice tone="error">
          {startError.message}
          {startError.requestId ? ` Reference: ${startError.requestId}` : ""}
        </InlineNotice>
      )}
      {unsafeLink && (
        <InlineNotice tone="error">
          We couldn&apos;t open the verification page safely. Please contact support.
        </InlineNotice>
      )}

      <FlowCta
        label={start.isPending ? "Opening verification…" : incomplete ? "Fill in all three fields" : "Start verification"}
        onClick={() => void begin()}
        disabled={incomplete || start.isPending}
        busy={start.isPending}
      />

      {link && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px]">
          <span>
            Verification opened in a new tab. If it didn&apos;t open,{" "}
            <a href={link} target="_blank" rel="noopener noreferrer" className="underline">
              open it here
            </a>
            .
          </span>
          <Button variant="outline" disabled={finish.isPending} onClick={() => finish.mutate()}>
            {finish.isPending ? "Checking with Bridge…" : "I've finished"}
          </Button>
        </div>
      )}

      {finishError && (
        <InlineNotice tone="error">
          {finishError.message}
          {finishError.requestId ? ` Reference: ${finishError.requestId}` : ""}
        </InlineNotice>
      )}
    </div>
  )
}
