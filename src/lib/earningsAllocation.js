import { incomeSummary, sumLoggedIncome } from './income'

const ENVELOPE = { needs: 0.5, wants: 0.3, savings: 0.2 }

function bucketForType(type) {
  if (type === 'fixed') return 'needs'
  if (type === 'variable') return 'wants'
  return 'savings'
}

function bucketLabel(bucket) {
  if (bucket === 'needs') return 'Needs (fixed)'
  if (bucket === 'wants') return 'Wants (variable)'
  return 'Savings'
}

function filterByMonth(items, monthKey, dateField = 'date') {
  return (items || []).filter((row) => String(row[dateField]).slice(0, 7) === monthKey)
}

export function buildEarningsAllocationReport({
  settings,
  expenses = [],
  incomeEntries = [],
  investmentTransactions = [],
  focusMonth,
}) {
  const budget = settings?.budget || []
  const budgetNames = new Set(budget.map((b) => b.category))

  const monthExpenses = filterByMonth(expenses, focusMonth)
  const monthIncomeRows = filterByMonth(incomeEntries, focusMonth)
  const monthInvestments = filterByMonth(investmentTransactions, focusMonth)

  const loggedIncome = sumLoggedIncome(monthIncomeRows)
  const expected = incomeSummary(settings)
  const income = loggedIncome > 0 ? loggedIncome : expected.total
  const incomeSource = loggedIncome > 0 ? 'logged' : expected.total > 0 ? 'expected' : 'none'

  const byCategory = {}
  for (const e of monthExpenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0)
  }

  let unmappedSpend = 0
  for (const [cat, amount] of Object.entries(byCategory)) {
    if (!budgetNames.has(cat)) unmappedSpend += amount
  }

  const investmentOutflow = monthInvestments
    .filter((t) => ['buy', 'deposit'].includes(t.tx_type))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)

  const spendingByType = budget.reduce(
    (acc, line) => {
      const bucket = bucketForType(line.type)
      acc[bucket] += byCategory[line.category] || 0
      return acc
    },
    { needs: 0, wants: 0, savings: 0 },
  )
  spendingByType.savings += investmentOutflow
  spendingByType.wants += unmappedSpend

  const totalSpent = Object.values(byCategory).reduce((s, v) => s + v, 0)
  const totalAllocated = totalSpent + investmentOutflow
  const remaining = income - totalAllocated
  const allocationPct = income > 0 ? Math.round((totalAllocated / income) * 100) : 0

  const envelopeTargets = {
    needs: Math.round(income * ENVELOPE.needs),
    wants: Math.round(income * ENVELOPE.wants),
    savings: Math.round(income * ENVELOPE.savings),
  }

  const buckets = (['needs', 'wants', 'savings']).map((key) => {
    const actual = spendingByType[key]
    const target = envelopeTargets[key]
    const diff = actual - target
    const actualPct = income > 0 ? Math.round((actual / income) * 100) : 0
    const targetPct = Math.round(ENVELOPE[key] * 100)
    let status = 'on'
    if (diff > Math.max(15000, income * 0.03)) status = 'over'
    else if (diff < -Math.max(15000, income * 0.03)) status = 'under'
    return {
      key,
      label: bucketLabel(key),
      targetPct,
      targetAmount: target,
      actualAmount: actual,
      actualPct,
      diff,
      status,
    }
  })

  const categoryRows = budget
    .map((line) => {
      const actual = byCategory[line.category] || 0
      const budgetAmount = Number(line.amount) || 0
      const variance = budgetAmount - actual
      const pctOfIncome = income > 0 ? Math.round((actual / income) * 100) : 0
      const pctOfSpend = totalSpent > 0 ? Math.round((actual / totalSpent) * 100) : 0
      let status = 'none'
      if (actual > 0 || budgetAmount > 0) {
        if (budgetAmount <= 0) status = actual > 0 ? 'unbudgeted' : 'none'
        else if (actual > budgetAmount * 1.1) status = 'over'
        else if (actual < budgetAmount * 0.85) status = 'under'
        else status = 'on'
      }
      return {
        category: line.category,
        type: line.type,
        bucket: bucketForType(line.type),
        color: line.color,
        budgetAmount,
        actual,
        variance,
        pctOfIncome,
        pctOfSpend,
        status,
      }
    })
    .filter((row) => row.actual > 0 || row.budgetAmount > 0)
    .sort((a, b) => b.actual - a.actual)

  const unmappedRows = Object.entries(byCategory)
    .filter(([cat]) => !budgetNames.has(cat))
    .map(([category, actual]) => ({
      category,
      type: 'variable',
      bucket: 'wants',
      color: 'var(--muted)',
      budgetAmount: 0,
      actual,
      variance: -actual,
      pctOfIncome: income > 0 ? Math.round((actual / income) * 100) : 0,
      pctOfSpend: totalSpent > 0 ? Math.round((actual / totalSpent) * 100) : 0,
      status: 'unmapped',
    }))
    .sort((a, b) => b.actual - a.actual)

  const incomeBySource = {}
  for (const row of monthIncomeRows) {
    incomeBySource[row.source] = (incomeBySource[row.source] || 0) + Number(row.amount || 0)
  }

  const insights = buildInsights({
    focusMonth,
    income,
    incomeSource,
    loggedIncome,
    expectedTotal: expected.total,
    incomeBySource,
    monthIncomeRows,
    totalSpent,
    totalAllocated,
    remaining,
    allocationPct,
    buckets,
    categoryRows,
    unmappedRows,
    unmappedSpend,
    investmentOutflow,
    monthExpenses,
  })

  return {
    focusMonth,
    income,
    incomeSource,
    loggedIncome,
    expectedIncome: expected.total,
    incomeBySource: Object.entries(incomeBySource).map(([source, amount]) => ({ source, amount })),
    totalSpent,
    totalAllocated,
    remaining,
    allocationPct,
    buckets,
    categoryRows,
    unmappedRows,
    envelopeTargets,
    insights,
    forecastGuide: buildForecastGuide({
      income,
      incomeSource,
      buckets,
      categoryRows,
      unmappedRows,
      remaining,
    }),
    hasData: monthExpenses.length > 0 || monthIncomeRows.length > 0,
  }
}

function buildForecastGuide({ income, incomeSource, buckets, categoryRows, unmappedRows, remaining }) {
  const allRows = [...categoryRows, ...unmappedRows]

  return buckets.map((bucket) => {
    const categories = allRows
      .filter((row) => row.bucket === bucket.key && row.actual > 0)
      .sort((a, b) => b.actual - a.actual)

    const forecastMonthly = bucket.actualAmount
    const forecast3Mo = Math.round(bucket.actualAmount * 3)
    const target3Mo = Math.round(bucket.targetAmount * 3)

    let statusLabel = 'On target'
    if (bucket.status === 'over') statusLabel = 'Above target'
    else if (bucket.status === 'under') statusLabel = 'Below target'

    let tip = null
    if (bucket.status === 'over') {
      const top = categories[0]
      tip = top
        ? `Trim ${top.category} or similar wants/needs — UGX ${fmtNum(bucket.diff)} above the ${bucket.targetPct}% guide.`
        : `Spending UGX ${fmtNum(bucket.diff)} above the ${bucket.targetPct}% guide this month.`
    } else if (bucket.status === 'under' && bucket.actualAmount === 0) {
      tip = `Nothing logged in ${bucket.label.toLowerCase()} yet — room to allocate up to UGX ${fmtNum(bucket.targetAmount)}.`
    } else if (bucket.status === 'under' && remaining > 0) {
      tip = `UGX ${fmtNum(Math.abs(bucket.diff))} below guide — could redirect to savings or other buckets.`
    } else if (bucket.status === 'on') {
      tip = `Well balanced at ${bucket.actualPct}% of income.`
    }

    return {
      ...bucket,
      statusLabel,
      forecastMonthly,
      forecast3Mo,
      target3Mo,
      categories: categories.map((row) => ({
        category: row.category,
        color: row.color,
        actual: row.actual,
        budgetAmount: row.budgetAmount,
        pctOfIncome: row.pctOfIncome,
        pctOfBucket: bucket.actualAmount > 0 ? Math.round((row.actual / bucket.actualAmount) * 100) : 0,
        shareLabel: bucket.actualAmount > 0 ? `${Math.round((row.actual / bucket.actualAmount) * 100)}% of bucket` : '',
        status: row.status,
      })),
      tip,
      incomeBasis: incomeSource,
    }
  })
}

function buildInsights(ctx) {
  const lines = []
  const monthName = formatMonthLabel(ctx.focusMonth)

  if (ctx.incomeSource === 'logged') {
    lines.push(`You logged UGX ${fmtNum(ctx.loggedIncome)} in income for ${monthName}.`)
    if (ctx.incomeBySource.length > 1) {
      const top = [...ctx.incomeBySource].sort((a, b) => b.amount - a.amount)[0]
      lines.push(`Largest inflow: ${top.source} (UGX ${fmtNum(top.amount)}).`)
    }
  } else if (ctx.expectedTotal > 0) {
    lines.push(
      `No income logged for ${monthName} — using expected UGX ${fmtNum(ctx.expectedTotal)} from Settings. Log inflows on the Income tab.`,
    )
  } else {
    lines.push(`Set salary or log income to compare earnings vs spending for ${monthName}.`)
  }

  if (!ctx.monthExpenses.length) {
    lines.push(`No expenses logged for ${monthName} yet.`)
    return lines
  }

  if (ctx.remaining >= 0) {
    lines.push(
      `UGX ${fmtNum(ctx.remaining)} unallocated (${100 - ctx.allocationPct}% of income) after spending and investments.`,
    )
  } else {
    lines.push(
      `Over-allocated by UGX ${fmtNum(Math.abs(ctx.remaining))} — spending and investments exceed income this month.`,
    )
  }

  for (const bucket of ctx.buckets) {
    if (bucket.status === 'over') {
      lines.push(
        `${bucket.label} used ${bucket.actualPct}% of income (target ${bucket.targetPct}%) — UGX ${fmtNum(bucket.diff)} above guide.`,
      )
    } else if (bucket.status === 'under' && bucket.actualAmount > 0) {
      lines.push(
        `${bucket.label} at ${bucket.actualPct}% of income — UGX ${fmtNum(Math.abs(bucket.diff))} below the ${bucket.targetPct}% guide.`,
      )
    }
  }

  const overBudget = ctx.categoryRows.filter((r) => r.status === 'over')
  if (overBudget.length) {
    lines.push(
      `${overBudget.length} categor${overBudget.length === 1 ? 'y' : 'ies'} over budget: ${overBudget.slice(0, 3).map((r) => r.category).join(', ')}${overBudget.length > 3 ? '…' : ''}.`,
    )
  }

  const top = [...ctx.categoryRows, ...ctx.unmappedRows].sort((a, b) => b.actual - a.actual)[0]
  if (top && top.actual > 0) {
    lines.push(`${top.category} is your biggest outflow at ${top.pctOfIncome}% of income (UGX ${fmtNum(top.actual)}).`)
  }

  if (ctx.unmappedSpend > 0) {
    lines.push(
      `UGX ${fmtNum(ctx.unmappedSpend)} spent in categories not in your budget — rename or add budget lines in Settings.`,
    )
  }

  if (ctx.investmentOutflow > 0) {
    lines.push(`UGX ${fmtNum(ctx.investmentOutflow)} moved into investments this month.`)
  }

  const underWithRoom = ctx.categoryRows.filter((r) => r.status === 'under' && r.variance > 50000)
  if (underWithRoom.length === 1) {
    lines.push(`${underWithRoom[0].category} is well under budget — UGX ${fmtNum(underWithRoom[0].variance)} headroom.`)
  }

  return lines.slice(0, 8)
}

function fmtNum(n) {
  return new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
}

export { ENVELOPE, bucketForType, bucketLabel }
