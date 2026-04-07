import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAppSettings } from '../context/useAppSettings'
import { useExpenses } from '../lib/hooks'
import { fmt, getCurrentMonth } from '../lib/constants'
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
  const { expenses, loading } = useExpenses(month)

  const { totalSpend, remaining, byCategory, chartData } = useMemo(() => {
    const totalSpend = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const remaining = salary - totalSpend

    const spendMap = {}
    expenses.forEach(e => {
      spendMap[e.category] = (spendMap[e.category] || 0) + e.amount
    })

    const byCategory = budget.map(b => ({
      ...b,
      actual: spendMap[b.category] || 0,
      variance: b.amount - (spendMap[b.category] || 0),
      pct: Math.min(100, Math.round(((spendMap[b.category] || 0) / b.amount) * 100)),
    }))

    const chartData = byCategory.map(b => ({
      name: b.category.split(' ')[0],
      Budget: b.amount,
      Actual: b.actual,
      color: b.color,
    }))

    return { totalSpend, remaining, byCategory, chartData }
  }, [expenses, salary, budget])

  const typeColor = { fixed: 'var(--teal)', variable: 'var(--amber)', savings: 'var(--green)' }

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
        <MetricCard
          label="% used"
          value={salary > 0 ? Math.round((totalSpend / salary) * 100) : 0}
          prefix=""
          sub={`of UGX ${fmt(salary)}`}
          color={totalSpend > salary ? 'var(--red)' : 'var(--text)'}
        />
      </div>

      {/* Salary progress bar */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--muted)' }}>Salary used</span>
          <span style={{ fontWeight: 600 }}>{fmt(totalSpend)} / {fmt(salary)}</span>
        </div>
        <ProgressBar value={totalSpend} max={salary} color="var(--accent)" height={10} />
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
