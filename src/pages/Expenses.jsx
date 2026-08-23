import { useRef, useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Trash2, Plus, X, FileSpreadsheet, Paperclip, Receipt, Camera } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { useExpenses } from '../lib/hooks'
import { parseExpensePasteMode } from '../lib/ledgerPaste'
import {
  attachReceiptToExpense,
  getReceiptSignedUrl,
  removeExpenseReceipt,
  uploadExpenseReceipt,
} from '../lib/expenseReceipts'
import { fmt, getCurrentMonth } from '../lib/constants'
import ExpenseSheetSync from '../components/ExpenseSheetSync'
import ScanReceiptModal from '../components/ScanReceiptModal'
import { Card, Btn, Spinner, EmptyState, MonthPicker } from '../components/UI'
import { format, parseISO } from 'date-fns'

function ImportPasteModal({ onClose, categories, paymentMethods, onImport }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [parseMode, setParseMode] = useState('auto')

  const pasteOpts = useMemo(() => ({ categories, paymentMethods }), [categories, paymentMethods])

  const { valid, invalid, warnings, format } = useMemo(() => {
    if (!text.trim()) return { valid: [], invalid: [], warnings: [], format: null }
    return parseExpensePasteMode(text, pasteOpts, parseMode)
  }, [text, pasteOpts, parseMode])

  const csvSample = `date,category,description,amount,payment_method\n${getCurrentMonth()}-15,${categories[0] || 'Groceries'},Coffee,12000,${paymentMethods[0] || 'Card'}`

  const handleImport = async () => {
    if (!valid.length) return
    setBusy(true)
    setErrMsg('')
    const rows = valid.map(({ date, category, description, amount, payment_method }) => ({
      date,
      category,
      description,
      amount,
      payment_method,
    }))
    const { error } = await onImport(rows)
    setBusy(false)
    if (error) setErrMsg(error.message ?? 'Import failed')
    else onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <Card className="modal-card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Import from paste</span>
          <button type="button" onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {[
            ['auto', 'Auto-detect'],
            ['ledger', 'Day book'],
            ['csv', 'CSV'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setParseMode(id)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border2)',
                background: parseMode === id ? 'var(--accent-dim)' : 'var(--surface2)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {format && (
          <p style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 10, fontWeight: 600 }}>
            Using: {format === 'ledger' ? 'Day book (tabs, e.g. March 1, 2026)' : 'Comma-separated'}
          </p>
        )}

        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          <strong>Day book:</strong> tab-separated columns{' '}
          <code style={{ fontSize: 11 }}>Day, Date, Income, From, Expense, for</code>. Sub-rows reuse the last date.
          Income-only lines are skipped; lines containing <strong>Totals</strong> are skipped. The <strong>for</strong>{' '}
          column is the expense note; categories are matched to Settings (name match, then heuristics for gym, fuel,
          subscriptions, groceries, etc.).
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          <strong>CSV:</strong> header with <strong>date</strong>, <strong>category</strong>, <strong>description</strong>,{' '}
          <strong>amount</strong>, <strong>payment</strong> — categories must match Settings exactly.
        </p>

        <details style={{ marginBottom: 12, fontSize: 12, color: 'var(--muted)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>CSV example</summary>
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
            {csvSample}
          </pre>
        </details>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste spreadsheet data here (Ctrl+V)…"
          rows={10}
          style={{ minHeight: 180, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: valid.length ? 'var(--green)' : 'var(--muted)' }}>
            {valid.length} ready to import
          </span>
          {invalid.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--amber)' }}>{invalid.length} row(s) with errors</span>
          )}
          {(warnings?.length ?? 0) > 0 && (
            <span style={{ fontSize: 13, color: 'var(--amber)' }}>
              {warnings.length} inferred categor{warnings.length === 1 ? 'y' : 'ies'} (see list)
            </span>
          )}
        </div>
        {warnings?.length > 0 && (
          <ul
            style={{
              marginTop: 8,
              maxHeight: 88,
              overflow: 'auto',
              fontSize: 11,
              color: 'var(--muted)',
              paddingLeft: '1.2rem',
            }}
          >
            {warnings.slice(0, 30).map((w) => (
              <li key={`${w.line}-${w.text}`}>
                Line {w.line}: {w.text}
              </li>
            ))}
            {warnings.length > 30 && <li>…and {warnings.length - 30} more</li>}
          </ul>
        )}
        {invalid.length > 0 && (
          <ul
            style={{
              marginTop: 10,
              maxHeight: 120,
              overflow: 'auto',
              fontSize: 12,
              color: 'var(--red)',
              paddingLeft: '1.2rem',
            }}
          >
            {invalid.slice(0, 40).map((x) => (
              <li key={`${x.line}-${x.reason}`}>
                Line {x.line}: {x.reason}
              </li>
            ))}
            {invalid.length > 40 && <li>…and {invalid.length - 40} more</li>}
          </ul>
        )}
        {errMsg && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{errMsg}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Btn onClick={() => void handleImport()} disabled={busy || !valid.length}>
            {busy ? 'Importing…' : `Import ${valid.length} row(s)`}
          </Btn>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
        </div>
      </Card>
    </div>
  )
}

function AddForm({ onAdd, onClose, categories, paymentMethods }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today,
    category: categories[0] ?? '',
    description: '',
    amount: '',
    payment_method: paymentMethods[0] ?? 'Card',
  })
  const [receiptFile, setReceiptFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.amount || isNaN(Number(form.amount))) { setError('Enter a valid amount'); return }
    if (!form.description.trim()) { setError('Add a description'); return }
    setSaving(true)
    setError('')
    const { data, error } = await onAdd({ ...form, amount: Number(form.amount) })
    if (error) { setError(error.message); setSaving(false); return }

    if (receiptFile && data?.id) {
      try {
        const { path, name } = await uploadExpenseReceipt(receiptFile, data.id)
        await attachReceiptToExpense(data.id, path, name)
      } catch (uploadErr) {
        setError(uploadErr.message || 'Expense saved but receipt upload failed.')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onClose()
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
          <span style={{ fontWeight: 700, fontSize: 16 }}>Log expense</span>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('Date', <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />)}
          {field('Category', (
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ))}
          {field('Description', <input placeholder="e.g. Grocery run — Witu" value={form.description} onChange={e => set('description', e.target.value)} />)}
          {field('Amount (UGX)', <input type="number" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} />)}
          {field('Payment method', (
            <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              {paymentMethods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ))}
          {field(
            'Receipt (optional)',
            <div className="receipt-upload">
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              {receiptFile && (
                <span className="receipt-upload-name">
                  <Paperclip size={14} /> {receiptFile.name}
                </span>
              )}
            </div>,
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <Btn onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Add expense'}</Btn>
        </div>
      </Card>
    </div>
  )
}

function ExpenseRow({ expense, catColor, onDelete, onReceiptUpdated, deleting }) {
  const fileRef = useRef(null)
  const [receiptBusy, setReceiptBusy] = useState(false)

  const openReceipt = async () => {
    if (!expense.receipt_path) return
    setReceiptBusy(true)
    try {
      const url = await getReceiptSignedUrl(expense.receipt_path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setReceiptBusy(false)
    }
  }

  const attachReceipt = async (file) => {
    if (!file) return
    setReceiptBusy(true)
    try {
      const { path, name } = await uploadExpenseReceipt(file, expense.id)
      const updated = await attachReceiptToExpense(expense.id, path, name)
      onReceiptUpdated(updated)
    } finally {
      setReceiptBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
        <div style={{ width: 8, height: 8, borderRadius: 2, background: catColor, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              fontSize: 13,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {expense.description}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span>{expense.category}</span>
            <span>·</span>
            <span>{expense.payment_method}</span>
            {expense.source === 'google_sheet' && (
              <>
                <span>·</span>
                <span>Sheet</span>
              </>
            )}
            {expense.receipt_name && (
              <>
                <span>·</span>
                <span>{expense.receipt_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>UGX {fmt(expense.amount)}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => void attachReceipt(e.target.files?.[0])}
        />
        {expense.receipt_path ? (
          <button
            type="button"
            onClick={() => void openReceipt()}
            disabled={receiptBusy}
            title="View receipt"
            className="expense-receipt-btn"
          >
            <Receipt size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={receiptBusy}
            title="Attach receipt"
            className="expense-receipt-btn"
          >
            <Paperclip size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(expense)}
          disabled={deleting === expense.id}
          style={{ background: 'none', color: 'var(--muted)', padding: 4, opacity: deleting === expense.id ? 0.4 : 1 }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function Expenses() {
  const { settings } = useAppSettings()
  const categories = settings.budget.map((b) => b.category)
  const paymentMethods = settings.payment_methods?.length ? settings.payment_methods : ['Card']
  const [month, setMonth] = useState(getCurrentMonth())
  const { expenses, loading, addExpense, addExpensesBulk, deleteExpense, refetch } = useExpenses(month)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [showCsv, setShowCsv] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (searchParams.get('scan') === '1') {
      setShowScan(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const grouped = expenses.reduce((acc, e) => {
    const d = e.date
    if (!acc[d]) acc[d] = []
    acc[d].push(e)
    return acc
  }, {})

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const handleDelete = async (expense) => {
    setDeleting(expense.id)
    if (expense.receipt_path) {
      try {
        await removeExpenseReceipt(expense)
      } catch {
        // expense row may still delete even if storage fails
      }
    }
    await deleteExpense(expense.id)
    setDeleting(null)
  }

  const catColor = (cat) => settings.budget.find((b) => b.category === cat)?.color || 'var(--muted)'

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">
            Total:{' '}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>UGX {fmt(total)}</span>
          </p>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <Btn onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Plus size={15} /> Add
          </Btn>
          <Btn variant="ghost" onClick={() => setShowScan(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Camera size={15} /> Scan
          </Btn>
          <Btn variant="ghost" onClick={() => setShowCsv(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <FileSpreadsheet size={15} /> CSV
          </Btn>
        </div>
      </header>

      <ExpenseSheetSync />

      {showCsv && (
        <ImportPasteModal
          categories={categories}
          paymentMethods={paymentMethods}
          onImport={(rows) => addExpensesBulk(rows)}
          onClose={() => setShowCsv(false)}
        />
      )}

      {showScan && (
        <ScanReceiptModal
          categories={categories}
          paymentMethods={paymentMethods}
          onAdd={addExpense}
          onClose={() => {
            setShowScan(false)
            void refetch()
          }}
        />
      )}

      {showForm && (
        <AddForm
          onAdd={addExpense}
          onClose={() => setShowForm(false)}
          categories={categories}
          paymentMethods={paymentMethods}
        />
      )}

      {loading ? <Spinner /> : expenses.length === 0 ? (
        <EmptyState icon="🧾" message="No expenses logged yet. Tap Add to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).sort(([a],[b]) => b.localeCompare(a)).map(([date, items]) => (
            <div key={date}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                {format(parseISO(date), 'EEEE, MMM d')}
                <span style={{ marginLeft: 8, color: 'var(--text)', fontWeight: 400 }}>
                  UGX {fmt(items.reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {items.map((e, i) => (
                  <div key={e.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <ExpenseRow
                      expense={e}
                      catColor={catColor(e.category)}
                      deleting={deleting}
                      onDelete={handleDelete}
                      onReceiptUpdated={() => void refetch()}
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
