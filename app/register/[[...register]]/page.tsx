"use client"

import Link from "next/link"
import { SignUp } from "@clerk/nextjs"
import { useAuth } from "@/components/auth-provider"

export default function RegisterPage() {
  const { isLoaded, isSignedIn } = useAuth()

  if (isLoaded && isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold">You are already signed in</h1>
          <p className="text-sm text-muted-foreground">Continue to your dashboard to manage your account.</p>
          <Link href="/" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Continue to dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
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
