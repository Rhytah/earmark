import { useEffect, useMemo, useRef } from 'react'
import { useAppSettings } from '../context/useAppSettings'
import { useAuth } from '../context/useAuth'
import { mergeGamificationProgress } from '../lib/profileBadges'
import { buildSpendingGamification } from '../lib/spendingProfile'

/** Build gamification UI state and persist new badges / peak XP to Supabase. */
export function useSpendingGamification(profile) {
  const { settings, saveGamification } = useAppSettings()
  const { user } = useAuth()
  const persistKeyRef = useRef('')

  const { game, nextGamification, dirty } = useMemo(() => {
    const built = buildSpendingGamification(profile)
    return mergeGamificationProgress(built, settings.gamification, user?.id)
  }, [profile, settings.gamification, user?.id])

  useEffect(() => {
    if (!dirty || !nextGamification || !user?.id) return
    const key = JSON.stringify(nextGamification)
    if (persistKeyRef.current === key) return
    persistKeyRef.current = key
    void saveGamification(nextGamification)
  }, [dirty, nextGamification, user?.id, saveGamification])

  return game
}
