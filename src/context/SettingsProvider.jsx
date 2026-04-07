import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_APP_SETTINGS } from '../lib/constants'
import { mergeDefaults, rowToSettings, settingsToRow } from '../lib/settingsDb'
import { AppSettingsContext } from './settingsContext'

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()

    if (fetchError) {
      console.error('[app_settings]', fetchError.message, fetchError)
      setError(fetchError)
      setSettings(mergeDefaults({}))
      setLoading(false)
      return
    }

    if (!data) {
      const row = settingsToRow(DEFAULT_APP_SETTINGS)
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
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  useEffect(() => {
    const title = settings?.app_title?.trim()
    if (title) document.title = title
  }, [settings?.app_title])

  const saveSettings = useCallback(async (next) => {
    const merged = mergeDefaults(next)
    const row = settingsToRow(merged)
    const { error: upsertError } = await supabase.from('app_settings').upsert(row, { onConflict: 'id' })
    if (upsertError) {
      console.error('[app_settings upsert]', upsertError.message, upsertError)
      return { error: upsertError }
    }
    setSettings(merged)
    return { error: null }
  }, [])

  const value = useMemo(
    () => ({
      settings: settings ?? DEFAULT_APP_SETTINGS,
      loading,
      error,
      reload: load,
      saveSettings,
    }),
    [settings, loading, error, load, saveSettings],
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}
