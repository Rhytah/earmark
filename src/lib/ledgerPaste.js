import { parseAmount, parseCsvText, parseExpenseCsv, parseExpenseDate } from './csvExpenses'

function splitTabs(line) {
  return line.split(/\t/).map((c) => c.trim())
}

/** True for tabular “day book” pastes (header Day/Date/Income/… or data shaped like it). */
export function isLedgerPaste(text) {
  const head = text.slice(0, 6000).replace(/\r\n/g, '\n')
  const compact = head.toLowerCase().replace(/[\t\n]+/g, ' ')
  if (/\bday\b/.test(compact) && /\bdate\b/.test(compact) && /\bexpense\b/.test(compact)) {
    return true
  }
  const lines = head.split('\n').filter((l) => l.trim())
  for (const line of lines.slice(0, 15)) {
    if (/\t[a-z]{3,9}\s+\d{1,2},\s*\d{4}\t/i.test(line)) return true
    if (/^[a-z]{3}\t[a-z]{3,9}\s+\d{1,2},\s*\d{4}/i.test(line.trim())) return true
  }
  return false
}

function findCol(headers, ...names) {
  const h = headers.map((x) => String(x ?? '').trim().toLowerCase())
  for (const n of names) {
    const i = h.indexOf(n.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

function parseProseDate(cell) {
  return parseExpenseDate(cell)
}

/** Map “for” text to a budget category using exact match, substring, then heuristics. */
export function inferLedgerCategory(forDesc, categories) {
  const raw = String(forDesc ?? '').trim()
  if (!raw) return { category: null, guessed: false }

  const lower = raw.toLowerCase()

  for (const c of categories) {
    if (c.toLowerCase() === lower) return { category: c, guessed: false }
  }

  for (const c of categories) {
    const cl = c.toLowerCase()
    if (lower.includes(cl) || cl.includes(lower)) return { category: c, guessed: false }
  }

  const pick = (re) => categories.find((c) => re.test(c))

  const rules = [
    { test: /\bgym\b/i, cat: pick(/\bgym\b/i) },
    { test: /fuel|petrol|litre|litres|metro/i, cat: pick(/fuel|transport/i) },
    { test: /airtel|router|data/i, cat: pick(/airtel|data/i) },
    {
      test: /atm|withdraw|kyandondo|stone\b/i,
      cat: pick(/cash|atm/i),
    },
    {
      test: /spotify|netflix|cursor|claude|coursera|subscription|prime|amazon prime|^google\b/i,
      cat: pick(/subscription/i),
    },
    {
      test: /grocery|groceries|greens|fraine|vegetables|salad|takeout|lunch|liquor|waya|amazon purchase|rogers|armstrong|bbq|beaverages|sam\b|purchase/i,
      cat: pick(/grocery|food/i),
    },
    {
      test: /hair|personal|labor|mercy|delivery|beaverage|bbq chicken/i,
      cat: pick(/personal|eating|misc|variable/i),
    },
  ]

  for (const { test, cat } of rules) {
    if (cat && test.test(raw)) return { category: cat, guessed: true }
  }

  const fallback =
    categories.find((c) => /eating|misc|variable/i.test(c)) ?? categories[0] ?? null
  if (fallback) return { category: fallback, guessed: true }

  return { category: null, guessed: false }
}

function isTotalsLine(line, cells) {
  const l = line.toLowerCase()
  if (/\btotals?\b/.test(l)) return true
  return cells.some((c) => String(c).trim().toLowerCase() === 'totals')
}

function textToLedgerMatrix(text) {
  const raw = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
  const firstLine = raw.split('\n').find((l) => l.trim()) ?? ''
  if (firstLine.includes('\t')) {
    return raw.split('\n').map(splitTabs)
  }
  return parseCsvText(raw)
}

/**
 * Parse day-book rows: Day, Date, Income, From, Expense, for.
 * Continuation rows reuse the last seen Date. Skips income-only and totals rows.
 */
export function parseLedgerMatrix(matrix, { categories, paymentMethods }) {
  const valid = []
  const invalid = []
  const warnings = []

  if (!categories?.length) {
    invalid.push({ line: 0, reason: 'No budget categories in Settings.' })
    return { valid, invalid, warnings }
  }

  const defaultPay = paymentMethods[0] ?? 'Card'

  let col = {
    day: 0,
    date: 1,
    income: 2,
    from: 3,
    expense: 4,
    for: 5,
  }
  let start = 0

  const firstNonEmpty = matrix.findIndex((row) => row.some((c) => String(c ?? '').trim()))
  if (firstNonEmpty >= 0) {
    const hCells = matrix[firstNonEmpty]
    const d = findCol(hCells, 'day')
    const a = findCol(hCells, 'date')
    const i = findCol(hCells, 'income')
    const f = findCol(hCells, 'from')
    const e = findCol(hCells, 'expense')
    const fo = findCol(hCells, 'for', 'memo', 'detail', 'notes')

    if (a >= 0 && e >= 0) {
      col = {
        day: d >= 0 ? d : 0,
        date: a,
        income: i >= 0 ? i : 2,
        from: f >= 0 ? f : 3,
        expense: e,
        for: fo >= 0 ? fo : 5,
      }
      start = firstNonEmpty + 1
    }
  }

  const width = Math.max(col.day, col.date, col.income, col.from, col.expense, col.for) + 1
  let currentDate = null

  for (let r = start; r < matrix.length; r++) {
    const line = matrix[r]
    if (!line.some((c) => String(c ?? '').trim())) continue

    let cells = line.map((c) => String(c ?? ''))
    while (cells.length < width) cells.push('')
    if (cells.length > width) cells = cells.slice(0, width)

    const lineText = cells.join('\t')
    if (isTotalsLine(lineText, cells)) continue

    const dateParsed = parseProseDate(cells[col.date])
    if (dateParsed) currentDate = dateParsed

    const expRaw = cells[col.expense] ?? ''
    const amount = parseAmount(expRaw)

    if (!Number.isFinite(amount) || amount <= 0) continue

    if (!currentDate) {
      invalid.push({ line: r + 1, reason: 'Expense before first dated row; add a row with a full date.' })
      continue
    }

    const forDesc = (cells[col.for] ?? '').trim() || 'Imported'
    const inf = inferLedgerCategory(forDesc, categories)

    if (!inf.category) {
      invalid.push({
        line: r + 1,
        reason: `Could not map “${forDesc}” to a category. Add a keyword or rename in Settings.`,
      })
      continue
    }

    if (inf.guessed) {
      warnings.push({ line: r + 1, text: `“${forDesc}” → ${inf.category}` })
    }

    valid.push({
      date: currentDate,
      category: inf.category,
      description: forDesc,
      amount,
      payment_method: defaultPay,
    })
  }

  return { valid, invalid, warnings }
}

/** Parse day-book paste (TSV from clipboard) or CSV export from Google Sheets. */
export function parseLedgerPaste(text, opts) {
  return parseLedgerMatrix(textToLedgerMatrix(text), opts)
}

/** Auto: ledger if it looks like a day book, else CSV. */
export function parseExpensePaste(text, opts) {
  if (isLedgerPaste(text)) {
    return { ...parseLedgerPaste(text, opts), format: 'ledger' }
  }
  return { ...parseExpenseCsv(text, opts), format: 'csv', warnings: [] }
}

/** @param {'auto' | 'ledger' | 'csv'} mode */
export function parseExpensePasteMode(text, opts, mode) {
  if (mode === 'ledger') return { ...parseLedgerPaste(text, opts), format: 'ledger' }
  if (mode === 'csv') return { ...parseExpenseCsv(text, opts), format: 'csv', warnings: [] }
  return parseExpensePaste(text, opts)
}
