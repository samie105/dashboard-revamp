"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Dark only, on purpose.
 *
 * The signature of this product is its atmosphere — the silk WebGL field, the
 * film grain, the ambient gold glow — and every bit of it is dark-only. Light
 * mode could never be the same product, just a quieter copy of it, and keeping
 * two modes honest doubled the design surface of every change.
 *
 * NOTHING about light mode has been deleted. The `:root` light token block, the
 * `.light` palettes and all 30-odd `dark:` variants are exactly where they
 * were, and the shared design-tokens package still ships both modes for the
 * satellite apps (Academy, Shop, Social) where light genuinely earns its place.
 *
 * To bring the switch back:
 *   1. Drop `forcedTheme` below and restore `defaultTheme="system"` +
 *      `enableSystem`.
 *   2. Re-mount <ThemeToggle /> in components/navbar.tsx.
 *   3. Optionally restore the "d" hotkey (see git history for ThemeHotkey).
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      // forcedTheme pins the class on <html> and makes setTheme a no-op, so a
      // stale "light" in localStorage from before this change can't resurface.
      forcedTheme="dark"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
