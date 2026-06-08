import { supabase } from './supabase'
import { parseExpenseCsv } from './csvExpenses'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

/** Turn a share/edit link into a CSV export URL. */
export function normalizeGoogleSheetUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return null

  if (raw.includes('output=csv') || raw.includes('format=csv') || raw.includes('tqx=out:csv')) return raw

  const pub = raw.match(/\/spreadsheets\/d\/e\/([^/]+)/)
  if (pub) return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv`

  const id = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (id) {
    const gid = raw.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
    return `https://docs.google.com/spreadsheets/d/${id[1]}/export?format=csv&gid=${gid}`
  }

  return raw
}

/** Try several public CSV export formats for the same sheet. */
function exportUrlCandidates(sheetInput) {
  const primary = normalizeGoogleSheetUrl(sheetInput)
  const candidates = []
  if (primary) candidates.push(primary)

  const id = String(sheetInput || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  const pubId = String(sheetInput || '').match(/\/spreadsheets\/d\/e\/([^/]+)/)?.[1]
  const gid = String(sheetInput || '').match(/[#&?]gid=(\d+)/)?.[1] ?? '0'

  if (pubId) {
    candidates.push(`https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv`)
  }
  if (id) {
    candidates.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`)
    candidates.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`)
  }

  return [...new Set(candidates)]
}

const looksLikeHtml = (text) => /<!DOCTYPE html|<html/i.test(text)

async function fetchCsvDirect(url) {
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}t=${Date.now()}`, { mode: 'cors' })
  const text = await res.text()
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status}).`)
  if (looksLikeHtml(text)) {
    throw new Error(
      'Sheet is not public. In Google Sheets use Share → Anyone with the link (Viewer), or File → Share → Publish to web.',
    )
  }
  if (!text.trim()) throw new Error('Sheet returned empty data.')
  return text
}

async function fetchCsvViaEdgeFunction(url) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or API key is missing in .env')
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/google-sheet-fetch`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ url }),
  })

  let payload
  try {
    payload = await res.json()
  } catch {
    throw new Error(
      `Sheet proxy returned an invalid response (${res.status}). Deploy it with: supabase functions deploy google-sheet-fetch --no-verify-jwt`,
    )
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Sheet proxy failed (${res.status}).`)
  }
  if (payload?.error) throw new Error(String(payload.error))
  if (!payload?.csv) throw new Error('Sheet proxy returned empty data.')
  return payload.csv
}

function edgeFunctionDeployHint() {
  return 'Deploy the sheet proxy: supabase link && supabase functions deploy google-sheet-fetch --no-verify-jwt'
}

async function fetchSheetCsv(sheetInput) {
  const candidates = exportUrlCandidates(sheetInput)
  let lastDirectError = null

  for (const url of candidates) {
    try {
      return await fetchCsvDirect(url)
    } catch (e) {
      lastDirectError = e
    }
  }

  for (const url of candidates) {
    try {
      return await fetchCsvViaEdgeFunction(url)
    } catch (e) {
      const msg = String(e?.message || '')
      if (/failed to send a request|fetch failed|network/i.test(msg)) {
        throw new Error(
          `Could not reach the sheet proxy Edge Function. ${edgeFunctionDeployHint()} Also ensure the sheet is shared publicly.`,
        )
      }
      lastDirectError = e
    }
  }

  throw lastDirectError || new Error(`Could not read the Google Sheet. ${edgeFunctionDeployHint()}`)
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
    const csv = await fetchSheetCsv(settings.sheet_sync_url)
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
