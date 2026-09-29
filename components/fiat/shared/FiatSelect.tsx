"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type FiatSelectOption = { value: string; label: string; meta?: string; flag?: string }

function CountryFlag({ flag }: { flag?: string }) {
  const [failed, setFailed] = React.useState(false)
  if (!flag) return null
  const code = Array.from(flag).map((letter) => String.fromCharCode((letter.codePointAt(0) ?? 0) - 127397)).join("").toLowerCase()
  if (!/^[a-z]{2}$/.test(code) || failed) return <span aria-hidden>{/^[a-z]{2}$/.test(code) ? code.toUpperCase() : flag}</span>
  // Flag images render consistently on Windows.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/w40/${code}.png`} width={24} height={18} alt="" className="h-[18px] w-6 shrink-0 rounded-sm object-cover" onError={() => setFailed(true)} />
}

export function FiatSelect({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: FiatSelectOption[]; onChange: (value: string) => void; disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const id = React.useId()
  const selected = options.find((option) => option.value === value)
  const filtered = options.filter((option) => `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="min-w-0 space-y-2">
    <span id={id} className="block text-xs font-semibold text-muted-foreground">{label}</span>
    <Popover open={open} onOpenChange={(next) => { setOpen(next); setSearch("") }}>
      <PopoverTrigger disabled={disabled || options.length === 0} aria-labelledby={id} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-left text-sm outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
        <CountryFlag key={selected?.flag} flag={selected?.flag} />
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{selected?.label ?? `Choose ${label.toLowerCase()}`}</span>{selected?.meta && <span className="block truncate text-xs text-muted-foreground">{selected.meta}</span>}</span>
        <span aria-hidden className="text-muted-foreground">⌄</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] min-w-56 max-w-[calc(100vw-32px)] border border-border bg-card p-2 shadow-2xl">
        {options.length > 6 && <input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" />}
        <div className="max-h-64 overflow-y-auto" aria-label={label}>
          {filtered.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => { onChange(option.value); setOpen(false) }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary ${option.value === value ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            <CountryFlag flag={option.flag} /><span className="min-w-0 flex-1"><span className="block font-medium">{option.label}</span>{option.meta && <span className="block text-xs text-muted-foreground">{option.meta}</span>}</span>{option.value === value && <span aria-hidden>✓</span>}
          </button>)}
          {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matches. Try another name.</p>}
        </div>
      </PopoverContent>
    </Popover>
  </div>
}
