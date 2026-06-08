import { parseAmount, parseCsvText, parseIsoOrDmy } from './csvExpenses'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { format, isValid, parse } from 'date-fns'

GlobalWorkerOptions.workerSrc = pdfWorker

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

const HEADER_ALIASES = {
  date: ['date', 'transaction_date', 'dt'],
  trans_no: ['trans_no', 'transaction_no', 'transaction_number', 'ref_no', 'reference', 'id'],
  asset: ['asset', 'symbol', 'ticker', 'instrument', 'security', 'name'],
  tx_type: ['type', 'transaction_type', 'tx_type', 'action', 'side'],
  amount: ['amount', 'value', 'total', 'net_amount', 'cash_amount'],
  deposit_amount: ['deposit', 'deposit_amount', 'credit'],
  interest_amount: ['interest', 'interest_amount'],
  withdrawal_amount: ['withdrawal', 'withdrawal_amount', 'debit'],
  withholding_tax_amount: ['withholding_tax', 'tax', 'withholding'],
  balance_amount: ['balance', 'running_balance', 'closing_balance'],
  description: ['description', 'narration', 'transaction_description'],
  units: ['units', 'quantity', 'qty', 'shares'],
  price: ['price', 'unit_price'],
  notes: ['notes', 'note', 'memo', 'description', 'details'],
}

function detectColumns(headerRow) {
  const norm = headerRow.map(normalizeHeader)
  const idx = {}
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = norm.findIndex((h) => aliases.includes(h))
    if (i >= 0) idx[key] = i
  }
  if (idx.date !== undefined && (idx.asset !== undefined || idx.description !== undefined)) return { ...idx, hasHeader: true }
  return { date: 0, asset: 1, tx_type: 2, amount: 3, units: 4, price: 5, notes: 6, description: 1, hasHeader: false }
}

function normalizeType(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return 'buy'
  if (/(buy|purchase)/.test(v)) return 'buy'
  if (/(sell|sale)/.test(v)) return 'sell'
  if (/(dividend|interest|coupon)/.test(v)) return 'dividend'
  if (/(fee|charge|commission|tax)/.test(v)) return 'fee'
  if (/(deposit|fund)/.test(v)) return 'deposit'
  if (/(withdraw|cashout|redemption)/.test(v)) return 'withdrawal'
  return null
}

function inferTypeFromContext(text, amount) {
  const t = String(text || '').toLowerCase()
  const keyword = normalizeType(t)
  if (keyword) return keyword
  if (/(dr|debit)/.test(t)) return 'buy'
  if (/(cr|credit)/.test(t)) return 'sell'
  if (Number.isFinite(amount)) return amount < 0 ? 'buy' : 'sell'
  return 'buy'
}

function parseStatementDate(raw) {
  const iso = parseIsoOrDmy(raw)
  if (iso) return iso
  const text = String(raw || '').trim()
  for (const mask of ['MMM d, yyyy', 'MMMM d, yyyy', 'MMM yyyy', 'MMMM yyyy', 'MMM-yy', 'MMM-yyyy']) {
    const dt = parse(text, mask, new Date())
    if (isValid(dt)) return format(dt, 'yyyy-MM-dd')
  }
  return null
}

export function parseInvestmentStatementCsv(csvText) {
  const matrix = parseCsvText(csvText)
  const valid = []
  const invalid = []
  if (!matrix.length) return { valid, invalid: [{ line: 0, reason: 'Empty file/paste.' }] }

  const col = detectColumns(matrix[0])
  const start = col.hasHeader ? 1 : 0
  const isDateCell = (value) => Boolean(parseIsoOrDmy(String(value ?? '').trim()))

  const getCell = (row, key) => {
    const i = col[key]
    return i !== undefined && row[i] != null ? String(row[i]) : ''
  }

  const logicalRows = []
  for (let r = start; r < matrix.length; r++) {
    const row = matrix[r]
    if (!isDateCell(row[0])) {
      continue
    }

    const assembled = {
      date: getCell(row, 'date'),
      asset: getCell(row, 'asset'),
      trans_no: getCell(row, 'trans_no'),
      tx_type: getCell(row, 'tx_type'),
      amount: getCell(row, 'amount'),
      units: getCell(row, 'units'),
      price: getCell(row, 'price'),
      notes: getCell(row, 'notes'),
      description: getCell(row, 'description'),
      deposit_amount: getCell(row, 'deposit_amount'),
      interest_amount: getCell(row, 'interest_amount'),
      withdrawal_amount: getCell(row, 'withdrawal_amount'),
      withholding_tax_amount: getCell(row, 'withholding_tax_amount'),
      balance_amount: getCell(row, 'balance_amount'),
    }

    // Handle broken multiline rows (e.g. date + partial asset on one line,
    // then "Product ..." next line, then "Policy,deposit,300000,...").
    while (r + 1 < matrix.length && !isDateCell(matrix[r + 1][0])) {
      const next = matrix[r + 1]
      const next0 = String(next[0] ?? '').trim()
      const next1 = String(next[1] ?? '').trim()
      const next2 = String(next[2] ?? '').trim()

      const looksLikeTxSplit = normalizeType(next1) && parseAmount(next2) >= 0
      const looksLikeTxLeadingType = normalizeType(next0) && parseAmount(next1) >= 0

      if (looksLikeTxSplit) {
        assembled.asset = [assembled.asset, next0].filter(Boolean).join(' ').trim()
        assembled.tx_type = assembled.tx_type || next1
        assembled.amount = assembled.amount || next2
        assembled.units = assembled.units || String(next[3] ?? '')
        assembled.price = assembled.price || String(next[4] ?? '')
        assembled.notes = assembled.notes || String(next[5] ?? '')
        assembled.description = assembled.description || String(next[5] ?? '')
      } else if (looksLikeTxLeadingType) {
        assembled.tx_type = assembled.tx_type || next0
        assembled.amount = assembled.amount || next1
        assembled.units = assembled.units || String(next[2] ?? '')
        assembled.price = assembled.price || String(next[3] ?? '')
        assembled.notes = assembled.notes || String(next[4] ?? '')
        assembled.description = assembled.description || String(next[4] ?? '')
      } else {
        // Continuation text (usually part of long asset name / policy label).
        const continuation = next.filter((x) => String(x ?? '').trim()).join(' ')
        if (continuation) {
          assembled.asset = [assembled.asset, continuation].filter(Boolean).join(' ').trim()
        }
      }
      r += 1
    }

    logicalRows.push(assembled)
  }

  for (let r = 0; r < logicalRows.length; r++) {
    const row = logicalRows[r]
    const get = (key) => String(row[key] ?? '')

    const date = parseIsoOrDmy(get('date'))
    const asset = get('asset').trim() || 'Statement Asset'
    const tx_typeRaw = normalizeType(get('tx_type'))
    const amount = parseAmount(get('amount'))
    const depositAmount = parseAmount(get('deposit_amount'))
    const interestAmount = parseAmount(get('interest_amount'))
    const withdrawalAmount = parseAmount(get('withdrawal_amount'))
    const withholdingTaxAmount = parseAmount(get('withholding_tax_amount'))
    const balanceAmount = parseAmount(get('balance_amount'))
    const description = get('description').trim()
    const trans_no = get('trans_no').trim()
    const unitsRaw = parseAmount(get('units'))
    const priceRaw = parseAmount(get('price'))
    const notes = get('notes').trim() || description || 'Imported statement row'

    const hasSplitAmounts = [depositAmount, interestAmount, withdrawalAmount, withholdingTaxAmount].some(Number.isFinite)
    const netFromSplit = (Number.isFinite(depositAmount) ? depositAmount : 0)
      + (Number.isFinite(interestAmount) ? interestAmount : 0)
      - (Number.isFinite(withdrawalAmount) ? withdrawalAmount : 0)
      - (Number.isFinite(withholdingTaxAmount) ? withholdingTaxAmount : 0)
    const normalizedAmount = Number.isFinite(amount) ? amount : hasSplitAmounts ? netFromSplit : NaN
    const tx_type = tx_typeRaw
      || (Number.isFinite(withdrawalAmount) && withdrawalAmount > 0 ? 'withdrawal' : null)
      || (Number.isFinite(interestAmount) && interestAmount > 0 ? 'dividend' : null)
      || (Number.isFinite(depositAmount) && depositAmount > 0 ? 'deposit' : null)
      || (Number.isFinite(withholdingTaxAmount) && withholdingTaxAmount > 0 ? 'fee' : null)
      || inferTypeFromContext(`${description} ${notes}`, normalizedAmount)

    const reasons = []
    if (!date) reasons.push('invalid/missing date')
    if (!asset) reasons.push('missing asset/symbol')
    if (!tx_type) reasons.push('invalid type')
    if (!Number.isFinite(normalizedAmount)) reasons.push('invalid amount')

    if (reasons.length) {
      invalid.push({ line: r + start + 1, reason: reasons.join('; ') })
      continue
    }

    valid.push({
      date,
      trans_no: trans_no || null,
      asset,
      tx_type,
      amount: normalizedAmount,
      description,
      deposit_amount: Number.isFinite(depositAmount) ? depositAmount : null,
      interest_amount: Number.isFinite(interestAmount) ? interestAmount : null,
      withdrawal_amount: Number.isFinite(withdrawalAmount) ? withdrawalAmount : null,
      withholding_tax_amount: Number.isFinite(withholdingTaxAmount) ? withholdingTaxAmount : null,
      balance_amount: Number.isFinite(balanceAmount) ? balanceAmount : null,
      units: Number.isFinite(unitsRaw) ? unitsRaw : null,
      price: Number.isFinite(priceRaw) ? priceRaw : null,
      notes,
      source: 'statement_upload',
    })
  }

  return { valid, invalid }
}

export function parseInvestmentStatementText(text) {
  const fromCsv = parseInvestmentStatementCsv(text)
  if (fromCsv.valid.length) return fromCsv

  const valid = []
  const invalid = []
  const lines = String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const linePattern = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\s+([A-Za-z0-9._-]{1,24})\s+(buy|sell|dividend|fee|deposit|withdrawal)\s+([-\d,.\sUGXugx]+)(?:\s+(.*))?$/i

  const statementAssetMatch = text.match(/([A-Za-z]+(?:\s+[A-Za-z]+){0,6}\s+(?:Income\s+Fund|Policy|Fund))/i)
  const policyNumberMatch = text.match(/policy\s+number\s*:\s*([A-Za-z0-9-]+)/i)
  const looksLikeBonusCertificate = /bonus\s+certificate/i.test(text)
  let statementAsset = statementAssetMatch ? statementAssetMatch[1].trim() : 'Statement Asset'
  if (looksLikeBonusCertificate && !/sanlam|prudential|pru/i.test(statementAsset)) {
    statementAsset = policyNumberMatch
      ? `Prudential Policy ${policyNumberMatch[1]}`
      : 'Prudential Policy'
  }
  const asAtMatch = text.match(/as\s+at\s+(\d{4}-\d{2}-\d{2})/i)
  const asAtDate = asAtMatch?.[1] || null

  lines.forEach((line, i) => {
    const normalizedLine = line.replace(/\s+/g, ' ').trim()
    if (/summation|available balance|account statement|trans\s+no|date\s+description\s+amount/i.test(normalizedLine)) return
    const m = line.match(linePattern)
    if (m) {
      const date = parseStatementDate(m[1])
      const asset = m[2]
      const tx_type = normalizeType(m[3])
      const amount = parseAmount(m[4])
      const notes = (m[5] || 'Imported from PDF text').trim()
      if (!date || !asset || !tx_type || !Number.isFinite(amount)) {
        invalid.push({ line: i + 1, reason: 'Could not parse line' })
        return
      }
      valid.push({
        date,
        trans_no: null,
        asset,
        tx_type,
        amount,
        description: '',
        deposit_amount: null,
        interest_amount: null,
        withdrawal_amount: null,
        withholding_tax_amount: null,
        balance_amount: null,
        units: null,
        price: null,
        notes,
        source: 'statement_upload',
      })
      return
    }

    // Sanlam-style rows:
    // [TransNo] Feb 27, 2025 Rtgs 200,000.00 ... balance
    const monthDateMatch = normalizedLine.match(/\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/)
    if (monthDateMatch) {
      const date = parseStatementDate(monthDateMatch[1])
      if (!date) return

      const afterDate = normalizedLine.slice(monthDateMatch.index + monthDateMatch[1].length).trim()
      const amounts = afterDate.match(/[-+]?(?:UGX\s*)?\d[\d,]*(?:\.\d+)?/gi) || []
      if (!amounts.length) return
      const firstAmountRaw = amounts[0]
      const firstAmountIdx = afterDate.indexOf(firstAmountRaw)
      const description = (firstAmountIdx > 0 ? afterDate.slice(0, firstAmountIdx) : afterDate).trim()
      if (!description) return

      const amount = parseAmount(firstAmountRaw)
      if (!Number.isFinite(amount)) return

      const descLower = description.toLowerCase()
      let tx_type = 'deposit'
      if (/interest/.test(descLower)) tx_type = 'dividend'
      else if (/withdraw|redeem|cashout/.test(descLower)) tx_type = 'withdrawal'
      else if (/tax|withholding|charge|fee/.test(descLower)) tx_type = 'fee'
      else if (/rtgs|deposit|fund/.test(descLower)) tx_type = 'deposit'

      valid.push({
        date,
        trans_no: null,
        asset: statementAsset,
        tx_type,
        amount: (tx_type === 'withdrawal' || tx_type === 'fee') ? -Math.abs(amount) : Math.abs(amount),
        description,
        deposit_amount: tx_type === 'deposit' ? Math.abs(amount) : null,
        interest_amount: tx_type === 'dividend' ? Math.abs(amount) : null,
        withdrawal_amount: tx_type === 'withdrawal' ? Math.abs(amount) : null,
        withholding_tax_amount: tx_type === 'fee' ? Math.abs(amount) : null,
        balance_amount: Number.isFinite(parseAmount(amounts[amounts.length - 1])) ? parseAmount(amounts[amounts.length - 1]) : null,
        units: null,
        price: null,
        notes: normalizedLine,
        source: 'statement_upload',
      })
      return
    }

    // Prudential-like rows:
    // Apr 2026 Premium Payment 0
    // Mar 2026 Premium Payment 300,000
    const monthYearMatch = normalizedLine.match(/\b([A-Za-z]{3,9}\s+\d{4})\b/)
    if (monthYearMatch) {
      const date = parseStatementDate(monthYearMatch[1])
      if (!date) return
      const afterDate = normalizedLine.slice(monthYearMatch.index + monthYearMatch[1].length).trim()
      const amountMatches = afterDate.match(/[-+]?(?:UGX\s*)?\d[\d,]*(?:\.\d+)?/gi) || []
      if (!amountMatches.length) return
      const amountRaw = amountMatches[amountMatches.length - 1]
      const amount = parseAmount(amountRaw)
      if (!Number.isFinite(amount)) return

      const firstAmountIdx = afterDate.lastIndexOf(amountRaw)
      const description = (firstAmountIdx > 0 ? afterDate.slice(0, firstAmountIdx) : afterDate).trim() || 'Statement transaction'
      const descLower = description.toLowerCase()
      let tx_type = 'deposit'
      if (/interest|bonus|dividend/.test(descLower)) tx_type = 'dividend'
      else if (/withdraw|surrender|loan|charge|fee|tax/.test(descLower)) tx_type = 'withdrawal'
      else if (/premium|payment|deposit|contribution/.test(descLower)) tx_type = 'deposit'

      valid.push({
        date,
        trans_no: null,
        asset: statementAsset,
        tx_type,
        amount: tx_type === 'withdrawal' ? -Math.abs(amount) : Math.abs(amount),
        description,
        deposit_amount: tx_type === 'deposit' ? Math.abs(amount) : null,
        interest_amount: tx_type === 'dividend' ? Math.abs(amount) : null,
        withdrawal_amount: tx_type === 'withdrawal' ? Math.abs(amount) : null,
        withholding_tax_amount: null,
        balance_amount: null,
        units: null,
        price: null,
        notes: normalizedLine,
        source: 'statement_upload',
      })
      return
    }

    // Bonus certificate rows:
    // Year 1 25,680,204 3.00% 770,406 770,406 26,450,610
    // Mapped as a yearly dividend/bonus with closing balance.
    const bonusRow = normalizedLine.match(/^Year\s+(\d+)\s+([0-9,]+)\s+(\d+(?:\.\d+)?)%\s+([0-9,]+)\s+([0-9,]+)\s+([0-9,]+)$/i)
    if (bonusRow) {
      const yearIndex = Number(bonusRow[1])
      const bonusAmount = parseAmount(bonusRow[4])
      const closingAmount = parseAmount(bonusRow[5])
      const assuredPlusBonus = parseAmount(bonusRow[6])
      if (!Number.isFinite(bonusAmount)) return

      let date = asAtDate
      if (!date) {
        // Fallback date if "AS AT" not detected.
        date = `${new Date().getFullYear()}-12-31`
      } else {
        const d = new Date(asAtDate)
        d.setFullYear(d.getFullYear() - Math.max(0, (bonusRow[1] ? 0 : 0)))
        date = d.toISOString().slice(0, 10)
      }

      valid.push({
        date,
        trans_no: `BONUS-Y${yearIndex}`,
        asset: statementAsset,
        tx_type: 'dividend',
        amount: Math.abs(bonusAmount),
        description: `Year ${yearIndex} bonus certificate`,
        deposit_amount: null,
        interest_amount: Math.abs(bonusAmount),
        withdrawal_amount: null,
        withholding_tax_amount: null,
        balance_amount: Number.isFinite(assuredPlusBonus) ? assuredPlusBonus : (Number.isFinite(closingAmount) ? closingAmount : null),
        units: null,
        price: null,
        notes: normalizedLine,
        source: 'statement_upload',
      })
      return
    }

    // Fallback parser for common statement text rows:
    // <date> ... <asset> ... <amount> [optional transaction word]
    const dateMatch = normalizedLine.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/)
    if (!dateMatch) return
    const date = parseIsoOrDmy(dateMatch[1])
    if (!date) return

    const amountMatches = normalizedLine.match(/[-+]?(?:UGX\s*)?\d[\d,]*(?:\.\d+)?/gi) || []
    const amountRaw = amountMatches[amountMatches.length - 1]
    const amount = parseAmount(amountRaw)
    if (!Number.isFinite(amount)) return

    const tail = normalizedLine.slice(dateMatch.index + dateMatch[1].length).trim()
    const assetMatch = tail.match(/\b([A-Z]{2,8}(?:\.[A-Z]{1,3})?)\b/) || tail.match(/\b([A-Za-z][A-Za-z0-9._-]{1,20})\b/)
    if (!assetMatch) return
    const asset = assetMatch[1].toUpperCase()
    const tx_type = inferTypeFromContext(normalizedLine, amount)

    valid.push({
      date,
      trans_no: null,
      asset,
      tx_type,
      amount,
      description: '',
      deposit_amount: null,
      interest_amount: null,
      withdrawal_amount: null,
      withholding_tax_amount: null,
      balance_amount: null,
      units: null,
      price: null,
      notes: normalizedLine,
      source: 'statement_upload',
    })
  })

  if (!valid.length) {
    invalid.push({
      line: 0,
      reason:
        'Could not detect investment rows in PDF text. Ensure statement has tabular transaction lines or export CSV.',
    })
  }
  return { valid, invalid }
}

export function parseInvestmentStatementInput(text) {
  const csv = parseInvestmentStatementCsv(text)
  if (csv.valid.length > 0) return csv
  return parseInvestmentStatementText(text)
}

function extractPdfLines(content) {
  const rowsByY = new Map()
  const yBuckets = []

  for (const item of content.items || []) {
    if (!item?.str?.trim()) continue
    const x = Number(item.transform?.[4] || 0)
    const y = Number(item.transform?.[5] || 0)
    // Bucket nearby y values into same row.
    const bucket = Math.round(y * 2) / 2
    if (!rowsByY.has(bucket)) {
      rowsByY.set(bucket, [])
      yBuckets.push(bucket)
    }
    rowsByY.get(bucket).push({ x, str: String(item.str).trim() })
  }

  return yBuckets
    .sort((a, b) => b - a)
    .map((y) => rowsByY.get(y).sort((a, b) => a.x - b.x).map((part) => part.str).join(' '))
    .filter(Boolean)
}

export async function parseInvestmentStatementFile(file) {
  const name = String(file?.name || '').toLowerCase()
  const type = String(file?.type || '').toLowerCase()
  const isPdf = type.includes('pdf') || name.endsWith('.pdf')
  const isTextLike = type.includes('csv') || type.includes('text') || name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')

  if (isPdf) {
    const bytes = await file.arrayBuffer()
    const pdf = await getDocument({ data: bytes }).promise
    let fullText = ''
    for (let page = 1; page <= pdf.numPages; page += 1) {
      const p = await pdf.getPage(page)
      const content = await p.getTextContent()
      const lines = extractPdfLines(content)
      fullText += `${lines.join('\n')}\n`
    }
    return parseInvestmentStatementText(fullText)
  }

  if (isTextLike || !type) {
    const text = await file.text()
    return parseInvestmentStatementCsv(text)
  }

  return {
    valid: [],
    invalid: [{ line: 0, reason: 'Unsupported file type. Use PDF, CSV, TXT, or TSV.' }],
  }
}
