export function normalizeExtraIncome(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((row, i) => ({
    id: String(row?.id || `income-${i + 1}`),
    label: String(row?.label || '').trim() || 'Extra income',
    amount: Math.max(0, Number(row?.amount) || 0),
  }))
}

export function createExtraIncomeRow(existing = []) {
  const ids = new Set(existing.map((r) => r.id))
  let n = existing.length + 1
  let id = `income-${n}`
  while (ids.has(id)) {
    n += 1
    id = `income-${n}`
  }
  return { id, label: 'Side income', amount: 0 }
}

export function incomeSummary(settings) {
  const salary = Math.max(0, Number(settings?.salary) || 0)
  const extraSources = normalizeExtraIncome(settings?.extra_income).filter((r) => r.amount > 0)
  const extraTotal = extraSources.reduce((sum, row) => sum + row.amount, 0)
  return {
    salary,
    extraSources,
    extraTotal,
    total: salary + extraTotal,
  }
}

export function totalMonthlyIncome(settings) {
  return incomeSummary(settings).total
}
