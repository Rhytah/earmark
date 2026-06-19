import { buildEarningsAllocationReport, ENVELOPE, bucketForType } from './earningsAllocation'
import { incomeSummary, sumLoggedIncome } from './income'

function addMonths(monthKey, plus) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + plus, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function filterByMonth(items, monthKey) {
  return (items || []).filter((row) => String(row.date).slice(0, 7) === monthKey)
}

function monthLabelShort(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-UG', { month: 'short', year: 'numeric' })
}

function roundToThousand(value) {
  return Math.round(value / 1000) * 1000
}

export function buildReportsData({
  settings,
  expenses = [],
  incomeEntries = [],
  investmentTransactions = [],
  snapshots = [],
  focusMonth,
  investments_category,
  emergency_category,
  projectMonths = 3,
}) {
  const budget = settings?.budget || []
  const expected = incomeSummary(settings)

  const allocation = buildEarningsAllocationReport({
    settings,
    expenses,
    incomeEntries,
    investmentTransactions,
    focusMonth,
  })

  const monthTotalsMap = {}
  const monthCategoryTotalsMap = {}
  const monthIncomeMap = {}

  for (const e of expenses) {
    const mk = String(e.date).slice(0, 7)
    monthTotalsMap[mk] = (monthTotalsMap[mk] || 0) + Number(e.amount || 0)
    if (!monthCategoryTotalsMap[mk]) monthCategoryTotalsMap[mk] = {}
    monthCategoryTotalsMap[mk][e.category] = (monthCategoryTotalsMap[mk][e.category] || 0) + Number(e.amount || 0)
  }

  for (const row of incomeEntries) {
    const mk = String(row.date).slice(0, 7)
    monthIncomeMap[mk] = (monthIncomeMap[mk] || 0) + Number(row.amount || 0)
  }

  const monthsWithSpend = Object.keys(monthTotalsMap).sort()
  const previousMonth = addMonths(focusMonth, -1)
  const focusSpend = allocation.totalSpent
  const previousSpend = monthTotalsMap[previousMonth] || 0
  const recentTrendPct =
    previousSpend > 0 ? Math.round(((focusSpend - previousSpend) / previousSpend) * 100) : 0
  const trendFactor = Math.max(0.85, Math.min(1.15, 1 + recentTrendPct / 100))
  const projectedSpend = Math.round(focusSpend * trendFactor)
  const projectedSavings = allocation.income - projectedSpend

  const focusByCategory = [...allocation.categoryRows, ...allocation.unmappedRows]
    .filter((row) => row.actual > 0)
    .map((row) => ({ category: row.category, total: row.actual, color: row.color }))
    .sort((a, b) => b.total - a.total)

  const topCategory = focusByCategory[0] || null

  const monthInvestments = filterByMonth(investmentTransactions, focusMonth)
  const investmentOutflow = monthInvestments
    .filter((t) => ['buy', 'deposit'].includes(t.tx_type))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)
  const investmentInflow = monthInvestments
    .filter((t) => ['sell', 'dividend'].includes(t.tx_type))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)

  const focusMonthByCategory = monthCategoryTotalsMap[focusMonth] || {}
  const recentMonths = [focusMonth, addMonths(focusMonth, -1), addMonths(focusMonth, -2)]

  const envelopeTotals = allocation.envelopeTargets
  const envelopeRatios = ENVELOPE

  const bucketBudgetTotals = { needs: 0, wants: 0, savings: 0 }
  const bucketFocusTotals = { needs: 0, wants: 0, savings: 0 }
  for (const line of budget) {
    const bucket = bucketForType(line.type)
    bucketBudgetTotals[bucket] += Number(line.amount) || 0
    bucketFocusTotals[bucket] += focusMonthByCategory[line.category] || 0
  }

  const planningSeeds = budget.map((line) => {
    const bucket = bucketForType(line.type)
    const lastActual = focusMonthByCategory[line.category] || 0
    const recentValues = recentMonths.map((m) => monthCategoryTotalsMap[m]?.[line.category] || 0)
    const monthsWithData = recentValues.filter((v) => v > 0).length
    const recentAvg = monthsWithData
      ? Math.round(recentValues.reduce((sum, v) => sum + v, 0) / monthsWithData)
      : 0
    const weightedRaw = monthsWithData
      ? lastActual * 0.5 + recentAvg * 0.35 + Number(line.amount) * 0.15
      : Number(line.amount)
    return {
      category: line.category,
      bucket,
      lastActual,
      recentAvg,
      budgetAmount: Number(line.amount) || 0,
      color: line.color,
      rawRecommended: Math.max(0, weightedRaw),
    }
  })

  const rawTotalsByBucket = { needs: 0, wants: 0, savings: 0 }
  planningSeeds.forEach((row) => {
    rawTotalsByBucket[row.bucket] += row.rawRecommended
  })

  const planningRows = planningSeeds
    .map((row) => {
      const bucket = row.bucket
      const fallbackShareBase =
        bucketFocusTotals[bucket] > 0 ? bucketFocusTotals[bucket] : bucketBudgetTotals[bucket]
      const fallbackShare =
        fallbackShareBase > 0
          ? (row.lastActual || row.budgetAmount) / fallbackShareBase
          : 1 / Math.max(1, planningSeeds.filter((r) => r.bucket === bucket).length)
      const scaled =
        rawTotalsByBucket[bucket] > 0
          ? (row.rawRecommended / rawTotalsByBucket[bucket]) * envelopeTotals[bucket]
          : fallbackShare * envelopeTotals[bucket]
      const recommended = Math.max(0, roundToThousand(scaled))
      const delta = recommended - row.budgetAmount
      let action = 'Keep'
      if (delta > 10000) action = 'Increase'
      if (delta < -10000) action = 'Trim'
      const reliability =
        row.lastActual > 0 && row.recentAvg > 0
          ? 'high'
          : row.lastActual > 0 || row.recentAvg > 0
            ? 'medium'
            : 'low'
      return { ...row, recommended, delta, action, reliability }
    })
    .filter((row) => row.lastActual > 0 || row.budgetAmount > 0)

  const projectionData = []
  for (let i = 1; i <= projectMonths; i += 1) {
    const nextMonth = addMonths(focusMonth, i)
    projectionData.push({
      month: monthLabelShort(nextMonth),
      projectedSpend,
      projectedSavings: allocation.income - projectedSpend,
      baseline: focusSpend,
    })
  }

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

  const rangeSpent = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const rangeLoggedIncome = sumLoggedIncome(incomeEntries)
  const rangeMonths = new Set([
    ...Object.keys(monthTotalsMap),
    ...Object.keys(monthIncomeMap),
  ]).size
  const rangeExpectedIncome = expected.total * Math.max(1, rangeMonths)
  const rangeIncome = rangeLoggedIncome > 0 ? rangeLoggedIncome : rangeExpectedIncome

  const investedThroughExpenses = focusMonthByCategory[investments_category] || 0
  const emergencyFunded = focusMonthByCategory[emergency_category] || 0

  return {
    focusMonth,
    focusMonthLabel: monthLabelShort(focusMonth),
    allocation,
    focusSpend,
    focusIncome: allocation.income,
    focusIncomeSource: allocation.incomeSource,
    focusRemaining: allocation.remaining,
    focusAllocated: allocation.totalAllocated,
    allocationPct: allocation.allocationPct,
    topCategory,
    focusByCategory,
    previousMonth,
    previousSpend,
    recentTrendPct,
    projectedSpend,
    projectedSavings,
    planningRows,
    envelopeTotals,
    envelopeRatios,
    projectionData,
    investmentBalance,
    investmentGrowth: investmentBalance - previousInvestmentBalance,
    investmentOutflow,
    investmentInflow,
    investmentNetFlow: investmentInflow - investmentOutflow,
    investedThroughExpenses,
    emergencyFunded,
    rangeSpent,
    rangeIncome,
    rangeMonths: rangeMonths || 1,
    monthsWithSpend: monthsWithSpend.length,
    avgMonthlySpend: monthsWithSpend.length
      ? Math.round(monthsWithSpend.reduce((s, m) => s + monthTotalsMap[m], 0) / monthsWithSpend.length)
      : 0,
  }
}

export { addMonths, monthLabelShort as monthLabel }
