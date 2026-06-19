import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useAppSettings } from '../context/useAppSettings'
import { useExpenses } from '../lib/hooks'
import { getCurrentMonth } from '../lib/constants'
import { shouldShowInAppNudge, todayDateStr } from '../lib/trackingReminders'
import { Card } from './UI'

export default function TrackReminderBanner() {
  const { settings } = useAppSettings()
  const month = getCurrentMonth()
  const { expenses, loading } = useExpenses(month)
  const today = todayDateStr()

  const hasExpenseToday = useMemo(
    () => expenses.some((e) => String(e.date).slice(0, 10) === today),
    [expenses, today],
  )

  const show = !loading && shouldShowInAppNudge({
    reminders: settings.tracking_reminders,
    hasExpenseToday,
  })

  if (!show) return null

  return (
    <Card className="track-reminder-banner">
      <div className="track-reminder-banner-body">
        <span className="track-reminder-banner-icon" aria-hidden>
          📝
        </span>
        <div>
          <strong>Time to log today&apos;s spending</strong>
          <p>No expenses logged yet today — a quick entry keeps your profile and budget accurate.</p>
        </div>
      </div>
      <Link to="/expenses" className="track-reminder-banner-link">
        Add expense <ChevronRight size={16} />
      </Link>
    </Card>
  )
}
