import { useEffect, useState } from 'react'
import { Plus, Trash2, RotateCcw } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { DEFAULT_APP_SETTINGS, fmt } from '../lib/constants'
import { Btn, Card, SectionTitle, Spinner } from '../components/UI'

const BUDGET_TYPES = ['fixed', 'variable', 'savings']

function cloneSettings(s) {
  return JSON.parse(JSON.stringify(s))
}

export default function Settings() {
  const { settings, loading, saveSettings, reload } = useAppSettings()
  const [draft, setDraft] = useState(() => cloneSettings(settings))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDraft(cloneSettings(settings))
  }, [settings])

  const updateBudgetRow = (i, field, value) => {
    setDraft((d) => {
      const budget = [...d.budget]
      budget[i] = { ...budget[i], [field]: value }
      return { ...d, budget }
    })
  }

  const addBudgetRow = () => {
    setDraft((d) => ({
      ...d,
      budget: [
        ...d.budget,
        { category: 'New category', amount: 100_000, type: 'variable', color: '#888888' },
      ],
    }))
  }

  const removeBudgetRow = (i) => {
    setDraft((d) => ({ ...d, budget: d.budget.filter((_, j) => j !== i) }))
  }

  const updateGoal = (i, field, value) => {
    setDraft((d) => {
      const investment_goals = [...d.investment_goals]
      investment_goals[i] = { ...investment_goals[i], [field]: value }
      return { ...d, investment_goals }
    })
  }

  const validate = () => {
    if (!draft.budget?.length) return 'Add at least one budget category.'
    const names = new Set(draft.budget.map((b) => b.category.trim()).filter(Boolean))
    if (!names.has(draft.gym_category?.trim())) {
      return `Add a budget line whose name matches gym category (“${draft.gym_category}”).`
    }
    if (!names.has(draft.emergency_category?.trim())) {
      return `Add a budget line whose name matches emergency category (“${draft.emergency_category}”).`
    }
    if (!names.has(draft.investments_category?.trim())) {
      return `Add a budget line whose name matches investments category (“${draft.investments_category}”).`
    }
    if (draft.investment_goals?.length !== 3) {
      return 'Use exactly three investment goals (they map to your saved balances).'
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) {
      setMessage(err)
      return
    }
    setSaving(true)
    setMessage('')
    const payment_methods = String(draft.payment_methods.join(', '))
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

    const { error } = await saveSettings({
      ...draft,
      salary: Number(draft.salary),
      emergency_fund_target: Number(draft.emergency_fund_target),
      gym_session_cost: Number(draft.gym_session_cost),
      gym_sessions_per_week: Math.max(1, Number(draft.gym_sessions_per_week) || 1),
      budget: draft.budget.map((b) => ({
        category: String(b.category).trim(),
        amount: Number(b.amount),
        type: BUDGET_TYPES.includes(b.type) ? b.type : 'variable',
        color: String(b.color || '#888888'),
      })),
      investment_goals: draft.investment_goals.map((g) => ({
        label: String(g.label).trim() || 'Goal',
        target: Math.max(1, Number(g.target) || 0),
        years: Math.max(1, Number(g.years) || 1),
      })),
      payment_methods: payment_methods.length ? payment_methods : DEFAULT_APP_SETTINGS.payment_methods,
    })
    setSaving(false)
    if (error) setMessage(error.message ?? 'Could not save.')
    else setMessage('Saved successfully.')
  }

  const resetDraft = () => {
    setDraft(cloneSettings(settings))
    setMessage('')
  }

  const resetToFactory = () => {
    setDraft(cloneSettings(DEFAULT_APP_SETTINGS))
    setMessage('Form reset to generic defaults — press Save to write them to the database.')
  }

  if (loading) {
    return (
      <div className="page">
        <Spinner />
      </div>
    )
  }

  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 6 }
  const labelStyle = { fontSize: 12, color: 'var(--muted)', fontWeight: 600 }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Salary, categories, and goals are stored in Supabase. Change them here anytime — numbers are formatted with the
            same locale as the rest of the app (e.g. {fmt(1_000)}).
          </p>
        </div>
        <div className="page-header-actions">
          <Btn variant="ghost" onClick={() => void reload()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RotateCcw size={16} /> Reload
          </Btn>
        </div>
      </header>

      <Card style={{ marginBottom: '1rem' }}>
        <SectionTitle>App & income</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>App name (nav & tab title)</label>
            <input
              value={draft.app_title}
              onChange={(e) => setDraft((d) => ({ ...d, app_title: e.target.value }))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Monthly salary</label>
            <input
              type="number"
              value={draft.salary}
              onChange={(e) => setDraft((d) => ({ ...d, salary: e.target.value }))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Emergency fund target (balance goal)</label>
            <input
              type="number"
              value={draft.emergency_fund_target}
              onChange={(e) => setDraft((d) => ({ ...d, emergency_fund_target: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <SectionTitle>Gym</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          The <strong>gym allowance</strong> comes from your budget row whose name matches{' '}
          <strong>gym category</strong> below.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Gym category name (must match budget line)</label>
            <input
              value={draft.gym_category}
              onChange={(e) => setDraft((d) => ({ ...d, gym_category: e.target.value }))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Cost per session</label>
            <input
              type="number"
              value={draft.gym_session_cost}
              onChange={(e) => setDraft((d) => ({ ...d, gym_session_cost: e.target.value }))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Target sessions per week (hint only)</label>
            <input
              type="number"
              min={1}
              value={draft.gym_sessions_per_week}
              onChange={(e) => setDraft((d) => ({ ...d, gym_sessions_per_week: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <SectionTitle>Budget category names</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          These names must match how they appear on your monthly budget lines — used for emergency / investments
          contribution hints on Goals.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Emergency fund budget line name</label>
            <input
              value={draft.emergency_category}
              onChange={(e) => setDraft((d) => ({ ...d, emergency_category: e.target.value }))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Investments budget line name</label>
            <input
              value={draft.investments_category}
              onChange={(e) => setDraft((d) => ({ ...d, investments_category: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <SectionTitle>Expenses — payment methods</SectionTitle>
        <div style={fieldStyle}>
          <label style={labelStyle}>Comma-separated labels</label>
          <input
            value={draft.payment_methods.join(', ')}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                payment_methods: e.target.value.split(',').map((x) => x.trim()),
              }))
            }
          />
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <SectionTitle style={{ marginBottom: 0 }}>Monthly budget lines</SectionTitle>
          <Btn variant="ghost" size="sm" onClick={addBudgetRow} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add line
          </Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {draft.budget.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10,
                alignItems: 'end',
                padding: '10px 0',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={fieldStyle}>
                <label style={labelStyle}>Category</label>
                <input value={row.category} onChange={(e) => updateBudgetRow(i, 'category', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Amount / month</label>
                <input
                  type="number"
                  value={row.amount}
                  onChange={(e) => updateBudgetRow(i, 'amount', e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Type</label>
                <select value={row.type} onChange={(e) => updateBudgetRow(i, 'type', e.target.value)}>
                  {BUDGET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Color</label>
                <input
                  type="color"
                  value={row.color?.startsWith('#') ? row.color : '#888888'}
                  onChange={(e) => updateBudgetRow(i, 'color', e.target.value)}
                  style={{ height: 42, padding: 4, cursor: 'pointer' }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeBudgetRow(i)}
                disabled={draft.budget.length <= 1}
                style={{
                  background: 'none',
                  color: 'var(--muted)',
                  padding: 10,
                  opacity: draft.budget.length <= 1 ? 0.35 : 1,
                }}
                aria-label="Remove row"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <SectionTitle>Investment goals (3)</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {draft.investment_goals.map((g, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                padding: '12px 0',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={fieldStyle}>
                <label style={labelStyle}>Label</label>
                <input value={g.label} onChange={(e) => updateGoal(i, 'label', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Target amount</label>
                <input type="number" value={g.target} onChange={(e) => updateGoal(i, 'target', e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Years</label>
                <input type="number" min={1} value={g.years} onChange={(e) => updateGoal(i, 'years', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {message && (
        <p style={{ fontSize: 14, color: message.includes('success') ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>
          {message}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Btn onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Btn>
        <Btn variant="ghost" onClick={resetDraft} disabled={saving}>
          Discard edits
        </Btn>
        <Btn variant="ghost" onClick={resetToFactory} disabled={saving}>
          Load generic defaults (form only)
        </Btn>
      </div>
    </div>
  )
}
