/** Parse CSV with comma separator and "double-quote" escaping. */
export function parseCsvText(text) {
  const raw = text.replace(/^\uFEFF/, '')
  const lines = []
  let row = []
  let cur = ''
  let inQuotes = false

  const flushRow = () => {
    row.push(cur)
    cur = ''
    if (row.length > 1 || row.some((c) => String(c).trim() !== '')) {
      lines.push(row)
    }
    row = []
  }

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n') {
      flushRow()
    } else if (c === '\r') {
      if (raw[i + 1] === '\n') i++
      flushRow()
    } else {
      cur += c
    }
  }
  row.push(cur)
  if (row.length && row.some((c) => String(c).trim() !== '')) {
    lines.push(row)
  }
  return lines
}

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

const HEADER_ALIASES = {
  date: ['date', 'dt', 'transaction_date', 'spent_on', 'when'],
  category: ['category', 'cat', 'type', 'account'],
  description: ['description', 'desc', 'memo', 'note', 'details', 'narrative', 'merchant'],
  amount: ['amount', 'amt', 'value', 'total', 'sum', 'cost', 'price', 'debit'],
  payment_method: ['payment_method', 'payment', 'pay', 'method', 'pm', 'card'],
}

function columnIndices(headerRow) {
  const norm = headerRow.map(normalizeHeader)
  const idx = {}
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let i = 0; i < norm.length; i++) {
      if (aliases.includes(norm[i])) {
        idx[key] = i
        break
      }
    }
  }
  if (idx.date !== undefined && idx.amount !== undefined) {
    return { ...idx, hasHeader: true }
  }
  return {
    date: 0,
    category: 1,
    description: 2,
    amount: 3,
    payment_method: 4,
    hasHeader: false,
  }
}

export function parseIsoOrDmy(dateStr) {
  const s = String(dateStr).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const y = m[3]
    if (a > 12) {
      return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
    }
    if (b > 12) {
      return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
    }
    return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
  }
  return null
}

export function parseAmount(s) {
  const t = String(s ?? '').trim()
  if (!t) return NaN
  const cleaned = t.replace(/^UGX\s*/i, '').replace(/,/g, '')
  const n = Number(cleaned.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function matchCategory(raw, categories) {
  const x = String(raw ?? '').trim()
  if (!x) return { ok: false, value: null, hint: 'missing category' }
  const exact = categories.find((c) => c === x)
  if (exact) return { ok: true, value: exact }
  const lower = categories.find((c) => c.toLowerCase() === x.toLowerCase())
  if (lower) return { ok: true, value: lower }
  return {
    ok: false,
    value: null,
    hint: `unknown category "${x}" — use one of your Settings budget names`,
  }
}

function matchPayment(raw, paymentMethods, fallback) {
  const x = String(raw ?? '').trim()
  if (!x) return fallback
  const exact = paymentMethods.find((p) => p === x)
  if (exact) return exact
  const lower = paymentMethods.find((p) => p.toLowerCase() === x.toLowerCase())
  if (lower) return lower
  return fallback
}

/**
 * @returns {{ valid: object[], invalid: { line: number, reason: string, cells?: string[] }[] }}
 */
export function parseExpenseCsv(csvText, { categories, paymentMethods }) {
  const matrix = parseCsvText(csvText)
  const valid = []
  const invalid = []

  if (!matrix.length) {
    invalid.push({ line: 0, reason: 'Empty paste — add a header row and data rows.' })
    return { valid, invalid }
  }

  const col = columnIndices(matrix[0])
  let startRow = col.hasHeader ? 1 : 0

  if (!col.hasHeader && matrix[0].length < 4) {
    invalid.push({
      line: 1,
      reason:
        'Without a header row, use 4+ columns: date, category, description, amount — optional 5th: payment method.',
    })
    return { valid, invalid }
  }

  const defaultPay = paymentMethods[0] ?? 'Card'

  for (let r = startRow; r < matrix.length; r++) {
    const line = matrix[r]
    const get = (key) => {
      const i = col[key]
      if (i === undefined) return ''
      return line[i] != null ? String(line[i]) : ''
    }

    const date = parseIsoOrDmy(get('date'))
    const categoryResult = matchCategory(get('category'), categories)
    const description = get('description').trim() || 'Imported'
    const amount = parseAmount(get('amount'))
    const payment_method = matchPayment(get('payment_method'), paymentMethods, defaultPay)

    const lineNum = r + 1
    const reasons = []
    if (!date) reasons.push('invalid or missing date (use YYYY-MM-DD)')
    if (!categoryResult.ok) reasons.push(categoryResult.hint)
    if (!Number.isFinite(amount) || amount <= 0) reasons.push('invalid amount')

    if (reasons.length) {
      invalid.push({ line: lineNum, reason: reasons.join('; '), cells: line })
      continue
    }

    valid.push({
      date,
      category: categoryResult.value,
      description,
      amount,
      payment_method,
    })
  }

  return { valid, invalid }
}
