"use client"

import * as React from "react"
import Link from "next/link"

import { useAdminAuth } from "@/components/admin/admin-auth"

export default function AdminLoginPage() {
  const { admin, requestAccessLink } = useAdminAuth()
  const [email, setEmail] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestAccessLink(email)
      setSubmitted(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The access link could not be requested.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-[420px] rounded-3xl border border-foreground/[0.08] bg-card p-6 shadow-xl md:p-8">
        <div className="mb-8 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">WorldStreet Admin</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-foreground">Sign in securely</h1>
          <p className="text-sm leading-6 text-muted-foreground">Use the email address that was invited to the operations console. No customer account is required.</p>
        </div>

        {admin ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">You are signed in as <span className="font-semibold text-foreground">{admin.email}</span>.</p>
            <Link href="/admin" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open console</Link>
          </div>
        ) : submitted ? (
          <div className="space-y-4" role="status">
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.07] p-4 text-sm leading-6 text-foreground">If this email is eligible, a one-time sign-in link has been sent. It expires shortly and can only be used once.</div>
            <button type="button" onClick={() => setSubmitted(false)} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">Use another email</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
              Admin email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 rounded-xl border border-foreground/[0.1] bg-background px-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary/60" />
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-debit">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-wait disabled:opacity-60">
              {busy ? "Sending link…" : "Email me a sign-in link"}
            </button>
          </form>
        )}

        <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-muted-foreground hover:text-foreground">Back to WorldStreet</Link>
      </section>
    </main>
  )
}

