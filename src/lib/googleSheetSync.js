import { supabase } from './supabase'
import { parseExpenseCsv } from './csvExpenses'

/** Turn a share/edit link into a CSV export URL. */
export function normalizeGoogleSheetUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return null

  if (raw.includes('output=csv') || raw.includes('format=csv')) return raw

  const pub = raw.match(/\/spreadsheets\/d\/e\/([^/]+)/)
  if (pub) return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv`

  const id = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (id) {
    const gid = raw.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
    return `https://docs.google.com/spreadsheets/d/${id[1]}/export?format=csv&gid=${gid}`
  }

  return raw
}

async function fetchSheetCsv(exportUrl) {
  const sep = exportUrl.includes('?') ? '&' : '?'
  const url = `${exportUrl}${sep}t=${Date.now()}`

  const looksLikeHtml = (text) => /<!DOCTYPE html|<html/i.test(text)

  try {
    const res = await fetch(url)
    const text = await res.text()
    if (res.ok && !looksLikeHtml(text)) return text
  } catch {
    // fall through to edge function
  }

  const { data, error } = await supabase.functions.invoke('google-sheet-fetch', { body: { url } })
  if (error) throw new Error(error.message || 'Could not fetch sheet.')
  if (data?.error) throw new Error(String(data.error))
  if (!data?.csv) throw new Error('Empty response from sheet fetch.')
  return data.csv
}

function rowKey(lineNum, row) {
  const payload = [lineNum, row.date, row.category, row.description, row.amount, row.payment_method].join('|')
  return `sheet:${payload}`
}

async function updateSyncStatus({ count, error }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const patch = {
    sheet_sync_last_at: new Date().toISOString(),
    sheet_sync_last_count: count ?? 0,
    sheet_sync_last_error: error ? String(error).slice(0, 500) : null,
  }
  const { error: upErr } = await supabase.from('app_settings').update(patch).eq('user_id', user.id)
  if (upErr) console.error('[sheet sync status]', upErr.message)
}

/**
 * Replace sheet-sourced expenses with rows from the linked Google Sheet.
 * @returns {{ count: number, invalid: number, error?: string }}
 */
export async function syncExpensesFromSheet(settings) {
  const exportUrl = normalizeGoogleSheetUrl(settings.sheet_sync_url)
  if (!exportUrl) {
    const err = 'Add a valid Google Sheets link.'
    await updateSyncStatus({ count: 0, error: err })
    return { count: 0, invalid: 0, error: err }
  }

  const categories = (settings.budget || []).map((b) => b.category)
  const paymentMethods = settings.payment_methods || []

  try {
    const csv = await fetchSheetCsv(exportUrl)
    const { valid, invalid } = parseExpenseCsv(csv, {
      categories,
      paymentMethods,
      allowUnknownCategories: true,
    })

    const { error: delErr } = await supabase.from('expenses').delete().eq('source', 'google_sheet')
    if (delErr) throw delErr

    if (valid.length) {
      const rows = valid.map((row, i) => ({
        ...row,
        source: 'google_sheet',
        sheet_row_key: rowKey(i + 2, row),
      }))
      const { error: insErr } = await supabase.from('expenses').insert(rows)
      if (insErr) throw insErr
    }

    const statusError = invalid.length ? `${invalid.length} row(s) skipped (check dates, amounts, or columns).` : null
    await updateSyncStatus({ count: valid.length, error: statusError })
    window.dispatchEvent(new CustomEvent('earmark:expenses-synced'))

    return { count: valid.length, invalid: invalid.length, error: statusError }
  } catch (e) {
    const msg = e?.message || 'Sheet sync failed.'
    await updateSyncStatus({ count: 0, error: msg })
    return { count: 0, invalid: 0, error: msg }
  }
}
