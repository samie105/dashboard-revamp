"use client"

/**
 * Settings — the preview's page (components/settings-unauth/settings.tsx) on
 * the real account, UI first. DEV ONLY until it's finished: the route 404s
 * outside development, and the account menu still says "Soon".
 *
 * What's real:
 *  · Profile — the signed-in user's name, email, avatar and user ID (read
 *    only: editing writes to the sign-in provider, which this work doesn't
 *    touch);
 *  · Security — the wallet's own protections (passphrase and backup, the
 *    recovery secret, exporting keys, adding networks), each opening the same
 *    security screens the wallet page uses;
 *  · Preferences — "hide balances" (the app-wide privacy toggle) and the
 *    preferred currency Vivid answers in (the app is dark-only, so no theme);
 *  · Sessions — this wallet's devices and its trading sessions, read from the
 *    backend; signing devices out happens in "Passphrase and backup".
 * Everything else the preview shows has no backend yet, so it keeps its place
 * with a "Soon" tag and its controls switched off — nothing is faked.
 */

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Alert02Icon,
  ArrowDown01Icon,
  BankIcon,
  CheckmarkBadge01Icon,
  ComputerIcon,
  Copy01Icon,
  FingerPrintIcon,
  Key01Icon,
  LockPasswordIcon,
  Mail01Icon,
  Notification02Icon,
  PlusSignIcon,
  Settings01Icon,
  Shield01Icon,
  SmartPhone01Icon,
  SquareLock02Icon,
  Tick02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { useProfile } from "@/components/profile-provider"
import { COUNTRIES, TIMEZONES, normalizeUsername, usernameProblem } from "@/lib/profile-fields"
import { WalletSecurityModal } from "@/components/crypto/WalletSecurityModal"
import { missingChainFamilies } from "@/components/crypto/WalletChainProvisioningPanel"
import { Icon, Panel, PanelTitle, SLIDE, ViewSelect, usePrivacy, type IconSvg } from "@/components/dashboard/redesign/ui"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { useTradingSessions } from "@/hooks/crypto/useTradingSessions"
import { setTradePrefs, useTradePrefs } from "@/lib/trade-prefs"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { SectionKey } from "@/components/settings-unauth/sections"

const SECTIONS: { key: SectionKey; label: string; hint: string; icon: IconSvg; soon?: boolean }[] = [
  { key: "profile", label: "Profile", hint: "Name, username, region", icon: UserIcon },
  { key: "security", label: "Security", hint: "Wallet protection, backups", icon: Shield01Icon },
  { key: "verification", label: "Verification", hint: "Identity and limits", icon: CheckmarkBadge01Icon, soon: true },
  { key: "notifications", label: "Notifications", hint: "What reaches you, and how", icon: Notification02Icon },
  { key: "preferences", label: "Preferences", hint: "Privacy, currency", icon: Settings01Icon },
  { key: "sessions", label: "Sessions", hint: "Devices and trading sessions", icon: ComputerIcon },
  { key: "payouts", label: "Payout accounts", hint: "Where cash-outs land", icon: BankIcon, soon: true },
  { key: "account", label: "Account", hint: "Export data, close account", icon: Alert02Icon, soon: true },
]

/* ── Primitives (the preview's) ───────────────────────────────────────── */

const ToastContext = React.createContext<(msg: string) => void>(() => {})
const useToast = () => React.useContext(ToastContext)

function Soon() {
  return <span className="rounded-md bg-foreground/[0.07] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Soon</span>
}

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
        on ? "border-primary bg-primary" : "border-foreground/[0.12] bg-foreground/[0.06]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 36 }}
        className={cn("absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.3)]", on ? "right-[2px] bg-primary-foreground" : "left-[2px] bg-foreground/85")}
      />
    </button>
  )
}

function Row({ icon, title, body, status, soon, children }: { icon?: IconSvg; title: string; body?: React.ReactNode; status?: React.ReactNode; soon?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-foreground/[0.05] px-5 py-4 first:border-t-0 sm:flex-row sm:items-center sm:gap-4">
      {/* Only the text dims on a "Soon" row. Fading the whole row would put
          it in its own layer, and a menu opened from it would draw UNDER the
          next card instead of over it. */}
      <div className={cn("flex min-w-0 flex-1 items-start gap-3.5", soon && "opacity-70")}>
        {icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.07] bg-foreground/[0.03] text-foreground/80">
            <Icon icon={icon} className="size-[18px]" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-foreground">
            {title}
            {status}
            {soon && <Soon />}
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
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]", tone === "good" ? "bg-credit/[0.12] text-credit" : tone === "warn" ? "bg-warning/[0.12] text-warning" : "bg-foreground/[0.07] text-muted-foreground")}>
      {children}
    </span>
  )
}

function GhostButton({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "border-debit/30 text-debit hover:bg-debit/[0.08]" : "border-foreground/[0.09] text-foreground/85 hover:border-foreground/[0.18] hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Card({ title, body, soon, children, className }: { title: string; body?: string; soon?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      <div className="flex flex-col gap-1 border-b border-foreground/[0.06] px-5 py-4">
        <span className="flex items-center gap-2">
          <PanelTitle className="text-[16px]">{title}</PanelTitle>
          {soon && <Soon />}
        </span>
        {body && <p className="text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>}
      </div>
      {children}
    </Panel>
  )
}

/** A whole section that has no backend yet. */
function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <Panel className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <Soon />
      <PanelTitle className="text-[18px]">{title}</PanelTitle>
      <p className="max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </Panel>
  )
}

const editCls = "h-11 w-full min-w-0 rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] px-3.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-foreground/[0.14] focus:border-primary/45"

/* ── Profile ──────────────────────────────────────────────────────────── */

function ProfileSection({ standalone = false }: { standalone?: boolean }) {
  const { user } = useAuth()
  const { profile, profileLoading, profileError, saveProfile } = useProfile()
  const toast = useToast()
  const [copied, setCopied] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const saved = {
    displayName: profile?.displayName ?? "",
    username: profile?.username ?? "",
    country: profile?.country ?? "",
    timezone: profile?.timezone ?? "",
  }
  const [form, setForm] = React.useState(saved)
  // Re-sync when the saved profile changes (first load, another tab, a save).
  const savedKey = JSON.stringify(saved)
  const [syncedKey, setSyncedKey] = React.useState(savedKey)
  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey)
    setForm(saved)
  }
  const dirty = JSON.stringify(form) !== savedKey
  const nameOk = form.displayName.trim().length === 0 || (form.displayName.trim().length >= 2 && form.displayName.trim().length <= 40)
  const usernameError = usernameProblem(form.username)
  const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
  const shown = form.displayName.trim() || fallbackName || user?.email || "—"
  const avatar = profile?.avatarUrl || user?.imageUrl
  const uid = user?.userId ?? ""

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    const result = await saveProfile({
      displayName: form.displayName.trim(),
      username: normalizeUsername(form.username),
      country: form.country,
      timezone: form.timezone,
    })
    setSaving(false)
    if (result.ok) toast("Profile saved")
    else setSaveError(result.error)
  }

  if (profileLoading && !profile) {
    return (
      <div className="flex flex-col gap-4">
        <span className="skel h-[300px] rounded-[20px]" />
        <span className="skel h-[180px] rounded-[20px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title={standalone ? "Your details" : "Profile"} body="How you appear on WorldStreet.">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center gap-4">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-16 rounded-2xl object-cover" />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9a3d] to-[#f26b1d] font-display text-[24px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
                {shown.trim()[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate font-display text-[17px] font-semibold text-foreground">{shown}</span>
              {uid && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(uid).catch(() => {})
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1500)
                  }}
                  className="inline-flex w-fit max-w-full items-center gap-1.5 text-[12px] font-medium tabular-nums text-muted-foreground hover:text-foreground"
                >
                  <span className="truncate">UID {uid}</span>
                  <Icon icon={copied ? Tick02Icon : Copy01Icon} className={cn("size-3.5 shrink-0", copied && "text-credit")} />
                </button>
              )}
            </div>
          </div>
          {profileError && !profile && <p className="rounded-xl border border-debit/25 bg-debit/[0.06] px-3.5 py-3 text-[12.5px] text-debit">Couldn&apos;t load your profile. Reload to try again.</p>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Display name</span>
              <input value={form.displayName} maxLength={40} placeholder={fallbackName || "Your name"} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={cn(editCls, !nameOk && "border-debit/55")} />
              <span className={cn("text-[12px]", nameOk ? "text-muted-foreground" : "text-debit")}>{nameOk ? "Leave empty to use your sign-in name." : "2–40 characters."}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Username</span>
              <span className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">@</span>
                <input
                  value={form.username}
                  maxLength={21}
                  placeholder="username"
                  autoComplete="off"
                  onChange={(e) => {
                    setSaveError(null)
                    setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, "") })
                  }}
                  className={cn(editCls, "pl-8", usernameError && "border-debit/55")}
                />
              </span>
              <span className={cn("text-[12px]", usernameError ? "text-debit" : "text-muted-foreground")}>{usernameError ?? "3–20 lowercase letters, digits or _. Optional."}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Country</span>
              <span className="relative">
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={cn(editCls, "cursor-pointer appearance-none pr-10 [&>option]:bg-popover")}>
                <option value="">Not set</option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
                <Icon icon={ArrowDown01Icon} className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground/85">Time zone</span>
              <span className="relative">
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={cn(editCls, "cursor-pointer appearance-none pr-10 [&>option]:bg-popover")}>
                <option value="">Not set</option>
                {TIMEZONES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
                <Icon icon={ArrowDown01Icon} className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
              </span>
            </label>
          </div>
        </div>
        {/* Explicit save for text — a half-typed name shouldn't commit itself.
            The card's own footer, in the flow: it never floats over the cards
            or pushes the column wider. */}
        <AnimatePresence initial={false}>
          {dirty && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/20 bg-primary/[0.04] px-5 py-3.5">
                <span className={cn("min-w-0 text-[13px] font-medium", saveError ? "text-debit" : "text-foreground")}>{saveError ?? "You have unsaved changes"}</span>
                <span className="flex shrink-0 gap-2">
                  <GhostButton
                    onClick={() => {
                      setForm(saved)
                      setSaveError(null)
                    }}
                  >
                    Discard
                  </GhostButton>
                  <button type="button" disabled={!nameOk || Boolean(usernameError) || saving} onClick={() => void save()} className="ds-gold flex h-9 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-40">
                    {saving && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
                    Save changes
                  </button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card title="Contact" body="Used for sign-in and security alerts.">
        <Row icon={Mail01Icon} title="Email" body={user?.email || profile?.email || "—"} status={<Chip tone="muted">Sign-in email</Chip>}>
          <GhostButton disabled>Change</GhostButton>
        </Row>
        <Row icon={SmartPhone01Icon} title="Phone" body="Add a number for SMS alerts and account recovery." soon>
          <GhostButton disabled>Add phone</GhostButton>
        </Row>
      </Card>

    </div>
  )
}

/* ── Notifications ────────────────────────────────────────────────────── */

type NotifyKey = "priceAlerts" | "tradeConfirmations" | "marketNews"
const NOTIFY_ROWS: { key: NotifyKey; label: string; hint: string }[] = [
  { key: "tradeConfirmations", label: "Orders & fills", hint: "Fills, cancellations, liquidation warnings" },
  { key: "priceAlerts", label: "Price alerts", hint: "Alerts you've set on markets" },
  { key: "marketNews", label: "News & offers", hint: "Product news and market updates" },
]

function NotificationsSection() {
  const { profile, profileLoading, updateProfile } = useProfile()
  const toast = useToast()
  const n = profile?.notifications
  const set = async (patch: Partial<NonNullable<typeof n>>, msg: string) => {
    if (!n) return
    const ok = await updateProfile({ notifications: { ...n, ...patch } })
    toast(ok ? msg : "Couldn't save — try again")
  }

  if (!n) {
    return profileLoading ? <span className="skel block h-[420px] rounded-[20px]" /> : <ComingSoon title="Notifications" body="Your notification settings couldn't be loaded. Reload to try again." />
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="What reaches you" body="Pick the updates you want. Security alerts always reach you — those can't be switched off.">
        {NOTIFY_ROWS.map((r) => (
          <Row key={r.key} title={r.label} body={r.hint}>
            <Toggle label={r.label} on={n[r.key]} onChange={(v) => void set({ [r.key]: v }, `${r.label} ${v ? "on" : "off"}`)} />
          </Row>
        ))}
        <Row title="Deposits & withdrawals" body="When money arrives or leaves" soon>
          <Toggle label="Deposits & withdrawals" on={false} disabled onChange={() => {}} />
        </Row>
        <Row title="Launchpad" body="Tokens you hold graduating" soon>
          <Toggle label="Launchpad" on={false} disabled onChange={() => {}} />
        </Row>
      </Card>

      <Card title="How it reaches you" body="The channels the updates above are sent on.">
        <Row icon={Notification02Icon} title="Push" body="On this device and the app.">
          <Toggle label="Push notifications" on={n.push} onChange={(v) => void set({ push: v }, `Push ${v ? "on" : "off"}`)} />
        </Row>
        <Row icon={Mail01Icon} title="Email" body="To your sign-in email.">
          <Toggle label="Email notifications" on={n.email} onChange={(v) => void set({ email: v }, `Email ${v ? "on" : "off"}`)} />
        </Row>
        <Row icon={SmartPhone01Icon} title="SMS" body="To your phone number." soon>
          <Toggle label="SMS notifications" on={false} disabled onChange={() => {}} />
        </Row>
      </Card>
    </div>
  )
}

/* ── Security ─────────────────────────────────────────────────────────── */

type SecurityView = "menu" | "locks" | "recovery" | "export" | "networks"

function SecuritySection() {
  const { user } = useAuth()
  const wallet = useCryptoWalletState()
  const pkg = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(user?.userId ?? "anonymous"),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data?.id),
    staleTime: 60_000,
  })
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<SecurityView>("menu")
  const ready = Boolean(wallet.data && pkg.data)
  const networksToAdd = wallet.data ? missingChainFamilies(wallet.data.accounts).length : 0
  const openAt = (v: SecurityView) => {
    setView(v)
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Your wallet" body="Only you can open this wallet. These are the ways to keep it that way.">
        <Row icon={SquareLock02Icon} title="Passphrase and backup" body="Change your passphrase, sign out other devices, save a backup file.">
          <GhostButton disabled={!ready} onClick={() => openAt("locks")}>Open</GhostButton>
        </Row>
        <Row icon={Shield01Icon} title="Recovery secret" body="Use your recovery secret if you're locked out of your wallet.">
          <GhostButton disabled={!ready} onClick={() => openAt("recovery")}>Open</GhostButton>
        </Row>
        <Row icon={Key01Icon} title="Move an account to another app" body="Shows that account's private key — for advanced users only.">
          <GhostButton disabled={!ready} onClick={() => openAt("export")}>Open</GhostButton>
        </Row>
        {networksToAdd > 0 && (
          <Row icon={PlusSignIcon} title="Add new networks" body={`${networksToAdd} ${networksToAdd === 1 ? "network" : "networks"} can be added to your wallet.`} status={<Chip tone="warn">{networksToAdd}</Chip>}>
            <GhostButton disabled={!ready} onClick={() => openAt("networks")}>Add</GhostButton>
          </Row>
        )}
        {!wallet.isLoading && !wallet.data && <p className="px-5 pb-4 text-[12.5px] text-muted-foreground">Set up your wallet to see these.</p>}
      </Card>

      <Card title="Sign-in" soon>
        <Row icon={LockPasswordIcon} title="Password" body="Change the password you sign in with." soon>
          <GhostButton disabled>Change</GhostButton>
        </Row>
        <Row icon={Shield01Icon} title="Two-factor authentication" body="A code from your authenticator app at every sign-in." soon>
          <Toggle label="Two-factor authentication" on={false} disabled onChange={() => {}} />
        </Row>
        <Row icon={FingerPrintIcon} title="Passkey" body="Sign in with Face ID, Touch ID or your device PIN." soon>
          <GhostButton disabled>Add passkey</GhostButton>
        </Row>
        <Row icon={Notification02Icon} title="New sign-in alerts" body="Email me whenever a new device signs in." soon>
          <Toggle label="New sign-in alerts" on={false} disabled onChange={() => {}} />
        </Row>
      </Card>

      <Card title="Withdrawals" soon>
        <Row icon={Key01Icon} title="Anti-phishing code" body="A code shown in every real email from us." soon>
          <GhostButton disabled>Set</GhostButton>
        </Row>
        <Row icon={CheckmarkBadge01Icon} title="Withdrawal whitelist" body="Only allow withdrawals to addresses you've saved." soon>
          <Toggle label="Withdrawal whitelist" on={false} disabled onChange={() => {}} />
        </Row>
      </Card>

      {wallet.data && pkg.data && (
        <WalletSecurityModal
          open={open}
          onOpenChange={setOpen}
          walletId={wallet.data.id}
          packageValue={pkg.data}
          accounts={wallet.data.accounts}
          networksToAdd={networksToAdd}
          initialView={view}
        />
      )}
    </div>
  )
}

/* ── Preferences ──────────────────────────────────────────────────────── */

function Seg<T extends string>({ value, options, onChange, disabled }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={cn("grid gap-1 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] p-1", disabled && "opacity-50")} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.key)}
          className={cn("relative h-8 rounded-lg px-3 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed", value === o.key ? "text-primary" : "text-muted-foreground hover:text-foreground")}
        >
          {value === o.key && <motion.span layoutId={`seg-${options.map((x) => x.key).join("")}`} transition={SLIDE} className="absolute inset-0 rounded-lg bg-primary/[0.1]" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function PreferencesSection() {
  const toast = useToast()
  const { hidden, toggle } = usePrivacy()
  const { profile, updateProfile } = useProfile()
  const trade = useTradePrefs()
  const currency = profile?.preferredCurrency || "USD"

  return (
    <div className="flex flex-col gap-4">
      {/* overflow-visible: the currency menu opens past the card edge. */}
      <Card title="Display" className="overflow-visible">
        <Row title="Hide balances" body="Mask every figure across the app — tap the eye anywhere to reveal.">
          <Toggle
            label="Hide balances"
            on={hidden}
            onChange={() => {
              toggle()
              toast(hidden ? "Balances shown" : "Balances hidden")
            }}
          />
        </Row>
        <Row title="Preferred currency" body="Vivid answers in this. Showing balances in it across the app is coming soon.">
          <ViewSelect
            align="right"
            options={[
              { key: "USD", label: "USD", hint: "US dollar" },
              { key: "NGN", label: "NGN", hint: "Nigerian naira" },
              { key: "EUR", label: "EUR", hint: "Euro" },
              { key: "GBP", label: "GBP", hint: "British pound" },
            ]}
            value={currency}
            onChange={async (v) => {
              const ok = await updateProfile({ preferredCurrency: v })
              toast(ok ? `Preferred currency: ${v}` : "Couldn't save — try again")
            }}
          />
        </Row>
        <Row title="Language" body="The language the app is shown in.">
          <ViewSelect align="right" options={[{ key: "English", label: "English" }]} value="English" onChange={() => {}} />
        </Row>
      </Card>

      <Card title="Trading" body="Saved on this device.">
        <Row title="Open trading on" body="Which venue the Trade page starts on. A link that names a market still wins.">
          <Seg
            value={trade.defaultVenue}
            options={[
              { key: "spot", label: "Spot" },
              { key: "futures", label: "Futures" },
            ]}
            onChange={(v) => toast(setTradePrefs({ defaultVenue: v }) ? `Trading opens on ${v === "spot" ? "Spot" : "Futures"}` : "Couldn't save on this device")}
          />
        </Row>
        <Row title="Confirm before placing orders" body="A review step before every spot swap is sent. Futures orders are always reviewed before you sign.">
          <Toggle label="Confirm before placing orders" on={trade.confirmSpot} onChange={(v) => toast(setTradePrefs({ confirmSpot: v }) ? (v ? "Spot orders will ask to confirm" : "Spot orders send straight away") : "Couldn't save on this device")} />
        </Row>
        <Row title="24h change measured" body="Rolling 24 hours, or since 00:00 UTC." soon>
          <Seg value="rolling" disabled options={[{ key: "rolling", label: "Rolling" }, { key: "utc", label: "UTC day" }]} onChange={() => {}} />
        </Row>
      </Card>
    </div>
  )
}

/* ── Sessions ─────────────────────────────────────────────────────────── */

function when(iso: string | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** What's being signed out, waiting for the recovery secret. */
type Pending = { kind: "device"; id: string; label: string } | { kind: "session"; id: string; label: string } | { kind: "all-sessions"; label: string }

function SessionsSection() {
  const toast = useToast()
  const wallet = useCryptoWalletState()
  const security = useWalletSecurity(wallet.data?.id)
  const sessions = useTradingSessions()
  const live = security.devices.filter((d) => d.status !== "revoked")
  const trading = sessions.sessions.filter((s) => s.status === "active")
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [secret, setSecret] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const ask = (p: Pending) => {
    setPending(p)
    setSecret("")
    setError(null)
  }
  const confirm = async () => {
    if (!pending || !secret.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      if (pending.kind === "device") {
        await security.revokeDevice(pending.id, secret.trim())
      } else {
        // Ending a trading session needs a fresh wallet authorization, made
        // from the recovery secret — the same check the security panel uses.
        const { walletAuthorizationToken } = await security.authorizeWithRecovery(secret.trim())
        if (pending.kind === "session") await sessions.revoke(pending.id, walletAuthorizationToken)
        else await sessions.revokeAll(walletAuthorizationToken)
      }
      toast(pending.kind === "device" ? `Signed out ${pending.label}` : pending.kind === "session" ? "Trading session ended" : "Every trading session ended")
      setPending(null)
      setSecret("")
    } catch (cause) {
      setError(formatWalletActionError(cause))
    } finally {
      setBusy(false)
    }
  }

  const confirmBox = (p: Pending) =>
    pending && pending.kind === p.kind && ("id" in pending ? "id" in p && pending.id === p.id : true) ? (
      <div className="flex flex-col gap-2.5 border-t border-foreground/[0.05] bg-foreground/[0.015] px-5 py-4">
        <span className="text-[12.5px] text-foreground/85">
          Enter your recovery secret to {p.kind === "device" ? `sign out ${p.label}` : p.kind === "session" ? "end this session" : "end every trading session"}.
        </span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Recovery secret"
            className={cn(editCls, "font-mono sm:max-w-[360px]")}
          />
          <span className="flex gap-2">
            <GhostButton onClick={() => setPending(null)}>Cancel</GhostButton>
            <button type="button" disabled={!secret.trim() || busy} onClick={() => void confirm()} className="flex h-9 items-center gap-2 self-center rounded-xl bg-debit px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-40">
              {busy && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
              Confirm
            </button>
          </span>
        </div>
        {error && <span className="text-[12px] text-debit">{error}</span>}
      </div>
    ) : null

  return (
    <div className="flex flex-col gap-4">
      <Card title="Devices" body="Devices that can open this wallet. Don't recognise one? Sign it out, then change your passphrase.">
        {security.devicesLoading ? (
          <div className="flex flex-col gap-2 p-5">
            {[0, 1].map((i) => (
              <span key={i} className="skel h-12 rounded-xl" />
            ))}
          </div>
        ) : live.length === 0 ? (
          <p className="px-5 py-4 text-[12.5px] text-muted-foreground">No devices yet.</p>
        ) : (
          live.map((d) => (
            <React.Fragment key={d.id}>
              <Row
                icon={/phone|ios|android/i.test(`${d.platform ?? ""} ${d.label}`) ? SmartPhone01Icon : ComputerIcon}
                title={d.label}
                body={`${d.platform ? `${d.platform} · ` : ""}last seen ${when(d.lastSeenAt)}`}
                status={d.status === "active" ? <Chip tone="good">Active</Chip> : <Chip tone="warn">{d.status}</Chip>}
              >
                <GhostButton danger onClick={() => ask({ kind: "device", id: d.id, label: d.label })}>
                  Sign out
                </GhostButton>
              </Row>
              {confirmBox({ kind: "device", id: d.id, label: d.label })}
            </React.Fragment>
          ))
        )}
      </Card>

      <Card title="Trading sessions" body="Short-lived keys that let trading run without unlocking your wallet for every order.">
        {sessions.loading ? (
          <div className="p-5">
            <span className="skel block h-12 rounded-xl" />
          </div>
        ) : sessions.error ? (
          <p className="px-5 py-4 text-[12.5px] text-debit">Couldn&apos;t load your trading sessions. Try again in a moment.</p>
        ) : trading.length === 0 ? (
          <p className="px-5 py-4 text-[12.5px] text-muted-foreground">No active trading sessions.</p>
        ) : (
          trading.map((s) => {
            const label = `${s.chainFamily === "evm" ? "EVM" : s.chainFamily[0].toUpperCase() + s.chainFamily.slice(1)} trading`
            return (
              <React.Fragment key={s.id}>
                <Row icon={Key01Icon} title={label} body={`Expires ${when(s.expiresAt)}`} status={<Chip tone="good">Active</Chip>}>
                  <GhostButton danger onClick={() => ask({ kind: "session", id: s.id, label })}>
                    End
                  </GhostButton>
                </Row>
                {confirmBox({ kind: "session", id: s.id, label })}
              </React.Fragment>
            )
          })
        )}
        {trading.length > 1 && (
          <>
            <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.06] px-5 py-4">
              <span className="text-[12.5px] text-muted-foreground">{trading.length} active sessions</span>
              <GhostButton danger onClick={() => ask({ kind: "all-sessions", label: "all" })}>
                End all
              </GhostButton>
            </div>
            {confirmBox({ kind: "all-sessions", label: "all" })}
          </>
        )}
      </Card>
    </div>
  )
}

/* ── Toast host ─ */

/** The page's one "Saved" confirmation, for every switch and save on it. */
function ToastHost({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<{ msg: string; n: number } | null>(null)
  React.useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])
  const showToast = React.useCallback((msg: string) => setToast((t) => ({ msg, n: (t?.n ?? 0) + 1 })), [])
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.n}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-foreground/[0.09] bg-popover/95 px-4 py-3 text-[13px] font-medium text-foreground shadow-[0_16px_40px_-10px_rgb(0_0_0/0.45)] backdrop-blur-xl"
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

/** The Profile section on its own — the /profile page. */
export function ProfilePage() {
  return (
    <ToastHost>
      <ProfileSection standalone />
    </ToastHost>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function SettingsWorkspace({ initialSection }: { initialSection: SectionKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const [section, setSection] = React.useState<SectionKey>(initialSection)
  React.useEffect(() => setSection(initialSection), [initialSection])

  const pick = (k: SectionKey) => {
    setSection(k)
    router.push(`${pathname}?section=${k}`, { scroll: false })
  }
  return (
    <ToastHost>
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="lg:hidden">
          <ViewSelect options={SECTIONS.map((x) => ({ key: x.key, label: x.label, hint: x.soon ? `${x.hint} · Soon` : x.hint, icon: x.icon }))} value={section} onChange={pick} className="w-full [&>button]:w-full" />
        </div>
        <nav aria-label="Settings sections" className="hidden lg:block">
          <Panel className="sticky top-4 flex flex-col gap-0.5 p-2">
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
                  {on && <motion.span layoutId="settings-nav" transition={SLIDE} className="absolute inset-0 rounded-xl bg-primary/[0.08]" />}
                  <Icon icon={x.icon} className="relative size-[18px]" />
                  <span className="relative flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[13.5px] font-semibold">{x.label}</span>
                    <span className="truncate text-[11.5px] font-normal text-muted-foreground">{x.hint}</span>
                  </span>
                  {x.soon && <span className="relative"><Soon /></span>}
                </button>
              )
            })}
          </Panel>
        </nav>

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              {section === "profile" && <ProfileSection />}
              {section === "security" && <SecuritySection />}
              {section === "verification" && <ComingSoon title="Verification" body="Your identity status and the limits each level unlocks will show here." />}
              {section === "notifications" && <NotificationsSection />}
              {section === "preferences" && <PreferencesSection />}
              {section === "sessions" && <SessionsSection />}
              {section === "payouts" && <ComingSoon title="Payout accounts" body="The bank accounts your cash-outs land in will be listed and managed here." />}
              {section === "account" && <ComingSoon title="Account" body="Export your account data, or close your account." />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </ToastHost>
  )
}
