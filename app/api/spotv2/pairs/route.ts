import { NextResponse } from "next/server"
import { fetchSpotV2Pairs } from "@/lib/spotv2/pairs"

export async function GET() {
  const pairs = await fetchSpotV2Pairs()
  return NextResponse.json({ success: true, pairs })
}
