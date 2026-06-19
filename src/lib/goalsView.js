import { budgetLineAmount } from './constants'
import { identifyInvestmentProvider, latestClosingBalance, txDisplayAmount } from './investmentsView'

function sumCategory(expenses, category) {
  return (expenses || [])
    .filter((e) => e.category === category)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)
}

function investmentDeposits(transactions) {
  return (transactions || [])
    .filter((t) => ['deposit', 'buy'].includes(t.tx_type))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)
}

function assetMatchesGoal(asset, goalLabel) {
  const a = String(asset || '').toLowerCase()
  const g = String(goalLabel || '').toLowerCase()
  if (!a || !g) return false
  if (a.includes(g) || g.includes(a)) return true
  const provider = identifyInvestmentProvider(asset).toLowerCase()
  if (provider !== 'other' && (g.includes(provider) || a.includes(provider))) return true
  const words = g.split(/\s+/).filter((w) => w.length > 3)
  return words.some((w) => a.includes(w))
}

function latestBalanceByAsset(transactions) {
  const map = {}
  for (const t of transactions || []) {
    const asset = String(t.asset || 'Unknown').trim()
    if (t.balance_amount != null) {
      const prev = map[asset]
      if (!prev?.fromStatement || String(t.date) >= String(prev.date)) {
        map[asset] = {
          balance: Number(t.balance_amount),
          date: t.date,
          fromStatement: true,
        }
      }
    }
  }
  for (const t of transactions || []) {
    const asset = String(t.asset || 'Unknown').trim()
    if (map[asset]?.fromStatement) continue
    if (!map[asset]) {
      map[asset] = { balance: 0, date: t.date, fromStatement: false }
    }
    map[asset].balance += txDisplayAmount(t)
    if (String(t.date) >= String(map[asset].date)) map[asset].date = t.date
  }
  return map
}

export function deriveInvestmentBalancesFromTransactions(allTransactions, investmentGoals = []) {
  const byAsset = latestBalanceByAsset(allTransactions)
  const assets = Object.entries(byAsset).sort((a, b) => b[1].balance - a[1].balance)
  const goalMeta = investmentGoals.map(() => ({ balance: 0, source: null, asset: null }))
  const assignedAssets = new Set()

  investmentGoals.forEach((goal, i) => {
    for (const [asset, data] of assets) {
      if (assignedAssets.has(asset)) continue
      if (assetMatchesGoal(asset, goal.label)) {
        goalMeta[i] = {
          balance: Math.max(0, data.balance),
          source: data.fromStatement ? 'statement' : 'activity',
          asset,
        }
        assignedAssets.add(asset)
        break
      }
    }
  })

  for (const [asset, data] of assets) {
    if (assignedAssets.has(asset)) continue
    const emptyIdx = goalMeta.findIndex((g) => g.balance === 0)
    if (emptyIdx < 0) break
    goalMeta[emptyIdx] = {
      balance: Math.max(0, data.balance),
      source: data.fromStatement ? 'statement' : 'activity',
      asset,
    }
    assignedAssets.add(asset)
  }

  return {
    goalBalances: goalMeta.map((g) => g.balance),
    goalMeta,
    byAsset,
    totalFromLogged: assets.reduce((sum, [, data]) => sum + Math.max(0, data.balance), 0),
    hasLoggedActivity: (allTransactions || []).length > 0,
    transactionCount: (allTransactions || []).length,
  }
}

function monthLabelShort(monthKey) {
  if (!monthKey) return ''
  const [year, month] = String(monthKey).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-UG', { month: 'short', year: 'numeric' })
}

function goalStatus(pct) {
  if (pct >= 100) return { label: 'Complete', color: 'var(--green)' }
  if (pct >= 75) return { label: 'Almost there', color: 'var(--teal)' }
  if (pct >= 40) return { label: 'On track', color: 'var(--accent)' }
  if (pct >= 15) return { label: 'Building', color: 'var(--amber)' }
  return { label: 'Getting started', color: 'var(--muted)' }
}

export function buildGoalsView({
  settings,
  snapshots = [],
  monthExpenses = [],
  monthInvestments = [],
  allInvestmentTransactions = [],
  focusMonth,
}) {
  const {
    investment_goals = [],
    emergency_fund_target = 0,
    emergency_category,
    investments_category,
    budget,
  } = settings

  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null
  const emergencyBalance = Number(latest?.emergency_balance || 0)
  const emergencyTarget = Number(emergency_fund_target || 0)
  const emergencyGap = Math.max(0, emergencyTarget - emergencyBalance)
  const emergencyPct =
    emergencyTarget > 0 ? Math.min(100, Math.round((emergencyBalance / emergencyTarget) * 100)) : 0

  const emergencyBudget = budgetLineAmount(budget, emergency_category)
  const investmentsBudget = budgetLineAmount(budget, investments_category)
  const emergencyContributed = sumCategory(monthExpenses, emergency_category)
  const investmentsFromExpenses = sumCategory(monthExpenses, investments_category)
  const investmentsFromStatements = investmentDeposits(monthInvestments)
  const investmentsContributed = investmentsFromExpenses + investmentsFromStatements
  const totalContributedThisMonth = emergencyContributed + investmentsContributed

  const monthsToEmergencyByBudget =
    emergencyGap > 0 && emergencyBudget > 0 ? Math.ceil(emergencyGap / emergencyBudget) : 0
  const monthsToEmergencyByPace =
    emergencyGap > 0 && emergencyContributed > 0
      ? Math.ceil(emergencyGap / emergencyContributed)
      : monthsToEmergencyByBudget

  const derived = deriveInvestmentBalancesFromTransactions(allInvestmentTransactions, investment_goals)

  const investBalances = investment_goals.map((_, i) => {
    const snapshotVal = Number(latest?.[`investment${i + 1}_balance`] || 0)
    if (snapshotVal > 0) return snapshotVal
    return derived.goalBalances[i] || 0
  })

  const investBalanceSources = investment_goals.map((_, i) => {
    const snapshotVal = Number(latest?.[`investment${i + 1}_balance`] || 0)
    if (snapshotVal > 0) return 'snapshot'
    if (derived.goalBalances[i] > 0) return derived.goalMeta[i]?.source || 'activity'
    return null
  })

  const investmentGoals = investment_goals.map((goal, i) => {
    const balance = investBalances[i] || 0
    const target = Number(goal.target || 0)
    const years = Math.max(1, Number(goal.years || 1))
    const gap = Math.max(0, target - balance)
    const pct = target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0
    const monthlyNeeded = gap > 0 ? Math.ceil(gap / (years * 12)) : 0
    const status = goalStatus(pct)
    const balanceSource = investBalanceSources[i]
    const linkedAsset = derived.goalMeta[i]?.asset || null

    return {
      ...goal,
      index: i,
      balance,
      target,
      years,
      gap,
      pct,
      monthlyNeeded,
      status,
      balanceSource,
      linkedAsset,
    }
  })

  const totalInvestmentBalance = investBalances.reduce((s, v) => s + v, 0)
  const totalInvestmentTarget = investmentGoals.reduce((s, g) => s + g.target, 0)
  const totalInvestmentGap = Math.max(0, totalInvestmentTarget - totalInvestmentBalance)
  const totalInvestmentPct =
    totalInvestmentTarget > 0
      ? Math.min(100, Math.round((totalInvestmentBalance / totalInvestmentTarget) * 100))
      : 0

  const totalSaved = emergencyBalance + totalInvestmentBalance
  const totalTarget = emergencyTarget + totalInvestmentTarget
  const totalPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0

  const statementBalance = latestClosingBalance(allInvestmentTransactions.length ? allInvestmentTransactions : monthInvestments)

  const recentInvestmentActivity = [...(allInvestmentTransactions || [])]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5)

  const usesLoggedBalances = investBalances.some((b, i) => b > 0 && investBalanceSources[i] !== 'snapshot')

  const chartData = snapshots.map((s) => {
    const row = {
      month: monthLabelShort(s.month),
      monthKey: s.month,
      Emergency: Number(s.emergency_balance || 0),
    }
    investment_goals.forEach((goal, i) => {
      row[goal.label || `Goal ${i + 1}`] = [s.investment1_balance, s.investment2_balance, s.investment3_balance][i] || 0
    })
    return row
  })

  return {
    focusMonth,
    focusMonthLabel: monthLabelShort(focusMonth),
    latestSnapshotMonth: latest?.month || null,
    latestSnapshotLabel: monthLabelShort(latest?.month),
    hasSnapshots: snapshots.length > 0,
    emergency: {
      category: emergency_category,
      balance: emergencyBalance,
      target: emergencyTarget,
      gap: emergencyGap,
      pct: emergencyPct,
      status: goalStatus(emergencyPct),
      monthlyBudget: emergencyBudget,
      contributedThisMonth: emergencyContributed,
      monthsToTarget: monthsToEmergencyByBudget,
      monthsAtThisPace: monthsToEmergencyByPace,
      onPace: emergencyBudget > 0 ? emergencyContributed >= emergencyBudget : emergencyContributed > 0,
    },
    investments: {
      category: investments_category,
      totalBalance: totalInvestmentBalance,
      totalTarget: totalInvestmentTarget,
      totalGap: totalInvestmentGap,
      totalPct: totalInvestmentPct,
      contributedThisMonth: investmentsContributed,
      fromExpenses: investmentsFromExpenses,
      fromStatements: investmentsFromStatements,
      statementBalance,
      monthlyBudget: investmentsBudget,
      goals: investmentGoals,
      hasLoggedActivity: derived.hasLoggedActivity,
      transactionCount: derived.transactionCount,
      totalFromLogged: derived.totalFromLogged,
      usesLoggedBalances,
      recentActivity: recentInvestmentActivity,
    },
    totals: {
      saved: totalSaved,
      target: totalTarget,
      pct: totalPct,
      contributedThisMonth: totalContributedThisMonth,
      combinedMonthlyBudget: emergencyBudget + investmentsBudget,
    },
    chartData,
    chartGoalLabels: investment_goals.map((g) => g.label),
  }
}

export { monthLabelShort as formatGoalMonth }
