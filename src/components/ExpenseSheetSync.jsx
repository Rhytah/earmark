import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppSettings } from '../context/useAppSettings'
import { syncExpensesFromSheet } from '../lib/googleSheetSync'
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

  return (
    <Card style={{ marginBottom: '1.25rem' }}>
      <SectionTitle>Google Sheet</SectionTitle>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Link a Google Sheet or Excel file saved in Google Drive. Edits sync into expenses automatically when live sync is
        on. Share the sheet as <strong>Anyone with the link can view</strong>.
      </p>
      <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginBottom: 12 }}>
        date,category,description,amount,payment_method
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(draft.sheet_sync_enabled)}
            onChange={(e) => setDraft((d) => ({ ...d, sheet_sync_enabled: e.target.checked }))}
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
