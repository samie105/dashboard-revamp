import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUnits(value: string, decimals: number): string {
  const s = value.padStart(decimals + 1, "0")
  const intPart = s.slice(0, s.length - decimals) || "0"
  const fracPart = s.slice(s.length - decimals)
  const trimmed = fracPart.replace(/0+$/, "")
  return trimmed ? `${intPart}.${trimmed}` : intPart
}
