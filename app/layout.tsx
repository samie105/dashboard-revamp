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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs"
import { ProfileProvider } from "@/components/profile-provider"
import { AuthProvider } from "@/components/auth-provider"
import { AuthGate } from "@/components/auth-gate"
import { WalletProvider } from "@/components/wallet-provider"


const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'})

// The display/brand voice — the mobile app's `fonts.display*` (Poppins).
// Headlines and hero figures lead with it; body/labels stay Public Sans.
// 300 is load-bearing: the design system's hero Balance is Poppins LIGHT —
// without this weight the browser substitutes 600 and the figure turns bold.
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "600", "700", "800"], variable: "--font-display" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { LayoutShell } from "@/components/layout-shell"
import { VividVoiceProvider } from "@/components/vivid-provider"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // This app IS www.worldstreetgold.com — the PRIMARY Clerk domain, where
    // sign-in actually happens. It must NOT declare isSatellite/domain: doing
    // so made it a satellite of itself, so Clerk waited forever on a handshake
    // with a primary that was this very app. `useUser().isLoaded` never flipped
    // true and every visit hung on "Verifying identity…". Satellite config
    // belongs only on academy/vision/arcade, which point back here.
    <ClerkProvider signInUrl="/login" signUpUrl="/register">
      <html
        lang="en"
        suppressHydrationWarning
        className={cn("antialiased", fontMono.variable, "font-sans", publicSans.variable, poppins.variable)}
      >
        <body>
          <ThemeProvider>
            <ProfileProvider>
              <AuthProvider>
                <AuthGate>
                  <WalletProvider>
                    
                      <TooltipProvider>
                        <VividVoiceProvider>
                            <LayoutShell>{children}</LayoutShell>
                        </VividVoiceProvider>
                      </TooltipProvider>
                    
                  </WalletProvider>
                </AuthGate>
              </AuthProvider>
            </ProfileProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
