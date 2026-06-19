import { useCallback, useEffect, useRef } from 'react'
import { useAppSettings } from '../context/useAppSettings'
import {
  hasExpenseOnDate,
  shouldSendTrackingReminder,
  showTrackingReminder,
  todayDateStr,
} from './trackingReminders'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

/** Poll for reminder time and fire a browser notification (max once per day). */
export function useTrackingReminders() {
  const { settings, saveTrackingReminders } = useAppSettings()
  const checkingRef = useRef(false)

  const runCheck = useCallback(async () => {
    if (checkingRef.current || !settings?.tracking_reminders?.enabled) return
    checkingRef.current = true
    try {
      const today = todayDateStr()
      const hasExpenseToday = await hasExpenseOnDate(today)
      if (
        !shouldSendTrackingReminder({
          reminders: settings.tracking_reminders,
          hasExpenseToday,
        })
      ) {
        return
      }

      const sent = showTrackingReminder({ appTitle: settings.app_title })
      if (!sent) return

      await saveTrackingReminders({
        ...settings.tracking_reminders,
        last_sent_at: new Date().toISOString(),
      })
    } finally {
      checkingRef.current = false
    }
  }, [settings, saveTrackingReminders])

  useEffect(() => {
    if (!settings?.tracking_reminders?.enabled) return undefined

    void runCheck()
    const id = window.setInterval(() => void runCheck(), CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [runCheck, settings?.tracking_reminders?.enabled])
}
