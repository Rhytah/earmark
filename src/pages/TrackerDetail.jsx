import { useState, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CheckCircle, Trash2, ChevronLeft } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { useTrackerLogs, useExpenses } from '../lib/hooks'
import { budgetLineAmount, fmt, getCurrentMonth } from '../lib/constants'
import { findTracker, computeTrackerSummary, mergeTrackerActivity, buildTrackerExpense, isTrackerGeneratedExpense, trackerExpenses } from '../lib/trackers'
import { Card, MetricCard, ProgressBar, SectionTitle, Btn, Spinner, MonthPicker } from '../components/UI'
import { format, parseISO, getDaysInMonth, getDay } from 'date-fns'

export default function TrackerDetail() {
  const { trackerId } = useParams()
  const { settings } = useAppSettings()
  const tracker = findTracker(settings.trackers, trackerId)

  const budget = budgetLineAmount(settings.budget, tracker?.budget_category)
  const unitCost = Number(tracker?.unit_cost) || 0
  const targetPerWeek = Number(tracker?.target_per_week) || 1
  const unitLabel = tracker?.unit_label || 'session'
  const unitLabelPlural = unitLabel.endsWith('s') ? unitLabel : `${unitLabel}s`

  const [month, setMonth] = useState(getCurrentMonth())
  const { logs, loading, logEntry, removeLog } = useTrackerLogs(trackerId, month)
  const { expenses, loading: expensesLoading, addExpense, deleteExpense } = useExpenses(month)
  const [loggingDate, setLoggingDate] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const paymentMethods = settings.payment_methods?.length ? settings.payment_methods : ['Card']

  const today = new Date().toISOString().split('T')[0]

  const activity = useMemo(
    () => (tracker ? mergeTrackerActivity(tracker, logs, expenses) : null),
    [tracker, logs, expenses],
  )

  const stats = useMemo(() => {
    if (!tracker || !activity) {
      return { count: 0, spent: 0, unspent: 0, maxUnits: 0, logDates: new Set() }
    }
    const summary = computeTrackerSummary(tracker, logs, {
      month,
      budgetAmount: budget,
      expenses,
    })
    return {
      count: summary.count,
      spent: summary.spent,
      unspent: summary.unspent,
      maxUnits: summary.maxUnits ?? (unitCost > 0 ? Math.floor(budget / unitCost) : 0),
      logDates: activity.dates,
      expenseCount: summary.expenseCount,
    }
  }, [tracker, logs, expenses, activity, month, budget, unitCost])

  if (!tracker || !tracker.enabled) {
    return <Navigate to="/trackers" replace />
  }

  const handleLog = async (dateStr) => {
    if (!dateStr || stats.logDates.has(dateStr) || dateStr > today) return
    setLoggingDate(dateStr)
    const { error: logError } = await logEntry(dateStr)
    if (logError) {
      setLoggingDate(null)
      return
    }

    const expensePayload = buildTrackerExpense(tracker, dateStr, paymentMethods[0])
    if (expensePayload) {
      const existingOnDate = trackerExpenses(tracker, expenses).filter((e) => e.date === dateStr)
      if (existingOnDate.length === 0) {
        await addExpense(expensePayload)
      }
    }
    setLoggingDate(null)
  }

  const handleRemove = async (entry) => {
    setDeleting(entry.date)
    if (entry.log) {
      await removeLog(entry.log.id)
    }
    if (entry.source === 'log') {
      const linkedExpense = expenses.find(
        (e) => e.date === entry.date && isTrackerGeneratedExpense(e, tracker),
      )
      if (linkedExpense) {
        await deleteExpense(linkedExpense.id)
      }
    }
    setDeleting(null)
  }

  const [year, mon] = month.split('-').map(Number)
  const firstDay = new Date(year, mon - 1, 1)
  const daysInMonth = getDaysInMonth(firstDay)
  const startWeekday = getDay(firstDay)

  const calDays = []
  for (let i = 0; i < startWeekday; i++) calDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`
    calDays.push({ d, dateStr, logged: stats.logDates.has(dateStr) })
  }

  const todayLogged = stats.logDates.has(today)
  const isCurrentMonth = month === getCurrentMonth()

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/trackers" className="tracker-back-link">
            <ChevronLeft size={16} /> All trackers
          </Link>
          <h1 className="page-title">{tracker.label}</h1>
          <p className="page-subtitle">
            Target {targetPerWeek}× / week
            {unitCost > 0 && (
              <>
                {' '}
                · {fmt(unitCost)} / {unitLabel} (from «{tracker.budget_category}» budget)
              </>
            )}
            {unitCost <= 0 && tracker.budget_category && (
              <> · linked to «{tracker.budget_category}» expenses</>
            )}
          </p>
          {tracker.budget_category && unitCost > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Logging a {unitLabel} adds an expense in «{tracker.budget_category}» for UGX {fmt(unitCost)}.
            </p>
          )}
          {tracker.budget_category && unitCost <= 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Expenses in «{tracker.budget_category}» count automatically — manual logs fill gaps.
            </p>
          )}
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          {isCurrentMonth && !todayLogged && (
            <Btn
              onClick={() => void handleLog(today)}
              disabled={Boolean(loggingDate)}
              variant="success"
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              {loggingDate === today ? 'Logging…' : `+ Log ${unitLabel}`}
            </Btn>
          )}
          {isCurrentMonth && todayLogged && (
            <Btn variant="ghost" disabled style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <CheckCircle size={15} /> Logged today
            </Btn>
          )}
        </div>
      </header>

      <div className="metric-grid">
        <MetricCard
          label={`${unitLabelPlural.charAt(0).toUpperCase()}${unitLabelPlural.slice(1)} logged`}
          value={stats.count}
          prefix=""
          sub={unitCost > 0 ? `of ${stats.maxUnits} max` : `this month`}
          color="var(--teal)"
        />
        {unitCost > 0 && <MetricCard label="Actual spend" value={stats.spent} />}
        {unitCost > 0 && <MetricCard label="Unspent → savings" value={stats.unspent} color="var(--green)" />}
        {budget > 0 && <MetricCard label="Budget" value={budget} color="var(--muted)" />}
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: 'var(--muted)' }}>{unitLabelPlural} this month</span>
          <span style={{ fontWeight: 600 }}>
            {unitCost > 0 ? `${stats.count} / ${stats.maxUnits}` : `${stats.count}`}
          </span>
        </div>
        {unitCost > 0 ? (
          <ProgressBar value={stats.count} max={Math.max(1, stats.maxUnits)} color="var(--teal)" height={10} />
        ) : (
          <ProgressBar value={stats.count} max={Math.max(1, targetPerWeek * 4)} color="var(--teal)" height={10} />
        )}
        {stats.unspent > 0 && unitCost > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
            UGX {fmt(stats.unspent)} rolling to savings from missed {unitLabelPlural}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Calendar</SectionTitle>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-0.35rem 0 0.85rem' }}>
          Tap a day to log a past or current {unitLabel}. Future dates cannot be logged.
        </p>
        <div className="tracker-calendar-grid">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, paddingBottom: 4 }}>
              {d}
            </div>
          ))}
          {loading
            ? null
            : calDays.map((day, i) => {
                if (!day) {
                  return <div key={i} aria-hidden />
                }
                const isFuture = day.dateStr > today
                const canLog = !day.logged && !isFuture
                const isLogging = loggingDate === day.dateStr
                const dayClasses = [
                  'tracker-calendar-day',
                  day.logged ? 'tracker-calendar-day--logged' : '',
                  day.dateStr === today ? 'tracker-calendar-day--today' : '',
                  canLog ? 'tracker-calendar-day--clickable' : '',
                  isLogging ? 'tracker-calendar-day--busy' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                if (canLog) {
                  return (
                    <button
                      key={i}
                      type="button"
                      className={dayClasses}
                      onClick={() => void handleLog(day.dateStr)}
                      disabled={Boolean(loggingDate)}
                      title={`Log ${unitLabel} on ${day.dateStr}`}
                      aria-label={`Log ${unitLabel} on ${format(parseISO(day.dateStr), 'MMMM d')}`}
                    >
                      {isLogging ? '…' : day.d}
                    </button>
                  )
                }

                return (
                  <div key={i} className={dayClasses} title={day.logged ? `Logged ${day.dateStr}` : undefined}>
                    {day.logged ? <span>✓ {day.d}</span> : day.d}
                  </div>
                )
              })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Activity</SectionTitle>
        {loading || expensesLoading ? (
          <Spinner />
        ) : !activity?.entries.length ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '1rem 0' }}>
            No {unitLabelPlural} yet — log manually or add expenses in «{tracker.budget_category || 'this category'}».
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activity.entries.map((entry, i) => (
              <div
                key={entry.date}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 0',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <CheckCircle size={15} color="var(--green)" />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13 }}>{format(parseISO(entry.date), 'EEEE, MMM d')}</span>
                    {entry.expenses.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {entry.expenses.map((e) => e.description).filter(Boolean).join(' · ') || 'Expense'}
                        {entry.source === 'both' && ' · manual log'}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {entry.amount > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 600 }}>UGX {fmt(entry.amount)}</span>
                  )}
                  {entry.source === 'expense' ? (
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Expense</span>
                  ) : (
                    <button
                      onClick={() => void handleRemove(entry)}
                      disabled={deleting === entry.date}
                      style={{
                        background: 'none',
                        color: 'var(--muted)',
                        padding: 4,
                        opacity: deleting === entry.date ? 0.4 : 1,
                      }}
                      title={entry.source === 'both' ? 'Remove manual log' : 'Remove log and expense'}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
