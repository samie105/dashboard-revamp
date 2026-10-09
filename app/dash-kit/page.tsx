import { notFound } from "next/navigation"

import { KitGallery } from "@/app/dash-kit/gallery"

export const metadata = { title: "Redesign kit", robots: { index: false, follow: false } }

/**
 * Dev-only review page for the redesign-port kit (components/dash/). Shows
 * every piece and every state in the current theme; flip the theme toggle to
 * check the other. Not reachable in a production build.
 */
export default function DashKitPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <KitGallery />
}
