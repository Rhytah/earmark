import { useMemo, useState } from 'react'
import { Upload, Trash2, Sparkles } from 'lucide-react'
import { useInsurancePolicies, useInvestmentsRange } from '../lib/hooks'
import {
  parseInvestmentStatementCsv,
  parseInvestmentStatementFile,
  parseInvestmentStatementInput,
} from '../lib/investmentStatements'
import { analyzeInsuranceDocuments, savePolicyAnalysis, uploadInsuranceDocs } from '../lib/insuranceService'
import { fmt, getCurrentMonth } from '../lib/constants'
import { Btn, Card, EmptyState, MetricCard, MonthPicker, SectionTitle, Spinner } from '../components/UI'

function UploadModal({ onClose, onImport }) {
  const [text, setText] = useState('')
  const [fileParsedRows, setFileParsedRows] = useState(null)
  const [fileParsedInvalid, setFileParsedInvalid] = useState([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fileBusy, setFileBusy] = useState(false)

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
        // Preserve structured parsed fields (interest/deposit/balance/etc.)
        // instead of flattening to CSV columns.
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
      <Card className="modal-card" style={{ maxWidth: 620 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Upload investment statement</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Drag & drop or choose a file (PDF, CSV, TXT, TSV), or paste CSV rows with columns like date, asset/symbol,
          type, amount, units, price, notes.
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void onDrop(e)}
          style={{
            border: `1px dashed ${dragOver ? 'var(--accent)' : 'var(--border2)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            marginBottom: 10,
            background: dragOver ? 'var(--accent-dim)' : 'var(--surface2)',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {fileBusy ? 'Reading file…' : fileName ? `Selected: ${fileName}` : 'Drop file here or choose one'}
            </span>
            <label style={{ display: 'inline-flex' }}>
              <input
                type="file"
                accept=".pdf,.csv,.txt,.tsv,text/csv,text/plain,application/pdf"
                onChange={(e) => void handleFile(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text)',
                  border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-solid)',
                  padding: '0.45rem 0.65rem',
                  cursor: 'pointer',
                }}
              >
                Choose file
              </span>
            </label>
          </div>
        </div>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            // Manual edits switch back to CSV parser path.
            setFileParsedRows(null)
            setFileParsedInvalid([])
          }}
          placeholder="Paste CSV statement data here..."
          style={{ minHeight: 180, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 13 }}>
          <span style={{ color: effectiveValid.length ? 'var(--green)' : 'var(--muted)' }}>{effectiveValid.length} valid rows</span>
          {!!effectiveInvalid.length && <span style={{ color: 'var(--amber)' }}>{effectiveInvalid.length} invalid rows</span>}
        </div>
        {!!effectiveInvalid.length && (
          <ul style={{ marginTop: 8, maxHeight: 110, overflow: 'auto', color: 'var(--red)', fontSize: 12, paddingLeft: '1.1rem' }}>
            {effectiveInvalid.slice(0, 20).map((x) => (
              <li key={`${x.line}-${x.reason}`}>Line {x.line}: {x.reason}</li>
            ))}
          </ul>
        )}
        {err && <div style={{ color: 'var(--red)', marginTop: 8, fontSize: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn onClick={() => void handleImport()} disabled={busy || fileBusy || !effectiveValid.length}>
            {busy ? 'Importing…' : `Import ${effectiveValid.length} row(s)`}
          </Btn>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
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
      <Card className="modal-card" style={{ maxWidth: 680 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>AI Insurance Analyzer</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Upload receipts/statements/bonus certificates. AI extracts policy and bonus details.
        </p>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>{files.length} file(s) selected</div>
        {result?.policies?.length > 0 && (
          <div style={{ marginTop: 10, maxHeight: 180, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
            {result.policies.map((p, i) => (
              <div key={`${p.policyNumber || p.insurer}-${i}`} style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.insurer || 'Policy'} {p.policyNumber ? `(${p.policyNumber})` : ''}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Sum assured: UGX {fmt(Number(p.sumAssured || 0))} · Bonuses: {(p.bonuses || []).length}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Btn onClick={() => void handleAnalyze()} disabled={busy || !files.length}>
            {busy ? 'Working…' : 'Analyze documents'}
          </Btn>
          <Btn variant="success" onClick={() => void handleSave()} disabled={busy || !(result?.policies?.length > 0)}>
            Save extracted policies
          </Btn>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
        </div>
      </Card>
    </div>
  )
}

export default function Investments() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [rangeMode, setRangeMode] = useState('rolling')
  const [monthsBack, setMonthsBack] = useState(12)
  const [customStart, setCustomStart] = useState(`${new Date().getFullYear()}-01-01`)
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState('combined')
  const [investmentTab, setInvestmentTab] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const [showInsuranceAnalyzer, setShowInsuranceAnalyzer] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (rangeMode === 'all') return { rangeStart: null, rangeEnd: null, rangeLabel: 'all time' }
    if (rangeMode === 'custom') {
      return {
        rangeStart: customStart || null,
        rangeEnd: customEnd || null,
        rangeLabel: customStart && customEnd ? `${customStart} to ${customEnd}` : 'custom range',
      }
    }
    const [endYear, endMonthNum] = month.split('-').map(Number)
    const startDate = new Date(endYear, endMonthNum - monthsBack, 1)
    const start = startDate.toISOString().slice(0, 10)
    const endDay = new Date(endYear, endMonthNum, 0).getDate()
    const end = `${endYear}-${String(endMonthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    return { rangeStart: start, rangeEnd: end, rangeLabel: `last ${monthsBack} months` }
  }, [rangeMode, customStart, customEnd, month, monthsBack])

  const { transactions, loading, addTransactionsBulk, deleteTransaction } = useInvestmentsRange(rangeStart, rangeEnd)
  const { policies: insurancePolicies, loading: insuranceLoading, refetch: refetchInsurance } = useInsurancePolicies()

  const identifyInvestment = (asset) => {
    const text = String(asset || '').toLowerCase()
    if (text.includes('sanlam')) return 'Sanlam'
    if (text.includes('prudential') || text.includes('pru')) return 'Prudential'
    const compact = String(asset || '').trim()
    if (!compact) return 'Other'
    return compact.split(/\s+/).slice(0, 2).join(' ')
  }

  const investmentTabs = useMemo(() => {
    const map = new Map()
    transactions.forEach((t) => {
      const label = identifyInvestment(t.asset)
      if (!map.has(label)) map.set(label, label.toLowerCase())
    })
    return [['all', 'All'], ...Array.from(map.entries()).map(([label, id]) => [id, label])]
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (investmentTab === 'all') return transactions
    return transactions.filter((t) => identifyInvestment(t.asset).toLowerCase() === investmentTab)
  }, [transactions, investmentTab])

  const overview = useMemo(() => {
    const totals = { buy: 0, sell: 0, dividend: 0, fee: 0, deposit: 0, withdrawal: 0 }
    const statementTotals = { deposit: 0, interest: 0, withdrawal: 0, tax: 0 }
    const byAsset = {}
    filteredTransactions.forEach((t) => {
      totals[t.tx_type] = (totals[t.tx_type] || 0) + Number(t.amount || 0)
      statementTotals.deposit += Number(t.deposit_amount || 0)
      statementTotals.interest += Number(t.interest_amount || 0)
      statementTotals.withdrawal += Number(t.withdrawal_amount || 0)
      statementTotals.tax += Number(t.withholding_tax_amount || 0)
      byAsset[t.asset] = (byAsset[t.asset] || 0) + Number(t.amount || 0)
    })
    const closingBalance = transactions.find((t) => t.balance_amount != null)?.balance_amount ?? null
    const netCashFlow = (totals.sell + totals.dividend + totals.deposit) - (totals.buy + totals.fee + totals.withdrawal)
    const topAssets = Object.entries(byAsset)
      .map(([asset, amount]) => ({ asset, amount }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 5)
    const statementRows = filteredTransactions.filter(
      (t) => t.source === 'statement_upload'
        || t.deposit_amount != null
        || t.interest_amount != null
        || t.withdrawal_amount != null
        || t.withholding_tax_amount != null
        || t.balance_amount != null,
    )
    return { totals, statementTotals, netCashFlow, topAssets, closingBalance, statementRows }
  }, [filteredTransactions])

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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Investments</h1>
          <p className="page-subtitle">Upload statements and track your investment activity</p>
        </div>
        <div
          className="page-header-actions"
          style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}
        >
          <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)} style={{ minWidth: 0 }}>
            <option value="rolling">Rolling months</option>
            <option value="custom">Custom date range</option>
            <option value="all">All time</option>
          </select>
          {rangeMode === 'rolling' && (
            <>
              <MonthPicker value={month} onChange={setMonth} />
              <select value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} style={{ minWidth: 0 }}>
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
                <option value={24}>Last 24 months</option>
              </select>
            </>
          )}
          {rangeMode === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          <Btn onClick={() => setShowUpload(true)} style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={15} /> Upload statement
          </Btn>
        </div>
      </header>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Active investment range: <strong style={{ color: 'var(--text)' }}>{rangeLabel}</strong>
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['combined', 'Combined'],
            ['statements', 'Statements'],
            ['all', 'All Activity'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border2)',
                background: tab === id ? 'var(--accent-dim)' : 'var(--surface2)',
                color: tab === id ? 'var(--accent)' : 'var(--text)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {investmentTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setInvestmentTab(id)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border2)',
                background: investmentTab === id ? 'var(--accent-dim)' : 'var(--surface2)',
                color: investmentTab === id ? 'var(--accent)' : 'var(--text)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onImport={addTransactionsBulk} />}
      {showInsuranceAnalyzer && (
        <InsuranceAnalyzerModal
          onClose={() => setShowInsuranceAnalyzer(false)}
          onSaved={() => void refetchInsurance()}
        />
      )}

      <Card style={{ marginBottom: '1rem' }}>
        <SectionTitle>Insurance policies (AI extracted)</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <Btn onClick={() => setShowInsuranceAnalyzer(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} /> Analyze insurance documents
          </Btn>
        </div>
        {insuranceLoading ? (
          <Spinner />
        ) : (
          <div className="metric-grid" style={{ marginBottom: 0 }}>
            <MetricCard label="Policies" value={insurancePolicies.length} prefix="" />
            <MetricCard label="Total sum assured" value={insuranceSummary.totalSumAssured} />
            <MetricCard label="Total bonuses" value={insuranceSummary.totalBonuses} color="var(--green)" />
            <MetricCard label="Projected payout" value={insuranceSummary.totalProjected} color="var(--accent)" />
          </div>
        )}
      </Card>

      {tab !== 'all' ? (
        <div className="metric-grid">
          <MetricCard label="Deposits" value={overview.statementTotals.deposit || overview.totals.deposit} />
          <MetricCard label="Interest" value={overview.statementTotals.interest || overview.totals.dividend} color="var(--green)" />
          <MetricCard label="Withdrawals" value={overview.statementTotals.withdrawal || overview.totals.withdrawal} color="var(--amber)" />
          <MetricCard label="Withholding tax" value={overview.statementTotals.tax || overview.totals.fee} color="var(--red)" />
          <MetricCard label="Net cash flow" value={overview.netCashFlow} color={overview.netCashFlow < 0 ? 'var(--red)' : 'var(--green)'} />
          <MetricCard label="Closing balance" value={overview.closingBalance || 0} color="var(--accent)" />
        </div>
      ) : (
        <div className="metric-grid">
          <MetricCard label="Buy volume" value={overview.totals.buy} />
          <MetricCard label="Sell volume" value={overview.totals.sell} />
          <MetricCard label="Dividend inflow" value={overview.totals.dividend} color="var(--green)" />
          <MetricCard label="Fees/tax" value={overview.totals.fee} color="var(--red)" />
          <MetricCard label="Deposits" value={overview.totals.deposit} />
          <MetricCard label="Withdrawals" value={overview.totals.withdrawal} color="var(--amber)" />
        </div>
      )}

      {tab !== 'statements' && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <SectionTitle>Top assets by activity</SectionTitle>
          {overview.topAssets.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No activity in selected range.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {overview.topAssets.map((x) => (
                <div key={x.asset} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{x.asset}</span>
                  <strong>UGX {fmt(x.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>
          {tab === 'statements' ? 'Statement transactions' : tab === 'all' ? 'All investment activity' : 'Imported transactions'}
        </SectionTitle>
        {loading ? <Spinner /> : (tab === 'statements' ? overview.statementRows : filteredTransactions).length === 0 ? (
          <EmptyState icon="📈" message="No investment transactions yet. Upload a statement to get started." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 980, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 100px 1.4fr 80px 110px 100px 100px 100px 100px 100px 40px',
                  gap: 10,
                  color: 'var(--muted)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  paddingBottom: 6,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>Date</div>
                <div>Trans #</div>
                <div>Asset / Description</div>
                <div>Type</div>
                <div>Net</div>
                <div>Deposit</div>
                <div>Interest</div>
                <div>Withdraw</div>
                <div>Tax</div>
                <div>Balance</div>
                <div />
              </div>
              {(tab === 'statements' ? overview.statementRows : filteredTransactions).map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 100px 1.4fr 80px 110px 100px 100px 100px 100px 100px 40px',
                    gap: 10,
                    alignItems: 'center',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    paddingTop: i > 0 ? 8 : 0,
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: 'var(--muted)' }}>{t.date}</div>
                  <div style={{ color: 'var(--muted)' }}>{t.trans_no || '—'}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.asset}</div>
                    <div style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.description || t.notes}
                    </div>
                  </div>
                  <div style={{ textTransform: 'capitalize' }}>{t.tx_type}</div>
                  <div style={{ fontWeight: 700 }}>UGX {fmt(t.amount)}</div>
                  <div style={{ color: 'var(--muted)' }}>{t.deposit_amount ? fmt(t.deposit_amount) : '—'}</div>
                  <div style={{ color: 'var(--muted)' }}>{t.interest_amount ? fmt(t.interest_amount) : '—'}</div>
                  <div style={{ color: 'var(--muted)' }}>{t.withdrawal_amount ? fmt(t.withdrawal_amount) : '—'}</div>
                  <div style={{ color: 'var(--muted)' }}>{t.withholding_tax_amount ? fmt(t.withholding_tax_amount) : '—'}</div>
                  <div style={{ color: 'var(--muted)' }}>{t.balance_amount ? fmt(t.balance_amount) : '—'}</div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(t.id)}
                    disabled={deleting === t.id}
                    style={{ background: 'none', color: 'var(--muted)', padding: 4, opacity: deleting === t.id ? 0.45 : 1 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
