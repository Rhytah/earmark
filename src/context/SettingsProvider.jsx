import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_APP_SETTINGS } from '../lib/constants'
import { mergeDefaults, normalizeGamification, normalizeTrackingReminders, rowToSettings, settingsToRow } from '../lib/settingsDb'
import { useAuth } from './useAuth'
import { AppSettingsContext } from './settingsContext'

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) {
      setSettings(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('[app_settings]', fetchError.message, fetchError)
      setError(fetchError)
      setSettings(mergeDefaults({}))
      setLoading(false)
      return
    }

    if (!data) {
      const row = settingsToRow(DEFAULT_APP_SETTINGS, user.id)
      const { data: created, error: insertError } = await supabase
        .from('app_settings')
        .insert(row)
        .select('*')
        .single()

      if (insertError) {
        console.error('[app_settings insert]', insertError.message, insertError)
        setError(insertError)
        setSettings(mergeDefaults({}))
      } else {
        setSettings(rowToSettings(created))
      }
      setLoading(false)
      return
    }

    setSettings(rowToSettings(data))
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  useEffect(() => {
    const title = settings?.app_title?.trim()
    if (title) document.title = title
  }, [settings?.app_title])

  const saveSettings = useCallback(
    async (next) => {
      if (!user?.id) return { error: new Error('Not signed in') }

      const merged = mergeDefaults(next)
      const row = settingsToRow(merged, user.id)
      const { error: upsertError } = await supabase.from('app_settings').upsert(row, { onConflict: 'user_id' })
      if (upsertError) {
        console.error('[app_settings upsert]', upsertError.message, upsertError)
        return { error: upsertError }
      }
      setSettings(merged)
      return { error: null }
    },
    [user?.id],
  )

  const saveGamification = useCallback(
    async (gamification) => {
      if (!user?.id) return { error: new Error('Not signed in') }

      const normalized = normalizeGamification(gamification)
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ gamification: normalized, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[app_settings gamification]', updateError.message, updateError)
        return { error: updateError }
      }

      setSettings((prev) => ({
        ...(prev ?? DEFAULT_APP_SETTINGS),
        gamification: normalized,
      }))
      return { error: null }
    },
    [user?.id],
  )

  const saveTrackingReminders = useCallback(
    async (trackingReminders) => {
      if (!user?.id) return { error: new Error('Not signed in') }

      const normalized = normalizeTrackingReminders(trackingReminders)
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ tracking_reminders: normalized, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[app_settings tracking_reminders]', updateError.message, updateError)
        return { error: updateError }
      }

      setSettings((prev) => ({
        ...(prev ?? DEFAULT_APP_SETTINGS),
        tracking_reminders: normalized,
      }))
      return { error: null }
    },
    [user?.id],
  )

  const value = useMemo(
    () => ({
      settings: settings ?? DEFAULT_APP_SETTINGS,
      loading,
      error,
      reload: load,
      saveSettings,
      saveGamification,
      saveTrackingReminders,
    }),
    [settings, loading, error, load, saveSettings, saveGamification, saveTrackingReminders],
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}
