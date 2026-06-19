import { Card, SectionTitle } from './UI'

export default function ProfileGamificationDetails({ game }) {
  if (!game?.hasData) return null

  return (
    <>
      <Card className="profile-page-panel">
        <SectionTitle>Your stats</SectionTitle>
        {game.xp != null && (
          <p className="profile-page-panel-desc">
            {game.xp} total XP · level {game.level} saved to your account
            {game.xpDelta > 0 ? ` · +${game.xpDelta} XP this visit` : ''}
          </p>
        )}
        <div className="profile-page-stats">
          {game.stats.map((stat) => (
            <div key={stat.key} className="profile-page-stat">
              <div className="profile-page-stat-head">
                <span>{stat.icon} {stat.label}</span>
                <strong>{stat.value}%</strong>
              </div>
              <div className="profile-page-stat-bar">
                <div
                  className="profile-page-stat-fill"
                  style={{ width: `${stat.value}%`, background: stat.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="profile-page-panel">
        <SectionTitle>Badges</SectionTitle>
        <p className="profile-page-panel-desc">
          {game.unlockedBadgeCount} of {game.badges.length} earned · synced to your account
        </p>
        <div className="profile-page-badges">
          {game.badges.map((badge) => (
            <div
              key={badge.id}
              className={`profile-page-badge${badge.unlocked ? ' profile-page-badge--unlocked' : ''}`}
              title={badge.hint}
            >
              <span className="profile-page-badge-icon">{badge.icon}</span>
              <span className="profile-page-badge-label">{badge.label}</span>
              {badge.unlocked && badge.earnedAt && (
                <span className="profile-page-badge-earned">
                  Earned {new Date(badge.earnedAt).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {!badge.unlocked && (
                <>
                  <div className="profile-page-badge-progress">
                    <div className="profile-page-badge-progress-fill" style={{ width: `${badge.progress ?? 0}%` }} />
                  </div>
                  <span className="profile-page-badge-hint">{badge.progress ?? 0}% · {badge.hint}</span>
                </>
              )}
              {badge.unlocked && !badge.currentlyMet && (
                <span className="profile-page-badge-hint">Earned — criteria not met right now</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {game.quests.length > 0 && (
        <Card className="profile-page-panel">
          <SectionTitle>Quests</SectionTitle>
          <div className="profile-page-quests">
            {game.quests.map((quest, i) => (
              <div
                key={i}
                className={`profile-page-quest${quest.done ? ' profile-page-quest--done' : ''}`}
              >
                <p>{quest.text}</p>
                <span className="profile-page-quest-reward">{quest.reward}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
