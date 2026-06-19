import { useEffect, useState } from 'react'
import { Plus, Trash2, RotateCcw, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppSettings } from '../context/useAppSettings'
import { DEFAULT_APP_SETTINGS, fmt, getCurrentMonth } from '../lib/constants'
import { syncExpensesFromSheet } from '../lib/googleSheetSync'
import {
  TRACKER_ICON_OPTIONS,
  TRACKER_PRESETS,
  createTrackerFromPreset,
  normalizeTrackers,
  slugifyTrackerId,
} from '../lib/trackers'
import { Btn, Card, SectionTitle, Spinner } from '../components/UI'
import { createExtraIncomeRow, incomeSummary } from '../lib/income'
import {
  DAY_LABELS,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../lib/trackingReminders'

const BUDGET_TYPES = ['fixed', 'variable', 'savings']

function cloneSettings(s) {
  return JSON.parse(JSON.stringify(s))
}

const SHEET_INTERVALS = [
  { value: 30, label: 'Every 30 seconds' },
  { value: 60, label: 'Every minute' },
  { value: 120, label: 'Every 2 minutes' },
  { value: 300, label: 'Every 5 minutes' },
]

export default function Settings() {
  const { settings, loading, saveSettings, reload } = useAppSettings()
  const [draft, setDraft] = useState(() => cloneSettings(settings))
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [notifPermission, setNotifPermission] = useState(() => notificationPermission())

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

  const addExtraIncomeRow = () => {
    setDraft((d) => ({
      ...d,
      extra_income: [...(d.extra_income || []), createExtraIncomeRow(d.extra_income || [])],
    }))
  }

  const updateExtraIncomeRow = (i, field, value) => {
    setDraft((d) => {
      const extra_income = [...(d.extra_income || [])]
      extra_income[i] = { ...extra_income[i], [field]: value }
      return { ...d, extra_income }
    })
  }

  const removeExtraIncomeRow = (i) => {
    setDraft((d) => ({
      ...d,
      extra_income: (d.extra_income || []).filter((_, j) => j !== i),
    }))
  }

  const updateGoal = (i, field, value) => {
    setDraft((d) => {
      const investment_goals = [...d.investment_goals]
      investment_goals[i] = { ...investment_goals[i], [field]: value }
      return { ...d, investment_goals }
    })
  }

  const updateTracker = (i, field, value) => {
    setDraft((d) => {
      const trackers = [...(d.trackers || [])]
      trackers[i] = { ...trackers[i], [field]: value }
      return { ...d, trackers }
    })
  }

  const addTracker = (preset = null) => {
    setDraft((d) => {
      const existing = d.trackers || []
      const ids = existing.map((t) => t.id)
      const next = preset
        ? createTrackerFromPreset(preset, ids)
        : normalizeTrackers(
            [
              {
                id: slugifyTrackerId('New tracker', ids),
                label: 'New tracker',
                icon: 'activity',
                enabled: true,
                budget_category: d.budget?.[0]?.category || '',
                unit_cost: 0,
                target_per_week: 3,
                unit_label: 'session',
              },
            ],
            null,
          )[0]
      return { ...d, trackers: [...existing, next] }
    })
  }

  const removeTracker = (i) => {
    setDraft((d) => ({ ...d, trackers: (d.trackers || []).filter((_, j) => j !== i) }))
  }

  const validate = () => {
    if (!draft.budget?.length) return 'Add at least one budget category.'
    const names = new Set(draft.budget.map((b) => b.category.trim()).filter(Boolean))
    const trackers = normalizeTrackers(draft.trackers, draft)
    const ids = new Set()
    for (const tracker of trackers) {
      if (ids.has(tracker.id)) return `Duplicate tracker id “${tracker.id}”.`
      ids.add(tracker.id)
      if (!tracker.enabled) continue
      if (!tracker.label.trim()) return 'Each enabled tracker needs a label.'
      if (tracker.budget_category && !names.has(tracker.budget_category.trim())) {
        return `Tracker “${tracker.label}” needs a budget line named “${tracker.budget_category}”.`
      }
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
      extra_income: (draft.extra_income || []).map((row) => ({
        id: row.id,
        label: String(row.label).trim(),
        amount: Math.max(0, Number(row.amount) || 0),
      })).filter((row) => row.label),
      emergency_fund_target: Number(draft.emergency_fund_target),
      trackers: normalizeTrackers(draft.trackers, draft).map((t) => ({
        ...t,
        label: String(t.label).trim(),
        budget_category: String(t.budget_category).trim(),
        unit_cost: Math.max(0, Number(t.unit_cost) || 0),
        target_per_week: Math.max(1, Number(t.target_per_week) || 1),
        unit_label: String(t.unit_label || 'session').trim() || 'session',
      })),
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
    else {
      setMessage('Saved successfully.')
      if (draft.tracking_reminders?.enabled && notificationPermission() === 'default') {
        await handleEnableNotifications()
      }
    }
  }

  const resetDraft = () => {
    setDraft(cloneSettings(settings))
    setMessage('')
  }

  const resetToFactory = () => {
    setDraft(cloneSettings(DEFAULT_APP_SETTINGS))
    setMessage('Form reset to generic defaults — press Save to write them to the database.')
  }

  const updateTrackingReminders = (patch) => {
    setDraft((d) => ({
      ...d,
      tracking_reminders: { ...(d.tracking_reminders || {}), ...patch },
    }))
  }

  const toggleReminderDay = (day) => {
    setDraft((d) => {
      const current = d.tracking_reminders?.days || [0, 1, 2, 3, 4, 5, 6]
      const days = current.includes(day) ? current.filter((x) => x !== day) : [...current, day].sort((a, b) => a - b)
      return {
        ...d,
        tracking_reminders: { ...(d.tracking_reminders || {}), days: days.length ? days : [day] },
      }
    })
  }

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission()
    setNotifPermission(result)
    if (result === 'granted') setMessage('Notifications enabled.')
    else if (result === 'denied') setMessage('Notifications blocked — enable them in your browser settings.')
    else if (result === 'unsupported') setMessage('This browser does not support notifications.')
  }

  const handleSyncNow = async () => {
    if (!draft.sheet_sync_url?.trim()) {
      setMessage('Add a Google Sheets link first, then save or sync.')
      return
    }
    setSyncing(true)
    setMessage('')
    const result = await syncExpensesFromSheet(draft)
    await reload()
    setSyncing(false)
    if (result.error && !result.count) setMessage(result.error)
    else if (result.error) setMessage(`Synced ${result.count} expense(s). ${result.error}`)
    else setMessage(`Synced ${result.count} expense(s) from your sheet.`)
  }

  const lastSyncLabel = settings.sheet_sync_last_at
    ? format(parseISO(settings.sheet_sync_last_at), 'MMM d, yyyy h:mm a')
    : 'Never'

  if (loading) {
    return (
      <div className="page">
        <Spinner />
      </div>
    )
  }

  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 6 }
  const labelStyle = { fontSize: 12, color: 'var(--muted)', fontWeight: 600 }
  const draftIncome = incomeSummary(draft)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Salary, categories, and goals are stored in your account on Supabase. Each user has their own settings and data.
            Numbers are formatted with the same locale as the rest of the app (e.g. {fmt(1_000)}).
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
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Set your primary salary plus any other regular monthly inflows. Dashboard and reports use the combined total.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>App name (nav & tab title)</label>
            <input
              value={draft.app_title}
              onChange={(e) => setDraft((d) => ({ ...d, app_title: e.target.value }))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Primary monthly salary</label>
            <input
              type="number"
              min={0}
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

        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <SectionTitle style={{ marginBottom: 0 }}>Extra income sources</SectionTitle>
            <Btn variant="ghost" size="sm" onClick={addExtraIncomeRow} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Add source
            </Btn>
          </div>
          {(draft.extra_income || []).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              No extra sources yet — add freelance, rent, dividends, or other regular inflows.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(draft.extra_income || []).map((row, i) => (
                <div
                  key={row.id || i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr minmax(120px, 160px) auto',
                    gap: 10,
                    alignItems: 'end',
                  }}
                >
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Source name</label>
                    <input
                      value={row.label}
                      onChange={(e) => updateExtraIncomeRow(i, 'label', e.target.value)}
                      placeholder="Freelance, rent, bonus…"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Monthly amount</label>
                    <input
                      type="number"
                      min={0}
                      value={row.amount}
                      onChange={(e) => updateExtraIncomeRow(i, 'amount', e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExtraIncomeRow(i)}
                    style={{ background: 'none', color: 'var(--muted)', padding: 10 }}
                    aria-label="Remove income source"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 14, marginBottom: 0 }}>
            Total monthly income:{' '}
            <strong style={{ color: 'var(--text)' }}>UGX {fmt(draftIncome.total)}</strong>
            {draftIncome.extraTotal > 0 && (
              <span>
                {' '}
                (salary {fmt(draftIncome.salary)} + extra {fmt(draftIncome.extraTotal)})
              </span>
            )}
          </p>
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Personal trackers</SectionTitle>
          <Btn variant="ghost" size="sm" onClick={() => addTracker()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add tracker
          </Btn>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Optional habit trackers — gym, reading, meditation, or anything you want. Link a budget line to
          auto-count matching expenses. Only enabled trackers appear in the nav.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {TRACKER_PRESETS.map((preset) => (
            <Btn key={preset.label} variant="ghost" size="sm" onClick={() => addTracker(preset)}>
              + {preset.label}
            </Btn>
          ))}
        </div>
        {(draft.trackers || []).length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No trackers yet — add one above or use a quick preset.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(draft.trackers || []).map((tracker, i) => (
              <div
                key={tracker.id || i}
                style={{
                  padding: '14px 0',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tracker.enabled !== false}
                      onChange={(e) => updateTracker(i, 'enabled', e.target.checked)}
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTracker(i)}
                    style={{ background: 'none', color: 'var(--muted)', padding: 6 }}
                    aria-label="Remove tracker"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Label</label>
                    <input value={tracker.label} onChange={(e) => updateTracker(i, 'label', e.target.value)} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Icon</label>
                    <select value={tracker.icon} onChange={(e) => updateTracker(i, 'icon', e.target.value)}>
                      {TRACKER_ICON_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Budget line</label>
                    <select
                      value={tracker.budget_category}
                      onChange={(e) => updateTracker(i, 'budget_category', e.target.value)}
                    >
                      <option value="">— none —</option>
                      {draft.budget.map((b) => (
                        <option key={b.category} value={b.category}>
                          {b.category}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                      Expenses in this category count toward the tracker.
                    </span>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Cost per log (0 = free)</label>
                    <input
                      type="number"
                      min={0}
                      value={tracker.unit_cost}
                      onChange={(e) => updateTracker(i, 'unit_cost', e.target.value)}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Target per week</label>
                    <input
                      type="number"
                      min={1}
                      value={tracker.target_per_week}
                      onChange={(e) => updateTracker(i, 'target_per_week', e.target.value)}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Unit label</label>
                    <input
                      value={tracker.unit_label}
                      onChange={(e) => updateTracker(i, 'unit_label', e.target.value)}
                      placeholder="session, class, day…"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
        <SectionTitle>Tracking reminders</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Get a gentle nudge when you haven&apos;t logged an expense today. Browser notifications fire at your chosen
          time while the app is open, or the next time you open it. You&apos;ll also see a banner on the Dashboard.
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(draft.tracking_reminders?.enabled)}
              onChange={(e) => updateTrackingReminders({ enabled: e.target.checked })}
            />
            Remind me to log expenses
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Reminder time</label>
              <input
                type="time"
                value={draft.tracking_reminders?.time || '20:00'}
                onChange={(e) => updateTrackingReminders({ time: e.target.value })}
                disabled={!draft.tracking_reminders?.enabled}
              />
            </div>
          </div>
          <div>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Reminder days</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DAY_LABELS.map((label, day) => (
                <label
                  key={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: (draft.tracking_reminders?.days || []).includes(day) ? 'var(--accent-dim)' : 'transparent',
                    cursor: draft.tracking_reminders?.enabled ? 'pointer' : 'not-allowed',
                    opacity: draft.tracking_reminders?.enabled ? 1 : 0.55,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(draft.tracking_reminders?.days || []).includes(day)}
                    onChange={() => toggleReminderDay(day)}
                    disabled={!draft.tracking_reminders?.enabled}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => void handleEnableNotifications()}
              disabled={!notificationsSupported()}
            >
              Allow browser notifications
            </Btn>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Status:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {!notificationsSupported()
                  ? 'Not supported'
                  : notifPermission === 'granted'
                    ? 'Allowed'
                    : notifPermission === 'denied'
                      ? 'Blocked'
                      : 'Not asked yet'}
              </strong>
            </span>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: '1rem' }}>
        <SectionTitle>Google Sheets sync</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Link a public Google Sheet to import expenses automatically. When you edit the sheet, this app refreshes on the
          interval below. Share the sheet as <strong>Anyone with the link can view</strong>, or publish it to the web.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, fontFamily: 'monospace' }}>
          date,category,description,amount,payment_method
          <br />
          {getCurrentMonth()}-15,Groceries,Coffee,12000,Card
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(draft.sheet_sync_enabled)}
              onChange={(e) => setDraft((d) => ({ ...d, sheet_sync_enabled: e.target.checked }))}
            />
            Enable live sheet sync
          </label>
          <div style={fieldStyle}>
            <label style={labelStyle}>Google Sheets URL</label>
            <input
              type="url"
              value={draft.sheet_sync_url}
              onChange={(e) => setDraft((d) => ({ ...d, sheet_sync_url: e.target.value }))}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Refresh interval</label>
            <select
              value={draft.sheet_sync_interval_seconds}
              onChange={(e) =>
                setDraft((d) => ({ ...d, sheet_sync_interval_seconds: Number(e.target.value) }))
              }
            >
              {SHEET_INTERVALS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              fontSize: 13,
              color: settings.sheet_sync_last_error ? 'var(--amber)' : 'var(--muted)',
              lineHeight: 1.5,
            }}
          >
            <div>
              Last sync: <strong style={{ color: 'var(--text)' }}>{lastSyncLabel}</strong>
              {settings.sheet_sync_last_count > 0 && (
                <span> · {settings.sheet_sync_last_count} expense(s)</span>
              )}
            </div>
            {settings.sheet_sync_last_error && <div>{settings.sheet_sync_last_error}</div>}
          </div>
          <Btn
            variant="ghost"
            onClick={() => void handleSyncNow()}
            disabled={syncing || saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content' }}
          >
            <RefreshCw size={16} className={syncing ? 'spin-icon' : undefined} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Btn>
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
