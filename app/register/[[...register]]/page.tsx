import { SignUp } from "@clerk/nextjs"
import { redirect } from "next/navigation"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"

export default function RegisterPage() {
  // Under the dev bypass there is no ClerkProvider to render <SignUp/> inside —
  // and nothing to sign up for: every visitor is already the mock user.
  if (DEV_AUTH_BYPASS) redirect("/")
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
