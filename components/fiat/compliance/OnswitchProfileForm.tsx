"use client"

/**
 * OnSwitch customer profile (guide §7 lines 503-524). One input per
 * documented request field, nothing else. It never blocks the OnSwitch
 * onramp: whether a profile is required before a quote is an open question
 * (docs/FIAT_RAMP_CONTEXT.md Q7), so the Buy flow doesn't wait on it.
 * Which fields are required isn't documented either (Q21); the backend's
 * INVALID_REQUEST fieldErrors mark what's missing.
 */

import * as React from "react"

import { FlowCta, InlineNotice } from "@/components/ui/flow"
import { Input } from "@/components/ui/input"
import { useCreateOnswitchCustomer } from "@/hooks/crypto/useFiatCompliance"
import { invalidFieldsFrom, type OnswitchProfileInput } from "@/lib/crypto-backend/fiat-compliance"
import { describeFiatError } from "@/lib/crypto-backend/fiat-errors"

const FIELDS: Array<{
  key: keyof OnswitchProfileInput
  label: string
  /** Name the backend uses in fieldErrors for this input. */
  apiField: string
  type?: string
  autoComplete?: string
  maxLength?: number
}> = [
  { key: "legalName", label: "Legal name", apiField: "legalName", autoComplete: "name" },
  { key: "firstName", label: "First name", apiField: "firstName", autoComplete: "given-name" },
  { key: "lastName", label: "Last name", apiField: "lastName", autoComplete: "family-name" },
  { key: "email", label: "Email", apiField: "email", type: "email", autoComplete: "email" },
  { key: "phone", label: "Phone (with country code)", apiField: "phone", type: "tel", autoComplete: "tel" },
  { key: "country", label: "Country (two-letter code, e.g. NG)", apiField: "country", maxLength: 2 },
  { key: "birthDate", label: "Date of birth", apiField: "birthDate", type: "date", autoComplete: "bday" },
  { key: "addressCountry", label: "Address country (two-letter code)", apiField: "residentialAddress", maxLength: 2 },
  { key: "addressCity", label: "Address city", apiField: "residentialAddress", autoComplete: "address-level2" },
]

const EMPTY: OnswitchProfileInput = {
  legalName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  birthDate: "",
  addressCountry: "",
  addressCity: "",
}

export function OnswitchProfileForm() {
  const create = useCreateOnswitchCustomer()
  const [form, setForm] = React.useState<OnswitchProfileInput>(EMPTY)
  const invalid = new Set(invalidFieldsFrom(create.error))
  const error = create.error && invalid.size === 0 ? describeFiatError(create.error) : null
  const isInvalid = (apiField: string) =>
    invalid.has(apiField) || [...invalid].some((field) => field.startsWith(`${apiField}.`))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-sunken/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Your profile with OnSwitch, our local-currency payment partner. You can buy without filling this in.
      </div>

      {FIELDS.map((field) => (
        <label key={field.key} className="flex flex-col gap-1 text-[13px]">
          <span>{field.label}</span>
          <Input
            value={form[field.key]}
            type={field.type ?? "text"}
            autoComplete={field.autoComplete}
            maxLength={field.maxLength}
            aria-invalid={isInvalid(field.apiField) || undefined}
            disabled={create.isPending}
            onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
          />
          {isInvalid(field.apiField) && <span className="text-destructive">Check this field.</span>}
        </label>
      ))}

      {error && (
        <InlineNotice tone="error">
          {error.message}
          {error.requestId ? ` Reference: ${error.requestId}` : ""}
        </InlineNotice>
      )}
      {create.isSuccess && <InlineNotice className="bg-credit-chip text-credit">Profile saved.</InlineNotice>}

      <FlowCta
        label={create.isPending ? "Saving…" : "Save profile"}
        onClick={() => create.mutate(form)}
        disabled={create.isPending}
        busy={create.isPending}
      />
    </div>
  )
}
