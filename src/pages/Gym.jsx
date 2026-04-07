import { useState, useMemo } from 'react'
import { CheckCircle, Trash2 } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { useGymSessions } from '../lib/hooks'
import { budgetLineAmount, fmt, getCurrentMonth } from '../lib/constants'
import { Card, MetricCard, ProgressBar, SectionTitle, Btn, Spinner, MonthPicker } from '../components/UI'
import { format, parseISO, getDaysInMonth, getDay } from 'date-fns'

export default function Gym() {
  const { settings } = useAppSettings()
  const gymBudget = budgetLineAmount(settings.budget, settings.gym_category)
  const sessionCost = Number(settings.gym_session_cost) || 0
  const sessionsPerWeek = Number(settings.gym_sessions_per_week) || 1

  const [month, setMonth] = useState(getCurrentMonth())
  const { sessions, loading, logSession, removeSession } = useGymSessions(month)
  const [logging, setLogging] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const stats = useMemo(() => {
    const count = sessions.length
    const spent = count * sessionCost
    const unspent = Math.max(0, gymBudget - spent)
    const maxSessions = sessionCost > 0 ? Math.floor(gymBudget / sessionCost) : 0
    const sessionDates = new Set(sessions.map(s => s.date))
    return { count, spent, unspent, maxSessions, sessionDates }
  }, [sessions, gymBudget, sessionCost])

  const handleLog = async () => {
    if (stats.sessionDates.has(today)) return
    setLogging(true)
    await logSession(today)
    setLogging(false)
  }

  const handleRemove = async (id) => {
    setDeleting(id)
    await removeSession(id)
    setDeleting(null)
  }

  // Build calendar for the month
  const [year, mon] = month.split('-').map(Number)
  const firstDay = new Date(year, mon - 1, 1)
  const daysInMonth = getDaysInMonth(firstDay)
  const startWeekday = getDay(firstDay)

  const calDays = []
  for (let i = 0; i < startWeekday; i++) calDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`
    calDays.push({ d, dateStr, hasSession: stats.sessionDates.has(dateStr) })
  }

  const todayLogged = stats.sessionDates.has(today)
  const isCurrentMonth = month === getCurrentMonth()

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Gym tracker</h1>
          <p className="page-subtitle">
            Target {sessionsPerWeek}× / week · {fmt(sessionCost)} / session (from «{settings.gym_category}» budget)
          </p>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          {isCurrentMonth && (
            <Btn onClick={handleLog} disabled={logging || todayLogged} variant={todayLogged ? 'ghost' : 'success'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {todayLogged ? <><CheckCircle size={15} /> Logged today</> : <>{logging ? 'Logging…' : '+ Log today'}</>}
            </Btn>
          )}
        </div>
      </header>

      <div className="metric-grid">
        <MetricCard
          label="Sessions attended"
          value={stats.count}
          prefix=""
          sub={sessionCost > 0 ? `of ${stats.maxSessions} max` : 'Set session cost in Settings'}
          color="var(--teal)"
        />
        <MetricCard label="Actual gym spend" value={stats.spent} />
        <MetricCard label="Unspent → savings" value={stats.unspent} color="var(--green)" />
        <MetricCard label="Budget" value={gymBudget} color="var(--muted)" />
      </div>

      {/* Progress */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: 'var(--muted)' }}>Sessions this month</span>
          <span style={{ fontWeight: 600 }}>
            {sessionCost > 0 ? `${stats.count} / ${stats.maxSessions}` : `${stats.count}`}
          </span>
        </div>
        {sessionCost > 0 ? (
          <ProgressBar value={stats.count} max={Math.max(1, stats.maxSessions)} color="var(--teal)" height={10} />
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Add a per-session cost under Settings to compare visits with your gym allowance.
          </p>
        )}
        {stats.unspent > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
            UGX {fmt(stats.unspent)} rolling to savings from missed sessions
          </div>
        )}
      </Card>

      {/* Calendar */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Session calendar</SectionTitle>
        <div className="gym-calendar-grid">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, paddingBottom: 4 }}>{d}</div>
          ))}
          {loading ? null : calDays.map((day, i) => (
            <div key={i} style={{
              aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: day?.hasSession ? 700 : 400,
              background: day?.hasSession ? 'rgba(61,190,122,0.15)' : day?.dateStr === today ? 'rgba(91,140,255,0.1)' : 'transparent',
              color: day?.hasSession ? 'var(--green)' : day?.dateStr === today ? 'var(--accent)' : day ? 'var(--text)' : 'transparent',
              border: day?.dateStr === today ? '1px solid var(--accent)' : '1px solid transparent',
            }}>
              {day ? (
                day.hasSession
                  ? <span title={`Session on ${day.dateStr}`}>✓ {day.d}</span>
                  : day.d
              ) : ''}
            </div>
          ))}
        </div>
      </Card>

      {/* Session list */}
      <Card>
        <SectionTitle>Session log</SectionTitle>
        {loading ? <Spinner /> : sessions.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '1rem 0' }}>No sessions logged yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sessions.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 0',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={15} color="var(--green)" />
                  <span style={{ fontSize: 13 }}>{format(parseISO(s.date), 'EEEE, MMM d')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>UGX {fmt(sessionCost)}</span>
                  <button onClick={() => handleRemove(s.id)} disabled={deleting === s.id}
                    style={{ background: 'none', color: 'var(--muted)', padding: 4, opacity: deleting === s.id ? 0.4 : 1 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
