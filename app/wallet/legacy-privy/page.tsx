import type { Metadata } from "next"
import { LegacyPrivyWalletPage } from "@/components/legacy/LegacyPrivyWalletPage"

export const metadata: Metadata = { title: "Legacy Privy Wallet" }

export default function LegacyPrivyWalletRoute() { return <LegacyPrivyWalletPage /> }
