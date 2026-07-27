import type { Viewport } from "next"
import { Geist, Geist_Mono, Public_Sans } from "next/font/google"

import "./globals.css"

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

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

import { TooltipProvider } from "@/components/ui/tooltip"
import { LayoutShell } from "@/components/layout-shell"
import { TradeSelectorProvider } from "@/components/trade-selector"
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
        className={cn("antialiased", fontMono.variable, "font-sans", publicSans.variable)}
      >
        <body>
          <ThemeProvider>
            <ProfileProvider>
              <AuthProvider>
                <AuthGate>
                  <WalletProvider>
                    
                      <TooltipProvider>
                        <VividVoiceProvider>
                          <TradeSelectorProvider>
                            <LayoutShell>{children}</LayoutShell>
                          </TradeSelectorProvider>
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
