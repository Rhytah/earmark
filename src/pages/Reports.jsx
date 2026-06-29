import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis } from 'recharts'
import { useAppSettings } from '../context/useAppSettings'
import { useExpensesRange, useIncomeRange, useInvestmentsRange, useSavingsSnapshot } from '../lib/hooks'
import { fmt, getCurrentMonth } from '../lib/constants'
import { addMonths, buildReportsData, monthLabel } from '../lib/reportsBuilder'
import EarningsForecastGuide from '../components/EarningsForecastGuide'
import { Card, MetricCard, SectionTitle, Spinner, MonthPicker } from '../components/UI'

const PROJECT_MONTHS = 3

export default function Reports() {
  const { settings } = useAppSettings()
  const { budget, investments_category, emergency_category } = settings
  const [month, setMonth] = useState(getCurrentMonth())
  const [monthsBack, setMonthsBack] = useState(12)
  const [rangeMode, setRangeMode] = useState('rolling')
  const [customStart, setCustomStart] = useState(`${new Date().getFullYear()}-01-01`)
  const [customEnd, setCustomEnd] = useState(`${new Date().toISOString().slice(0, 10)}`)

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (rangeMode === 'all') {
      return { rangeStart: null, rangeEnd: null, rangeLabel: 'all time' }
    }
    if (rangeMode === 'custom') {
      return {
        rangeStart: customStart || null,
        rangeEnd: customEnd || null,
        rangeLabel: customStart && customEnd ? `${customStart} to ${customEnd}` : 'custom range',
      }
    }
    const [endYear, endMonthNum] = month.split('-').map(Number)
    const startDate = new Date(endYear, endMonthNum - monthsBack, 1)
    const start = startDate.toISOString().slice(0, 10)
    const endDay = new Date(endYear, endMonthNum, 0).getDate()
    const end = `${endYear}-${String(endMonthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    return { rangeStart: start, rangeEnd: end, rangeLabel: `last ${monthsBack} months` }
  }, [rangeMode, customStart, customEnd, month, monthsBack])

  const { expenses, loading } = useExpensesRange(rangeStart, rangeEnd)
  const { entries: incomeEntries, loading: incomeLoading } = useIncomeRange(rangeStart, rangeEnd)
  const { transactions: investmentTransactions, loading: investmentsLoading } = useInvestmentsRange(
    rangeStart,
    rangeEnd,
  )
  const { snapshots, loading: snapshotsLoading } = useSavingsSnapshot()

  const focusMonth = useMemo(() => {
    if (rangeMode === 'rolling') return month
    const months = [...new Set(expenses.map((e) => String(e.date).slice(0, 7)))].sort()
    return months.length ? months[months.length - 1] : month
  }, [rangeMode, month, expenses])

  const report = useMemo(
    () =>
      buildReportsData({
        settings,
        expenses,
        incomeEntries,
        investmentTransactions,
        snapshots,
        focusMonth,
        investments_category,
        emergency_category,
        projectMonths: PROJECT_MONTHS,
      }),
    [
      settings,
      expenses,
      incomeEntries,
      investmentTransactions,
      snapshots,
      focusMonth,
      investments_category,
      emergency_category,
    ],
  )

  const pieData = report.focusByCategory.slice(0, 6).map((c, i) => ({
    name: c.category,
    value: c.total,
    color:
      c.color ||
      budget.find((b) => b.category === c.category)?.color ||
      ['#7ba3ff', '#3dbe7a', '#ff8c5a', '#a78bfa', '#38bdf8', '#f472b6'][i % 6],
  }))

  const incomeSub =
    report.focusIncomeSource === 'logged'
      ? 'Logged on Income tab'
      : report.focusIncomeSource === 'expected'
        ? 'Expected from Settings'
        : 'Set salary in Settings'

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Focus: <strong>{report.focusMonthLabel}</strong>
            {rangeMode !== 'rolling' && ' · latest month in range'}
          </p>
        </div>
        <div
          className="page-header-actions"
          style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}
        >
          <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)} style={{ minWidth: 0 }}>
            <option value="rolling">Rolling months</option>
            <option value="custom">Custom date range</option>
            <option value="all">All time</option>
          </select>
          {rangeMode === 'rolling' && (
            <>
              <MonthPicker value={month} onChange={setMonth} />
              <select value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} style={{ minWidth: 0 }}>
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
                <option value={24}>Last 24 months</option>
              </select>
            </>
          )}
          {rangeMode === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
        </div>
      </header>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          Data range: <strong style={{ color: 'var(--text)' }}>{rangeLabel}</strong>
          {' · '}
          Report month: <strong style={{ color: 'var(--text)' }}>{report.focusMonthLabel}</strong>
          {report.allocation.insights[0] && (
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>{report.allocation.insights[0]}</p>
          )}
        </div>
      </Card>

      {loading || incomeLoading || snapshotsLoading || investmentsLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="metric-grid">
            <MetricCard
              label={`Income (${monthLabel(focusMonth)})`}
              value={report.focusIncome}
              sub={incomeSub}
              color="var(--green)"
            />
            <MetricCard
              label={`Spent (${monthLabel(focusMonth)})`}
              value={report.focusSpend}
              sub={report.topCategory ? `Top: ${report.topCategory.category}` : 'No expenses yet'}
              color="var(--amber)"
            />
            <MetricCard
              label="Remaining"
              value={report.focusRemaining}
              sub={`${report.allocationPct}% allocated`}
              color={report.focusRemaining < 0 ? 'var(--red)' : 'var(--green)'}
            />
            <MetricCard
              label="Invested (month)"
              value={report.investmentOutflow}
              color="var(--accent)"
            />
            {rangeMode !== 'rolling' || monthsBack > 1 ? (
              <MetricCard
                label={`Range spent (${rangeLabel})`}
                value={report.rangeSpent}
                sub={`${report.rangeMonths} month(s) · avg UGX ${fmt(report.avgMonthlySpend)}/mo`}
                color="var(--text)"
              />
            ) : null}
          </div>

          <div className="metric-grid" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <MetricCard
              label={`vs ${monthLabel(report.previousMonth)}`}
              value={report.previousSpend}
              sub="Previous month spend"
              color="var(--muted)"
            />
            <MetricCard
              label="Spend trend"
              value={Math.abs(report.recentTrendPct)}
              prefix=""
              sub={report.recentTrendPct >= 0 ? 'up vs prior month' : 'down vs prior month'}
              color={report.recentTrendPct > 0 ? 'var(--red)' : 'var(--green)'}
            />
            <MetricCard label="Forecast next month" value={report.projectedSpend} color="var(--text)" />
            <MetricCard
              label="Forecast savings"
              value={report.projectedSavings}
              color={report.projectedSavings < 0 ? 'var(--red)' : 'var(--green)'}
            />
          </div>

          <Card style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <SectionTitle style={{ marginBottom: 4 }}>Spending habits</SectionTitle>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  Archetype, badges, quests, and habit insights live on your Profile tab.
                </p>
              </div>
              <Link to="/profile" className="spending-profile-link">
                Open profile <ChevronRight size={14} />
              </Link>
            </div>
          </Card>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Where your money went — {monthLabel(focusMonth)}</SectionTitle>
            {pieData.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>No expenses logged this month.</p>
            ) : (
              <>
                <div className="chart-wrap chart-wrap--line">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `UGX ${fmt(v)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {report.focusByCategory.slice(0, 8).map((c) => (
                    <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: c.color || 'var(--muted)' }}>{c.category}</span>
                      <strong>UGX {fmt(c.total)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Earnings vs allocation — {monthLabel(focusMonth)}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {report.allocation.buckets.map((bucket) => (
                <div key={bucket.key} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>{bucket.label}</div>
                  <div style={{ fontWeight: 700 }}>UGX {fmt(bucket.actualAmount)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {bucket.actualPct}% of income · target {bucket.targetPct}%
                  </div>
                </div>
              ))}
            </div>
            {report.allocation.insights.length > 1 && (
              <ul className="earnings-allocation-insights" style={{ marginTop: '1rem' }}>
                {report.allocation.insights.slice(1).map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Earnings-based forecast guide (50/30/20) — {monthLabel(focusMonth)}</SectionTitle>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Targets from {report.focusIncomeSource === 'logged' ? 'logged income' : 'Settings expected income'}.
              Categories show where each bucket&apos;s spend went; {PROJECT_MONTHS}-month forecast assumes this
              month&apos;s pace continues.
            </p>
            <EarningsForecastGuide
              report={report.allocation}
              monthLabel={monthLabel(focusMonth)}
              projectMonths={PROJECT_MONTHS}
            />
          </Card>

          <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
            <MetricCard label="Investment balances" value={report.investmentBalance} color="var(--accent)" sub="Latest snapshot" />
            <MetricCard
              label="Investment growth"
              value={report.investmentGrowth}
              color={report.investmentGrowth < 0 ? 'var(--red)' : 'var(--green)'}
              sub="Snapshot vs prior"
            />
            <MetricCard
              label={`Invested via expenses (${monthLabel(focusMonth)})`}
              value={report.investedThroughExpenses}
            />
            <MetricCard
              label={`Invested via transactions (${monthLabel(focusMonth)})`}
              value={report.investmentOutflow}
              color="var(--accent)"
            />
            <MetricCard
              label={`Investment inflows (${monthLabel(focusMonth)})`}
              value={report.investmentInflow}
              color="var(--green)"
            />
            <MetricCard
              label={`Emergency funded (${monthLabel(focusMonth)})`}
              value={report.emergencyFunded}
            />
          </div>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>{PROJECT_MONTHS}-month projection from {monthLabel(focusMonth)}</SectionTitle>
            <div className="chart-wrap chart-wrap--line">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.projectionData}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip formatter={(v) => `UGX ${fmt(v)}`} />
                  <Line type="monotone" dataKey="projectedSpend" name="Projected spend" stroke="var(--amber)" strokeWidth={2} />
                  <Line type="monotone" dataKey="projectedSavings" name="Projected savings" stroke="var(--green)" strokeWidth={2} />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name={`${monthLabel(focusMonth)} spend`}
                    stroke="var(--accent)"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <SectionTitle>Assisted planning (50/30/20) — {monthLabel(focusMonth)}</SectionTitle>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Recommendations based on this month&apos;s spending, recent category averages, and income of UGX{' '}
              {fmt(report.focusIncome)}.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Needs ({Math.round(report.envelopeRatios.needs * 100)}%)
                </div>
                <div style={{ fontWeight: 700 }}>UGX {fmt(report.envelopeTotals.needs)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  Spent UGX {fmt(report.allocation.buckets.find((b) => b.key === 'needs')?.actualAmount || 0)}
                </div>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Wants ({Math.round(report.envelopeRatios.wants * 100)}%)
                </div>
                <div style={{ fontWeight: 700 }}>UGX {fmt(report.envelopeTotals.wants)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  Spent UGX {fmt(report.allocation.buckets.find((b) => b.key === 'wants')?.actualAmount || 0)}
                </div>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Savings ({Math.round(report.envelopeRatios.savings * 100)}%)
                </div>
                <div style={{ fontWeight: 700 }}>UGX {fmt(report.envelopeTotals.savings)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  Spent UGX {fmt(report.allocation.buckets.find((b) => b.key === 'savings')?.actualAmount || 0)}
                </div>
              </div>
            </div>
            {report.planningRows.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Log expenses to get category planning suggestions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {report.planningRows.map((row) => (
                  <div
                    key={row.category}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 10,
                      alignItems: 'center',
                      borderTop: '1px solid var(--border)',
                      paddingTop: 10,
                    }}
                  >
                    <div style={{ color: row.color, fontWeight: 600, fontSize: 13 }}>{row.category}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      This month: UGX {fmt(row.lastActual)}
                      <span style={{ marginLeft: 6 }}>Avg: {fmt(row.recentAvg)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Budget: UGX {fmt(row.budgetAmount)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      Plan: UGX {fmt(row.recommended)}
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}> ({row.bucket})</span>
                    </div>
                    <div style={{ fontSize: 11, color: row.action === 'Trim' ? 'var(--amber)' : row.action === 'Increase' ? 'var(--accent)' : 'var(--green)' }}>
                      {row.action} · {row.reliability}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}


