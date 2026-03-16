"use client"

import { useState, useCallback } from "react"

export type PanelKey = "left" | "right" | "bottom"

export function usePanelLayout() {
  const [collapsed, setCollapsed] = useState<Record<PanelKey, boolean>>({
    left: false,
    right: false,
    bottom: true,
  })

  const toggle = useCallback((key: PanelKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return { collapsed, toggle }
}
