import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { fmt } from '../lib/constants'
import { Card, SectionTitle } from './UI'

const CONFIDENCE_COLOR = {
  high: 'var(--green)',
  medium: 'var(--amber)',
  low: 'var(--muted)',
}

export default function SpendingProfile({ profile, compact = false }) {
  if (!profile) return null

  if (!profile.hasData) {
    return (
      <Card style={{ marginBottom: compact ? 0 : '1.5rem' }}>
        <SectionTitle>Spending habits</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{profile.insights[0]}</p>
        {profile.tips?.[0] && (
          <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8, marginBottom: 0 }}>{profile.tips[0].text}</p>
        )}
      </Card>
    )
  }

  const { archetype, confidence, metrics, categoryShares, weekdayPattern, paymentMix, topMerchants, tips, dataQuality, insights, budgetAdherence, trends } = profile
  const maxWeekday = Math.max(...weekdayPattern.map((d) => d.amount), 1)

  if (compact) {
    return (
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div>
            <SectionTitle style={{ marginBottom: 4 }}>Spending profile</SectionTitle>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{archetype.label}</div>
          </div>
          <span className="spending-profile-confidence" style={{ color: CONFIDENCE_COLOR[confidence.level] }}>
            {confidence.label}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          {insights[1] || archetype.summary}
        </p>
        {tips[0] && (
          <p style={{ fontSize: 12, color: 'var(--amber)', margin: '0 0 12px', lineHeight: 1.45 }}>{tips[0].text}</p>
        )}
        <Link to="/reports" className="spending-profile-link">
          Full profile & trends <ChevronRight size={14} />
        </Link>
      </Card>
    )
  }

  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <SectionTitle style={{ marginBottom: 0 }}>Spending habits profile</SectionTitle>
        <span className="spending-profile-confidence" style={{ color: CONFIDENCE_COLOR[confidence.level] }}>
          {confidence.label}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
        {expensesSummary(metrics)} · {metrics.mappedShare}% mapped to budget
      </p>

      <div className="spending-profile-hero">
        <div>
          <div className="spending-profile-label">{archetype.label}</div>
          <p className="spending-profile-summary">{archetype.summary}</p>
        </div>
        <div className="spending-profile-stats">
          <div>
            <span className="spending-profile-stat-value">{metrics.adherenceScore ?? '—'}{metrics.adherenceScore != null ? '%' : ''}</span>
            <span className="spending-profile-stat-label">budget on-track</span>
          </div>
          <div>
            <span className="spending-profile-stat-value">{metrics.savingsRate != null ? `${metrics.savingsRate}%` : '—'}</span>
            <span className="spending-profile-stat-label">salary retained</span>
          </div>
          <div>
            <span className="spending-profile-stat-value">{metrics.transactionsPerMonth}</span>
            <span className="spending-profile-stat-label">expenses / mo</span>
          </div>
        </div>
      </div>

      {dataQuality.length > 0 && (
        <ul className="spending-profile-quality">
          {dataQuality.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}

      {tips.length > 0 && (
        <div className="spending-profile-tips">
          <div className="spending-profile-panel-title">Suggested actions</div>
          <ul>
            {tips.map((tip) => (
              <li key={tip.text}>{tip.text}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="spending-profile-grid">
        <div className="spending-profile-panel">
          <div className="spending-profile-panel-title">Needs / wants / savings</div>
          <div className="spending-profile-split">
            <div style={{ flex: metrics.needsShare }}>
              <div className="spending-profile-bar" style={{ background: 'var(--teal)' }} />
              <span>Needs {metrics.needsShare}%</span>
            </div>
            <div style={{ flex: metrics.wantsShare }}>
              <div className="spending-profile-bar" style={{ background: 'var(--amber)' }} />
              <span>Wants {metrics.wantsShare}%</span>
            </div>
            <div style={{ flex: Math.max(metrics.savingsShare, 1) }}>
              <div className="spending-profile-bar" style={{ background: 'var(--green)' }} />
              <span>Savings {metrics.savingsShare}%</span>
            </div>
          </div>
        </div>

        <div className="spending-profile-panel">
          <div className="spending-profile-panel-title">Busiest days</div>
          <div className="spending-profile-weekdays">
            {weekdayPattern.map((d) => (
              <div key={d.day} className="spending-profile-weekday">
                <div
                  className="spending-profile-weekday-bar"
                  style={{ height: `${Math.max(8, (d.amount / maxWeekday) * 100)}%` }}
                  title={`UGX ${fmt(d.amount)}`}
                />
                <span>{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {trends.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="spending-profile-panel-title">Rolling trends (3 mo vs prior 3 mo)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {trends.map((t) => (
              <div key={t.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{t.category}</span>
                <span style={{ color: t.changePct > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                  {t.changePct > 0 ? '+' : ''}{t.changePct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {budgetAdherence.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="spending-profile-panel-title">Budget adherence</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {budgetAdherence.map((row) => (
              <div key={row.category} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color || 'var(--muted)' }} />
                <span style={{ flex: 1 }}>{row.category}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  UGX {fmt(row.monthlyAvg)} / {fmt(row.budgetAmount)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: row.status === 'over' ? 'var(--red)' : row.status === 'under' ? 'var(--green)' : 'var(--muted)',
                  }}
                >
                  {row.status === 'over' ? 'Over' : row.status === 'under' ? 'Under' : 'On track'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {categoryShares.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="spending-profile-panel-title">Category mix</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {categoryShares.map((c) => (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color || 'var(--muted)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                  {c.category}
                  {!c.mapped && <span style={{ color: 'var(--amber)', fontSize: 11, marginLeft: 6 }}>unmapped</span>}
                </span>
                <span style={{ color: 'var(--muted)' }}>{c.pct}%</span>
                <strong>UGX {fmt(c.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {(paymentMix.length > 0 || topMerchants.length > 0) && (
        <div className="spending-profile-grid" style={{ marginTop: 14 }}>
          {paymentMix.length > 0 && (
            <div className="spending-profile-panel">
              <div className="spending-profile-panel-title">Payment methods</div>
              {paymentMix.map((p) => (
                <div key={p.method} className="spending-profile-row">
                  <span>{p.method}</span>
                  <span>{p.pct}% · UGX {fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
          {topMerchants.length > 0 && (
            <div className="spending-profile-panel">
              <div className="spending-profile-panel-title">Top merchants</div>
              {topMerchants.map((m) => (
                <div key={m.name} className="spending-profile-row">
                  <span>{m.name}</span>
                  <span>{m.count}× · UGX {fmt(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {insights.length > 0 && (
        <ul className="spending-profile-insights">
          {insights.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function expensesSummary(metrics) {
  return `${metrics.monthCount} month${metrics.monthCount === 1 ? '' : 's'} · avg UGX ${fmt(metrics.avgMonthlySpend)}/mo`
}
