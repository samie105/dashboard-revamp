export const ADMIN_SESSION_COOKIE = "worldstreet_admin_session"
export const ADMIN_PUBLIC_PATHS = ["/admin/login", "/admin/accept"] as const

export function isAdminPublicPath(pathname: string): boolean {
  return ADMIN_PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

