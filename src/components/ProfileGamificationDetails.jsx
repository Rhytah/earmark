import { Card, SectionTitle } from './UI'

export default function ProfileGamificationDetails({ game }) {
  if (!game?.hasData) return null

  return (
    <>
      <Card className="profile-page-panel">
        <SectionTitle>Your stats</SectionTitle>
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
          {game.unlockedBadgeCount} of {game.badges.length} unlocked
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
              {!badge.unlocked && <span className="profile-page-badge-hint">{badge.hint}</span>}
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
