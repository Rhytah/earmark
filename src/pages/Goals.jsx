import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAppSettings } from '../context/useAppSettings'
import { useSavingsSnapshot } from '../lib/hooks'
import { budgetLineAmount, fmt, getCurrentMonth } from '../lib/constants'
import { Card, MetricCard, ProgressBar, SectionTitle, Btn, Badge } from '../components/UI'

const INV_LINE_COLORS = ['var(--accent)', 'var(--purple)', '#f472b6']

export default function Goals() {
  const { settings } = useAppSettings()
  const {
    investment_goals,
    emergency_fund_target,
    emergency_category,
    budget,
  } = settings
  const EMERGENCY_BUDGET = budgetLineAmount(budget, emergency_category)

  const { snapshots, upsertSnapshot } = useSavingsSnapshot()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const latest = snapshots[snapshots.length - 1] || {}
  const [form, setForm] = useState({
    month: getCurrentMonth(),
    emergency_balance: latest.emergency_balance || 0,
    investment1_balance: latest.investment1_balance || 0,
    investment2_balance: latest.investment2_balance || 0,
    investment3_balance: latest.investment3_balance || 0,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await upsertSnapshot({ ...form, emergency_balance: Number(form.emergency_balance),
      investment1_balance: Number(form.investment1_balance),
      investment2_balance: Number(form.investment2_balance),
      investment3_balance: Number(form.investment3_balance),
    })
    setSaving(false)
    setEditing(false)
  }

  const cur = snapshots.length ? snapshots[snapshots.length - 1] : form

  const emergencyGap = emergency_fund_target - (cur.emergency_balance || 0)
  const monthsToEmergency =
    emergencyGap > 0 && EMERGENCY_BUDGET > 0 ? Math.ceil(emergencyGap / EMERGENCY_BUDGET) : 0

  const investBalances = [
    cur.investment1_balance || 0,
    cur.investment2_balance || 0,
    cur.investment3_balance || 0,
  ]

  const chartData = snapshots.map((s) => {
    const row = { month: s.month, Emergency: s.emergency_balance }
    investment_goals.forEach((_, i) => {
      const v = [s.investment1_balance, s.investment2_balance, s.investment3_balance][i]
      row[`inv${i}`] = v
    })
    return row
  })

  const field = (label, key, placeholder) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      <input type="number" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
    </div>
  )

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">Investment & emergency fund progress</p>
        </div>
        <div className="page-header-actions">
          <Btn onClick={() => setEditing(true)} variant="ghost">
            Update balances
          </Btn>
        </div>
      </header>

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <Card className="modal-card">
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: '1.25rem' }}>Update balances</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Month</label>
                <input type="month" value={form.month} onChange={e => set('month', e.target.value)} />
              </div>
              {field(`“${emergency_category}” balance (UGX)`, 'emergency_balance', '0')}
              {field(`“${investment_goals[0]?.label ?? 'Goal 1'}” balance (UGX)`, 'investment1_balance', '0')}
              {field(`“${investment_goals[1]?.label ?? 'Goal 2'}” balance (UGX)`, 'investment2_balance', '0')}
              {field(`“${investment_goals[2]?.label ?? 'Goal 3'}” balance (UGX)`, 'investment3_balance', '0')}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Btn onClick={handleSave} disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save'}</Btn>
                <Btn onClick={() => setEditing(false)} variant="ghost" style={{ flex: 1 }}>Cancel</Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Emergency fund */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Emergency fund</SectionTitle>
        <div className="metric-grid">
          <MetricCard label="Current balance" value={cur.emergency_balance || 0} color="var(--green)" />
          <MetricCard label="Target" value={emergency_fund_target} color="var(--muted)" />
          <MetricCard label="Gap remaining" value={emergencyGap} color={emergencyGap > 0 ? 'var(--red)' : 'var(--green)'} />
          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Months to target</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--amber)' }}>{monthsToEmergency}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>at UGX {fmt(EMERGENCY_BUDGET)}/mo</div>
          </div>
        </div>
        <ProgressBar
          value={cur.emergency_balance || 0}
          max={Math.max(1, emergency_fund_target)}
          color="var(--green)"
          height={12}
          showPct
        />
      </Card>

      {/* Investment goals */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Investment goals</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {investment_goals.map((goal, i) => {
            const balance = investBalances[i]
            const gap = goal.target - balance
            const pct = goal.target > 0 ? Math.round((balance / goal.target) * 100) : 0

            return (
              <div key={goal.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{goal.label}</span>
                    <Badge color="var(--accent)">{goal.years}yr horizon</Badge>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700 }}>UGX {fmt(balance)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}> / {fmt(goal.target)}</span>
                  </div>
                </div>
                <ProgressBar value={balance} max={Math.max(1, goal.target)} color="var(--accent)" height={8} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <span>{pct}% complete</span>
                  <span>UGX {fmt(gap)} remaining</span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Growth chart */}
      {chartData.length > 1 && (
        <Card>
          <SectionTitle>Balance history</SectionTitle>
          <div className="chart-wrap chart-wrap--line">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000000)}M`} />
              <Tooltip formatter={(v) => `UGX ${fmt(v)}`} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="Emergency" name="Emergency" stroke="var(--green)" strokeWidth={2} dot={false} />
              {investment_goals.map((g, i) => (
                <Line
                  key={g.label}
                  type="monotone"
                  dataKey={`inv${i}`}
                  name={g.label}
                  stroke={INV_LINE_COLORS[i % INV_LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              ['Emergency', 'var(--green)'],
              ...investment_goals.map((g, i) => [g.label, INV_LINE_COLORS[i % INV_LINE_COLORS.length]]),
            ].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}>
                <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
                {label}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Monthly contribution guide */}
      <Card style={{ marginTop: '1.5rem' }}>
        <SectionTitle>Monthly contribution targets</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {investment_goals.map((goal, i) => {
            const needed = Math.ceil(goal.target / (goal.years * 12))
            return (
              <div key={goal.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{goal.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{goal.years}-year target</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>UGX {fmt(needed)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>/mo</span></div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>to hit UGX {fmt(goal.target)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
