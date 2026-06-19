const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function monthKey(dateStr) {
  return String(dateStr).slice(0, 7)
}

function bucketForType(type) {
  if (type === 'fixed') return 'needs'
  if (type === 'variable') return 'wants'
  return 'savings'
}

function normalizeMerchant(description) {
  const raw = String(description || '').trim()
  if (!raw || /^imported$/i.test(raw)) return null
  return raw.replace(/\s+/g, ' ').slice(0, 48)
}

const ARCHETYPES = {
  planner: {
    label: 'The Planner',
    summary: 'You keep spending below income and stay close to budget — strong savings discipline.',
  },
  essentials: {
    label: 'Essentials-first',
    summary: 'Most of your money goes to fixed needs like housing, transport, and utilities.',
  },
  lifestyle: {
    label: 'Lifestyle-led',
    summary: 'Variable spending (dining, shopping, misc) makes up a large share of your outflows.',
  },
  focused: {
    label: 'Category-focused',
    summary: 'One budget area dominates your spending — worth watching for creep.',
  },
  frequent: {
    label: 'High-frequency spender',
    summary: 'You make many small purchases rather than a few large ones.',
  },
  stretched: {
    label: 'Income-stretched',
    summary: 'Spending is close to or above your salary — little room left each month.',
  },
  balanced: {
    label: 'Balanced spender',
    summary: 'Your spending is spread across categories without one dominant pattern.',
  },
}

/**
 * Build a spending-habits profile from the user's expense history.
 */
export function buildSpendingProfile(expenses, { salary, budget = [] }) {
  if (!expenses?.length) {
    return {
      hasData: false,
      insights: ['Log or sync expenses to unlock your spending profile.'],
    }
  }

  const categoryMeta = Object.fromEntries(budget.map((b) => [b.category, b]))
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const months = [...new Set(expenses.map((e) => monthKey(e.date)))].sort()
  const monthCount = Math.max(1, months.length)

  const byCategory = {}
  const byMonth = {}
  const byMonthCategory = {}
  const byPayment = {}
  const byWeekday = Array(7).fill(0)
  const merchantTotals = {}

  for (const e of expenses) {
    const amount = Number(e.amount || 0)
    const mk = monthKey(e.date)
    byCategory[e.category] = (byCategory[e.category] || 0) + amount
    byMonth[mk] = (byMonth[mk] || 0) + amount
    if (!byMonthCategory[mk]) byMonthCategory[mk] = {}
    byMonthCategory[mk][e.category] = (byMonthCategory[mk][e.category] || 0) + amount

    const pay = e.payment_method || 'Other'
    byPayment[pay] = (byPayment[pay] || 0) + amount

    const day = new Date(`${e.date}T12:00:00`).getDay()
    if (Number.isFinite(day)) byWeekday[day] += amount

    const merchant = normalizeMerchant(e.description)
    if (merchant) merchantTotals[merchant] = (merchantTotals[merchant] || 0) + amount
  }

  const avgMonthlySpend = Math.round(total / monthCount)
  const transactionsPerMonth = Math.round(expenses.length / monthCount)
  const avgTransaction = Math.round(total / expenses.length)
  const savingsRate = salary > 0 ? Math.round(((salary - avgMonthlySpend) / salary) * 100) : null

  let needsSpend = 0
  let wantsSpend = 0
  let savingsSpend = 0
  let overBudgetCategories = 0
  let withinBudgetCategories = 0

  for (const [cat, spent] of Object.entries(byCategory)) {
    const meta = categoryMeta[cat]
    const bucket = bucketForType(meta?.type || 'variable')
    if (bucket === 'needs') needsSpend += spent
    else if (bucket === 'wants') wantsSpend += spent
    else savingsSpend += spent

    const budgetAmt = Number(meta?.amount || 0)
    if (budgetAmt > 0) {
      const monthlyAvg = spent / monthCount
      if (monthlyAvg > budgetAmt * 1.1) overBudgetCategories += 1
      else withinBudgetCategories += 1
    }
  }

  const unmapped = total - needsSpend - wantsSpend - savingsSpend
  wantsSpend += unmapped

  const needsShare = total > 0 ? needsSpend / total : 0
  const wantsShare = total > 0 ? wantsSpend / total : 0
  const savingsShare = total > 0 ? savingsSpend / total : 0

  const categoryShares = Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: categoryMeta[category]?.color,
    }))
    .sort((a, b) => b.amount - a.amount)

  const topCategory = categoryShares[0] || null
  const topCategoryPct = topCategory?.pct || 0

  const weekendSpend = byWeekday[0] + byWeekday[6]
  const weekendShare = total > 0 ? Math.round((weekendSpend / total) * 100) : 0

  const weekdayPattern = byWeekday.map((amount, i) => ({
    day: DAY_NAMES[i],
    amount,
    pct: total > 0 ? Math.round((amount / total) * 100) : 0,
  }))

  const paymentMix = Object.entries(byPayment)
    .map(([method, amount]) => ({
      method,
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const topMerchants = Object.entries(merchantTotals)
    .map(([name, amount]) => ({ name, amount, count: expenses.filter((e) => normalizeMerchant(e.description) === name).length }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const trends = []
  if (months.length >= 2) {
    const latest = months[months.length - 1]
    const prev = months[months.length - 2]
    for (const cat of new Set([...Object.keys(byMonthCategory[latest] || {}), ...Object.keys(byMonthCategory[prev] || {})])) {
      const cur = byMonthCategory[latest]?.[cat] || 0
      const prior = byMonthCategory[prev]?.[cat] || 0
      if (prior <= 0 && cur <= 0) continue
      const changePct = prior > 0 ? Math.round(((cur - prior) / prior) * 100) : 100
      if (Math.abs(changePct) >= 15) {
        trends.push({ category: cat, changePct, latest: cur, prior })
      }
    }
    trends.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  }

  const scores = {
    planner: savingsRate != null && savingsRate >= 15 && overBudgetCategories <= withinBudgetCategories ? 3 : savingsRate >= 10 ? 1 : 0,
    essentials: needsShare >= 0.5 ? 3 : needsShare >= 0.4 ? 1 : 0,
    lifestyle: wantsShare >= 0.45 ? 3 : wantsShare >= 0.35 ? 1 : 0,
    focused: topCategoryPct >= 35 ? 3 : topCategoryPct >= 28 ? 1 : 0,
    frequent: transactionsPerMonth >= 25 ? 3 : transactionsPerMonth >= 15 ? 1 : 0,
    stretched: salary > 0 && avgMonthlySpend >= salary * 0.9 ? 3 : avgMonthlySpend >= salary * 0.8 ? 1 : 0,
    balanced: 1,
  }

  const archetypeId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
  const archetype = { id: archetypeId, ...ARCHETYPES[archetypeId] }

  const insights = []

  if (topCategory) {
    insights.push(`${topCategory.category} is your biggest area at ${topCategory.pct}% of tracked spending.`)
  }
  if (savingsRate != null) {
    insights.push(
      savingsRate >= 0
        ? `You retain about ${savingsRate}% of salary after average monthly spend.`
        : `Average monthly spend exceeds salary by ${Math.abs(savingsRate)}%.`,
    )
  }
  if (weekendShare >= 40) {
    insights.push(`${weekendShare}% of spending happens on weekends — higher than weekdays.`)
  } else if (weekendShare <= 20 && total > 0) {
    insights.push('Most spending happens on weekdays — weekend purchases are relatively low.')
  }
  if (paymentMix[0]) {
    insights.push(`${paymentMix[0].method} is your most-used payment method (${paymentMix[0].pct}%).`)
  }
  if (transactionsPerMonth >= 15) {
    insights.push(`Roughly ${transactionsPerMonth} expenses per month (~${avgTransaction.toLocaleString()} UGX average).`)
  }
  if (overBudgetCategories > 0) {
    insights.push(`${overBudgetCategories} categor${overBudgetCategories === 1 ? 'y is' : 'ies are'} consistently above budget.`)
  }
  for (const t of trends.slice(0, 2)) {
    const dir = t.changePct > 0 ? 'up' : 'down'
    insights.push(`${t.category} is ${dir} ${Math.abs(t.changePct)}% vs the previous month.`)
  }
  if (topMerchants[0]) {
    insights.push(`"${topMerchants[0].name}" is your most frequent merchant by total spend.`)
  }

  return {
    hasData: true,
    archetype,
    metrics: {
      total,
      monthCount,
      avgMonthlySpend,
      avgTransaction,
      transactionsPerMonth,
      savingsRate,
      needsShare: Math.round(needsShare * 100),
      wantsShare: Math.round(wantsShare * 100),
      savingsShare: Math.round(savingsShare * 100),
      weekendShare,
      topCategoryPct,
      overBudgetCategories,
    },
    categoryShares: categoryShares.slice(0, 6),
    weekdayPattern,
    paymentMix: paymentMix.slice(0, 4),
    topMerchants,
    trends: trends.slice(0, 4),
    insights: insights.slice(0, 8),
  }
}
