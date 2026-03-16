"use client"

import { useState, useCallback } from "react"

export type PanelKey = "left" | "right" | "bottom" | "order"

export function usePanelLayout() {
  const [collapsed, setCollapsed] = useState<Record<PanelKey, boolean>>({
    left: false,
    right: false,
    bottom: false,
    order: false,
  })

  const toggle = useCallback((key: PanelKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return { collapsed, toggle }
}
