import { SignIn } from "@clerk/nextjs"
import { redirect } from "next/navigation"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"

export default function LoginPage() {
  // Under the dev bypass there is no ClerkProvider to render <SignIn/> inside —
  // and nothing to sign in to: every visitor is already the mock user.
  if (DEV_AUTH_BYPASS) redirect("/")
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
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
