"use client"

/**
 * The discovery feed.
 *
 * Ranked by PROGRESS toward graduation by default, not by a "trending" score.
 * Progress is a number the chain supplies; trending is a formula nobody has
 * defined, and a launchpad that ranks on an undefined formula is one people
 * learn to game. Newest and market cap are offered because both are real too.
 *
 * "Near graduation" is its own filter because that is the moment that
 * matters most to a buyer — the last SOL before a curve fills — and it is the
 * question a feed sorted any other way makes you scroll to answer.
 */

import * as React from "react"
import { Segmented, EmptyState } from "@/components/ui/system"
import { LaunchCard } from "@/components/launchpad-unauth/launch-card"
import {
  LAUNCHES,
  viewOf,
  type LaunchView,
} from "@/components/launchpad-unauth/launch-data"
import { PREVIEW_ROUTES } from "@/components/preview/routes"

type Filter = "all" | "live" | "near" | "graduated"
type Sort = "progress" | "newest" | "cap"

/** 75% of the way there. Tunable, and a product call rather than a fact. */
const NEAR_BPS = 7500

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "On the curve" },
  { key: "near", label: "Near graduation" },
  { key: "graduated", label: "Graduated" },
]

const SORTS: { key: Sort; label: string }[] = [
  { key: "progress", label: "Progress" },
  { key: "newest", label: "Newest" },
  { key: "cap", label: "Market cap" },
]

/* "Near graduation" includes GRADUATING launches: the curve is full and the
   pool is being created, which is the far end of near. Filing them under
   "Graduated" put a card reading "Graduating" beneath a filter that said it
   was done — the label and the cards under it disagreeing. */
function isNear(v: LaunchView): boolean {
  return (
    v.status === "graduating" ||
    (v.status === "live" && v.progressBps >= NEAR_BPS)
  )
}

export function LaunchGrid() {
  const [filter, setFilter] = React.useState<Filter>("all")
  const [sort, setSort] = React.useState<Sort>("progress")
  const [query, setQuery] = React.useState("")

  const views = React.useMemo(() => LAUNCHES.map(viewOf), [])

  const counts = React.useMemo(
    () => ({
      all: views.length,
      live: views.filter((v) => v.status === "live").length,
      near: views.filter(isNear).length,
      graduated: views.filter((v) => v.status === "graduated").length,
    }),
    [views]
  )

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = views.filter((v) => {
      if (filter === "live" && v.status !== "live") return false
      if (filter === "near" && !isNear(v)) return false
      if (filter === "graduated" && v.status !== "graduated") return false
      if (!q) return true
      return (
        v.name.toLowerCase().includes(q) || v.symbol.toLowerCase().includes(q)
      )
    })
    list.sort((a, b) =>
      sort === "newest"
        ? a.minutesAgo - b.minutesAgo
        : sort === "cap"
          ? b.marketCapUsd - a.marketCapUsd
          : // Graduated launches have nothing left to fill, so they sink below
            // everything still on a curve instead of topping the list at 100%.
            Number(a.status !== "live") - Number(b.status !== "live") ||
            b.progressBps - a.progressBps
    )
    return list
  }, [views, filter, sort, query])

  return (
    <div className="flex flex-col gap-4">
      {/* The filter rail scrolls on a phone rather than wrapping: four labels
          with counts do not fit 375px, and a wrapped segmented control reads
          as two controls. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none min-w-0 overflow-x-auto">
          <Segmented
            options={FILTERS.map((f) => ({
              key: f.key,
              label: `${f.label} · ${counts[f.key]}`,
            }))}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="relative flex min-w-0 flex-1 items-center lg:w-56 lg:flex-none">
            <span className="sr-only">Search launches</span>
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground"
            >
              <circle
                cx="7"
                cy="7"
                r="4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="m10.5 10.5 3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or symbol"
              className="h-10 w-full min-w-0 rounded-full bg-foreground/[0.05] pr-3 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
          <Segmented
            size="sm"
            options={SORTS}
            value={sort}
            onChange={setSort}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description={
            query
              ? `No launch is called "${query}". Try a symbol instead.`
              : "No launch is in this state yet."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((v) => (
            <LaunchCard
              key={v.id}
              launch={v}
              href={`${PREVIEW_ROUTES.launchpad}/${v.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
