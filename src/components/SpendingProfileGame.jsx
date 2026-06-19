import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { Card } from './UI'

function ProgressRing({ value, label }) {
  const size = 76
  const stroke = 7
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  const offset = circ - (pct / 100) * circ

  return (
    <div className="profile-game-ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="profile-game-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="profile-game-ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="profile-game-ring-label">
        <strong>{pct}%</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

const ARCHETYPE_BUDDY = {
  planner: '✨',
  essentials: '🏡',
  lifestyle: '🛍️',
  focused: '🔮',
  frequent: '💫',
  stretched: '🌤️',
  balanced: '🌿',
}

export default function SpendingProfileGame({ profile, game, compact = false, fullPage = false }) {
  const { settings } = useAppSettings()
  const displayName = settings.app_title?.trim() || 'You'

  if (!game) return null

  if (compact) {
    return (
      <Card className="profile-teaser">
        <div className="profile-teaser-main">
          <span className="profile-teaser-avatar" aria-hidden>
            {game.hasData ? game.avatar : '🐣'}
          </span>
          <div className="profile-teaser-body">
            {game.hasData ? (
              <>
                <div className="profile-teaser-kicker">
                  Lv {game.level} · {game.levelTitle}
                </div>
                <div className="profile-teaser-title">
                  {game.archetypeLabel || 'Your spending profile'}
                </div>
                <p className="profile-teaser-copy">
                  {profile?.insights?.[1] || game.quests[0]?.text || 'See your habits, badges, and quests.'}
                </p>
              </>
            ) : (
              <>
                <div className="profile-teaser-title">Unlock your profile</div>
                <p className="profile-teaser-copy">{game.quests[0]?.text}</p>
              </>
            )}
          </div>
        </div>
        <Link to="/profile" className="profile-teaser-link">
          Open profile <ChevronRight size={16} />
        </Link>
      </Card>
    )
  }

  if (!game.hasData) {
    return (
      <Card className={`profile-game profile-game--empty${fullPage ? ' profile-game--page' : ''}`}>
        <div className="profile-game-hero">
          <div className="profile-game-blobs" aria-hidden>
            <span className="profile-game-blob profile-game-blob--a">🐣</span>
            <span className="profile-game-blob profile-game-blob--b">💰</span>
          </div>
        </div>
        <div className="profile-game-intro">
          <p className="profile-game-subtitle">Your money journey</p>
          <h2 className="profile-game-name">Hi, {displayName}</h2>
          <p className="profile-game-tagline">Log expenses to unlock your soft-spending profile and level up.</p>
        </div>
        <div className="profile-game-inner">
          <p className="profile-game-copy">{game.quests[0]?.text}</p>
          <Link to="/expenses" className="profile-game-btn">
            Start tracking <ChevronRight size={16} />
          </Link>
        </div>
      </Card>
    )
  }

  const xpPct = Math.min(100, Math.round((game.xpInLevel / game.xpToNext) * 100))
  const buddy = ARCHETYPE_BUDDY[profile?.archetype?.id] || '✨'
  const budgetStat = game.stats.find((s) => s.key === 'budget')
  const savingsStat = game.stats.find((s) => s.key === 'savings')
  const activeQuest = game.quests.find((q) => !q.done) || game.quests[0]
  const insightText =
    profile?.insights?.[1] ||
    game.archetypeSummary ||
    'You are building healthier money habits one expense at a time.'

  return (
    <Card className={`profile-game profile-game--${profile?.archetype?.id || 'balanced'}${fullPage ? ' profile-game--page' : ''}`}>
      <div className="profile-game-hero">
        <div className="profile-game-blobs" aria-hidden>
          <span className="profile-game-blob profile-game-blob--a">{game.avatar}</span>
          <span className="profile-game-blob profile-game-blob--b">{buddy}</span>
        </div>
      </div>

      <div className="profile-game-intro">
        <p className="profile-game-subtitle">{game.levelTitle}</p>
        <h2 className="profile-game-name">{displayName}</h2>
        <p className="profile-game-tagline">{game.archetypeLabel}</p>
      </div>

      <div className="profile-game-inner">
        <p className="profile-game-copy">{insightText}</p>
        <div className="profile-game-level-row">
          <span className="profile-game-level-pill">Lv {game.level}</span>
          <div className="profile-game-xp-track">
            <div className="profile-game-xp-fill" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="profile-game-xp-pct">{xpPct}%</span>
        </div>
      </div>

      <div className="profile-game-highlight">
        <ProgressRing value={budgetStat?.value ?? 0} label="on track" />
        <div className="profile-game-highlight-body">
          <p className="profile-game-highlight-title">
            {activeQuest?.done ? 'Nice work this month' : 'Your next gentle nudge'}
          </p>
          <p className="profile-game-highlight-text">{activeQuest?.text}</p>
          {!fullPage && (
            <Link to="/profile" className="profile-game-btn profile-game-btn--soft">
              Open profile <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </div>

      <div className="profile-game-tiles">
        <div className="profile-game-tile profile-game-tile--wide">
          <span className="profile-game-tile-icon">📅</span>
          <div>
            <strong>{profile?.metrics?.monthCount ?? 0}/{Math.max(profile?.metrics?.monthCount ?? 0, 6)}</strong>
            <span>Months tracked</span>
          </div>
        </div>
        <div className="profile-game-tile">
          <span className="profile-game-tile-icon">🔥</span>
          <div>
            <strong>{game.unlockedBadgeCount}</strong>
            <span>Badges</span>
          </div>
        </div>
        <div className="profile-game-tile">
          <span className="profile-game-tile-icon">⚡</span>
          <div>
            <strong>{savingsStat?.value ?? 0}%</strong>
            <span>Savings power</span>
          </div>
        </div>
      </div>

      {!fullPage && game.badges.some((b) => b.unlocked) && (
        <div className="profile-game-chips">
          {game.badges
            .filter((b) => b.unlocked)
            .map((badge) => (
              <span key={badge.id} className="profile-game-chip" title={badge.hint}>
                {badge.icon} {badge.label}
              </span>
            ))}
        </div>
      )}
    </Card>
  )
}
