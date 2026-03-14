"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const activityData = [
  { date: "Jan", value: 2400 },
  { date: "Feb", value: 3200 },
  { date: "Mar", value: 2800 },
  { date: "Apr", value: 4100 },
  { date: "May", value: 3600 },
  { date: "Jun", value: 5200 },
  { date: "Jul", value: 4800 },
  { date: "Aug", value: 6100 },
  { date: "Sep", value: 5400 },
  { date: "Oct", value: 7200 },
  { date: "Nov", value: 6800 },
  { date: "Dec", value: 8400 },
]

const timeRanges = ["7D", "1M", "3M", "1Y", "ALL"] as const

export function ActivityChart() {
  const [activeRange, setActiveRange] = React.useState<(typeof timeRanges)[number]>("1Y")

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">Portfolio Activity</h3>
          <p className="text-xs text-muted-foreground">Your portfolio performance over time</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background p-0.5">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeRange === range
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activityData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.795 0.184 86.047)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.795 0.184 86.047)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 5%)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "oklch(0.547 0.021 43.1)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "oklch(0.547 0.021 43.1)" }}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.214 0.009 43.1)",
                border: "1px solid oklch(1 0 0 / 10%)",
                borderRadius: "10px",
                fontSize: 12,
                color: "oklch(0.986 0.002 67.8)",
              }}
              formatter={(value) => [`$${Number(value).toLocaleString()}`, "Value"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="oklch(0.795 0.184 86.047)"
              strokeWidth={2}
              fill="url(#activityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
