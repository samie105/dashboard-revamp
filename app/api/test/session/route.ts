import { NextResponse } from "next/server"

import {
  createDashboardTestSession,
  DASHBOARD_TEST_SESSION_COOKIE,
  isDashboardTestAccessKey,
} from "@/lib/dashboard-test-auth"
import { SERVER_DASHBOARD_TEST_MODE } from "@/lib/dashboard-test-mode"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = process.env.WORLDSTREET_DASHBOARD_TEST_AUTH_SECRET
  if (!SERVER_DASHBOARD_TEST_MODE || !secret) {
    return NextResponse.json({ error: "Test authentication is disabled" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const accessKey = body && typeof body === "object" && "accessKey" in body
    ? (body as { accessKey?: unknown }).accessKey
    : undefined
  if (!isDashboardTestAccessKey(accessKey, secret)) {
    return NextResponse.json({ error: "Invalid test access key" }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: DASHBOARD_TEST_SESSION_COOKIE,
    value: await createDashboardTestSession(secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: DASHBOARD_TEST_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}

