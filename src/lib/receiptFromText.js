import { parseExpenseDate } from './csvExpenses'

function matchFromList(raw, options, fallback) {
  const x = String(raw ?? '').trim()
  if (!x) return fallback
  const exact = options.find((o) => o === x)
  if (exact) return exact
  const lower = options.find((o) => o.toLowerCase() === x.toLowerCase())
  if (lower) return lower
  const lowerX = x.toLowerCase()
  for (const o of options) {
    const ol = o.toLowerCase()
    if (lowerX.includes(ol) || ol.includes(lowerX)) return o
  }
  return fallback
}

function parseMoney(raw) {
  const cleaned = String(raw ?? '')
    .replace(/UGX|USH|SHS|KES|USD|\$/gi, '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function findAmount(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const totalLine = lines.find((l) => /\b(total|amount\s*due|grand\s*total|balance\s*due|net\s*payable)\b/i.test(l))
  if (totalLine) {
    const moneyMatches = totalLine.match(/(?:UGX|USH|SHS|\$)?\s*[\d,]+\.?\d*/gi) || []
    for (let i = moneyMatches.length - 1; i >= 0; i -= 1) {
      const n = parseMoney(moneyMatches[i])
      if (n != null) return n
    }
  }

  const all = [...String(text || '').matchAll(/(?:UGX|USH|SHS)\s*([\d,]+\.?\d*)/gi)]
  if (all.length) {
    const n = parseMoney(all[all.length - 1][1])
    if (n != null) return n
  }

  const candidates = []
  for (const line of lines) {
    if (/^\s*#|page\s+\d+/i.test(line)) continue
    const matches = line.match(/[\d,]{3,}(?:\.\d{1,2})?/g) || []
    for (const m of matches) {
      const n = parseMoney(m)
      if (n != null && n >= 100) candidates.push(n)
    }
  }
  if (!candidates.length) return null
  return Math.max(...candidates)
}

function findDate(text) {
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/,
    /\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/,
    /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/,
  ]
  for (const re of patterns) {
    const m = String(text || '').match(re)
    if (!m) continue
    const iso = parseExpenseDate(m[1])
    if (iso) return iso
  }
  return null
}

function findMerchant(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .filter((l) => l && !/^<!--/.test(l) && !/^page\s+\d+/i.test(l))
  for (const line of lines.slice(0, 8)) {
    if (/^\d+$/.test(line)) continue
    if (/\b(receipt|invoice|tax|vat|tel|phone|email|www\.|http)/i.test(line) && line.length < 12) continue
    if (/^(date|time|total|amount|subtotal|cashier)/i.test(line)) continue
    if (line.length >= 2 && line.length <= 80) return line
  }
  return 'Receipt purchase'
}

function findPaymentMethod(text, paymentMethods) {
  const lower = String(text || '').toLowerCase()
  for (const method of paymentMethods || []) {
    if (lower.includes(String(method).toLowerCase())) return method
  }
  if (/\b(momo|mobile\s*money|mtn|airtel\s*money)\b/i.test(lower)) {
    return matchFromList('Mobile money', paymentMethods, paymentMethods?.[0] || 'Mobile money')
  }
  if (/\b(card|visa|mastercard|debit|credit)\b/i.test(lower)) {
    return matchFromList('Card', paymentMethods, paymentMethods?.[0] || 'Card')
  }
  if (/\bcash\b/i.test(lower)) {
    return matchFromList('Cash', paymentMethods, paymentMethods?.[0] || 'Cash')
  }
  return paymentMethods?.[0] || 'Card'
}

function findCategory(text, categories) {
  const lower = String(text || '').toLowerCase()
  for (const cat of categories || []) {
    if (lower.includes(String(cat).toLowerCase())) return cat
  }
  const hints = [
    [/grocery|supermarket|shoprite|nakumatt|food\s*store/i, 'Groceries'],
    [/fuel|petrol|diesel|shell|total\s*energies|gas\s*station/i, 'Transport'],
    [/restaurant|cafe|coffee|dining|lunch|dinner/i, 'Dining & misc'],
    [/gym|fitness|workout/i, 'Gym'],
    [/netflix|spotify|subscription|airtime/i, 'Subscriptions'],
    [/rent|electric|water|utility|housing/i, 'Housing & utilities'],
  ]
  for (const [re, name] of hints) {
    if (re.test(lower)) return matchFromList(name, categories, categories?.[0] || name)
  }
  return categories?.[0] || ''
}

/** Parse expense fields from markdown/text extracted by readany. */
export function expenseFromDocumentText(markdown, { categories = [], paymentMethods = [] } = {}) {
  const text = String(markdown || '').trim()
  if (!text) {
    return {
      expense: {},
      confidence: 'low',
      notes: 'No readable text in this file.',
    }
  }

  const amount = findAmount(text)
  const date = findDate(text) || new Date().toISOString().slice(0, 10)
  const description = findMerchant(text)
  const category = findCategory(text, categories)
  const payment_method = findPaymentMethod(text, paymentMethods)

  const confidence = amount != null ? 'medium' : 'low'
  const notes = amount != null
    ? 'Read locally with readany (no API).'
    : 'Read locally with readany, but amount was unclear — please confirm.'

  return {
    expense: {
      date,
      amount: amount ?? '',
      description,
      category,
      payment_method,
      currency: 'UGX',
    },
    confidence,
    notes,
  }
}
