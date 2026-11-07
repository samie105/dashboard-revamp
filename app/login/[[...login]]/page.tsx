"use client"

import Link from "next/link"
import * as React from "react"
import { SignIn } from "@clerk/nextjs"
import { useAuth } from "@/components/auth-provider"
import { CLERK_AFTER_SIGN_IN_URL, safeClerkRedirect } from "@/lib/clerk-config"

export default function LoginPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [redirectUrl, setRedirectUrl] = React.useState<string>()

  React.useEffect(() => {
    setRedirectUrl(safeClerkRedirect(new URLSearchParams(window.location.search).get("redirect_url"), window.location.origin))
  }, [])

  if (isLoaded && isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold">You are already signed in</h1>
          <p className="text-sm text-muted-foreground">Continue to your dashboard or sign out to use another account.</p>
          <Link href="/" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Continue to dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl ?? CLERK_AFTER_SIGN_IN_URL}
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-card border border-border/50 shadow-xl",
          },
        }}
      />
    </div>
  )
}
