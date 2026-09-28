"use client"

/**
 * The app's ErrorDetail, fed by describeFiatError. The message is ours
 * (never the backend's text, guide §12.2 lines 1093-1094); the "Details"
 * toggle carries only the request reference for support (guide §4 lines
 * 204-205, §12 "keep the request ID").
 */

import { ErrorDetail } from "@/components/ui/flow"
import type { FiatErrorDescription } from "@/lib/crypto-backend/fiat-errors"

export function FiatErrorDetail({ error }: { error: FiatErrorDescription }) {
  return <ErrorDetail message={error.message} raw={error.requestId ? `Reference: ${error.requestId}` : null} />
}
