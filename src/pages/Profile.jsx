import { useMemo } from 'react'
import { useAppSettings } from '../context/useAppSettings'
import { useExpensesHistory } from '../lib/hooks'
import { getCurrentMonth } from '../lib/constants'
import { buildSpendingProfile, buildSpendingGamification } from '../lib/spendingProfile'
import SpendingProfileGame from '../components/SpendingProfileGame'
import ProfileGamificationDetails from '../components/ProfileGamificationDetails'
import SpendingProfile from '../components/SpendingProfile'
import { Spinner } from '../components/UI'

export default function Profile() {
  const { settings } = useAppSettings()
  const { salary, budget } = settings
  const month = getCurrentMonth()
  const { expenses, loading } = useExpensesHistory(6, month)

  const spendingProfile = useMemo(
    () => buildSpendingProfile(expenses, { salary, budget }),
    [expenses, salary, budget],
  )

  const spendingGame = useMemo(
    () => buildSpendingGamification(spendingProfile),
    [spendingProfile],
  )

  return (
    <div className="page profile-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Your spending personality, progress, and habits</p>
        </div>
      </header>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <SpendingProfileGame profile={spendingProfile} game={spendingGame} fullPage />
          <ProfileGamificationDetails game={spendingGame} />
          <SpendingProfile profile={spendingProfile} />
        </>
      )}
    </div>
  )
}
