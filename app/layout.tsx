import { Geist, Geist_Mono, Public_Sans } from "next/font/google"

import "./globals.css"
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
import { HlWsWrapper } from "@/components/hl-ws-wrapper"

const isProduction = process.env.NODE_ENV === "production"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      {...(isProduction
        ? {
            domain: "worldstreetgold.com",
            isSatellite: true,
            signInUrl: "https://www.worldstreetgold.com/login",
          }
        : {})}
    >
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
                    <HlWsWrapper>
                      <TooltipProvider>
                        <VividVoiceProvider>
                          <TradeSelectorProvider>
                            <LayoutShell>{children}</LayoutShell>
                          </TradeSelectorProvider>
                        </VividVoiceProvider>
                      </TooltipProvider>
                    </HlWsWrapper>
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
