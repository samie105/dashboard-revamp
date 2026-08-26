"use client"

import { useCallback, useEffect, useState } from "react"
import type { Network } from "@/lib/crypto/client"
import { useCryptoApi } from "./useCryptoApi"

/** Server-driven network list (guide §5: never hardcode the enabled set). */
export function useNetworks() {
  const api = useCryptoApi()
  const [networks, setNetworks] = useState<Network[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    api.client
      .listNetworks()
      .then(setNetworks)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load networks"),
      )
      .finally(() => setLoading(false))
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { networks, loading, error, refresh }
}
