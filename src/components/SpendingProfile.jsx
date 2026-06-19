import { fmt } from '../lib/constants'
import { Card, SectionTitle } from './UI'

export default function SpendingProfile({ profile }) {
  if (!profile) return null

  if (!profile.hasData) {
    return (
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Spending habits</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{profile.insights[0]}</p>
      </Card>
    )
  }

  const { archetype, metrics, categoryShares, weekdayPattern, paymentMix, topMerchants, insights } = profile
  const maxWeekday = Math.max(...weekdayPattern.map((d) => d.amount), 1)

  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <SectionTitle>Spending habits profile</SectionTitle>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
        Based on your logged and synced expenses in the selected report range.
      </p>

      <div className="spending-profile-hero">
        <div>
          <div className="spending-profile-label">{archetype.label}</div>
          <p className="spending-profile-summary">{archetype.summary}</p>
        </div>
        <div className="spending-profile-stats">
          <div>
            <span className="spending-profile-stat-value">{metrics.transactionsPerMonth}</span>
            <span className="spending-profile-stat-label">expenses / mo</span>
          </div>
          <div>
            <span className="spending-profile-stat-value">{metrics.savingsRate != null ? `${metrics.savingsRate}%` : '—'}</span>
            <span className="spending-profile-stat-label">salary retained</span>
          </div>
          <div>
            <span className="spending-profile-stat-value">{metrics.weekendShare}%</span>
            <span className="spending-profile-stat-label">weekend spend</span>
          </div>
        </div>
      </div>

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

      {categoryShares.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="spending-profile-panel-title">Category mix</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {categoryShares.map((c) => (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color || 'var(--muted)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{c.category}</span>
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
