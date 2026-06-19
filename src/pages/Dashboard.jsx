import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAppSettings } from '../context/useAppSettings'
import { useExpenses, useInvestments, useTrackerLogsBatch, useExpensesHistory } from '../lib/hooks'
import { budgetLineAmount, fmt, getCurrentMonth } from '../lib/constants'
import { computeTrackerSummary, enabledTrackers, getTrackerIcon } from '../lib/trackers'
import { buildSpendingProfile, buildSpendingGamification } from '../lib/spendingProfile'
import SpendingProfileGame from '../components/SpendingProfileGame'
import { Card, MetricCard, ProgressBar, SectionTitle, Badge, MonthPicker, Spinner } from '../components/UI'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--surface-solid)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: UGX {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { settings } = useAppSettings()
  const { salary, budget } = settings
  const [month, setMonth] = useState(getCurrentMonth())
  const trackers = useMemo(() => enabledTrackers(settings.trackers), [settings.trackers])
  const trackerIds = useMemo(() => trackers.map((t) => t.id), [trackers])
  const { expenses, loading } = useExpenses(month)
  const { expenses: profileExpenses } = useExpensesHistory(6, month)
  const { transactions } = useInvestments(month)
  const { logsByTracker, loading: trackersLoading } = useTrackerLogsBatch(month, trackerIds)

  const trackerSummaries = useMemo(
    () =>
      trackers.map((tracker) => ({
        tracker,
        stats: computeTrackerSummary(tracker, logsByTracker[tracker.id] || [], {
          month,
          budgetAmount: budgetLineAmount(budget, tracker.budget_category),
          expenses,
        }),
      })),
    [trackers, logsByTracker, month, budget, expenses],
  )

  const { totalSpend, remaining, byCategory, chartData, otherSpend } = useMemo(() => {
    const totalSpend = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const investedOutflow = transactions
      .filter((t) => ['buy', 'deposit'].includes(t.tx_type))
      .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)
    const remaining = salary - totalSpend - investedOutflow

    const spendMap = {}
    expenses.forEach((e) => {
      spendMap[e.category] = (spendMap[e.category] || 0) + e.amount
    })

    const budgetNames = new Set(budget.map((b) => b.category))
    const otherSpend = Object.entries(spendMap)
      .filter(([cat]) => !budgetNames.has(cat))
      .reduce((sum, [, amt]) => sum + amt, 0)

    const byCategory = budget.map((b) => ({
      ...b,
      actual: spendMap[b.category] || 0,
      variance: b.amount - (spendMap[b.category] || 0),
      pct: Math.min(100, Math.round(((spendMap[b.category] || 0) / b.amount) * 100)),
    }))

    if (otherSpend > 0) {
      byCategory.push({
        category: 'Other (not in budget)',
        amount: 0,
        type: 'variable',
        color: 'var(--muted)',
        actual: otherSpend,
        variance: -otherSpend,
        pct: 100,
      })
    }

    const chartData = byCategory.map((b) => ({
      name: b.category.split(' ')[0],
      Budget: b.amount,
      Actual: b.actual,
      color: b.color,
    }))

    return { totalSpend, remaining, byCategory, chartData, otherSpend }
  }, [expenses, salary, budget, transactions])

  const typeColor = { fixed: 'var(--teal)', variable: 'var(--amber)', savings: 'var(--green)' }
  const investedThisMonth = transactions
    .filter((t) => t.tx_type === 'buy' || t.tx_type === 'deposit')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)
  const incomeUsed = totalSpend + investedThisMonth

  const spendingProfile = useMemo(
    () => buildSpendingProfile(profileExpenses, { salary, budget }),
    [profileExpenses, salary, budget],
  )

  const spendingGame = useMemo(
    () => buildSpendingGamification(spendingProfile),
    [spendingProfile],
  )

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your money at a glance</p>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </header>

      <div className="metric-grid">
        <MetricCard label="Monthly salary" value={salary} />
        <MetricCard label="Total spent" value={totalSpend} color={totalSpend > salary * 0.8 ? 'var(--red)' : 'var(--text)'} />
        <MetricCard label="Remaining" value={remaining} color={remaining < 0 ? 'var(--red)' : 'var(--green)'} />
        <MetricCard label="Invested (month)" value={investedThisMonth} color="var(--accent)" />
        <MetricCard
          label="% income allocated"
          value={salary > 0 ? Math.round((incomeUsed / salary) * 100) : 0}
          prefix=""
          sub={`of UGX ${fmt(salary)}`}
          color={incomeUsed > salary ? 'var(--red)' : 'var(--text)'}
        />
      </div>

      {!loading && expenses.length === 0 && (
        <Card style={{ marginBottom: '1.5rem', borderColor: 'var(--amber)' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            No expenses for this month. If you just synced a sheet, use the <strong>month picker</strong> above — imported
            rows only appear for the month they are dated in.
          </p>
        </Card>
      )}

      {!loading && otherSpend > 0 && (
        <Card style={{ marginBottom: '1.5rem', borderColor: 'var(--amber)' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            UGX {fmt(otherSpend)} synced from your sheet uses categories not in Settings → Budget. Rename the{' '}
            <strong>category</strong> column in your sheet to match your budget names, or see &ldquo;Other (not in
            budget)&rdquo; below.
          </p>
        </Card>
      )}

      <SpendingProfileGame profile={spendingProfile} game={spendingGame} />

      {trackers.length > 0 && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
            <SectionTitle style={{ marginBottom: 0 }}>Personal trackers</SectionTitle>
            <Link to="/trackers" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          {trackersLoading ? (
            <Spinner />
          ) : (
            <div className="dashboard-tracker-grid">
              {trackerSummaries.map(({ tracker, stats }) => {
                const Icon = getTrackerIcon(tracker.icon)
                const unitPlural = stats.unitLabel.endsWith('s') ? stats.unitLabel : `${stats.unitLabel}s`
                return (
                  <Link key={tracker.id} to={`/trackers/${tracker.id}`} className="dashboard-tracker-card">
                    <div className="dashboard-tracker-head">
                      <div className="dashboard-tracker-icon" aria-hidden>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="dashboard-tracker-title">{tracker.label}</div>
                        <div className="dashboard-tracker-meta">
                          {stats.isCurrentMonth && stats.weekCount != null
                            ? `${stats.weekCount}/${stats.targetPerWeek} this week`
                            : `${stats.count} ${unitPlural} this month`}
                        </div>
                      </div>
                    </div>
                    {stats.isCurrentMonth && stats.weekCount != null && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                          <span>This week</span>
                          <span>{stats.weekCount} / {stats.targetPerWeek}</span>
                        </div>
                        <ProgressBar value={stats.weekCount} max={stats.targetPerWeek} color="var(--teal)" height={6} />
                      </div>
                    )}
                    <div style={{ marginBottom: stats.unspent > 0 ? 8 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                        <span>This month</span>
                        <span>
                          {stats.count}
                          {stats.maxUnits != null ? ` / ${stats.maxUnits}` : ` / ${stats.monthTarget}`}
                        </span>
                      </div>
                      <ProgressBar
                        value={stats.count}
                        max={stats.maxUnits ?? stats.monthTarget}
                        color="var(--accent)"
                        height={6}
                      />
                    </div>
                    {stats.unspent > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
                        UGX {fmt(stats.unspent)} unspent
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Salary progress bar */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--muted)' }}>Salary used</span>
          <span style={{ fontWeight: 600 }}>{fmt(incomeUsed)} / {fmt(salary)}</span>
        </div>
        <ProgressBar value={incomeUsed} max={salary} color="var(--accent)" height={10} />
      </Card>

      {/* Chart */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Budget vs actual by category</SectionTitle>
        {loading ? (
          <Spinner />
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Budget" fill="#ffffff18" radius={[4,4,0,0]} />
              <Bar dataKey="Actual" radius={[4,4,0,0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Category breakdown */}
      <Card>
        <SectionTitle>Category breakdown</SectionTitle>
        {loading ? <Spinner /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {byCategory.map(cat => (
              <div key={cat.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{cat.category}</span>
                    <Badge color={typeColor[cat.type]}>{cat.type}</Badge>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: cat.actual > cat.amount ? 'var(--red)' : 'var(--text)' }}>
                      {fmt(cat.actual)}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}> / {fmt(cat.amount)}</span>
                  </div>
                </div>
                <ProgressBar value={cat.actual} max={cat.amount} color={cat.color} showPct />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
