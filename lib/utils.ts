import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns the avatar URL if provided, otherwise a deterministic Dicebear avatar seeded by name. */
export function avatarUrl(avatar: string | null | undefined, seed: string | null | undefined): string {
  if (avatar && avatar.trim() !== "") return avatar
  const safeSeed = encodeURIComponent((seed ?? "user").trim() || "user")
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

export function formatUnits(value: string, decimals: number): string {
  const s = value.padStart(decimals + 1, "0")
  const intPart = s.slice(0, s.length - decimals) || "0"
  const fracPart = s.slice(s.length - decimals)
  const trimmed = fracPart.replace(/0+$/, "")
  return trimmed ? `${intPart}.${trimmed}` : intPart
}
