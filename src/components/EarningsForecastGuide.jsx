import { fmt } from '../lib/constants'

const STATUS_COLOR = {
  'Above target': 'var(--amber)',
  'Below target': 'var(--accent)',
  'On target': 'var(--green)',
}

const BUCKET_ACCENT = {
  needs: 'var(--teal)',
  wants: 'var(--amber)',
  savings: 'var(--green)',
}

export default function EarningsForecastGuide({ report, monthLabel, projectMonths = 3 }) {
  if (!report?.forecastGuide?.length) return null

  return (
    <div className="earnings-forecast">
      <div className="earnings-forecast-intro">
        <p>
          Income basis for {monthLabel}:{' '}
          <strong>UGX {fmt(report.income)}</strong>
          {report.incomeSource === 'logged' ? ' (logged)' : ' (expected from Settings)'}
        </p>
        {report.remaining !== 0 && (
          <p>
            {report.remaining >= 0 ? (
              <>
                UGX {fmt(report.remaining)} unallocated this month — potential room in savings or wants.
              </>
            ) : (
              <>
                Over-allocated by UGX {fmt(Math.abs(report.remaining))} — trim wants or needs to rebalance.
              </>
            )}
          </p>
        )}
      </div>

      {report.forecastGuide.map((bucket) => (
        <div key={bucket.key} className="earnings-forecast-bucket">
          <div className="earnings-forecast-bucket-head">
            <div>
              <strong style={{ color: BUCKET_ACCENT[bucket.key] }}>{bucket.label}</strong>
              <span className="earnings-forecast-target">
                Target {bucket.targetPct}% · UGX {fmt(bucket.targetAmount)}
              </span>
            </div>
            <span className="earnings-forecast-status" style={{ color: STATUS_COLOR[bucket.statusLabel] }}>
              {bucket.statusLabel}
            </span>
          </div>

          <div className="earnings-forecast-metrics">
            <div>
              <span>This month</span>
              <strong>
                UGX {fmt(bucket.actualAmount)}{' '}
                <small>({bucket.actualPct}%)</small>
              </strong>
            </div>
            <div>
              <span>{projectMonths}-mo at this pace</span>
              <strong>UGX {fmt(bucket.forecast3Mo)}</strong>
            </div>
            <div>
              <span>{projectMonths}-mo guide</span>
              <strong>UGX {fmt(bucket.target3Mo)}</strong>
            </div>
            <div>
              <span>Gap</span>
              <strong style={{ color: bucket.diff > 0 ? 'var(--amber)' : bucket.diff < 0 ? 'var(--accent)' : 'var(--green)' }}>
                {bucket.diff > 0 ? '+' : bucket.diff < 0 ? '−' : ''}
                UGX {fmt(Math.abs(bucket.diff))}
              </strong>
            </div>
          </div>

          <div className="earnings-forecast-bar-track">
            <div className="earnings-forecast-bar-target" style={{ width: `${Math.min(100, bucket.targetPct)}%` }} />
            <div
              className="earnings-forecast-bar-actual"
              style={{
                width: `${Math.min(100, bucket.actualPct)}%`,
                background: BUCKET_ACCENT[bucket.key],
              }}
            />
          </div>

          {bucket.categories.length > 0 ? (
            <div className="earnings-forecast-categories">
              {bucket.categories.map((row) => (
                <div key={row.category} className="earnings-forecast-cat-row">
                  <span className="earnings-forecast-cat-name">
                    <i style={{ background: row.color || 'var(--muted)' }} />
                    {row.category}
                  </span>
                  <span>{row.shareLabel}</span>
                  <span>{row.pctOfIncome}% of income</span>
                  <strong>UGX {fmt(row.actual)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="earnings-forecast-empty">No spending logged in this bucket for {monthLabel}.</p>
          )}

          {bucket.tip && <p className="earnings-forecast-tip">{bucket.tip}</p>}
        </div>
      ))}
    </div>
  )
}
