import { evaluateBadges } from './profileBadges'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function monthKey(dateStr) {
  return String(dateStr).slice(0, 7)
}

function bucketForType(type) {
  if (type === 'fixed') return 'needs'
  if (type === 'variable') return 'wants'
  return 'savings'
}

function normalizeMerchantKey(description) {
  const raw = String(description || '').trim()
  if (!raw || /^imported$/i.test(raw)) return null
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48)
}

function displayMerchant(description) {
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

const ARCHETYPE_AVATARS = {
  planner: '🧙‍♂️',
  essentials: '🏠',
  lifestyle: '🎉',
  focused: '🎯',
  frequent: '⚡',
  stretched: '😅',
  balanced: '⚖️',
}

const LEVEL_TITLES = [
  'Coin Curious',
  'Pocket Padawan',
  'Budget Beginner',
  'Money Minded',
  'Cash Captain',
  'Finance Fighter',
  'Savings Sage',
  'Wealth Wizard',
  'Budget Legend',
  'Money Master',
]

const XP_PER_LEVEL = 100

/** Turn profile stats into levels, badges, and quests for the dashboard game card. */
export function buildSpendingGamification(profile) {
  if (!profile?.hasData) {
    return {
      hasData: false,
      avatar: '🐣',
      level: 1,
      levelTitle: LEVEL_TITLES[0],
      xp: 0,
      xpInLevel: 0,
      xpToNext: XP_PER_LEVEL,
      stats: [],
      badges: [],
      quests: [{ text: 'Log your first expense to start your money journey!', reward: '+25 XP', done: false }],
    }
  }

  const { archetype, confidence, metrics, tips, budgetAdherence } = profile
  const avatar = ARCHETYPE_AVATARS[archetype.id] || '💰'

  const budgetHp = metrics.adherenceScore ?? Math.round(confidence.score * 0.6)
  const savingsPower = metrics.savingsRate != null ? Math.min(100, Math.max(0, metrics.savingsRate + 20)) : 40
  const discipline = confidence.score

  const rawXp =
    confidence.score * 2 +
    (metrics.adherenceScore ?? 0) +
    Math.max(0, metrics.savingsRate ?? 0) +
    metrics.monthCount * 8 +
    Math.min(40, metrics.mappedShare / 2)

  const level = Math.min(10, Math.max(1, Math.floor(rawXp / XP_PER_LEVEL) + 1))
  const xpInLevel = Math.round(rawXp % XP_PER_LEVEL)
  const xpToNext = XP_PER_LEVEL

  const badges = evaluateBadges(profile)

  const overBudget = budgetAdherence?.filter((r) => r.status === 'over').length ?? 0
  const quests = []

  if (tips[0]) {
    quests.push({
      text: tips[0].text.replace(/^Trim /, 'Quest: Trim ').replace(/^Rename /, 'Quest: Fix '),
      reward: '+40 XP',
      done: false,
    })
  }
  if (overBudget > 0) {
    quests.push({
      text: `Side quest: get ${overBudget} over-budget categor${overBudget === 1 ? 'y' : 'ies'} back on track this month.`,
      reward: '+30 XP',
      done: false,
    })
  }
  if ((metrics.savingsRate ?? 0) < 10 && metrics.savingsRate != null) {
    quests.push({
      text: 'Bonus quest: boost salary retained above 10%.',
      reward: '+50 XP',
      done: false,
    })
  }
  if (!quests.length) {
    quests.push({
      text: 'Main quest complete! Keep logging to maintain your streak.',
      reward: 'Streak 🔥',
      done: true,
    })
  }

  return {
    hasData: true,
    avatar,
    archetypeLabel: archetype.label,
    archetypeSummary: archetype.summary,
    level,
    levelTitle: LEVEL_TITLES[level - 1],
    xp: Math.round(rawXp),
    xpInLevel,
    xpToNext,
    stats: [
      { key: 'budget', label: 'Budget HP', icon: '❤️', value: budgetHp, color: 'var(--teal)' },
      { key: 'savings', label: 'Savings Power', icon: '⚡', value: savingsPower, color: 'var(--green)' },
      { key: 'discipline', label: 'Discipline', icon: '🎯', value: discipline, color: 'var(--accent)' },
    ],
    badges,
    quests,
    unlockedBadgeCount: badges.filter((b) => b.unlocked).length,
  }
}

function computeConfidence({ expenseCount, monthCount, mappedShare, hasDescriptions }) {
  let score = 0
  if (expenseCount >= 60) score += 35
  else if (expenseCount >= 30) score += 25
  else if (expenseCount >= 12) score += 15
  else score += 5

  if (monthCount >= 6) score += 35
  else if (monthCount >= 3) score += 25
  else if (monthCount >= 2) score += 15
  else score += 5

  if (mappedShare >= 0.9) score += 20
  else if (mappedShare >= 0.75) score += 12
  else if (mappedShare >= 0.5) score += 6

  if (hasDescriptions >= 0.7) score += 10
  else if (hasDescriptions >= 0.4) score += 5

  if (score >= 75) return { level: 'high', label: 'High confidence', score }
  if (score >= 45) return { level: 'medium', label: 'Medium confidence', score }
  return { level: 'low', label: 'Low confidence', score }
}

function rollingCategoryTrends(byMonthCategory, months) {
  if (months.length < 4) return []
  const recent = months.slice(-3)
  const prior = months.slice(-6, -3)
  if (!prior.length) return []

  const categories = new Set()
  for (const m of [...recent, ...prior]) {
    Object.keys(byMonthCategory[m] || {}).forEach((c) => categories.add(c))
  }

  const avg = (keys, cat) => {
    const vals = keys.map((m) => byMonthCategory[m]?.[cat] || 0)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }

  const trends = []
  for (const cat of categories) {
    const cur = avg(recent, cat)
    const prev = avg(prior, cat)
    if (cur <= 0 && prev <= 0) continue
    const changePct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0
    if (Math.abs(changePct) >= 12) {
      trends.push({ category: cat, changePct, recentAvg: Math.round(cur), priorAvg: Math.round(prev), rolling: true })
    }
  }
  return trends.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
}

function buildActionTips({ categoryMeta, byCategory, monthCount, budgetAdherence, unmappedCategories }) {
  const tips = []

  for (const row of budgetAdherence.filter((r) => r.status === 'over')) {
    tips.push({
      type: 'trim',
      text: `Trim ${row.category} by UGX ${fmtNum(row.overBy)}/mo to stay within budget (avg UGX ${fmtNum(row.monthlyAvg)} vs UGX ${fmtNum(row.budgetAmount)}).`,
    })
  }

  for (const row of budgetAdherence.filter((r) => r.status === 'under' && r.budgetAmount > 0 && r.monthlyAvg < r.budgetAmount * 0.5)) {
    tips.push({
      type: 'room',
      text: `${row.category} is well under budget — UGX ${fmtNum(row.headroom)}/mo headroom you could redirect to savings.`,
    })
  }

  if (unmappedCategories.length) {
    tips.push({
      type: 'fix',
      text: `Rename ${unmappedCategories.slice(0, 2).join(', ')}${unmappedCategories.length > 2 ? '…' : ''} in your sheet to match Settings budget names.`,
    })
  }

  return tips.slice(0, 4)
}

function fmtNum(n) {
  return new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(Math.round(n))
}

/**
 * Build a spending-habits profile from the user's expense history.
 */
export function buildSpendingProfile(expenses, { salary, budget = [] }) {
  if (!expenses?.length) {
    return {
      hasData: false,
      insights: ['Log or sync expenses to unlock your spending profile.'],
      tips: [{ type: 'fix', text: 'Add expenses manually, scan receipts, or sync a Google Sheet.' }],
    }
  }

  const categoryMeta = Object.fromEntries(budget.map((b) => [b.category, b]))
  const budgetNames = new Set(budget.map((b) => b.category))
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const months = [...new Set(expenses.map((e) => monthKey(e.date)))].sort()
  const monthCount = Math.max(1, months.length)

  const byCategory = {}
  const byMonthCategory = {}
  const byPayment = {}
  const byWeekday = Array(7).fill(0)
  const merchantGroups = {}
  let mappedTotal = 0
  let describedCount = 0
  let receiptCount = 0
  const unmappedCategories = new Set()

  for (const e of expenses) {
    const amount = Number(e.amount || 0)
    const mk = monthKey(e.date)
    byCategory[e.category] = (byCategory[e.category] || 0) + amount
    if (!byMonthCategory[mk]) byMonthCategory[mk] = {}
    byMonthCategory[mk][e.category] = (byMonthCategory[mk][e.category] || 0) + amount

    if (budgetNames.has(e.category)) mappedTotal += amount
    else unmappedCategories.add(e.category)

    const pay = e.payment_method || 'Other'
    byPayment[pay] = (byPayment[pay] || 0) + amount

    const day = new Date(`${e.date}T12:00:00`).getDay()
    if (Number.isFinite(day)) byWeekday[day] += amount

    if (e.receipt_path) receiptCount += 1

    const key = normalizeMerchantKey(e.description)
    const label = displayMerchant(e.description)
    if (label) {
      describedCount += 1
      if (key) {
        if (!merchantGroups[key]) merchantGroups[key] = { label, amount: 0, count: 0 }
        merchantGroups[key].amount += amount
        merchantGroups[key].count += 1
        if (label.length < merchantGroups[key].label.length) merchantGroups[key].label = label
      }
    }
  }

  const mappedShare = total > 0 ? mappedTotal / total : 0
  const confidence = computeConfidence({
    expenseCount: expenses.length,
    monthCount,
    mappedShare,
    hasDescriptions: expenses.length ? describedCount / expenses.length : 0,
  })

  const avgMonthlySpend = Math.round(total / monthCount)
  const transactionsPerMonth = Math.round(expenses.length / monthCount)
  const avgTransaction = Math.round(total / expenses.length)
  const savingsRate = salary > 0 ? Math.round(((salary - avgMonthlySpend) / salary) * 100) : null

  let needsSpend = 0
  let wantsSpend = 0
  let savingsSpend = 0
  let unmappedSpend = 0
  const budgetAdherence = []

  for (const [cat, spent] of Object.entries(byCategory)) {
    const meta = categoryMeta[cat]
    const monthlyAvg = spent / monthCount
    const budgetAmt = Number(meta?.amount || 0)

    if (meta) {
      const bucket = bucketForType(meta.type)
      if (bucket === 'needs') needsSpend += spent
      else if (bucket === 'wants') wantsSpend += spent
      else savingsSpend += spent

      if (budgetAmt > 0) {
        const ratio = monthlyAvg / budgetAmt
        let status = 'on'
        if (ratio > 1.1) status = 'over'
        else if (ratio < 0.85) status = 'under'
        budgetAdherence.push({
          category: cat,
          monthlyAvg: Math.round(monthlyAvg),
          budgetAmount: budgetAmt,
          overBy: Math.max(0, Math.round(monthlyAvg - budgetAmt)),
          headroom: Math.max(0, Math.round(budgetAmt - monthlyAvg)),
          status,
          color: meta.color,
        })
      }
    } else {
      unmappedSpend += spent
    }
  }

  const adherenceScore =
    budgetAdherence.length > 0
      ? Math.round(
          (budgetAdherence.filter((r) => r.status === 'on').length / budgetAdherence.length) * 100,
        )
      : null

  const needsShare = total > 0 ? needsSpend / total : 0
  const wantsShare = total > 0 ? (wantsSpend + unmappedSpend) / total : 0
  const savingsShare = total > 0 ? savingsSpend / total : 0

  const categoryShares = Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: categoryMeta[category]?.color,
      mapped: budgetNames.has(category),
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

  const topMerchants = Object.values(merchantGroups)
    .map((g) => ({ name: g.label, amount: g.amount, count: g.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const rollingTrends = rollingCategoryTrends(byMonthCategory, months)

  const scores = {
    planner:
      savingsRate != null && savingsRate >= 15 && (adherenceScore ?? 0) >= 60 ? 3 : savingsRate >= 10 ? 1 : 0,
    essentials: needsShare >= 0.5 ? 3 : needsShare >= 0.4 ? 1 : 0,
    lifestyle: wantsShare >= 0.45 ? 3 : wantsShare >= 0.35 ? 1 : 0,
    focused: topCategoryPct >= 35 ? 3 : topCategoryPct >= 28 ? 1 : 0,
    frequent: transactionsPerMonth >= 25 ? 3 : transactionsPerMonth >= 15 ? 1 : 0,
    stretched: salary > 0 && avgMonthlySpend >= salary * 0.9 ? 3 : avgMonthlySpend >= salary * 0.8 ? 1 : 0,
    balanced: 0,
  }

  const sortedArchetypes = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const archetypeId = sortedArchetypes[0][1] > 0 ? sortedArchetypes[0][0] : 'balanced'
  const archetype = { id: archetypeId, ...ARCHETYPES[archetypeId] }

  const tips = buildActionTips({
    categoryMeta,
    byCategory,
    monthCount,
    budgetAdherence,
    unmappedCategories: [...unmappedCategories],
  })

  const insights = []

  insights.push(
    `${confidence.label} — based on ${expenses.length} expenses across ${monthCount} month${monthCount === 1 ? '' : 's'}.`,
  )

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
  if (adherenceScore != null) {
    insights.push(`${adherenceScore}% of budget categories are within ±10% of their monthly target.`)
  }
  if (weekendShare >= 40) {
    insights.push(`${weekendShare}% of spending happens on weekends.`)
  }
  if (paymentMix[0]) {
    insights.push(`${paymentMix[0].method} is your most-used payment method (${paymentMix[0].pct}%).`)
  }
  for (const t of rollingTrends.slice(0, 2)) {
    const dir = t.changePct > 0 ? 'up' : 'down'
    insights.push(
      `${t.category} is ${dir} ${Math.abs(t.changePct)}% (3-mo avg vs prior 3 mo).`,
    )
  }
  if (topMerchants[0]) {
    insights.push(`"${topMerchants[0].name}" is your top merchant by spend.`)
  }

  const dataQuality = []
  if (monthCount < 3) dataQuality.push('Use at least 3 months of data for stronger trends.')
  if (mappedShare < 0.85) dataQuality.push('Align expense categories with your Settings budget names.')
  if (describedCount / expenses.length < 0.5) dataQuality.push('Add descriptions or scan receipts for merchant insights.')

  return {
    hasData: true,
    archetype,
    confidence,
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
      adherenceScore,
      mappedShare: Math.round(mappedShare * 100),
      receiptCount,
    },
    categoryShares: categoryShares.slice(0, 6),
    weekdayPattern,
    paymentMix: paymentMix.slice(0, 4),
    topMerchants,
    trends: rollingTrends.slice(0, 4),
    budgetAdherence: budgetAdherence.sort((a, b) => b.overBy - a.overBy).slice(0, 6),
    tips,
    dataQuality,
    insights: insights.slice(0, 8),
  }
}
