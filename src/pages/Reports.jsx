import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis } from 'recharts'
import { useAppSettings } from '../context/useAppSettings'
import { useExpensesRange, useInvestmentsRange, useSavingsSnapshot } from '../lib/hooks'
import { fmt, getCurrentMonth } from '../lib/constants'
import { Card, MetricCard, SectionTitle, Spinner, MonthPicker } from '../components/UI'

const PROJECT_MONTHS = 3

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-UG', { month: 'short' })
}

function addMonths(monthKey, plus) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + plus, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function Reports() {
  const { settings } = useAppSettings()
  const { salary, budget, investments_category, emergency_category } = settings
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
  const { transactions: investmentTransactions, loading: investmentsLoading } = useInvestmentsRange(rangeStart, rangeEnd)
  const { snapshots, loading: snapshotsLoading } = useSavingsSnapshot()

  const report = useMemo(() => {
    const byCategoryMap = {}
    const monthTotalsMap = {}
    const monthCategoryTotalsMap = {}

    expenses.forEach((e) => {
      byCategoryMap[e.category] = (byCategoryMap[e.category] || 0) + e.amount
      const month = String(e.date).slice(0, 7)
      monthTotalsMap[month] = (monthTotalsMap[month] || 0) + e.amount
      if (!monthCategoryTotalsMap[month]) monthCategoryTotalsMap[month] = {}
      monthCategoryTotalsMap[month][e.category] = (monthCategoryTotalsMap[month][e.category] || 0) + e.amount
    })

    const byCategory = Object.entries(byCategoryMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
    const totalSpent = byCategory.reduce((sum, c) => sum + c.total, 0)
    const topCategory = byCategory[0] || null

    const months = Object.keys(monthTotalsMap).sort()
    const avgMonthlySpend = months.length
      ? Math.round(months.reduce((s, m) => s + monthTotalsMap[m], 0) / months.length)
      : 0
    const baseMonth = months.length ? months[months.length - 1] : month
    const previousMonth = addMonths(baseMonth, -1)
    const lastMonthSpend = monthTotalsMap[baseMonth] || 0
    const previousMonthSpend = monthTotalsMap[previousMonth] || lastMonthSpend
    const recentTrendPct = previousMonthSpend > 0
      ? Math.round(((lastMonthSpend - previousMonthSpend) / previousMonthSpend) * 100)
      : 0
    const trendFactor = Math.max(0.85, Math.min(1.15, 1 + recentTrendPct / 100))
    const projectedFromLastMonth = Math.round(lastMonthSpend * trendFactor)

    const projectionData = []
    const latestSpend = lastMonthSpend
    for (let i = 1; i <= PROJECT_MONTHS; i += 1) {
      const nextMonth = addMonths(baseMonth, i)
      projectionData.push({
        month: monthLabel(nextMonth),
        projectedSpend: projectedFromLastMonth,
        projectedSavings: salary - projectedFromLastMonth,
        baseline: latestSpend,
      })
    }

    const lastMonthByCategory = monthCategoryTotalsMap[baseMonth] || {}
    const envelopeRatios = { needs: 0.5, wants: 0.3, savings: 0.2 }
    const envelopeTotals = {
      needs: Math.round(salary * envelopeRatios.needs),
      wants: Math.round(salary * envelopeRatios.wants),
      savings: Math.round(salary * envelopeRatios.savings),
    }
    const roundToThousand = (value) => Math.round(value / 1000) * 1000

    const bucketForType = (type) => {
      if (type === 'fixed') return 'needs'
      if (type === 'variable') return 'wants'
      return 'savings'
    }

    const bucketBudgetTotals = { needs: 0, wants: 0, savings: 0 }
    const bucketLastTotals = { needs: 0, wants: 0, savings: 0 }
    budget.forEach((line) => {
      const bucket = bucketForType(line.type)
      bucketBudgetTotals[bucket] += line.amount
      bucketLastTotals[bucket] += lastMonthByCategory[line.category] || 0
    })

    const recentMonthsForPlanning = [baseMonth, addMonths(baseMonth, -1), addMonths(baseMonth, -2)]
    const planningSeeds = budget.map((line) => {
      const bucket = bucketForType(line.type)
      const lastActual = lastMonthByCategory[line.category] || 0
      const recentValues = recentMonthsForPlanning.map((m) => monthCategoryTotalsMap[m]?.[line.category] || 0)
      const monthsWithData = recentValues.filter((v) => v > 0).length
      const recentAvg = monthsWithData
        ? Math.round(recentValues.reduce((sum, v) => sum + v, 0) / monthsWithData)
        : 0
      const weightedRaw = monthsWithData
        ? (lastActual * 0.5) + (recentAvg * 0.35) + (line.amount * 0.15)
        : line.amount
      const rawRecommended = Math.max(0, weightedRaw)

      return {
        category: line.category,
        bucket,
        lastActual,
        recentAvg,
        budgetAmount: line.amount,
        color: line.color,
        rawRecommended,
      }
    })

    // Fit weighted category suggestions into exact 50/30/20 bucket envelopes.
    const rawTotalsByBucket = { needs: 0, wants: 0, savings: 0 }
    planningSeeds.forEach((row) => {
      rawTotalsByBucket[row.bucket] += row.rawRecommended
    })

    const planningRows = planningSeeds.map((row) => {
      const bucket = row.bucket
      const fallbackShareBase = bucketLastTotals[bucket] > 0 ? bucketLastTotals[bucket] : bucketBudgetTotals[bucket]
      const fallbackShare = fallbackShareBase > 0
        ? ((row.lastActual || row.budgetAmount) / fallbackShareBase)
        : 1 / Math.max(1, planningSeeds.filter((r) => r.bucket === bucket).length)
      const scaled = rawTotalsByBucket[bucket] > 0
        ? (row.rawRecommended / rawTotalsByBucket[bucket]) * envelopeTotals[bucket]
        : fallbackShare * envelopeTotals[bucket]
      const recommended = Math.max(0, roundToThousand(scaled))

      const delta = recommended - row.budgetAmount
      let action = 'Keep'
      if (delta > 10000) action = 'Increase'
      if (delta < -10000) action = 'Trim'

      const reliability = row.lastActual > 0 && row.recentAvg > 0 ? 'high' : row.lastActual > 0 || row.recentAvg > 0 ? 'medium' : 'low'

      return {
        ...row,
        recommended,
        delta,
        action,
        reliability,
      }
    })

    const investmentOutflow = investmentTransactions
      .filter((t) => ['buy', 'deposit'].includes(t.tx_type))
      .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)
    const investmentInflow = investmentTransactions
      .filter((t) => ['sell', 'dividend'].includes(t.tx_type))
      .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)

    const spendingByType = budget.reduce(
      (acc, b) => {
        const actual = byCategoryMap[b.category] || 0
        acc[b.type] = (acc[b.type] || 0) + actual
        return acc
      },
      { fixed: 0, variable: 0, savings: 0 },
    )
    // Investment outflows are treated as savings allocations from income.
    spendingByType.savings += investmentOutflow

    const earningsGuide = [
      {
        key: 'needs',
        label: 'Needs',
        targetPct: Math.round(envelopeRatios.needs * 100),
        targetAmount: envelopeTotals.needs,
        actualAmount: spendingByType.fixed || 0,
      },
      {
        key: 'wants',
        label: 'Wants',
        targetPct: Math.round(envelopeRatios.wants * 100),
        targetAmount: envelopeTotals.wants,
        actualAmount: spendingByType.variable || 0,
      },
      {
        key: 'savings',
        label: 'Savings',
        targetPct: Math.round(envelopeRatios.savings * 100),
        targetAmount: envelopeTotals.savings,
        actualAmount: spendingByType.savings || 0,
      },
    ].map((row) => {
      const diff = row.actualAmount - row.targetAmount
      const observedMonths = Math.max(1, months.length || 1)
      const forecastAmount = Math.round((row.actualAmount / observedMonths) * PROJECT_MONTHS)
      return {
        ...row,
        diff,
        forecastAmount,
        status: diff > 15000 ? 'Above target' : diff < -15000 ? 'Below target' : 'On target',
      }
    })

    const currentSnapshot = snapshots[snapshots.length - 1] || null
    const previousSnapshot = snapshots[snapshots.length - 2] || null
    const investmentBalance = currentSnapshot
      ? (currentSnapshot.investment1_balance || 0) +
        (currentSnapshot.investment2_balance || 0) +
        (currentSnapshot.investment3_balance || 0)
      : 0
    const previousInvestmentBalance = previousSnapshot
      ? (previousSnapshot.investment1_balance || 0) +
        (previousSnapshot.investment2_balance || 0) +
        (previousSnapshot.investment3_balance || 0)
      : 0

    return {
      totalSpent,
      totalEarnings: salary * Math.max(months.length, 1),
      incomeAllocated: totalSpent + investmentOutflow,
      topCategory,
      byCategory,
      avgMonthlySpend,
      projectionData,
      baseMonth,
      lastMonthSpend,
      projectedFromLastMonth,
      projectedNextSavings: salary - projectedFromLastMonth,
      recentTrendPct,
      planningRows,
      envelopeTotals,
      envelopeRatios,
      earningsGuide,
      spendingByType,
      investmentBalance,
      investmentGrowth: investmentBalance - previousInvestmentBalance,
      investmentOutflow,
      investmentInflow,
      investmentNetFlow: investmentInflow - investmentOutflow,
      investedThroughExpenses: byCategoryMap[investments_category] || 0,
      emergencyFunded: byCategoryMap[emergency_category] || 0,
      monthCount: months.length || 1,
    }
  }, [expenses, salary, budget, snapshots, investments_category, emergency_category, investmentTransactions, month])

  const pieData = report.byCategory.slice(0, 6).map((c, i) => ({
    name: c.category,
    value: c.total,
    color: budget.find((b) => b.category === c.category)?.color || ['#7ba3ff', '#3dbe7a', '#ff8c5a', '#a78bfa', '#38bdf8', '#f472b6'][i % 6],
  }))

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Smart overview of spending, earnings, investments, and projections</p>
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
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Active report range: <strong style={{ color: 'var(--text)' }}>{rangeLabel}</strong>
        </div>
      </Card>

      {loading || snapshotsLoading || investmentsLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="metric-grid">
            <MetricCard label={`Spent (${rangeLabel})`} value={report.totalSpent} />
            <MetricCard label="Estimated earnings" value={report.totalEarnings} color="var(--green)" />
            <MetricCard
              label="Top spending area"
              value={report.topCategory?.total || 0}
              sub={report.topCategory ? report.topCategory.category : 'No data yet'}
              color="var(--amber)"
            />
            <MetricCard
              label="Avg monthly spend"
              value={report.avgMonthlySpend}
              sub={`Across ${report.monthCount} month(s)`}
              color="var(--text)"
            />
            <MetricCard
              label="Income allocated"
              value={report.incomeAllocated}
              sub={`Spent + invested from ${rangeLabel}`}
              color={report.incomeAllocated > report.totalEarnings ? 'var(--red)' : 'var(--accent)'}
            />
          </div>

          <div className="metric-grid" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <MetricCard label={`Last month spent (${monthLabel(report.baseMonth)})`} value={report.lastMonthSpend} color="var(--amber)" />
            <MetricCard label="Forecast next month spend" value={report.projectedFromLastMonth} color="var(--text)" />
            <MetricCard label="Forecast next month savings" value={report.projectedNextSavings} color={report.projectedNextSavings < 0 ? 'var(--red)' : 'var(--green)'} />
            <MetricCard label="Recent spend trend" value={Math.abs(report.recentTrendPct)} prefix="" sub={report.recentTrendPct >= 0 ? 'up vs previous month' : 'down vs previous month'} color={report.recentTrendPct > 0 ? 'var(--red)' : 'var(--green)'} />
          </div>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Where your money goes most</SectionTitle>
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
              {report.byCategory.slice(0, 5).map((c, i) => (
                <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: pieData[i]?.color || 'var(--muted)' }}>{c.category}</span>
                  <strong>UGX {fmt(c.total)}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Earnings vs allocation insights</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {Object.entries(report.spendingByType).map(([type, amount]) => (
                <div key={type} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                  <div style={{ textTransform: 'capitalize', color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>{type}</div>
                  <div style={{ fontWeight: 700 }}>UGX {fmt(amount)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Earnings-based forecast guide (50/30/20)</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {report.earningsGuide.map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                    alignItems: 'center',
                    borderTop: '1px solid var(--border)',
                    paddingTop: 10,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Target ({row.targetPct}%): UGX {fmt(row.targetAmount)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Actual: UGX {fmt(row.actualAmount)}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {PROJECT_MONTHS}mo forecast: UGX {fmt(row.forecastAmount)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        row.status === 'Above target'
                          ? 'var(--amber)'
                          : row.status === 'Below target'
                            ? 'var(--accent)'
                            : 'var(--green)',
                    }}
                  >
                    {row.status}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
            <MetricCard label="Investment balances" value={report.investmentBalance} color="var(--accent)" />
            <MetricCard label="Investment growth (latest)" value={report.investmentGrowth} color={report.investmentGrowth < 0 ? 'var(--red)' : 'var(--green)'} />
            <MetricCard label="Invested via expenses" value={report.investedThroughExpenses} />
            <MetricCard label="Invested via transactions" value={report.investmentOutflow} color="var(--accent)" />
            <MetricCard label="Investment inflows" value={report.investmentInflow} color="var(--green)" />
            <MetricCard label="Investment net flow" value={report.investmentNetFlow} color={report.investmentNetFlow < 0 ? 'var(--red)' : 'var(--green)'} />
            <MetricCard label="Emergency funded via expenses" value={report.emergencyFunded} />
          </div>

          <Card>
            <SectionTitle>{PROJECT_MONTHS}-month spending projection</SectionTitle>
            <div className="chart-wrap chart-wrap--line">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.projectionData}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => `UGX ${fmt(v)}`} />
                  <Line type="monotone" dataKey="projectedSpend" name="Projected spend" stroke="var(--amber)" strokeWidth={2} />
                  <Line type="monotone" dataKey="projectedSavings" name="Projected savings" stroke="var(--green)" strokeWidth={2} />
                  <Line type="monotone" dataKey="baseline" name="Latest month spend" stroke="var(--accent)" strokeDasharray="5 4" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ marginTop: '1.5rem' }}>
            <SectionTitle>Assisted planning (50/30/20 rule)</SectionTitle>
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
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Wants ({Math.round(report.envelopeRatios.wants * 100)}%)
                </div>
                <div style={{ fontWeight: 700 }}>UGX {fmt(report.envelopeTotals.wants)}</div>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Savings ({Math.round(report.envelopeRatios.savings * 100)}%)
                </div>
                <div style={{ fontWeight: 700 }}>UGX {fmt(report.envelopeTotals.savings)}</div>
              </div>
            </div>
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
                    Last: UGX {fmt(row.lastActual)}
                    <span style={{ marginLeft: 6 }}>Avg: {fmt(row.recentAvg)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Budget: UGX {fmt(row.budgetAmount)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    Plan: UGX {fmt(row.recommended)}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}> ({row.bucket})</span>
                  </div>
                  <div style={{ fontSize: 11, color: row.action === 'Trim' ? 'var(--amber)' : 'var(--green)' }}>
                    {row.action} · {row.reliability}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
