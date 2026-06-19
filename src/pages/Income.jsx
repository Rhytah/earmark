import { useMemo, useState } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppSettings } from '../context/useAppSettings'
import { useIncome } from '../lib/hooks'
import { fmt, getCurrentMonth } from '../lib/constants'
import { incomeSourceOptions, monthIncomeView } from '../lib/income'
import { Card, Btn, Spinner, EmptyState, MonthPicker } from '../components/UI'

const SOURCE_COLORS = {
  Salary: '#3dbe7a',
  Other: 'var(--muted)',
}

function sourceColor(source, settings) {
  if (SOURCE_COLORS[source]) return SOURCE_COLORS[source]
  const extra = settings.extra_income?.find((r) => r.label === source)
  if (extra) return 'var(--accent)'
  return 'var(--teal)'
}

function AddIncomeForm({ onAdd, onClose, sources, paymentMethods }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today,
    source: sources[0] ?? 'Salary',
    customSource: '',
    description: '',
    amount: '',
    payment_method: paymentMethods[0] ?? 'Bank transfer',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      setError('Enter a valid amount')
      return
    }
    const source =
      form.source === 'Other' ? form.customSource.trim() || 'Other' : form.source
    if (!source) {
      setError('Choose or enter an income source')
      return
    }
    setSaving(true)
    setError('')
    const { error: saveError } = await onAdd({
      date: form.date,
      source,
      description: form.description.trim(),
      amount,
      payment_method: form.payment_method,
    })
    setSaving(false)
    if (saveError) setError(saveError.message ?? 'Could not save')
    else onClose()
  }

  const field = (label, children) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )

  return (
    <div className="modal-backdrop" role="presentation">
      <Card className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Log income</span>
          <button type="button" onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('Date received', <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />)}
          {field(
            'Source',
            <select value={form.source} onChange={(e) => set('source', e.target.value)}>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>,
          )}
          {form.source === 'Other' &&
            field('Source name', (
              <input
                placeholder="Bonus, gift, refund…"
                value={form.customSource}
                onChange={(e) => set('customSource', e.target.value)}
              />
            ))}
          {field(
            'Note (optional)',
            <input
              placeholder="e.g. March salary, client invoice #12"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />,
          )}
          {field(
            'Amount (UGX)',
            <input type="number" min={0} placeholder="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} />,
          )}
          {field(
            'Received via',
            <select value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
              {paymentMethods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>,
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <Btn onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Saving…' : 'Add income'}
          </Btn>
        </div>
      </Card>
    </div>
  )
}

function IncomeRow({ entry, color, onDelete, deleting }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>
            {entry.description?.trim() || entry.source}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
            {entry.source}
            {entry.description?.trim() ? ` · ${entry.payment_method}` : ` · ${entry.payment_method}`}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>+ UGX {fmt(entry.amount)}</span>
        <button
          type="button"
          onClick={() => onDelete(entry)}
          disabled={deleting === entry.id}
          style={{ background: 'none', color: 'var(--muted)', padding: 4, opacity: deleting === entry.id ? 0.4 : 1 }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function Income() {
  const { settings } = useAppSettings()
  const paymentMethods = settings.payment_methods?.length ? settings.payment_methods : ['Bank transfer']
  const sources = useMemo(() => incomeSourceOptions(settings), [settings])
  const [month, setMonth] = useState(getCurrentMonth())
  const { entries, loading, addIncome, deleteIncome } = useIncome(month)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const incomeView = useMemo(() => monthIncomeView(settings, entries), [settings, entries])

  const grouped = entries.reduce((acc, row) => {
    if (!acc[row.date]) acc[row.date] = []
    acc[row.date].push(row)
    return acc
  }, {})

  const handleDelete = async (entry) => {
    setDeleting(entry.id)
    await deleteIncome(entry.id)
    setDeleting(null)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Income</h1>
          <p className="page-subtitle">
            Received:{' '}
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>UGX {fmt(incomeView.logged)}</span>
            {incomeView.total > 0 && incomeView.logged !== incomeView.total && (
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                {' '}
                · expected UGX {fmt(incomeView.total)} from Settings
              </span>
            )}
          </p>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <Btn onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Plus size={15} /> Add
          </Btn>
        </div>
      </header>

      {incomeView.total > 0 && (
        <Card style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            Sources from Settings: salary UGX {fmt(incomeView.salary)}
            {incomeView.extraTotal > 0 && ` + extra UGX ${fmt(incomeView.extraTotal)}`}. Log each inflow here when
            it arrives.
          </p>
        </Card>
      )}

      {showForm && (
        <AddIncomeForm
          onAdd={addIncome}
          onClose={() => setShowForm(false)}
          sources={sources}
          paymentMethods={paymentMethods}
        />
      )}

      {loading ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState icon="💵" message="No income logged yet. Tap Add when money comes in." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items]) => (
              <div key={date}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  {format(parseISO(date), 'EEEE, MMM d')}
                  <span style={{ marginLeft: 8, color: 'var(--green)', fontWeight: 600 }}>
                    + UGX {fmt(items.reduce((s, e) => s + Number(e.amount), 0))}
                  </span>
                </div>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {items.map((entry, i) => (
                    <div key={entry.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <IncomeRow
                        entry={entry}
                        color={sourceColor(entry.source, settings)}
                        deleting={deleting}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </Card>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
