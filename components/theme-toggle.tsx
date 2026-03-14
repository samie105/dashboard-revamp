"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-all duration-300 hover:text-foreground active:scale-95"
      aria-label="Toggle theme"
    >
      <HugeiconsIcon
        icon={Sun01Icon}
        className="h-4 w-4 transition-all duration-300 dark:rotate-90 dark:scale-0 dark:opacity-0"
      />
      <HugeiconsIcon
        icon={Moon02Icon}
        className="absolute h-4 w-4 -rotate-90 scale-0 opacity-0 transition-all duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
      />
    </button>
  )
}
