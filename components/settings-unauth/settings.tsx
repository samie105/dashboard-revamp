"use client"

/**
 * Settings — the whole account, in eight sections.
 *
 *   Profile · Security · Verification · Notifications · Preferences ·
 *   Sessions · Payout accounts · Account
 *
 * One section at a time, picked from a left-hand menu on wide screens and a
 * ViewSelect dropdown on a phone (the same control the trading and dashboard
 * panels use). The section is in the URL (`?section=security`), so the
 * account menu's Profile / Security / Verification links land on the right
 * one, and the back button walks back through what you visited.
 *
 * Switches save the moment they flip (with a "Saved" confirmation); text
 * fields save behind an explicit Save bar, because a half-typed username
 * shouldn't commit itself. Everything persists in localStorage via
 * settings-store.ts — and nothing leaves the browser.
 */

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  BankIcon,
  CheckmarkBadge01Icon,
  ComputerIcon,
  Copy01Icon,
  FingerPrintIcon,
  Key01Icon,
  LockPasswordIcon,
  Logout01Icon,
  Mail01Icon,
  Notification02Icon,
  Settings01Icon,
  Shield01Icon,
  SmartPhone01Icon,
  Tick02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { resetSettings, updateSettings, useSettings, type Channel, type NotifyKey, type Settings } from "@/components/settings-unauth/settings-store"
import { Icon, Panel, PanelTitle, SLIDE, ViewSelect, type IconSvg } from "@/components/redesign/ui"

/* ── Sections ─────────────────────────────────────────────────────────── */

import type { SectionKey } from "@/components/settings-unauth/sections"

const SECTIONS: { key: SectionKey; label: string; hint: string; icon: IconSvg }[] = [
  { key: "profile", label: "Profile", hint: "Name, username, region", icon: UserIcon },
  { key: "security", label: "Security", hint: "2FA, passkeys, whitelist", icon: Shield01Icon },
  { key: "verification", label: "Verification", hint: "Identity and limits", icon: CheckmarkBadge01Icon },
  { key: "notifications", label: "Notifications", hint: "What reaches you, and how", icon: Notification02Icon },
  { key: "preferences", label: "Preferences", hint: "Currency, language, trading", icon: Settings01Icon },
  { key: "sessions", label: "Sessions", hint: "Where you're signed in", icon: ComputerIcon },
  { key: "payouts", label: "Payout accounts", hint: "Where cash-outs land", icon: BankIcon },
  { key: "account", label: "Account", hint: "Export data, close account", icon: Alert02Icon },
]

/* ── Saved toast ──────────────────────────────────────────────────────── */

const ToastContext = React.createContext<(msg: string) => void>(() => {})
const useToast = () => React.useContext(ToastContext)

/* ── Primitives ───────────────────────────────────────────────────────── */

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60",
        on ? "border-primary bg-primary" : "border-white/[0.12] bg-white/[0.06]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 36 }}
        className={cn("absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.4)]", on ? "right-[2px] bg-primary-foreground" : "left-[2px] bg-foreground/85")}
      />
    </button>
  )
}

function Row({ icon, title, body, status, children }: { icon?: IconSvg; title: string; body?: React.ReactNode; status?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.05] px-5 py-4 first:border-t-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        {icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-foreground/80">
            <Icon icon={icon} className="size-[18px]" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-foreground">
            {title}
            {status}
          </span>
          {body && <span className="text-[12.5px] leading-relaxed text-muted-foreground">{body}</span>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 sm:justify-end">{children}</div>}
    </div>
  )
}

function Chip({ tone, children }: { tone: "good" | "warn" | "muted"; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]", tone === "good" ? "bg-credit/[0.12] text-credit" : tone === "warn" ? "bg-warning/[0.12] text-warning" : "bg-white/[0.07] text-muted-foreground")}>
      {children}
    </span>
  )
}

function GhostButton({ children, onClick, danger }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-9 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors", danger ? "border-debit/30 text-debit hover:bg-debit/[0.08]" : "border-white/[0.09] text-foreground/85 hover:border-white/[0.18] hover:text-foreground")}
    >
      {children}
    </button>
  )
}

function Card({ title, body, children, className }: { title: string; body?: string; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      <div className="flex flex-col gap-1 border-b border-white/[0.06] px-5 py-4">
        <PanelTitle className="text-[16px]">{title}</PanelTitle>
        {body && <p className="text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>}
      </div>
      {children}
    </Panel>
  )
}

const inputCls = "h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-white/[0.14] focus:border-primary/45"

/* ── Profile ──────────────────────────────────────────────────────────── */

function ProfileSection({ s }: { s: Settings }) {
  const toast = useToast()
  const [form, setForm] = React.useState(s.profile)
  const [copied, setCopied] = React.useState(false)
  // Re-sync if the saved profile changes from elsewhere (another tab, reset).
  const savedKey = JSON.stringify(s.profile)
  const [syncedKey, setSyncedKey] = React.useState(savedKey)
  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey)
    setForm(s.profile)
  }
  const dirty = JSON.stringify(form) !== savedKey
  const usernameOk = /^[a-z0-9_]{3,20}$/.test(form.username)
  const nameOk = form.displayName.trim().length >= 2

  return (
    <div className="flex flex-col gap-4">
      <Card title="Profile" body="How you appear on WorldStreet — in trades, the launchpad and community.">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9a3d] to-[#f26b1d] font-display text-[24px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
              {(form.displayName.trim()[0] ?? "R").toUpperCase()}
            </span>
            <div className="flex flex-col gap-1.5">
              <span className="font-display text-[17px] font-semibold text-foreground">{form.displayName || "Your name"}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText("30197536").catch(() => {})
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1500)
                }}
                className="inline-flex w-fit items-center gap-1.5 text-[12px] font-medium tabular-nums text-muted-foreground hover:text-foreground"
              >
                UID 30197536
                <Icon icon={copied ? Tick02Icon : Copy01Icon} className={cn("size-3.5", copied && "text-credit")} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Display name</span>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={cn(inputCls, !nameOk && "border-debit/55")} />
              {!nameOk && <span className="text-[12px] text-debit">At least 2 characters.</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Username</span>
              <span className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">@</span>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} className={cn(inputCls, "pl-8", !usernameOk && "border-debit/55")} />
              </span>
              <span className={cn("text-[12px]", usernameOk ? "text-muted-foreground" : "text-debit")}>3–20 lowercase letters, digits or _.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Country</span>
              <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={cn(inputCls, "cursor-pointer [&>option]:bg-[#141414]")}>
                {["Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Time zone</span>
              <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={cn(inputCls, "cursor-pointer [&>option]:bg-[#141414]")}>
                {["Africa/Lagos (GMT+1)", "Africa/Accra (GMT+0)", "Africa/Nairobi (GMT+3)", "Europe/London (GMT+0)", "America/New_York (GMT-5)"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card title="Contact" body="Used for sign-in and security alerts. Changing either needs a code sent to the current one.">
        <Row icon={Mail01Icon} title="Email" body="r••••••@gmail.com" status={<Chip tone="good">Verified</Chip>}>
          <GhostButton onClick={() => toast("A code would be sent to your current email (demo)")}>Change</GhostButton>
        </Row>
        <Row icon={SmartPhone01Icon} title="Phone" body="Add a number for SMS alerts and account recovery." status={<Chip tone="muted">Not set</Chip>}>
          <GhostButton onClick={() => toast("Phone verification would start here (demo)")}>Add phone</GhostButton>
        </Row>
      </Card>

      {/* Explicit save for text — a half-typed username shouldn't commit itself. */}
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="sticky bottom-4 z-20">
            <Panel className="flex items-center justify-between gap-3 border-primary/30 px-4 py-3 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)]">
              <span className="text-[13px] font-medium text-foreground">You have unsaved changes</span>
              <span className="flex gap-2">
                <GhostButton onClick={() => setForm(s.profile)}>Discard</GhostButton>
                <button
                  type="button"
                  disabled={!usernameOk || !nameOk}
                  onClick={() => {
                    updateSettings((x) => ({ ...x, profile: form }))
                    toast("Profile saved")
                  }}
                  className="dash-gold-btn h-9 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-40"
                >
                  Save changes
                </button>
              </span>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Security ─────────────────────────────────────────────────────────── */

function SecuritySection({ s }: { s: Settings }) {
  const toast = useToast()
  const [showCode, setShowCode] = React.useState(false)
  const set = (patch: Partial<Settings["security"]>, msg: string) => {
    updateSettings((x) => ({ ...x, security: { ...x.security, ...patch } }))
    toast(msg)
  }
  const checks = [true, s.security.twoFactor, s.security.passkey, !!s.security.antiPhishing, s.security.whitelist]
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative size-20 shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="7" />
            <motion.circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={score >= 80 ? "var(--credit)" : score >= 60 ? "var(--primary)" : "var(--warning)"}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              initial={false}
              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - score / 100) }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-[19px] font-semibold tabular-nums">{score}%</span>
        </div>
        <div className="flex flex-col gap-1">
          <PanelTitle className="text-[16px]">Security score</PanelTitle>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {score === 100 ? "Every protection is on. Nice." : `Turn on ${checks.length - checks.filter(Boolean).length} more protection${checks.length - checks.filter(Boolean).length === 1 ? "" : "s"} below to reach 100%.`}
          </p>
        </div>
      </Panel>

      <Card title="Sign-in">
        <Row icon={LockPasswordIcon} title="Password" body="Last changed 3 months ago." status={<Chip tone="good">Set</Chip>}>
          <GhostButton onClick={() => toast("Password change would open here (demo)")}>Change</GhostButton>
        </Row>
        <Row icon={Shield01Icon} title="Two-factor authentication" body="A code from your authenticator app at every sign-in and withdrawal." status={s.security.twoFactor ? <Chip tone="good">On</Chip> : <Chip tone="warn">Off</Chip>}>
          <Toggle label="Two-factor authentication" on={s.security.twoFactor} onChange={(v) => set({ twoFactor: v }, v ? "Two-factor turned on" : "Two-factor turned off")} />
        </Row>
        <Row icon={FingerPrintIcon} title="Passkey" body="Sign in with Face ID, Touch ID or your device PIN — phishing-proof." status={s.security.passkey ? <Chip tone="good">Added</Chip> : <Chip tone="muted">None</Chip>}>
          {s.security.passkey ? <GhostButton danger onClick={() => set({ passkey: false }, "Passkey removed")}>Remove</GhostButton> : <GhostButton onClick={() => set({ passkey: true }, "Passkey added")}>Add passkey</GhostButton>}
        </Row>
        <Row icon={Notification02Icon} title="New sign-in alerts" body="Email me whenever a new device signs in.">
          <Toggle label="New sign-in alerts" on={s.security.loginAlerts} onChange={(v) => set({ loginAlerts: v }, v ? "Sign-in alerts on" : "Sign-in alerts off")} />
        </Row>
      </Card>

      <Card title="Withdrawals">
        <Row
          icon={Key01Icon}
          title="Anti-phishing code"
          body={
            <>
              Shown in every real email from us:{" "}
              <button type="button" onClick={() => setShowCode((v) => !v)} className="font-mono font-semibold text-foreground hover:text-primary">
                {showCode ? s.security.antiPhishing : "••••••••"}
              </button>{" "}
              <span className="text-muted-foreground/70">({showCode ? "hide" : "tap to reveal"})</span>
            </>
          }
          status={<Chip tone="good">Set</Chip>}
        >
          <GhostButton onClick={() => toast("Code change would open here (demo)")}>Change</GhostButton>
        </Row>
        <Row icon={CheckmarkBadge01Icon} title="Withdrawal whitelist" body="Only allow withdrawals to addresses you've saved. New addresses wait 24 hours." status={s.security.whitelist ? <Chip tone="good">On</Chip> : <Chip tone="warn">Off</Chip>}>
          <Toggle label="Withdrawal whitelist" on={s.security.whitelist} onChange={(v) => set({ whitelist: v }, v ? "Whitelist on — new addresses wait 24h" : "Whitelist off")} />
        </Row>
      </Card>
    </div>
  )
}

/* ── Verification ─────────────────────────────────────────────────────── */

const TIERS = [
  { n: 1, name: "Basic", state: "done" as const, needs: "Email and phone", limits: [["Deposit", "Unlimited crypto"], ["Withdraw", "$2,000 / day"], ["Buy with card", "Not available"]] },
  { n: 2, name: "Verified", state: "next" as const, needs: "Government ID and a selfie · ~3 minutes", limits: [["Deposit", "Unlimited"], ["Withdraw", "$100,000 / day"], ["Buy with card", "$5,000 / day"]] },
  { n: 3, name: "Advanced", state: "locked" as const, needs: "Proof of address", limits: [["Deposit", "Unlimited"], ["Withdraw", "$2,000,000 / day"], ["Buy with card", "$50,000 / day"]] },
]

function VerificationSection() {
  const toast = useToast()
  return (
    <div className="flex flex-col gap-4">
      <Panel className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_50%,rgb(250_204_21/0.08),transparent_60%)]" />
        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Next step</span>
          <PanelTitle className="text-[18px]">Verify your identity</PanelTitle>
          <p className="text-[13px] leading-relaxed text-muted-foreground">Raises your withdrawal limit from $2,000 to $100,000 a day and unlocks card purchases. Takes about 3 minutes.</p>
        </div>
        <button type="button" onClick={() => toast("Identity verification would start here (demo)")} className="dash-gold-btn relative flex h-11 shrink-0 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
          Start verification
          <Icon icon={ArrowRight01Icon} className="size-4" strokeWidth={2} />
        </button>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {TIERS.map((t) => (
          <Panel key={t.n} className={cn("flex flex-col gap-4 p-5", t.state === "next" && "border-primary/30")}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className={cn("flex size-8 items-center justify-center rounded-full border font-display text-[13px] font-semibold", t.state === "done" ? "border-credit/40 bg-credit/[0.12] text-credit" : t.state === "next" ? "border-primary/50 bg-primary/[0.1] text-primary" : "border-white/[0.1] text-muted-foreground")}>
                  {t.state === "done" ? <Icon icon={Tick02Icon} className="size-4" strokeWidth={2.6} /> : t.n}
                </span>
                <span className="text-[15px] font-semibold text-foreground">Level {t.n} · {t.name}</span>
              </span>
              {t.state === "done" ? <Chip tone="good">Current</Chip> : t.state === "next" ? <Chip tone="warn">Next</Chip> : <Chip tone="muted">Later</Chip>}
            </div>
            <span className="text-[12.5px] text-muted-foreground">Needs: {t.needs}</span>
            <dl className="flex flex-col divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
              {t.limits.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3.5 py-2.5 text-[12.5px]">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>
    </div>
  )
}

/* ── Notifications ────────────────────────────────────────────────────── */

const NOTIFY_ROWS: { key: NotifyKey; label: string; hint: string; locked?: boolean }[] = [
  { key: "money", label: "Deposits & withdrawals", hint: "When money arrives or leaves" },
  { key: "orders", label: "Orders & fills", hint: "Fills, cancellations, liquidation warnings" },
  { key: "alerts", label: "Price alerts", hint: "Alerts you've set on markets" },
  { key: "launchpad", label: "Launchpad", hint: "Tokens you hold graduating" },
  { key: "security", label: "Security", hint: "Sign-ins, password and 2FA changes", locked: true },
  { key: "news", label: "News & offers", hint: "Product news and promotions" },
]
const CHANNELS: { key: Channel; label: string }[] = [
  { key: "push", label: "Push" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
]

function NotificationsSection({ s }: { s: Settings }) {
  const toast = useToast()
  const set = (k: NotifyKey, c: Channel, v: boolean) => {
    updateSettings((x) => ({ ...x, notify: { ...x.notify, [k]: { ...x.notify[k], [c]: v } } }))
    toast(`${NOTIFY_ROWS.find((r) => r.key === k)?.label} · ${c} ${v ? "on" : "off"}`)
  }
  return (
    <Card title="Notifications" body="Pick what reaches you, and where. Security alerts always reach you by email — that one can't be switched off.">
      <div className="hidden grid-cols-[minmax(0,1fr)_repeat(3,72px)] gap-2 border-b border-white/[0.05] px-5 py-2.5 text-[11.5px] font-medium text-muted-foreground sm:grid">
        <span />
        {CHANNELS.map((c) => (
          <span key={c.key} className="text-center">
            {c.label}
          </span>
        ))}
      </div>
      {NOTIFY_ROWS.map((r) => (
        <div key={r.key} className="flex flex-col gap-3 border-t border-white/[0.05] px-5 py-4 first:border-t-0 sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(3,72px)] sm:items-center sm:gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-foreground">{r.label}</span>
            <span className="text-[12.5px] text-muted-foreground">{r.hint}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:contents">
            {CHANNELS.map((c) => {
              const locked = r.locked && c.key === "email"
              return (
                <label key={c.key} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] px-3 py-2 sm:justify-center sm:border-0 sm:p-0">
                  <span className="text-[12px] text-muted-foreground sm:hidden">{c.label}</span>
                  <Toggle label={`${r.label} by ${c.label}`} on={locked ? true : s.notify[r.key][c.key]} disabled={locked} onChange={(v) => set(r.key, c.key, v)} />
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </Card>
  )
}

/* ── Preferences ──────────────────────────────────────────────────────── */

/** A small segmented control for two or three choices. */
function Seg<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)} className={cn("relative h-8 rounded-lg px-3 text-[12.5px] font-semibold transition-colors", value === o.key ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
          {value === o.key && <motion.span layoutId={`seg-${options.map((x) => x.key).join("")}`} transition={SLIDE} className="absolute inset-0 rounded-lg bg-primary/[0.1]" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function PreferencesSection({ s }: { s: Settings }) {
  const toast = useToast()
  const set = (patch: Partial<Settings["prefs"]>, msg: string) => {
    updateSettings((x) => ({ ...x, prefs: { ...x.prefs, ...patch } }))
    toast(msg)
  }
  return (
    <div className="flex flex-col gap-4">
      <Card title="Display">
        <Row title="Display currency" body="Balances and values across the app are shown in this.">
          <ViewSelect
            align="right"
            options={[
              { key: "USD", label: "USD", hint: "US dollar" },
              { key: "NGN", label: "NGN", hint: "Nigerian naira" },
              { key: "EUR", label: "EUR", hint: "Euro" },
              { key: "GBP", label: "GBP", hint: "British pound" },
            ]}
            value={s.prefs.currency}
            onChange={(v) => set({ currency: v }, `Display currency: ${v}`)}
          />
        </Row>
        <Row title="Language">
          <ViewSelect
            align="right"
            options={[
              { key: "English", label: "English" },
              { key: "Français", label: "Français" },
              { key: "Yorùbá", label: "Yorùbá", hint: "Coming soon" },
            ]}
            value={s.prefs.language}
            onChange={(v) => set({ language: v }, `Language: ${v}`)}
          />
        </Row>
        <Row title="Theme" body="WorldStreet is designed dark. Light is on the way." status={<Chip tone="muted">Dark</Chip>} />
        <Row title="Hide balances by default" body="Start every session with figures masked — tap the eye to reveal.">
          <Toggle label="Hide balances by default" on={s.prefs.hideBalances} onChange={(v) => set({ hideBalances: v }, v ? "Balances hidden by default" : "Balances shown by default")} />
        </Row>
      </Card>

      <Card title="Trading">
        <Row title="Open trading on" body="Which venue the Trade page starts on.">
          <Seg
            value={s.prefs.defaultVenue}
            options={[
              { key: "spot", label: "Spot" },
              { key: "futures", label: "Futures" },
            ]}
            onChange={(v) => set({ defaultVenue: v }, `Trading opens on ${v}`)}
          />
        </Row>
        <Row title="24h change measured" body="Rolling 24 hours, or since 00:00 UTC.">
          <Seg
            value={s.prefs.changeBasis}
            options={[
              { key: "rolling", label: "Rolling" },
              { key: "utc", label: "UTC day" },
            ]}
            onChange={(v) => set({ changeBasis: v }, v === "rolling" ? "24h change: rolling" : "24h change: since 00:00 UTC")}
          />
        </Row>
        <Row title="Confirm before placing orders" body="A review step before every order is sent.">
          <Toggle label="Confirm before placing orders" on={s.prefs.confirmOrders} onChange={(v) => set({ confirmOrders: v }, v ? "Order confirmation on" : "Order confirmation off")} />
        </Row>
      </Card>
    </div>
  )
}

/* ── Sessions ─────────────────────────────────────────────────────────── */

const SESSIONS = [
  { id: "s0", device: "Chrome on Windows", where: "Lagos, Nigeria", when: "Active now", current: true, icon: ComputerIcon },
  { id: "s1", device: "WorldStreet app · iPhone 15", where: "Lagos, Nigeria", when: "2 hours ago", icon: SmartPhone01Icon },
  { id: "s2", device: "Safari on macOS", where: "Abuja, Nigeria", when: "3 days ago", icon: ComputerIcon },
  { id: "s3", device: "Chrome on Android", where: "Accra, Ghana", when: "12 days ago", icon: SmartPhone01Icon },
]

function SessionsSection({ s }: { s: Settings }) {
  const toast = useToast()
  const live = SESSIONS.filter((x) => !s.revoked.includes(x.id))
  const others = live.filter((x) => !x.current)
  const revoke = (ids: string[], msg: string) => {
    updateSettings((x) => ({ ...x, revoked: [...new Set([...x.revoked, ...ids])] }))
    toast(msg)
  }
  return (
    <Card title="Where you're signed in" body="Don't recognise one? Sign it out, then change your password.">
      <AnimatePresence initial={false}>
        {live.map((x) => (
          <motion.div key={x.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
            <Row icon={x.icon} title={x.device} body={`${x.where} · ${x.when}`} status={x.current ? <Chip tone="good">This device</Chip> : undefined}>
              {!x.current && (
                <GhostButton danger onClick={() => revoke([x.id], `Signed out ${x.device}`)}>
                  Sign out
                </GhostButton>
              )}
            </Row>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
        <span className="text-[12.5px] text-muted-foreground">{others.length === 0 ? "Only this device is signed in." : `${others.length} other session${others.length === 1 ? "" : "s"}`}</span>
        {others.length > 0 && (
          <button type="button" onClick={() => revoke(others.map((x) => x.id), "Signed out of every other device")} className="flex h-9 items-center gap-2 rounded-xl border border-debit/30 px-3.5 text-[13px] font-semibold text-debit transition-colors hover:bg-debit/[0.08]">
            <Icon icon={Logout01Icon} className="size-4" />
            Sign out all others
          </button>
        )}
      </div>
    </Card>
  )
}

/* ── Payout accounts ──────────────────────────────────────────────────── */

function PayoutsSection() {
  const toast = useToast()
  return (
    <Card title="Payout accounts" body="Where cash-outs from Sell land. The Dollar Account is always available.">
      <Row icon={BankIcon} title="Dollar Account" body="USD · instant, no fee" status={<Chip tone="good">Default</Chip>} />
      <Row icon={BankIcon} title="GTBank •• 3381" body="Raphael Tomiwa · NGN · added Sep 2026" status={<Chip tone="good">Verified</Chip>}>
        <GhostButton onClick={() => toast("Bank removal would ask for 2FA (demo)")}>Remove</GhostButton>
      </Row>
      <div className="border-t border-white/[0.06] px-5 py-4">
        <button type="button" onClick={() => toast("Add bank account would open here (demo)")} className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-white/[0.15] px-4 text-[13px] font-semibold text-foreground/85 transition-colors hover:border-primary/45 hover:text-primary">
          + Add a bank account
        </button>
      </div>
    </Card>
  )
}

/* ── Account ──────────────────────────────────────────────────────────── */

function AccountSection() {
  const toast = useToast()
  const [confirm, setConfirm] = React.useState("")
  const [open, setOpen] = React.useState(false)
  return (
    <div className="flex flex-col gap-4">
      <Card title="Your data">
        <Row title="Export account data" body="Your profile, balances and full transaction history as a CSV archive.">
          <GhostButton onClick={() => toast("An export link would be emailed to you (demo)")}>Request export</GhostButton>
        </Row>
        <Row title="Reset this preview" body="Puts every setting on this page back to its default.">
          <GhostButton
            onClick={() => {
              resetSettings()
              toast("Preview settings reset")
            }}
          >
            Reset
          </GhostButton>
        </Row>
      </Card>
      <Panel className="flex flex-col border-debit/25">
        <div className="flex flex-col gap-1 border-b border-debit/15 px-5 py-4">
          <PanelTitle className="text-[16px] text-debit">Close account</PanelTitle>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">Withdraw everything first — a closed account can&apos;t hold funds. Closing is permanent after 30 days.</p>
        </div>
        <div className="flex flex-col gap-3 p-5">
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="h-10 w-fit rounded-xl border border-debit/30 px-4 text-[13px] font-semibold text-debit transition-colors hover:bg-debit/[0.08]">
              Close my account
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-col gap-3 overflow-hidden">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] text-foreground/85">
                  Type <span className="font-mono font-semibold text-debit">CLOSE</span> to confirm
                </span>
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cn(inputCls, "max-w-[260px] font-mono uppercase")} />
              </label>
              <div className="flex gap-2">
                <GhostButton
                  onClick={() => {
                    setOpen(false)
                    setConfirm("")
                  }}
                >
                  Cancel
                </GhostButton>
                <button
                  type="button"
                  disabled={confirm.trim().toUpperCase() !== "CLOSE"}
                  onClick={() => {
                    toast("Closure would be scheduled — nothing changed (demo)")
                    setOpen(false)
                    setConfirm("")
                  }}
                  className="h-9 rounded-xl bg-debit px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-40"
                >
                  Close account
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </Panel>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function SettingsWorkspace({ initialSection }: { initialSection: SectionKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const s = useSettings()
  const [section, setSection] = React.useState<SectionKey>(initialSection)
  const [toast, setToast] = React.useState<{ msg: string; n: number } | null>(null)
  React.useEffect(() => setSection(initialSection), [initialSection])
  React.useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const pick = (k: SectionKey) => {
    setSection(k)
    router.push(`${pathname}?section=${k}`, { scroll: false })
  }
  const showToast = React.useCallback((msg: string) => setToast((t) => ({ msg, n: (t?.n ?? 0) + 1 })), [])
  const protections = [s.security.twoFactor, s.security.passkey, s.security.whitelist].filter((x) => !x).length

  return (
    <ToastContext.Provider value={showToast}>
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Section menu — a list on wide screens, a dropdown on a phone. */}
        <div className="lg:hidden">
          <ViewSelect options={SECTIONS} value={section} onChange={pick} className="w-full [&>button]:w-full" />
        </div>
        <nav aria-label="Settings sections" className="hidden lg:block">
          <Panel className="sticky top-[96px] flex flex-col gap-0.5 p-2">
            {SECTIONS.map((x) => {
              const on = x.key === section
              return (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => pick(x.key)}
                  aria-current={on ? "page" : undefined}
                  className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", on ? "text-primary" : x.key === "account" ? "text-debit/80 hover:text-debit" : "text-foreground/75 hover:text-foreground")}
                >
                  {on && <motion.span layoutId="settings-nav" transition={SLIDE} className="dash-rail-active absolute inset-0 rounded-xl !shadow-none" />}
                  <Icon icon={x.icon} className="relative size-[18px]" />
                  <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[13.5px] font-semibold">{x.label}</span>
                    <span className="truncate text-[11.5px] font-normal text-muted-foreground">{x.hint}</span>
                  </span>
                  {x.key === "security" && protections > 0 && <span className="relative rounded-md bg-warning/[0.14] px-1.5 text-[10.5px] font-bold tabular-nums text-warning">{protections}</span>}
                  {x.key === "verification" && <span className="relative size-2 rounded-full bg-warning" title="Action needed" />}
                </button>
              )
            })}
          </Panel>
        </nav>

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              {section === "profile" && <ProfileSection s={s} />}
              {section === "security" && <SecuritySection s={s} />}
              {section === "verification" && <VerificationSection />}
              {section === "notifications" && <NotificationsSection s={s} />}
              {section === "preferences" && <PreferencesSection s={s} />}
              {section === "sessions" && <SessionsSection s={s} />}
              {section === "payouts" && <PayoutsSection />}
              {section === "account" && <AccountSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* The one confirmation for every switch on the page. */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.n}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-white/[0.09] bg-[#151515]/95 px-4 py-3 text-[13px] font-medium text-foreground shadow-[0_16px_40px_-10px_rgb(0_0_0/0.8)] backdrop-blur-xl"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-credit/[0.15] text-credit">
              <Icon icon={Tick02Icon} className="size-3" strokeWidth={2.6} />
            </span>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  )
}


/* ── Header (Settings is full-screen) ─────────────────────────────────── */

/**
 * Settings has no top bar or rail — it's a focused screen, like the phone
 * trading terminal. This slim header is its whole chrome: the mark, the
 * title, and a close button back to wherever you came from.
 */
export function SettingsHeader() {
  const router = useRouter()
  const close = () => {
    // Back to the page you opened Settings from (the frame records it), or
    // the dashboard if you landed here directly.
    let last: string | null = null
    try {
      last = window.sessionStorage.getItem("ws:redesign:last-page")
    } catch {
      /* fall through to the dashboard */
    }
    router.push(last && last.startsWith("/") ? last : PREVIEW_ROUTES.dashboard)
  }
  return (
    <header className="dash-topbar sticky top-0 z-30 flex h-16 items-center gap-3 px-4 md:h-[72px] md:px-8">
      <Link href={PREVIEW_ROUTES.dashboard} aria-label="WorldStreet dashboard" className="flex shrink-0 items-center">
        <Image src="/worldstreet-logo/WorldStreet1.png" alt="" width={36} height={20} className="h-[20px] w-auto" priority />
      </Link>
      <span aria-hidden className="h-6 w-px bg-white/[0.1]" />
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-foreground md:text-[21px]">Settings</h1>
        <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80 sm:inline">Demo</span>
      </div>
      <span className="ml-auto hidden text-[12.5px] text-muted-foreground md:block">Changes save in this browser only</span>
      <button
        type="button"
        onClick={close}
        aria-label="Close settings"
        className="ml-auto flex size-10 items-center justify-center rounded-full border border-white/[0.08] text-muted-foreground transition-colors hover:border-white/[0.18] hover:text-foreground md:ml-3"
      >
        <Icon icon={Cancel01Icon} className="size-5" />
      </button>
    </header>
  )
}
