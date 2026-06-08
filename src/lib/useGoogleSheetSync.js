import { useCallback, useEffect, useRef } from 'react'
import { useAppSettings } from '../context/useAppSettings'
import { syncExpensesFromSheet } from './googleSheetSync'

/** Polls the linked Google Sheet and syncs expenses while enabled. */
export function useGoogleSheetSync() {
  const { settings, reload } = useAppSettings()
  const busy = useRef(false)

  const runSync = useCallback(async () => {
    if (!settings.sheet_sync_enabled || !settings.sheet_sync_url?.trim()) return null
    if (busy.current) return null
    busy.current = true
    try {
      const result = await syncExpensesFromSheet(settings)
      await reload()
      return result
    } finally {
      busy.current = false
    }
  }, [settings, reload])

  useEffect(() => {
    if (!settings.sheet_sync_enabled || !settings.sheet_sync_url?.trim()) return undefined

    void runSync()
    const seconds = Math.max(15, Number(settings.sheet_sync_interval_seconds) || 60)
    const id = setInterval(() => void runSync(), seconds * 1000)
    return () => clearInterval(id)
  }, [
    settings.sheet_sync_enabled,
    settings.sheet_sync_url,
    settings.sheet_sync_interval_seconds,
    runSync,
  ])

  return { runSync }
}
