import { fmt } from '../lib/constants'

export function Card({ children, style, className }) {
  const cn = className ? `ui-card ${className}` : 'ui-card'
  return (
    <div style={style} className={cn}>
      {children}
    </div>
  )
}

export function MetricCard({ label, value, sub, color, prefix = 'UGX ' }) {
  return (
    <div className="ui-metric-card">
      <div className="ui-metric-label">{label}</div>
      <div className="ui-metric-value" style={{ color: color || 'var(--text)' }}>
        {prefix}{fmt(value)}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function ProgressBar({ value, max, color = 'var(--accent)', height = 6, showPct = false }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const over = value > max
  return (
    <div>
      <div style={{ background: 'var(--border2)', borderRadius: 99, height, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Number.isFinite(pct) ? pct : 0}%`,
            background: over ? 'var(--red)' : color,
            borderRadius: 99,
            transition: 'width 0.45s var(--ease)',
          }}
        />
      </div>
      {showPct && (
        <div
          style={{
            fontSize: 11,
            color: over ? 'var(--red)' : 'var(--muted)',
            marginTop: 4,
            textAlign: 'right',
          }}
        >
          {pct}%{over ? ' over budget' : ''}
        </div>
      )}
    </div>
  )
}

export function Badge({ children, color = 'var(--accent)', bg }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg || `${color}22`,
        borderRadius: 'var(--radius-pill)',
        padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export function Btn({ children, onClick, variant = 'primary', size = 'md', style, disabled, className, type = 'button' }) {
  const cn = className ? `ui-btn ${className}` : 'ui-btn'
  const base = {
    fontWeight: 600,
    padding: size === 'sm' ? '0.45rem 0.85rem' : '0.6rem 1.15rem',
    fontSize: size === 'sm' ? 12 : 14,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...style,
  }
  const variants = {
    primary: {
      background: 'linear-gradient(165deg, #7ba3ff 0%, var(--accent) 100%)',
      color: '#fff',
      boxShadow: '0 4px 14px rgba(107, 147, 255, 0.35)',
    },
    danger: { background: 'var(--red)', color: '#fff' },
    ghost: {
      background: 'var(--surface2)',
      color: 'var(--text)',
      border: '1px solid var(--border2)',
    },
    success: {
      background: 'linear-gradient(165deg, #4ee4a0 0%, var(--green) 100%)',
      color: '#0a1620',
      boxShadow: '0 4px 14px rgba(61, 214, 140, 0.3)',
    },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cn} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  )
}

export function SectionTitle({ children, className, style }) {
  const cn = className ? `ui-section-title ${className}` : 'ui-section-title'
  return (
    <div className={cn} style={style}>
      {children}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="ui-spinner-wrap">
      <div className="ui-spinner" aria-hidden />
    </div>
  )
}

export function EmptyState({ icon, message }) {
  return (
    <div className="ui-empty">
      <div className="ui-empty-icon">{icon}</div>
      <div className="ui-empty-msg">{message}</div>
    </div>
  )
}

export function MonthPicker({ value, onChange }) {
  return (
    <input
      type="month"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="ui-month-picker"
    />
  )
}
