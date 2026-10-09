"use client"

import * as React from "react"
import { BankIcon, Globe02Icon, Wallet02Icon } from "@hugeicons/core-free-icons"

import {
  Chip,
  DashScope,
  DataTable,
  EmptyPanel,
  ErrorPanel,
  GoldButton,
  MoreLink,
  NeutralButton,
  Panel,
  PanelHeader,
  SelectCards,
  SkeletonList,
  SkeletonPanel,
  StatusBadge,
  UnavailableState,
  type DataColumn,
} from "@/components/dash"

type Row = { id: string; name: string; network: string; amount: string; status: "success" | "warning" | "danger" }

// Labelled sample rows: this page exists only to review the kit's styling.
const SAMPLE: Row[] = [
  { id: "1", name: "Sample row A", network: "ethereum-mainnet", amount: "12.50", status: "success" },
  { id: "2", name: "Sample row B", network: "solana-mainnet-beta", amount: "3.10", status: "warning" },
  { id: "3", name: "Sample row C", network: "ethereum-mainnet", amount: "0.75", status: "danger" },
]
const STATUS_LABEL = { success: "Completed", warning: "Processing", danger: "Failed" } as const

const COLUMNS: DataColumn<Row>[] = [
  { key: "name", header: "Item", cell: (r) => <span className="font-semibold">{r.name}</span> },
  { key: "network", header: "Network", cell: (r) => <span className="text-muted-foreground">{r.network}</span>, showFrom: "lg" },
  { key: "status", header: "Status", cell: (r) => <StatusBadge tone={r.status} label={STATUS_LABEL[r.status]} /> },
  { key: "amount", header: "Amount", align: "right", cell: (r) => r.amount },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

export function KitGallery() {
  const [method, setMethod] = React.useState<"a" | "b" | "c">("a")
  const [tableState, setTableState] = React.useState<"rows" | "loading" | "empty" | "error">("rows")

  return (
    <DashScope className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 p-4 md:p-6">
      <div className="flex items-center gap-2.5 px-1">
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em]">Redesign kit</h1>
        <Chip>Dev only</Chip>
      </div>

      <Section title="Panel">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="flex flex-col gap-4 p-5">
            <PanelHeader title="Panel title" subtitle="Subtitle in muted text" action={<MoreLink href="#">View all</MoreLink>} />
            <p className="font-display text-[32px] font-semibold tracking-[-0.03em] tabular-nums">1,234.56</p>
            <div className="ds-well rounded-2xl px-4 py-3 text-[13px] text-muted-foreground">A well inside a panel</div>
          </Panel>
          <Panel lift className="flex flex-col gap-2 p-5">
            <PanelHeader title="Lifts on hover" />
            <p className="text-[13px] text-muted-foreground">For cards that are links.</p>
          </Panel>
        </div>
      </Section>

      <Section title="Buttons">
        <Panel className="flex flex-wrap items-center gap-3 p-5">
          <GoldButton>Primary action</GoldButton>
          <GoldButton busy>Working…</GoldButton>
          <GoldButton disabled>Enter an amount</GoldButton>
          <NeutralButton>Secondary</NeutralButton>
          <NeutralButton disabled>Disabled</NeutralButton>
          <GoldButton size="lg" fullWidth>Full-width large</GoldButton>
        </Panel>
      </Section>

      <Section title="Selectable cards">
        <Panel className="p-5">
          <SelectCards
            label="Sample choice"
            value={method}
            onChange={setMethod}
            options={[
              { key: "a", label: "Option A", detail: "Describes itself", icon: Wallet02Icon, meta: "Meta" },
              { key: "b", label: "Option B", detail: "Second choice", icon: BankIcon },
              { key: "c", label: "Option C", detail: "Not available", icon: Globe02Icon, disabled: true, disabledLabel: "Soon" },
            ]}
          />
        </Panel>
      </Section>

      <Section title="Status badges">
        <Panel className="flex flex-wrap gap-2 p-5">
          <StatusBadge tone="success" label="Completed" />
          <StatusBadge tone="info" label="Processing" />
          <StatusBadge tone="warning" label="Under review" />
          <StatusBadge tone="danger" label="Failed" />
          <StatusBadge tone="neutral" label="Expired" />
          <Chip>Neutral chip</Chip>
        </Panel>
      </Section>

      <Section title="Table → cards on phones (resize below 768px)">
        <Panel className="flex flex-col gap-3 px-0 pb-2 pt-5">
          <div className="flex flex-wrap gap-2 px-5">
            {(["rows", "loading", "empty", "error"] as const).map((s) => (
              <NeutralButton key={s} onClick={() => setTableState(s)} className={tableState === s ? "border-primary/50 text-primary" : ""}>
                {s}
              </NeutralButton>
            ))}
          </div>
          <DataTable
            label="Sample table"
            rows={tableState === "rows" ? SAMPLE : tableState === "empty" ? [] : undefined}
            loading={tableState === "loading"}
            error={tableState === "error" ? "The request didn't complete." : undefined}
            onRetry={() => setTableState("rows")}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            empty={{ title: "Nothing here yet", description: "Items appear here once there are some." }}
            card={(r) => (
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col gap-1">
                  <span className="text-[13.5px] font-semibold">{r.name}</span>
                  <StatusBadge tone={r.status} label={STATUS_LABEL[r.status]} />
                </span>
                <span className="text-[13.5px] font-semibold tabular-nums">{r.amount}</span>
              </div>
            )}
          />
        </Panel>
      </Section>

      <Section title="Skeletons">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="p-5"><SkeletonPanel /></Panel>
          <Panel className="p-3"><SkeletonList rows={3} /></Panel>
        </div>
      </Section>

      <Section title="States">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel><ErrorPanel message="We couldn't reach the service. Check your connection and try again." onRetry={() => undefined} reference="req_0000" /></Panel>
          <Panel><EmptyPanel title="No activity yet" description="It shows here once something happens. This isn't an error." /></Panel>
          <Panel><UnavailableState title="Not available right now" description="This is switched off for your account." /></Panel>
        </div>
        <Panel><UnavailableState paused title="Temporarily paused" description="Try again a little later." compact /></Panel>
      </Section>
    </DashScope>
  )
}
