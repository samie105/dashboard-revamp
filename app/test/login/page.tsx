"use client"

import * as React from "react"

export default function DashboardTestLoginPage() {
  const [accessKey, setAccessKey] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/test/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error ?? "Could not start the test session")
      }
      const returnTo = new URL(window.location.href).searchParams.get("returnTo")
      const destination = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/"
      window.location.assign(destination)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the test session")
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">WorldStreet dashboard test</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em]">Open the full test dashboard</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This host uses a scoped dummy session instead of Clerk. OnSwitch and Bridge fiat requests still use the isolated backend configured for this test host.
        </p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="dashboard-test-access-key">Test access key</label>
          <input
            id="dashboard-test-access-key"
            name="accessKey"
            type="password"
            autoComplete="current-password"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Paste the deployment key"
            required
          />
          {error && <p role="alert" className="rounded-xl bg-debit-chip px-3 py-2.5 text-sm text-debit">{error}</p>}
          <button
            type="submit"
            disabled={submitting || accessKey.length === 0}
            className="h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Opening dashboard…" : "Continue to dashboard"}
          </button>
        </form>
        <p className="mt-5 text-xs leading-relaxed text-subtle">
          The key is only for this host and is not a Clerk user ID. Keep it private.
        </p>
      </section>
    </main>
  )
}
