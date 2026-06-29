import { useMemo, useState } from 'react'
import {
  Upload,
  Trash2,
  Sparkles,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'
import { useInsurancePolicies, useInvestments } from '../lib/hooks'
import {
  parseInvestmentStatementFile,
  parseInvestmentStatementInput,
} from '../lib/investmentStatements'
import { analyzeInsuranceDocuments, savePolicyAnalysis, uploadInsuranceDocs } from '../lib/insuranceService'
import {
  formatActivityDate,
  identifyInvestmentProvider,
  monthInvestmentsView,
  providerFilterOptions,
  TX_COLORS,
  TX_LABELS,
  TX_TYPES,
  txDisplayAmount,
} from '../lib/investmentsView'
import { fmt, getCurrentMonth } from '../lib/constants'
import { Badge, Btn, Card, EmptyState, MetricCard, MonthPicker, SectionTitle, Spinner } from '../components/UI'

function UploadModal({ onClose, onImport }) {
  const [text, setText] = useState('')
  const [fileParsedRows, setFileParsedRows] = useState(null)
  const [fileParsedInvalid, setFileParsedInvalid] = useState([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const [showPaste, setShowPaste] = useState(false)

  const { valid, invalid } = useMemo(() => {
    if (!text.trim()) return { valid: [], invalid: [] }
    return parseInvestmentStatementInput(text)
  }, [text])

  const effectiveValid = fileParsedRows ?? valid
  const effectiveInvalid = fileParsedRows ? fileParsedInvalid : invalid

  const handleImport = async () => {
    if (!effectiveValid.length) return
    setBusy(true)
    setErr('')
    const { error } = await onImport(effectiveValid)
    setBusy(false)
    if (error) setErr(error.message ?? 'Could not import statement')
    else onClose()
  }

  const handleFile = async (file) => {
    if (!file) return
    setFileBusy(true)
    setErr('')
    setFileName(file.name || 'statement')
    try {
      const { valid: fileValid, invalid: fileInvalid } = await parseInvestmentStatementFile(file)
      if (!fileValid.length) {
        setErr(fileInvalid[0]?.reason || 'Could not parse this file.')
        setFileParsedRows([])
        setFileParsedInvalid(fileInvalid)
      } else {
        setFileParsedRows(fileValid)
        setFileParsedInvalid(fileInvalid)
      }
    } catch (e) {
      setErr(e?.message || 'Could not read this file.')
    } finally {
      setFileBusy(false)
    }
  }

  const onDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) await handleFile(file)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <Card className="modal-card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Import statement</span>
          <button type="button" onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
          Drop a PDF or CSV from Sanlam, Prudential, or your broker. We extract deposits, interest, withdrawals, and
          balances automatically.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void onDrop(e)}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border2)'}`,
            borderRadius: 'var(--radius)',
            padding: '1.75rem 1rem',
            marginBottom: 12,
            background: dragOver ? 'var(--accent-dim)' : 'var(--surface2)',
            textAlign: 'center',
          }}
        >
          <Upload size={28} style={{ color: 'var(--accent)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {fileBusy ? 'Reading file…' : 'Drag & drop your statement'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            {fileName ? `Selected: ${fileName}` : 'PDF, CSV, TXT, or TSV'}
          </div>
          <label style={{ display: 'inline-flex' }}>
            <input
              type="file"
              accept=".pdf,.csv,.txt,.tsv,text/csv,text/plain,application/pdf"
              onChange={(e) => void handleFile(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <span className="ui-btn" style={{ cursor: 'pointer', fontSize: 13 }}>
              Choose file
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => setShowPaste((v) => !v)}
          style={{
            background: 'none',
            color: 'var(--muted)',
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 0',
            marginBottom: showPaste ? 8 : 0,
          }}
        >
          {showPaste ? 'Hide' : 'Advanced: paste CSV instead'}
        </button>

        {showPaste && (
          <textarea
            rows={8}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileParsedRows(null)
              setFileParsedInvalid([])
            }}
            placeholder="date, asset, type, amount, notes…"
            style={{ minHeight: 140, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 11, width: '100%' }}
          />
        )}

        {(effectiveValid.length > 0 || effectiveInvalid.length > 0) && (
          <div style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 13 }}>
            <span style={{ color: effectiveValid.length ? 'var(--green)' : 'var(--muted)' }}>
              {effectiveValid.length} transaction{effectiveValid.length === 1 ? '' : 's'} ready
            </span>
            {!!effectiveInvalid.length && (
              <span style={{ color: 'var(--amber)' }}>{effectiveInvalid.length} skipped</span>
            )}
          </div>
        )}

        {!!effectiveInvalid.length && (
          <ul style={{ marginTop: 8, maxHeight: 88, overflow: 'auto', color: 'var(--red)', fontSize: 12, paddingLeft: '1.1rem' }}>
            {effectiveInvalid.slice(0, 8).map((x) => (
              <li key={`${x.line}-${x.reason}`}>Line {x.line}: {x.reason}</li>
            ))}
          </ul>
        )}

        {err && <div style={{ color: 'var(--red)', marginTop: 8, fontSize: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Btn onClick={() => void handleImport()} disabled={busy || fileBusy || !effectiveValid.length}>
            {busy ? 'Importing…' : `Import ${effectiveValid.length || ''}`}
          </Btn>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
        </div>
      </Card>
    </div>
  )
}

function AddTransactionModal({ onClose, onAdd }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today,
    asset: '',
    tx_type: 'deposit',
    amount: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    const amount = Number(form.amount)
    if (!form.asset.trim()) {
      setError('Enter an investment or policy name')
      return
    }
    if (!amount || amount <= 0) {
      setError('Enter a valid amount')
      return
    }
    setSaving(true)
    setError('')
    const signed = ['buy', 'withdrawal', 'fee'].includes(form.tx_type) ? -Math.abs(amount) : Math.abs(amount)
    const { error: saveError } = await onAdd([
      {
        date: form.date,
        asset: form.asset.trim(),
        tx_type: form.tx_type,
        amount: signed,
        notes: form.notes.trim() || 'Manual entry',
        source: 'manual',
      },
    ])
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
      <Card className="modal-card" style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Log investment activity</span>
          <button type="button" onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('Date', <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />)}
          {field(
            'Investment / policy',
            <input
              placeholder="e.g. Sanlam Income Fund, Prudential Policy"
              value={form.asset}
              onChange={(e) => set('asset', e.target.value)}
            />,
          )}
          {field(
            'What happened?',
            <select value={form.tx_type} onChange={(e) => set('tx_type', e.target.value)}>
              {TX_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>,
          )}
          {field(
            'Amount (UGX)',
            <input type="number" min={0} placeholder="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} />,
          )}
          {field(
            'Note (optional)',
            <input placeholder="e.g. Monthly premium, bonus certificate" value={form.notes} onChange={(e) => set('notes', e.target.value)} />,
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <Btn onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </Card>
    </div>
  )
}

function InsuranceAnalyzerModal({ onClose, onSaved }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleAnalyze = async () => {
    if (!files.length) return
    setBusy(true)
    setError('')
    try {
      const data = await analyzeInsuranceDocuments(files)
      setResult(data)
    } catch (e) {
      setError(e?.message || 'AI analysis failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    if (!result?.policies?.length) return
    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadInsuranceDocs(files)
      for (const policy of result.policies) {
        await savePolicyAnalysis(policy, uploaded)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e?.message || 'Could not save policies')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <Card className="modal-card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Analyze insurance documents</span>
          <button type="button" onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
          Upload policy statements or bonus certificates. AI extracts sum assured, bonuses, and policy numbers.
        </p>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>{files.length} file(s) selected</div>
        {result?.policies?.length > 0 && (
          <div
            style={{
              marginTop: 10,
              maxHeight: 180,
              overflow: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 8,
            }}
          >
            {result.policies.map((p, i) => (
              <div key={`${p.policyNumber || p.insurer}-${i}`} style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {p.insurer || 'Policy'} {p.policyNumber ? `(${p.policyNumber})` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Sum assured: UGX {fmt(Number(p.sumAssured || 0))} · Bonuses: {(p.bonuses || []).length}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <Btn onClick={() => void handleAnalyze()} disabled={busy || !files.length}>
            {busy ? 'Working…' : 'Analyze'}
          </Btn>
          <Btn variant="success" onClick={() => void handleSave()} disabled={busy || !(result?.policies?.length > 0)}>
            Save policies
          </Btn>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
        </div>
      </Card>
    </div>
  )
}

function ActivityRow({ tx, deleting, onDelete }) {
  const [open, setOpen] = useState(false)
  const signed = txDisplayAmount(tx)
  const color = signed >= 0 ? 'var(--green)' : 'var(--red)'
  const prefix = signed >= 0 ? '+' : '−'
  const hasDetails =
    tx.deposit_amount != null ||
    tx.interest_amount != null ||
    tx.withdrawal_amount != null ||
    tx.withholding_tax_amount != null ||
    tx.balance_amount != null ||
    tx.trans_no

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: `${TX_COLORS[tx.tx_type] || 'var(--accent)'}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {signed >= 0 ? (
            <ArrowDownLeft size={15} style={{ color: TX_COLORS[tx.tx_type] || 'var(--green)' }} />
          ) : (
            <ArrowUpRight size={15} style={{ color: TX_COLORS[tx.tx_type] || 'var(--red)' }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{tx.description?.trim() || tx.asset}</span>
            <Badge color={TX_COLORS[tx.tx_type] || 'var(--muted)'}>{TX_LABELS[tx.tx_type] || tx.tx_type}</Badge>
            {tx.source === 'statement_upload' && (
              <Badge color="var(--accent)" bg="var(--accent-dim)">
                Statement
              </Badge>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {tx.asset}
            {tx.notes && tx.notes !== tx.description ? ` · ${tx.notes}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color }}>
            {prefix} UGX {fmt(Math.abs(signed))}
          </span>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{ background: 'none', color: 'var(--muted)', padding: 4 }}
              aria-label={open ? 'Hide details' : 'Show details'}
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(tx.id)}
            disabled={deleting === tx.id}
            style={{ background: 'none', color: 'var(--muted)', padding: 4, opacity: deleting === tx.id ? 0.4 : 1 }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {open && hasDetails && (
        <div
          style={{
            marginTop: 10,
            marginLeft: 42,
            padding: '8px 10px',
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
            color: 'var(--muted)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 8,
          }}
        >
          {tx.trans_no && <div>Ref: {tx.trans_no}</div>}
          {tx.deposit_amount != null && <div>Deposit: UGX {fmt(tx.deposit_amount)}</div>}
          {tx.interest_amount != null && <div>Interest: UGX {fmt(tx.interest_amount)}</div>}
          {tx.withdrawal_amount != null && <div>Withdrawal: UGX {fmt(tx.withdrawal_amount)}</div>}
          {tx.withholding_tax_amount != null && <div>Tax: UGX {fmt(tx.withholding_tax_amount)}</div>}
          {tx.balance_amount != null && <div>Balance: UGX {fmt(tx.balance_amount)}</div>}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.5rem 0.9rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border2)',
        background: active ? 'var(--accent-dim)' : 'var(--surface2)',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function Investments() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [section, setSection] = useState('overview')
  const [providerFilter, setProviderFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showInsuranceAnalyzer, setShowInsuranceAnalyzer] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const { transactions, loading, addTransactionsBulk, deleteTransaction } = useInvestments(month)
  const { policies: insurancePolicies, loading: insuranceLoading, refetch: refetchInsurance } = useInsurancePolicies()

  const view = useMemo(() => monthInvestmentsView(transactions), [transactions])
  const filterOptions = useMemo(() => providerFilterOptions(transactions), [transactions])

  const activityTransactions = useMemo(() => {
    if (providerFilter === 'all') return transactions
    return transactions.filter(
      (t) => identifyInvestmentProvider(t.asset).toLowerCase() === providerFilter,
    )
  }, [transactions, providerFilter])

  const insuranceSummary = useMemo(() => {
    const totalSumAssured = insurancePolicies.reduce((s, p) => s + Number(p.sum_assured || 0), 0)
    const totalBonuses = insurancePolicies.reduce(
      (s, p) => s + (p.insurance_bonuses || []).reduce((b, x) => b + Number(x.amount || 0), 0),
      0,
    )
    return { totalSumAssured, totalBonuses, totalProjected: totalSumAssured + totalBonuses }
  }, [insurancePolicies])

  const handleDelete = async (id) => {
    setDeleting(id)
    await deleteTransaction(id)
    setDeleting(null)
  }

  const groupedActivity = useMemo(() => {
    const grouped = {}
    for (const t of activityTransactions) {
      const key = String(t.date)
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(t)
    }
    return grouped
  }, [activityTransactions])

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
  }, [month])

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Investments</h1>
          <p className="page-subtitle">
            {monthLabel}:{' '}
            <span style={{ color: view.netFlow >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {view.netFlow >= 0 ? '+' : '−'} UGX {fmt(Math.abs(view.netFlow))} net
            </span>
            {view.closingBalance != null && (
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                {' '}
                · balance UGX {fmt(view.closingBalance)}
              </span>
            )}
          </p>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <Btn variant="ghost" onClick={() => setShowUpload(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={15} /> Import
          </Btn>
          <Btn onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Plus size={15} /> Add
          </Btn>
        </div>
      </header>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TabButton active={section === 'overview'} onClick={() => setSection('overview')}>
            Overview
          </TabButton>
          <TabButton active={section === 'activity'} onClick={() => setSection('activity')}>
            Activity
          </TabButton>
          <TabButton active={section === 'insurance'} onClick={() => setSection('insurance')}>
            Insurance
          </TabButton>
        </div>
      </Card>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onImport={addTransactionsBulk} />}
      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onAdd={addTransactionsBulk} />}
      {showInsuranceAnalyzer && (
        <InsuranceAnalyzerModal onClose={() => setShowInsuranceAnalyzer(false)} onSaved={() => void refetchInsurance()} />
      )}

      {loading ? (
        <Spinner />
      ) : section === 'overview' ? (
        <>
          <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
            <MetricCard
              label="Latest balance"
              value={view.closingBalance ?? 0}
              sub={view.closingBalance != null ? 'From most recent statement' : 'Upload a statement to see balance'}
              color="var(--accent)"
            />
            <MetricCard label="Money in" value={view.moneyIn} sub="Deposits, interest & sales" color="var(--green)" />
            <MetricCard label="Money out" value={view.moneyOut} sub="Purchases, withdrawals & fees" color="var(--amber)" />
            <MetricCard label="Contributions" value={view.contributions} sub="New deposits only" color="var(--teal)" />
          </div>

          {view.providers.length === 0 ? (
            <EmptyState
              icon="📈"
              message="No investment activity this month. Import a statement or add a contribution manually."
            />
          ) : (
            <Card>
              <SectionTitle>By investment</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {view.providers.map((p) => (
                  <div
                    key={p.provider}
                    style={{
                      background: 'var(--surface2)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{p.provider}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                      {p.count} transaction{p.count === 1 ? '' : 's'} this month
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
                      <span style={{ color: 'var(--muted)' }}>In</span>
                      <strong style={{ color: 'var(--green)' }}>UGX {fmt(p.inflow)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>Out</span>
                      <strong style={{ color: 'var(--amber)' }}>UGX {fmt(p.outflow)}</strong>
                    </div>
                    {p.latestBalance != null && (
                      <div
                        style={{
                          marginTop: 10,
                          paddingTop: 10,
                          borderTop: '1px solid var(--border)',
                          fontSize: 12,
                          color: 'var(--muted)',
                        }}
                      >
                        Balance: <strong style={{ color: 'var(--text)' }}>UGX {fmt(p.latestBalance)}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : section === 'activity' ? (
        <>
          {filterOptions.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
              {filterOptions.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProviderFilter(id)}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border2)',
                    background: providerFilter === id ? 'var(--accent-dim)' : 'transparent',
                    color: providerFilter === id ? 'var(--accent)' : 'var(--muted)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {activityTransactions.length === 0 ? (
            <EmptyState icon="📋" message="No transactions this month. Import a statement or add one manually." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(groupedActivity)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, items]) => {
                  const dayTotal = items.reduce((s, t) => s + txDisplayAmount(t), 0)
                  return (
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
                        {formatActivityDate(date)}
                        <span
                          style={{
                            marginLeft: 8,
                            color: dayTotal >= 0 ? 'var(--green)' : 'var(--red)',
                            fontWeight: 600,
                          }}
                        >
                          {dayTotal >= 0 ? '+' : '−'} UGX {fmt(Math.abs(dayTotal))}
                        </span>
                      </div>
                      <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {items.map((tx, i) => (
                          <div key={tx.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                            <ActivityRow tx={tx} deleting={deleting} onDelete={handleDelete} />
                          </div>
                        ))}
                      </Card>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      ) : (
        <>
          <Card style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Track life insurance and endowment policies separately from day-to-day investment activity. Upload policy
              documents to extract sum assured and bonus details.
            </p>
            <Btn onClick={() => setShowInsuranceAnalyzer(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} /> Analyze policy documents
            </Btn>
          </Card>

          {insuranceLoading ? (
            <Spinner />
          ) : insurancePolicies.length === 0 ? (
            <EmptyState icon="🛡️" message="No insurance policies yet. Upload a policy or bonus certificate to get started." />
          ) : (
            <>
              <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
                <MetricCard label="Policies" value={insurancePolicies.length} prefix="" />
                <MetricCard label="Sum assured" value={insuranceSummary.totalSumAssured} />
                <MetricCard label="Bonuses tracked" value={insuranceSummary.totalBonuses} color="var(--green)" />
                <MetricCard label="Projected payout" value={insuranceSummary.totalProjected} color="var(--accent)" />
              </div>
              <Card>
                <SectionTitle>Your policies</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {insurancePolicies.map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '14px 0',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {p.insurer || 'Policy'} {p.policy_number ? `· ${p.policy_number}` : ''}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                        Sum assured: UGX {fmt(Number(p.sum_assured || 0))}
                        {(p.insurance_bonuses || []).length > 0 && (
                          <span>
                            {' '}
                            · {(p.insurance_bonuses || []).length} bonus record
                            {(p.insurance_bonuses || []).length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
