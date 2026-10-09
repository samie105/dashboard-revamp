/**
 * The redesign's one surface: hairline-rimmed, top-lit in dark, softly
 * lifted in light (.ds-panel in globals.css, built on --card).
 */

import * as React from "react"

import { cn } from "@/lib/utils"

export function Panel({
  as: Tag = "section",
  lift = false,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "li"; lift?: boolean }) {
  return (
    <Tag className={cn("ds-panel relative rounded-[20px]", lift && "ds-lift", className)} {...rest}>
      {children}
    </Tag>
  )
}

export function PanelTitle({ as: Tag = "h2", className, children }: { as?: "h2" | "h3"; className?: string; children: React.ReactNode }) {
  return <Tag className={cn("font-display text-[16px] font-semibold tracking-[-0.01em] text-foreground", className)}>{children}</Tag>
}

/** A panel header row: title (+ optional subtitle) on the left, an action on the right. */
export function PanelHeader({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <PanelTitle>{title}</PanelTitle>
        {subtitle && <p className="text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
