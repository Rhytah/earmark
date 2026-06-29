import { supabase } from './supabase'
import { edgeFunctionErrorMessage } from './edgeFunctionErrors'
import { parseExpenseDate } from './csvExpenses'

async function fileToBase64(file) {
  const buf = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

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

/** Normalize AI output into an expense form shape. */
export function normalizeScannedExpense(raw, { categories, paymentMethods }) {
  const expense = raw?.expense ?? raw ?? {}
  const today = new Date().toISOString().slice(0, 10)
  const date = parseExpenseDate(expense.date) || today
  const amountRaw = String(expense.amount ?? '').replace(/,/g, '')
  const amount = Number(amountRaw.replace(/[^\d.-]/g, ''))
  const description = String(expense.description || expense.merchant || '').trim() || 'Receipt purchase'
  const category = matchFromList(expense.category, categories, categories[0] || '')
  const payment_method = matchFromList(expense.payment_method, paymentMethods, paymentMethods[0] || 'Card')

  return {
    date,
    amount: Number.isFinite(amount) && amount > 0 ? amount : '',
    description,
    category,
    payment_method,
    confidence: raw?.confidence || 'medium',
    notes: raw?.notes || '',
  }
}

export async function scanReceipt(file, { categories, paymentMethods }) {
  if (!file) throw new Error('Choose a receipt photo or PDF first.')

  const payload = {
    name: file.name,
    mimeType: file.type || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
    contentBase64: await fileToBase64(file),
  }

  const { data, error } = await supabase.functions.invoke('receipt-scanner', {
    body: { file: payload, categories, paymentMethods },
  })

  if (error) {
    throw new Error(
      await edgeFunctionErrorMessage(
        error,
        data,
        'Receipt scanner unavailable. Set a valid Anthropic key: supabase secrets set ANTHROPIC_API_KEY=your_key',
      ),
    )
  }
  if (data?.error) {
    const extra = data.details ? ` ${String(data.details).slice(0, 200)}` : ''
    throw new Error(String(data.error) + extra)
  }

  return normalizeScannedExpense(data, { categories, paymentMethods })
}
