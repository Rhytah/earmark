import { useContext } from 'react'
import { AppSettingsContext } from './settingsContext'

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettings must be used within SettingsProvider')
  return ctx
}
