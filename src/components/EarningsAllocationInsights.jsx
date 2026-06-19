import { fmt } from '../lib/constants'

const STATUS_COLOR = {
  over: 'var(--red)',
  under: 'var(--accent)',
  on: 'var(--green)',
  unmapped: 'var(--amber)',
  unbudgeted: 'var(--muted)',
  none: 'var(--muted)',
}

const STATUS_LABEL = {
  over: 'Over budget',
  under: 'Under budget',
  on: 'On track',
  unmapped: 'Not in budget',
  unbudgeted: 'No budget line',
  none: '—',
}

export default function EarningsAllocationInsights({ report, monthLabel }) {
  if (!report) return null

  const allCategories = [...report.categoryRows, ...report.unmappedRows]

  return (
    <div className="earnings-allocation">
      <div className="earnings-allocation-summary">
        <div className="earnings-allocation-stat">
          <span>Income ({monthLabel})</span>
          <strong style={{ color: 'var(--green)' }}>UGX {fmt(report.income)}</strong>
          <small>
            {report.incomeSource === 'logged'
              ? `${report.incomeBySource.length} logged inflow${report.incomeBySource.length === 1 ? '' : 's'}`
              : report.incomeSource === 'expected'
                ? 'Expected from Settings'
                : 'Not set'}
          </small>
        </div>
        <div className="earnings-allocation-stat">
          <span>Spent + invested</span>
          <strong>UGX {fmt(report.totalAllocated)}</strong>
          <small>{report.allocationPct}% of income</small>
        </div>
        <div className="earnings-allocation-stat">
          <span>{report.remaining >= 0 ? 'Remaining' : 'Over by'}</span>
          <strong style={{ color: report.remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
            UGX {fmt(Math.abs(report.remaining))}
          </strong>
          <small>{report.remaining >= 0 ? 'Unallocated' : 'Above income'}</small>
        </div>
      </div>

      {report.incomeBySource.length > 0 && (
        <div className="earnings-allocation-income-list">
          {report.incomeBySource.map((row) => (
            <div key={row.source} className="earnings-allocation-income-row">
              <span>{row.source}</span>
              <span>+ UGX {fmt(row.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="earnings-allocation-buckets">
        {report.buckets.map((bucket) => (
          <div key={bucket.key} className="earnings-allocation-bucket">
            <div className="earnings-allocation-bucket-head">
              <span>{bucket.label}</span>
              <span style={{ color: STATUS_COLOR[bucket.status] || 'var(--text)' }}>
                {bucket.actualPct}% / {bucket.targetPct}% target
              </span>
            </div>
            <div className="earnings-allocation-bar-track">
              <div
                className="earnings-allocation-bar-target"
                style={{ width: `${Math.min(100, bucket.targetPct)}%` }}
              />
              <div
                className="earnings-allocation-bar-actual"
                style={{
                  width: `${Math.min(100, bucket.actualPct)}%`,
                  background:
                    bucket.status === 'over'
                      ? 'var(--red)'
                      : bucket.status === 'under'
                        ? 'var(--accent)'
                        : 'var(--green)',
                }}
              />
            </div>
            <div className="earnings-allocation-bucket-foot">
              <span>UGX {fmt(bucket.actualAmount)} actual</span>
              <span>Target UGX {fmt(bucket.targetAmount)}</span>
            </div>
          </div>
        ))}
      </div>

      {allCategories.length > 0 && (
        <div className="earnings-allocation-categories">
          <div className="earnings-allocation-categories-head">
            <span>Category</span>
            <span>Budget</span>
            <span>Actual</span>
            <span>% income</span>
            <span>Status</span>
          </div>
          {allCategories.map((row) => (
            <div key={row.category} className="earnings-allocation-category-row">
              <span className="earnings-allocation-cat-name">
                <i style={{ background: row.color || 'var(--muted)' }} />
                {row.category}
              </span>
              <span>{row.budgetAmount > 0 ? fmt(row.budgetAmount) : '—'}</span>
              <span style={{ fontWeight: 600 }}>{fmt(row.actual)}</span>
              <span>{row.pctOfIncome}%</span>
              <span style={{ color: STATUS_COLOR[row.status], fontSize: 11, fontWeight: 600 }}>
                {STATUS_LABEL[row.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {report.insights.length > 0 && (
        <ul className="earnings-allocation-insights">
          {report.insights.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
