import { useEffect, useRef, useState } from 'react'
import { Camera, FileUp, Paperclip, X } from 'lucide-react'
import { scanReceipt } from '../lib/receiptScan'
import { attachReceiptToExpense, uploadExpenseReceipt } from '../lib/expenseReceipts'
import { Btn, Card } from './UI'

const IMAGE_ACCEPT = 'image/*,image/jpeg,image/png,image/webp,image/heic'
const FILE_ACCEPT = 'image/*,.pdf,application/pdf,image/jpeg,image/png,image/webp'

function isAllowedReceiptFile(file) {
  if (!file) return false
  const name = String(file.name || '').toLowerCase()
  const type = String(file.type || '').toLowerCase()
  return (
    type.startsWith('image/') ||
    type === 'application/pdf' ||
    /\.(png|jpe?g|webp|gif|heic|pdf)$/i.test(name)
  )
}

export default function ScanReceiptModal({ categories, paymentMethods, onAdd, onClose }) {
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [scanNotes, setScanNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file?.type?.startsWith('image/')) {
      setPreviewUrl(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleFile = (next) => {
    if (next && !isAllowedReceiptFile(next)) {
      setError('Upload a photo (JPG, PNG, WEBP) or a PDF receipt.')
      return
    }
    setFile(next)
    setForm(null)
    setScanNotes('')
    setError('')
  }

  const handleScan = async () => {
    if (!file) {
      setError('Take a photo or upload a receipt photo/PDF first.')
      return
    }
    setScanning(true)
    setError('')
    try {
      const result = await scanReceipt(file, { categories, paymentMethods })
      setForm({
        date: result.date,
        category: result.category,
        description: result.description,
        amount: result.amount,
        payment_method: result.payment_method,
      })
      setScanNotes(result.notes || '')
    } catch (e) {
      setError(e?.message || 'Could not read receipt.')
    } finally {
      setScanning(false)
    }
  }

  const handleSave = async () => {
    if (!form?.amount || Number.isNaN(Number(form.amount))) {
      setError('Enter a valid amount.')
      return
    }
    if (!form.description?.trim()) {
      setError('Add a description.')
      return
    }
    setSaving(true)
    setError('')
    const { data, error: addErr } = await onAdd({
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      amount: Number(form.amount),
      payment_method: form.payment_method,
    })
    if (addErr) {
      setError(addErr.message || 'Could not save expense.')
      setSaving(false)
      return
    }
    if (file && data?.id) {
      try {
        const { path, name } = await uploadExpenseReceipt(file, data.id)
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
      <Card className="modal-card" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Scan receipt</span>
          <button type="button" onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {!form ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Take a photo or upload a receipt photo/PDF. Text PDFs are read locally with readany; photos use AI when
              available. Confirm before saving.
            </p>
            <div className="receipt-scan-actions">
              <button
                type="button"
                className="receipt-scan-btn"
                onClick={() => cameraInputRef.current?.click()}
                disabled={scanning}
              >
                <Camera size={18} />
                Take photo
              </button>
              <button
                type="button"
                className="receipt-scan-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
              >
                <FileUp size={18} />
                Upload photo or PDF
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                capture="environment"
                className="receipt-scan-input"
                onChange={(e) => {
                  handleFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept={FILE_ACCEPT}
                className="receipt-scan-input"
                onChange={(e) => {
                  handleFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </div>
            {file && (
              <div className="receipt-scan-preview">
                {previewUrl ? (
                  <img src={previewUrl} alt="Receipt preview" />
                ) : (
                  <div className="receipt-scan-pdf">
                    <Paperclip size={16} /> {file.name}
                  </div>
                )}
              </div>
            )}
            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Btn onClick={() => void handleScan()} disabled={scanning || !file}>
                {scanning ? 'Reading receipt…' : 'Scan receipt'}
              </Btn>
              <Btn variant="ghost" onClick={onClose} disabled={scanning}>
                Cancel
              </Btn>
            </div>
          </>
        ) : (
          <>
            {scanNotes && (
              <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 12, lineHeight: 1.45 }}>{scanNotes}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {field('Date', <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />)}
              {field(
                'Category',
                <select value={form.category} onChange={(e) => setField('category', e.target.value)}>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'Description',
                <input
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Merchant or note"
                />,
              )}
              {field(
                'Amount (UGX)',
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  placeholder="0"
                />,
              )}
              {field(
                'Payment method',
                <select value={form.payment_method} onChange={(e) => setField('payment_method', e.target.value)}>
                  {paymentMethods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>,
              )}
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <Btn onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save expense'}
              </Btn>
              <Btn variant="ghost" onClick={() => setForm(null)} disabled={saving}>
                Scan again
              </Btn>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
