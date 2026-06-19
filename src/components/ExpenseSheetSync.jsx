import { useEffect, useState } from 'react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppSettings } from '../context/useAppSettings'
import { syncExpensesFromSheet } from '../lib/googleSheetSync'
import { downloadExpenseSheetTemplate, buildExpenseSheetTemplateCsv } from '../lib/sheetTemplate'
import { Btn, Card, SectionTitle } from './UI'

const INTERVALS = [
  { value: 30, label: 'Every 30 seconds' },
  { value: 60, label: 'Every minute' },
  { value: 120, label: 'Every 2 minutes' },
  { value: 300, label: 'Every 5 minutes' },
]

export default function ExpenseSheetSync() {
  const { settings, saveSettings, reload } = useAppSettings()
  const [draft, setDraft] = useState({
    sheet_sync_enabled: settings.sheet_sync_enabled,
    sheet_sync_url: settings.sheet_sync_url,
    sheet_sync_interval_seconds: settings.sheet_sync_interval_seconds,
  })
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDraft({
      sheet_sync_enabled: settings.sheet_sync_enabled,
      sheet_sync_url: settings.sheet_sync_url,
      sheet_sync_interval_seconds: settings.sheet_sync_interval_seconds,
    })
  }, [settings.sheet_sync_enabled, settings.sheet_sync_url, settings.sheet_sync_interval_seconds])

  const persist = async (nextDraft = draft) => {
    setSaving(true)
    const { error } = await saveSettings({ ...settings, ...nextDraft })
    setSaving(false)
    if (error) {
      setMessage(error.message || 'Could not save sheet settings.')
      return false
    }
    return true
  }

  const handleLiveSyncChange = async (enabled) => {
    const nextDraft = { ...draft, sheet_sync_enabled: enabled }
    setDraft(nextDraft)
    setMessage('')
    const saved = await persist(nextDraft)
    if (saved) {
      setMessage(enabled ? 'Live sync enabled.' : 'Live sync disabled.')
    } else {
      setDraft((d) => ({ ...d, sheet_sync_enabled: !enabled }))
    }
  }

  const handleSync = async () => {
    if (!draft.sheet_sync_url?.trim()) {
      setMessage('Paste your Google Sheet link first.')
      return
    }
    setSyncing(true)
    setMessage('')
    const merged = { ...settings, ...draft }
    const saved = await persist(draft)
    if (!saved) {
      setSyncing(false)
      return
    }
    const result = await syncExpensesFromSheet(merged)
    await reload()
    setSyncing(false)
    if (result.error && !result.count) setMessage(result.error)
    else if (result.error) setMessage(`Imported ${result.count} row(s). ${result.error}`)
    else setMessage(`Imported ${result.count} expense(s) from your sheet.`)
  }

  const lastSync = settings.sheet_sync_last_at
    ? format(parseISO(settings.sheet_sync_last_at), 'MMM d, yyyy h:mm a')
    : 'Never'

  const sheetEditUrl = draft.sheet_sync_url?.includes('docs.google.com')
    ? draft.sheet_sync_url.replace('/pub?', '/edit?').split('/export')[0]
    : draft.sheet_sync_url

  const templatePreview = buildExpenseSheetTemplateCsv({
    categories: (settings.budget || []).map((b) => b.category),
    paymentMethods: settings.payment_methods || [],
  })

  return (
    <Card style={{ marginBottom: '1.25rem' }}>
      <SectionTitle>Google Sheet</SectionTitle>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Use a <strong>dedicated tab</strong> with one flat expense table (no side summaries). Share the sheet as{' '}
        <strong>Anyone with the link can view</strong>, then paste the tab URL including <code>#gid=…</code> if needed.
      </p>
      <details open style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text)' }}>Recommended template</summary>
        <p style={{ marginTop: 8, lineHeight: 1.5 }}>
          Row 1 = headers exactly as below. <strong>category</strong> must match your Settings budget names. Dates:
          YYYY-MM-DD (best) or June 1, 2026. Amounts: numbers only (commas OK).
        </p>
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            background: 'var(--surface-solid)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'auto',
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {templatePreview}
        </pre>
        <Btn
          variant="ghost"
          onClick={() => downloadExpenseSheetTemplate(settings)}
          style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <Download size={14} /> Download CSV template
        </Btn>
        <p style={{ marginTop: 10, lineHeight: 1.5 }}>
          In Google Sheets: <strong>File → Import → Upload</strong> the CSV, or paste the table into a new tab named{' '}
          <em>Expenses</em>. Copy that tab&apos;s link for sync below.
        </p>
      </details>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(draft.sheet_sync_enabled)}
            disabled={saving}
            onChange={(e) => void handleLiveSyncChange(e.target.checked)}
          />
          Live sync from sheet
        </label>
        <input
          type="url"
          value={draft.sheet_sync_url}
          onChange={(e) => setDraft((d) => ({ ...d, sheet_sync_url: e.target.value }))}
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
        <select
          value={draft.sheet_sync_interval_seconds}
          onChange={(e) => setDraft((d) => ({ ...d, sheet_sync_interval_seconds: Number(e.target.value) }))}
        >
          {INTERVALS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
          Last sync: <strong style={{ color: 'var(--text)' }}>{lastSync}</strong>
          {settings.sheet_sync_last_count > 0 && <span> · {settings.sheet_sync_last_count} from sheet</span>}
          {settings.sheet_sync_last_error && (
            <div style={{ color: 'var(--amber)', marginTop: 4 }}>{settings.sheet_sync_last_error}</div>
          )}
        </div>
        {message && (
          <div style={{ fontSize: 13, color: message.includes('Imported') ? 'var(--green)' : 'var(--red)' }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Btn
            onClick={() => void handleSync()}
            disabled={syncing || saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} className={syncing ? 'spin-icon' : undefined} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Btn>
          <Btn variant="ghost" onClick={() => void persist()} disabled={saving || syncing}>
            {saving ? 'Saving…' : 'Save sheet link'}
          </Btn>
          {sheetEditUrl?.startsWith('http') && (
            <a href={sheetEditUrl} target="_blank" rel="noreferrer" className="expense-sheet-open">
              <ExternalLink size={15} /> Open sheet
            </a>
          )}
        </div>
      </div>
    </Card>
  )
}
