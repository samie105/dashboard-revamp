/**
 * Type for the dashboard preview.
 *
 * Scoped to this page on purpose: the rest of the app still speaks Public Sans
 * and Poppins, and the redesign should be judged without dragging every other
 * screen along with it. If it is adopted, these move to app/layout.tsx.
 *
 *  · Plus Jakarta Sans — the interface voice. Geometric enough to feel
 *    engineered, open enough to stay legible at 12px, and it ships real
 *    tabular figures, which a table of balances cannot do without.
 *  · Sora — the display voice for greetings and headline figures. Wide,
 *    crisp terminals; a big balance set in it reads as an instrument rather
 *    than a paragraph.
 */

import { Plus_Jakarta_Sans, Sora } from "next/font/google"

export const dashSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dash-sans",
  display: "swap",
})

export const dashDisplay = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dash-display",
  display: "swap",
})
