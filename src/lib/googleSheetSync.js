import { supabase } from './supabase'
import { parseExpenseCsv } from './csvExpenses'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const googleApiKeyRaw = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY?.trim()
const googleApiKeyError = (() => {
  if (!googleApiKeyRaw) return null
  if (googleApiKeyRaw.includes('.apps.googleusercontent.com')) {
    return 'VITE_GOOGLE_SHEETS_API_KEY is an OAuth Client ID, not an API key. In Google Cloud Console → Credentials, create an API key (starts with AIza…).'
  }
  if (!googleApiKeyRaw.startsWith('AIza')) {
    return 'VITE_GOOGLE_SHEETS_API_KEY does not look like a Google API key (expected AIza…).'
  }
  return null
})()
const googleApiKey = googleApiKeyError ? null : googleApiKeyRaw

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

function parseSpreadsheetId(sheetInput) {
  return (
    String(sheetInput || '').match(/\/spreadsheets\/d\/e\/([^/]+)/)?.[1] ||
    String(sheetInput || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ||
    null
  )
}

function parseGid(sheetInput) {
  return String(sheetInput || '').match(/[#&?]gid=(\d+)/)?.[1] ?? null
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

function matrixToCsv(rows) {
  return rows
    .map((row) =>
      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','),
    )
    .join('\n')
}

/** Google Sheets API v4 — works from the browser when VITE_GOOGLE_SHEETS_API_KEY is set. */
async function fetchCsvViaGoogleApi(sheetInput) {
  if (!googleApiKey) return null

  const spreadsheetId = parseSpreadsheetId(sheetInput)
  if (!spreadsheetId) throw new Error('Could not parse spreadsheet ID from the URL.')

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties&key=${googleApiKey}`,
  )
  const meta = await metaRes.json()
  if (!metaRes.ok) {
    throw new Error(meta?.error?.message || 'Google Sheets API metadata request failed.')
  }

  const gid = parseGid(sheetInput)
  let sheetTitle = meta.sheets?.[0]?.properties?.title || 'Sheet1'
  if (gid && meta.sheets?.length) {
    const match = meta.sheets.find((s) => String(s.properties.sheetId) === gid)
    if (match?.properties?.title) sheetTitle = match.properties.title
  }

  const range = encodeURIComponent(sheetTitle)
  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${googleApiKey}`,
  )
  const values = await valuesRes.json()
  if (!valuesRes.ok) {
    throw new Error(values?.error?.message || 'Google Sheets API values request failed.')
  }

  const rows = values.values || []
  if (!rows.length) throw new Error('Google Sheet has no rows.')
  return matrixToCsv(rows)
}

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
    throw new Error('Missing VITE_SUPABASE_URL or API key in .env — rebuild the app after adding them.')
  }

  const { data: invokeData, error: invokeError } = await supabase.functions.invoke('google-sheet-fetch', {
    body: { url },
  })

  if (!invokeError && invokeData?.csv) return invokeData.csv
  if (invokeData?.error) throw new Error(String(invokeData.error))

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token || supabaseKey
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/google-sheet-fetch`

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
    })
  } catch (e) {
    const hint = invokeError?.message ? ` (${invokeError.message})` : ''
    throw new Error(
      `Network error reaching sheet proxy${hint}. Check ad blockers, confirm .env has VITE_SUPABASE_URL, and rebuild if deploying.`,
    )
  }

  let payload
  try {
    payload = await res.json()
  } catch {
    throw new Error(`Sheet proxy returned an invalid response (HTTP ${res.status}).`)
  }

  if (res.status === 404 || payload?.code === 'NOT_FOUND') {
    throw new Error(
      'Sheet proxy not deployed. Run: supabase functions deploy google-sheet-fetch --no-verify-jwt',
    )
  }
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || `Sheet proxy failed (HTTP ${res.status}).`)
  }
  if (payload?.error) throw new Error(String(payload.error))
  if (!payload?.csv) throw new Error('Sheet proxy returned empty data.')
  return payload.csv
}

async function fetchSheetCsv(sheetInput) {
  const errors = []
  if (googleApiKeyError) errors.push(googleApiKeyError)

  if (googleApiKey) {
    try {
      const csv = await fetchCsvViaGoogleApi(sheetInput)
      if (csv) return csv
    } catch (e) {
      errors.push(`Google API: ${e.message}`)
    }
  }

  for (const url of exportUrlCandidates(sheetInput)) {
    try {
      return await fetchCsvDirect(url)
    } catch (e) {
      errors.push(`Direct: ${e.message}`)
    }
  }

  for (const url of exportUrlCandidates(sheetInput)) {
    try {
      return await fetchCsvViaEdgeFunction(url)
    } catch (e) {
      errors.push(`Proxy: ${e.message}`)
    }
  }

  const detail = errors.length ? errors[errors.length - 1] : 'Unknown error'
  throw new Error(
    `${detail} Tip: share the sheet publicly, or add VITE_GOOGLE_SHEETS_API_KEY to .env for direct sync.`,
  )
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
