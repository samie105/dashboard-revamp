import type { Metadata, Viewport } from "next"
import { Geist_Mono, Poppins, Public_Sans } from "next/font/google"

import "./globals.css"

// Same lockup and mark the other ecosystem apps declare (see
// worldstreet-academy/app/layout.tsx) so the tab icon is identical everywhere.
export const metadata: Metadata = {
  title: {
    default: "WorldStreet",
    template: "%s | WorldStreet",
  },
  description:
    "Trade, swap, and manage multi-chain crypto, cash, and your Worldstreet portfolio in one dashboard.",
  icons: {
    icon: "/worldstreet-logo/WorldStreet1.png",
    apple: "/worldstreet-logo/WorldStreet1.png",
  },
}

// Pinch-zoom stays ENABLED. Locking it (maximumScale 1 / userScalable false)
// is a WCAG 1.4.4 failure, and the reason people reach for it — iOS zooming in
// when a sub-16px input takes focus — does not apply here: Input is
// `text-base md:text-sm`, so every field is already 16px on a phone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
}
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";
import { ProfileProvider } from "@/components/profile-provider"
import { AuthProvider } from "@/components/auth-provider"
import { AuthGate } from "@/components/auth-gate"
import { WalletProvider } from "@/components/wallet-provider"
import { WalletModeProvider } from "@/components/wallet-mode-provider"
import { UiModeProvider } from "@/components/ui-mode-provider"
import { CryptoQueryProvider } from "@/components/crypto/query-provider"
import { CryptoProvider } from "@/components/crypto/CryptoProvider"


const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'})

// The display/brand voice — the mobile app's `fonts.display*` (Poppins).
// Headlines and hero figures lead with it; body/labels stay Public Sans.
// 300 is load-bearing: the design system's hero Balance is Poppins LIGHT —
// without this weight the browser substitutes 600 and the figure turns bold.
// 500 is load-bearing too: the dashboard total sits between the light hero
// cut and Semibold, and without the real Medium the browser snaps 500 to one
// of its neighbours or fakes it.
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "500", "600", "700", "800"], variable: "--font-display" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { LayoutShell } from "@/components/layout-shell"
import { VividVoiceProvider } from "@/components/vivid-provider"
import { LocalClerkConfigurationNotice } from "@/components/auth/local-clerk-configuration-notice"
import { ConditionalClerkProvider } from "@/components/conditional-clerk-provider"

// The satellite must receive the public key explicitly. Reading it in the
// server layout also lets a container platform inject the value at runtime;
// relying on Clerk's implicit client-side env lookup can leave useUser() in an
// endless `isLoaded === false` state when the dashboard was built without the
// public build argument.
export const dynamic = "force-dynamic"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const clerkPublishableKey = process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] ?? ""

  return (
    // The dashboard is a Clerk satellite in production: sign-in happens on
    // www.worldstreetgold.com and the authenticated session returns here.
    // Local/test deployments can remain a primary app through the host-aware
    // config in lib/clerk-config.ts.
    <ConditionalClerkProvider publishableKey={clerkPublishableKey}>
      <html
        lang="en"
        suppressHydrationWarning
        className={cn("antialiased", fontMono.variable, "font-sans", publicSans.variable, poppins.variable)}
      >
        <body>
          <LocalClerkConfigurationNotice />
          <ThemeProvider>
            <CryptoQueryProvider>
              <ProfileProvider>
                <AuthProvider>
                  <CryptoProvider>
                    <AuthGate>
                      <WalletProvider>
                      <WalletModeProvider>
                      {/* Simple/Pro sits inside AuthProvider (it keys the
                          preference by user) and outside LayoutShell, because
                          /trade is full-bleed and renders outside the shell's
                          sidebar branch but still reads the mode. */}
                      <UiModeProvider>

                      <TooltipProvider>
                        <VividVoiceProvider>
                            <LayoutShell>{children}</LayoutShell>
                        </VividVoiceProvider>
                      </TooltipProvider>

                      </UiModeProvider>
                      </WalletModeProvider>
                      </WalletProvider>
                    </AuthGate>
                  </CryptoProvider>
                </AuthProvider>
              </ProfileProvider>
            </CryptoQueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConditionalClerkProvider>
  )
}
