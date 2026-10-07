"use client"

/**
 * A table on desktop, a card list on phones — the previews' pattern. Columns
 * can join progressively (`showFrom`), so a wide screen gets more detail
 * without the phone layout changing. Loading, error and empty are part of
 * the component, so a ported table can't forget them.
 */

import * as React from "react"

import { EmptyPanel, ErrorPanel, SkeletonBlock, SkeletonList } from "@/components/dash/states"
import { columnVisibility, type Breakpoint } from "@/lib/dash-ui"
import { cn } from "@/lib/utils"

export interface DataColumn<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  align?: "left" | "right"
  /** Only shown from this breakpoint up. */
  showFrom?: Breakpoint
  className?: string
}

export function DataTable<T>({
  label,
  rows,
  columns,
  rowKey,
  card,
  onRowClick,
  loading = false,
  error,
  onRetry,
  empty,
  skeletonRows = 4,
}: {
  /** Accessible name for the table. */
  label: string
  rows: readonly T[] | undefined
  columns: DataColumn<T>[]
  rowKey: (row: T) => string
  /** The phone layout for one row. */
  card: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  loading?: boolean
  /** A message to show instead of the rows; pair with onRetry. */
  error?: React.ReactNode
  onRetry?: () => void
  /** What to say when there are no rows. */
  empty: { title: string; description?: React.ReactNode; action?: React.ReactNode }
  skeletonRows?: number
}) {
  if (loading && !rows) {
    return (
      <>
        <div role="status" aria-busy="true" aria-label={`Loading ${label}`} className="hidden md:block">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <div key={i} className="ds-cell flex items-center gap-4 px-6 py-4" style={{ opacity: 1 - i * 0.15 }}>
              <SkeletonBlock className="size-9 shrink-0 rounded-full" />
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="ml-auto h-3 w-20" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
          ))}
        </div>
        <SkeletonList rows={skeletonRows} label={`Loading ${label}`} className="md:hidden" />
      </>
    )
  }
  if (error && !rows) return <ErrorPanel message={error} onRetry={onRetry} compact />
  if (!rows || rows.length === 0) return <EmptyPanel title={empty.title} description={empty.description} action={empty.action} compact />

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table aria-label={label} className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[12px] text-muted-foreground">
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "py-3 pr-4 font-medium",
                    i === 0 && "pl-6",
                    i === columns.length - 1 && "pr-6",
                    c.align === "right" && "text-right",
                    columnVisibility(c.showFrom),
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[13.5px] tabular-nums">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "ds-cell pr-4",
                      i === 0 && "pl-6",
                      i === columns.length - 1 && "pr-6",
                      c.align === "right" && "text-right",
                      columnVisibility(c.showFrom),
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={label} className="flex flex-col md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="border-t border-foreground/[0.06] first:border-t-0">
            {onRowClick ? (
              <button type="button" onClick={() => onRowClick(row)} className="w-full rounded-xl px-2 py-3 text-left transition-colors hover:bg-foreground/[0.025]">
                {card(row)}
              </button>
            ) : (
              <div className="px-2 py-3">{card(row)}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
