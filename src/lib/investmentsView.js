import { format, parseISO } from 'date-fns'

export const TX_TYPES = [
  { id: 'deposit', label: 'Contribution / deposit', direction: 'in' },
  { id: 'dividend', label: 'Interest / dividend', direction: 'in' },
  { id: 'sell', label: 'Sale', direction: 'in' },
  { id: 'buy', label: 'Purchase', direction: 'out' },
  { id: 'withdrawal', label: 'Withdrawal', direction: 'out' },
  { id: 'fee', label: 'Fee / tax', direction: 'out' },
]

export const TX_LABELS = Object.fromEntries(TX_TYPES.map((t) => [t.id, t.label]))

export const TX_COLORS = {
  deposit: 'var(--green)',
  dividend: 'var(--teal)',
  sell: 'var(--accent)',
  buy: 'var(--amber)',
  withdrawal: 'var(--amber)',
  fee: 'var(--red)',
}

const INFLOW = new Set(['deposit', 'dividend', 'sell'])

export function identifyInvestmentProvider(asset) {
  const text = String(asset || '').toLowerCase()
  if (text.includes('sanlam')) return 'Sanlam'
  if (text.includes('prudential') || text.includes('pru')) return 'Prudential'
  const compact = String(asset || '').trim()
  if (!compact) return 'Other'
  return compact.split(/\s+/).slice(0, 2).join(' ')
}

export function txDirection(txType) {
  return INFLOW.has(txType) ? 'in' : 'out'
}

export function txDisplayAmount(tx) {
  const amount = Math.abs(Number(tx.amount || 0))
  return txDirection(tx.tx_type) === 'in' ? amount : -amount
}

export function latestClosingBalance(transactions) {
  const withBalance = (transactions || [])
    .filter((t) => t.balance_amount != null)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return withBalance[0]?.balance_amount ?? null
}

export function monthInvestmentsView(transactions = []) {
  const totals = { deposit: 0, dividend: 0, sell: 0, buy: 0, withdrawal: 0, fee: 0 }
  let statementDeposit = 0
  let statementInterest = 0
  let statementWithdrawal = 0
  let statementTax = 0

  const byProvider = {}
  const groupedByDate = {}

  for (const t of transactions) {
    totals[t.tx_type] = (totals[t.tx_type] || 0) + Math.abs(Number(t.amount || 0))
    statementDeposit += Number(t.deposit_amount || 0)
    statementInterest += Number(t.interest_amount || 0)
    statementWithdrawal += Number(t.withdrawal_amount || 0)
    statementTax += Number(t.withholding_tax_amount || 0)

    const provider = identifyInvestmentProvider(t.asset)
    if (!byProvider[provider]) {
      byProvider[provider] = { provider, inflow: 0, outflow: 0, count: 0, latestBalance: null }
    }
    const bucket = byProvider[provider]
    bucket.count += 1
    const signed = txDisplayAmount(t)
    if (signed >= 0) bucket.inflow += signed
    else bucket.outflow += Math.abs(signed)
    if (t.balance_amount != null) {
      if (!bucket.latestBalance || String(t.date) >= String(bucket.latestBalanceDate || '')) {
        bucket.latestBalance = Number(t.balance_amount)
        bucket.latestBalanceDate = t.date
      }
    }

    const dateKey = String(t.date)
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = []
    groupedByDate[dateKey].push(t)
  }

  const moneyIn =
    (statementDeposit || totals.deposit) +
    (statementInterest || totals.dividend) +
    totals.sell
  const moneyOut =
    totals.buy +
    (statementWithdrawal || totals.withdrawal) +
    (statementTax || totals.fee)
  const netFlow = moneyIn - moneyOut
  const contributions = statementDeposit || totals.deposit
  const returns = (statementInterest || totals.dividend) + totals.sell
  const outflows = moneyOut
  const closingBalance = latestClosingBalance(transactions)

  const providers = Object.values(byProvider).sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow))

  return {
    totals,
    statementDeposit,
    statementInterest,
    statementWithdrawal,
    statementTax,
    moneyIn,
    moneyOut,
    contributions,
    returns,
    outflows,
    netFlow,
    closingBalance,
    providers,
    groupedByDate,
    count: transactions.length,
  }
}

export function formatActivityDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'EEEE, MMM d')
  } catch {
    return dateStr
  }
}

export function providerFilterOptions(transactions) {
  const map = new Map()
  for (const t of transactions) {
    const label = identifyInvestmentProvider(t.asset)
    map.set(label.toLowerCase(), label)
  }
  return [['all', 'All'], ...Array.from(map.entries()).map(([id, label]) => [id, label])]
}
