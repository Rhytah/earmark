import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Shield, TrendingUp, Target, X, ChevronRight, PiggyBank, RefreshCw } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { useExpenses, useInvestments, useInvestmentsRange, useSavingsSnapshot } from '../lib/hooks'
import { fmt, getCurrentMonth } from '../lib/constants'
import { buildGoalsView } from '../lib/goalsView'
import { TX_LABELS, txDisplayAmount } from '../lib/investmentsView'
import { Badge, Btn, Card, MetricCard, MonthPicker, ProgressBar, SectionTitle, Spinner } from '../components/UI'

const GOAL_COLORS = ['var(--accent)', 'var(--purple)', '#f472b6']

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

function PaceRow({ label, budgeted, actual, color = 'var(--green)' }) {
  const pct = budgeted > 0 ? Math.min(100, Math.round((actual / budgeted) * 100)) : actual > 0 ? 100 : 0
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span>
          <strong style={{ color }}>UGX {fmt(actual)}</strong>
          {budgeted > 0 && (
            <span style={{ color: 'var(--muted)', fontWeight: 400 }}> of UGX {fmt(budgeted)} budgeted</span>
          )}
        </span>
      </div>
      {budgeted > 0 && <ProgressBar value={actual} max={budgeted} color={color} height={6} />}
      {budgeted > 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{pct}% of monthly plan</div>
      )}
    </div>
  )
}

function GoalCard({ goal, color, contributedHint }) {
  const sourceLabel =
    goal.balanceSource === 'snapshot'
      ? 'Manual balance'
      : goal.balanceSource === 'statement'
        ? 'From statement'
        : goal.balanceSource === 'activity'
          ? 'From logged activity'
          : null

  return (
    <div
      style={{
        background: 'var(--surface2)',
        borderRadius: 'var(--radius-sm)',
        padding: '1rem 1.1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{goal.label}</span>
            <Badge color={goal.status.color}>{goal.status.label}</Badge>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {goal.years}-year target · UGX {fmt(goal.monthlyNeeded)}/mo to finish
            {goal.linkedAsset && (
              <span> · linked to {goal.linkedAsset.length > 40 ? `${goal.linkedAsset.slice(0, 40)}…` : goal.linkedAsset}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color }}>UGX {fmt(goal.balance)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>of UGX {fmt(goal.target)}</div>
        </div>
      </div>
      <ProgressBar value={goal.balance} max={Math.max(1, goal.target)} color={color} height={10} showPct />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
        <span>
          {goal.pct}% complete
          {sourceLabel && <span> · {sourceLabel}</span>}
        </span>
        <span>{goal.gap > 0 ? `UGX ${fmt(goal.gap)} to go` : 'Target reached'}</span>
      </div>
      {contributedHint && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.4 }}>{contributedHint}</div>
      )}
    </div>
  )
}

function UpdateBalancesModal({ onClose, onSave, saving, form, setForm, emergencyCategory, investmentGoals }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const field = (label, key) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      <input type="number" min={0} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="0" />
    </div>
  )

  return (
    <div className="modal-backdrop" role="presentation">
      <Card className="modal-card" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Update balances</span>
          <button type="button" onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
          Enter what you have saved today from your bank, mobile money, or broker statements. This powers your progress
          bars — logging expenses on the Expenses tab tracks monthly contributions separately.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Snapshot month</label>
            <input type="month" value={form.month} onChange={(e) => set('month', e.target.value)} />
          </div>
          {field(`${emergencyCategory} balance (UGX)`, 'emergency_balance')}
          {field(`${investmentGoals[0]?.label ?? 'Goal 1'} balance (UGX)`, 'investment1_balance')}
          {field(`${investmentGoals[1]?.label ?? 'Goal 2'} balance (UGX)`, 'investment2_balance')}
          {field(`${investmentGoals[2]?.label ?? 'Goal 3'} balance (UGX)`, 'investment3_balance')}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Btn onClick={() => void onSave()} disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving…' : 'Save balances'}
            </Btn>
            <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>
              Cancel
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function Goals() {
  const { settings } = useAppSettings()
  const { investment_goals, emergency_category } = settings
  const [month, setMonth] = useState(getCurrentMonth())
  const [section, setSection] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const { snapshots, loading: snapshotsLoading, upsertSnapshot } = useSavingsSnapshot()
  const { expenses, loading: expensesLoading } = useExpenses(month)
  const { transactions, loading: investmentsLoading } = useInvestments(month)
  const { transactions: allInvestmentTransactions, loading: allInvestmentsLoading } = useInvestmentsRange(null, null)

  const view = useMemo(
    () =>
      buildGoalsView({
        settings,
        snapshots,
        monthExpenses: expenses,
        monthInvestments: transactions,
        allInvestmentTransactions,
        focusMonth: month,
      }),
    [settings, snapshots, expenses, transactions, allInvestmentTransactions, month],
  )

  const latest = snapshots[snapshots.length - 1] || {}
  const [form, setForm] = useState({
    month: getCurrentMonth(),
    emergency_balance: 0,
    investment1_balance: 0,
    investment2_balance: 0,
    investment3_balance: 0,
  })

  const openEditor = () => {
    setForm({
      month: getCurrentMonth(),
      emergency_balance: latest.emergency_balance || 0,
      investment1_balance: latest.investment1_balance || view.investments.goals[0]?.balance || 0,
      investment2_balance: latest.investment2_balance || view.investments.goals[1]?.balance || 0,
      investment3_balance: latest.investment3_balance || view.investments.goals[2]?.balance || 0,
    })
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    await upsertSnapshot({
      month: form.month,
      emergency_balance: Number(form.emergency_balance) || 0,
      investment1_balance: Number(form.investment1_balance) || 0,
      investment2_balance: Number(form.investment2_balance) || 0,
      investment3_balance: Number(form.investment3_balance) || 0,
    })
    setSaving(false)
    setEditing(false)
  }

  const loading = snapshotsLoading || expensesLoading || investmentsLoading || allInvestmentsLoading

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">
            {view.totals.pct}% toward your savings targets
            {view.latestSnapshotLabel && (
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                {' '}
                · balances as of {view.latestSnapshotLabel}
              </span>
            )}
          </p>
        </div>
        <div className="page-header-actions">
          <MonthPicker value={month} onChange={setMonth} />
          <Btn onClick={openEditor} variant="ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} /> Update balances
          </Btn>
        </div>
      </header>

      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TabButton active={section === 'overview'} onClick={() => setSection('overview')}>
            Overview
          </TabButton>
          <TabButton active={section === 'emergency'} onClick={() => setSection('emergency')}>
            Emergency fund
          </TabButton>
          <TabButton active={section === 'investments'} onClick={() => setSection('investments')}>
            Investments
          </TabButton>
        </div>
      </Card>

      {editing && (
        <UpdateBalancesModal
          onClose={() => setEditing(false)}
          onSave={handleSave}
          saving={saving}
          form={form}
          setForm={setForm}
          emergencyCategory={emergency_category}
          investmentGoals={investment_goals}
        />
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {!view.hasSnapshots && !view.investments.hasLoggedActivity && (
            <Card style={{ marginBottom: '1rem', borderColor: 'var(--accent)', background: 'var(--accent-dim)' }}>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.5 }}>
                <strong>Balances not set yet.</strong> Tap <strong>Update balances</strong> to enter what you have saved
                today, or log activity on the{' '}
                <Link to="/investments" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Investments
                </Link>{' '}
                tab — imported statements can fill in progress automatically.
              </p>
              <Btn onClick={openEditor} size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} /> Update balances
              </Btn>
            </Card>
          )}

          {!view.hasSnapshots && view.investments.hasLoggedActivity && (
            <Card style={{ marginBottom: '1rem', background: 'var(--surface2)' }}>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                Progress below is pulled from your <strong>{view.investments.transactionCount}</strong> logged investment
                {view.investments.transactionCount === 1 ? '' : 's'} on the Investments tab
                {view.investments.usesLoggedBalances ? ' (statement balances or net activity)' : ''}. Tap{' '}
                <strong>Update balances</strong> anytime to override with exact totals from your apps.
              </p>
            </Card>
          )}

          {section === 'overview' ? (
        <>
          <Card style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PiggyBank size={28} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Total saved</div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>UGX {fmt(view.totals.saved)}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  of UGX {fmt(view.totals.target)} combined target ({view.totals.pct}%)
                </div>
              </div>
            </div>
            <ProgressBar
              value={view.totals.saved}
              max={Math.max(1, view.totals.target)}
              color="var(--accent)"
              height={12}
              showPct
            />
          </Card>

          <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
            <MetricCard
              label={`Set aside (${view.focusMonthLabel})`}
              value={view.totals.contributedThisMonth}
              sub={`Plan: UGX ${fmt(view.totals.combinedMonthlyBudget)}/mo`}
              color="var(--green)"
            />
            <MetricCard
              label="Emergency fund"
              value={view.emergency.pct}
              prefix=""
              sub={`UGX ${fmt(view.emergency.balance)} saved`}
              color="var(--green)"
            />
            <MetricCard
              label="Investment goals"
              value={view.investments.totalPct}
              prefix=""
              sub={`UGX ${fmt(view.investments.totalBalance)} saved`}
              color="var(--accent)"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Shield size={18} style={{ color: 'var(--green)' }} />
                <SectionTitle style={{ margin: 0 }}>Emergency fund</SectionTitle>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{view.emergency.pct}%</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 10px' }}>
                UGX {fmt(view.emergency.balance)} of UGX {fmt(view.emergency.target)}
              </div>
              <ProgressBar value={view.emergency.balance} max={Math.max(1, view.emergency.target)} color="var(--green)" height={8} />
              <button type="button" onClick={() => setSection('emergency')} className="spending-profile-link" style={{ marginTop: 12, display: 'inline-flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                View details <ChevronRight size={14} />
              </button>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
                <SectionTitle style={{ margin: 0 }}>Investments</SectionTitle>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{view.investments.totalPct}%</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 10px' }}>
                UGX {fmt(view.investments.totalBalance)} of UGX {fmt(view.investments.totalTarget)}
              </div>
              <ProgressBar
                value={view.investments.totalBalance}
                max={Math.max(1, view.investments.totalTarget)}
                color="var(--accent)"
                height={8}
              />
              <button type="button" onClick={() => setSection('investments')} className="spending-profile-link" style={{ marginTop: 12, display: 'inline-flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                View goals <ChevronRight size={14} />
              </button>
            </Card>
          </div>

          {view.chartData.length > 1 && (
            <Card>
              <SectionTitle>Balance history</SectionTitle>
              <div className="chart-wrap chart-wrap--line">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={view.chartData}>
                    <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: 'var(--muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`}
                    />
                    <Tooltip formatter={(v) => `UGX ${fmt(v)}`} />
                    <Line type="monotone" dataKey="Emergency" name="Emergency" stroke="var(--green)" strokeWidth={2} dot={false} />
                    {view.chartGoalLabels.map((label, i) => (
                      <Line
                        key={label}
                        type="monotone"
                        dataKey={label}
                        name={label}
                        stroke={GOAL_COLORS[i % GOAL_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      ) : section === 'emergency' ? (
        <>
          <Card style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <Shield size={22} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <SectionTitle style={{ marginBottom: 4 }}>{view.emergency.category}</SectionTitle>
                <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                  {view.emergency.pct >= 100
                    ? 'Your safety net is fully funded. Keep the balance somewhere easy to access.'
                    : view.emergency.gap > 0
                      ? `You're UGX ${fmt(view.emergency.gap)} away from your ${fmt(view.emergency.target)} safety net.`
                      : 'Set a target in Settings to track your emergency fund.'}
                </p>
              </div>
              <Badge color={view.emergency.status.color}>{view.emergency.status.label}</Badge>
            </div>
            <ProgressBar
              value={view.emergency.balance}
              max={Math.max(1, view.emergency.target)}
              color="var(--green)"
              height={14}
              showPct
            />
          </Card>

          <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
            <MetricCard label="Saved" value={view.emergency.balance} color="var(--green)" />
            <MetricCard label="Target" value={view.emergency.target} color="var(--muted)" />
            <MetricCard
              label="Still needed"
              value={view.emergency.gap}
              color={view.emergency.gap > 0 ? 'var(--amber)' : 'var(--green)'}
            />
            <MetricCard
              label="Months to target"
              value={view.emergency.monthsToTarget}
              prefix=""
              sub={
                view.emergency.monthlyBudget > 0
                  ? `at UGX ${fmt(view.emergency.monthlyBudget)}/mo from budget`
                  : 'Set budget line in Settings'
              }
              color="var(--accent)"
            />
          </div>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>This month — {view.focusMonthLabel}</SectionTitle>
            <PaceRow
              label={`Contributions to ${view.emergency.category}`}
              budgeted={view.emergency.monthlyBudget}
              actual={view.emergency.contributedThisMonth}
              color="var(--green)"
            />
            {view.emergency.contributedThisMonth > 0 && view.emergency.gap > 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0 0', lineHeight: 1.5 }}>
                At this month&apos;s pace (~UGX {fmt(view.emergency.contributedThisMonth)}/mo), you&apos;d reach your
                target in about {view.emergency.monthsAtThisPace} month{view.emergency.monthsAtThisPace === 1 ? '' : 's'}.
              </p>
            )}
            <Link to="/expenses" className="spending-profile-link" style={{ marginTop: 14, display: 'inline-flex' }}>
              Log on Expenses <ChevronRight size={14} />
            </Link>
          </Card>

          <Card>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Target and monthly budget come from{' '}
              <Link to="/settings" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Settings
              </Link>
              . Update balances when you check your savings account — contributions logged on Expenses show how much you
              added this month.
            </p>
          </Card>
        </>
      ) : (
        <>
          <Card style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <Target size={22} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <SectionTitle style={{ marginBottom: 4 }}>Long-term investment goals</SectionTitle>
                <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                  UGX {fmt(view.investments.totalBalance)} saved across {investment_goals.length} goals —{' '}
                  {view.investments.totalPct}% of your combined target.
                </p>
              </div>
            </div>
            <ProgressBar
              value={view.investments.totalBalance}
              max={Math.max(1, view.investments.totalTarget)}
              color="var(--accent)"
              height={14}
              showPct
            />
          </Card>

          <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
            <MetricCard label="Total saved" value={view.investments.totalBalance} color="var(--accent)" />
            <MetricCard label="Combined target" value={view.investments.totalTarget} color="var(--muted)" />
            <MetricCard label="Remaining" value={view.investments.totalGap} color="var(--amber)" />
            <MetricCard
              label={`Added (${view.focusMonthLabel})`}
              value={view.investments.contributedThisMonth}
              sub={
                view.investments.fromStatements > 0
                  ? `Expenses UGX ${fmt(view.investments.fromExpenses)} + statements UGX ${fmt(view.investments.fromStatements)}`
                  : `Budget plan UGX ${fmt(view.investments.monthlyBudget)}/mo`
              }
              color="var(--green)"
            />
          </div>

          {view.investments.hasLoggedActivity && (
            <Card style={{ marginBottom: '1.5rem' }}>
              <SectionTitle>Logged on Investments tab</SectionTitle>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                {view.investments.transactionCount} transaction{view.investments.transactionCount === 1 ? '' : 's'} total
                {view.investments.statementBalance != null && (
                  <span>
                    {' '}
                    · latest statement balance UGX {fmt(view.investments.statementBalance)}
                  </span>
                )}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {view.investments.recentActivity.map((tx, i) => {
                  const signed = txDisplayAmount(tx)
                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 13,
                        padding: '10px 0',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{tx.description?.trim() || tx.asset}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {tx.date} · {TX_LABELS[tx.tx_type] || tx.tx_type}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: signed >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                        {signed >= 0 ? '+' : '−'} UGX {fmt(Math.abs(signed))}
                      </span>
                    </div>
                  )
                })}
              </div>
              <Link to="/investments" className="spending-profile-link" style={{ marginTop: 12, display: 'inline-flex' }}>
                Open Investments <ChevronRight size={14} />
              </Link>
            </Card>
          )}

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Your goals</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
              {view.investments.goals.map((goal, i) => (
                <GoalCard
                  key={goal.label}
                  goal={goal}
                  color={GOAL_COLORS[i % GOAL_COLORS.length]}
                  contributedHint={
                    i === 0 && view.investments.contributedThisMonth > 0
                      ? `This month: UGX ${fmt(view.investments.contributedThisMonth)} toward investments (shared across goals).`
                      : null
                  }
                />
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom: '1.5rem' }}>
            <SectionTitle>Monthly savings plan</SectionTitle>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Suggested monthly amounts to reach each target from where you are today.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {view.investments.goals.map((goal, i) => (
                <div
                  key={goal.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{goal.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      UGX {fmt(goal.gap)} left · {goal.years} years
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                      UGX {fmt(goal.monthlyNeeded)}
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>/mo</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <Link to="/investments" className="spending-profile-link">
                Import investment statements <ChevronRight size={14} />
              </Link>
              <Link to="/expenses" className="spending-profile-link">
                Log on Expenses <ChevronRight size={14} />
              </Link>
              <Link to="/settings" className="spending-profile-link">
                Edit goal targets <ChevronRight size={14} />
              </Link>
            </div>
          </Card>
        </>
      )}
        </>
      )}
    </div>
  )
}
