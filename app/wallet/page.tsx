import { notFound, redirect } from "next/navigation"
import { selfCustodyEnabled } from "@/lib/crypto/config"
import { DEV_AUTH_BYPASS } from "@/lib/dev-auth-bypass"
import { DASHBOARD_TEST_MODE } from "@/lib/dashboard-test-mode"

export default function WalletPage() {
  // Preview-branch only: this pre-redesign setup screen talks straight to the
  // crypto backend URL and hangs on localhost. The redesigned experience at
  // /wallet/modern (where the navbar links) supersedes it — send the viewer
  // there instead of showing stale skeletons.
  if (DEV_AUTH_BYPASS || DASHBOARD_TEST_MODE) redirect("/wallet/modern")
  if (!selfCustodyEnabled()) notFound()
  redirect("/wallet/modern")
}
