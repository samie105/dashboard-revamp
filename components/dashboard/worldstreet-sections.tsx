"use client"

import Link from "next/link"
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

const EXTERNAL_SECTIONS = [
  { name: "Store", url: "https://shop.worldstreetgold.com", icon: Store01Icon },
  { name: "Academy", url: "https://academy.worldstreetgold.com", icon: Book01Icon },
  { name: "Social", url: "https://social.worldstreetgold.com", icon: UserGroup02Icon },
  { name: "Xstream", url: "https://xtreme.worldstreetgold.com", icon: Video01Icon },
  { name: "Forex Trading", url: "https://trader.worldstreetgold.com", icon: DollarCircleIcon },
] as const

export function WorldStreetSections() {
  return (
    <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-border/30">
        {EXTERNAL_SECTIONS.map((section) => (
          <a
            key={section.name}
            href={section.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-1.5 px-3 py-3.5 transition-colors hover:bg-accent/30 [&:nth-child(n+4)]:border-t [&:nth-child(n+4)]:border-border/30 sm:[&:nth-child(n+4)]:border-t-0"
          >
            <HugeiconsIcon icon={section.icon} className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="flex items-center gap-0.5 text-xs font-medium text-foreground/80 text-center leading-tight">
              {section.name}
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
            </span>
          </a>
        ))}

        {/* Vivid AI — links to /vivid */}
        <Link
          href="/vivid"
          className="group flex flex-col items-center gap-1.5 px-3 py-3.5 transition-colors hover:bg-accent/30 border-t border-border/30 sm:border-t-0"
        >
          <HugeiconsIcon
            icon={Brain01Icon}
            className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors"
          />
          <span className="text-xs font-medium text-center leading-tight text-foreground/80">
            Vivid AI
          </span>
        </Link>
      </div>
    </div>
  )
}
