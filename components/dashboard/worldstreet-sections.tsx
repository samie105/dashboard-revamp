"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Store01Icon,
  Book01Icon,
  UserGroup02Icon,
  Video01Icon,
  Brain01Icon,
  DollarCircleIcon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"

const SECTIONS = [
  { name: "Store", url: "https://shop.worldstreetgold.com", icon: Store01Icon, external: true },
  { name: "Academy", url: "https://academy.worldstreetgold.com", icon: Book01Icon, external: true },
  { name: "Social", url: "https://social.worldstreetgold.com", icon: UserGroup02Icon, external: true },
  { name: "Xstream", url: "https://xtreme.worldstreetgold.com", icon: Video01Icon, external: true },
  { name: "Forex Trading", url: "https://trader.worldstreetgold.com", icon: DollarCircleIcon, external: true },
  { name: "Vivid AI", url: "/vivid", icon: Brain01Icon, external: false },
] as const

export function WorldStreetSections() {
  return (
    <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-border/30">
        {SECTIONS.map((section) => (
          <a
            key={section.name}
            href={section.url}
            {...(section.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group flex flex-col items-center gap-1.5 px-3 py-3.5 transition-colors hover:bg-accent/30 [&:nth-child(n+4)]:border-t [&:nth-child(n+4)]:border-border/30 sm:[&:nth-child(n+4)]:border-t-0"
          >
            <HugeiconsIcon icon={section.icon} className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="flex items-center gap-0.5 text-xs font-medium text-foreground/80 text-center leading-tight">
              {section.name}
              {section.external && (
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
              )}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
