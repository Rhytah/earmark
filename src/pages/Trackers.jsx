import { Link } from 'react-router-dom'
import { Plus, Settings } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { enabledTrackers, getTrackerIcon } from '../lib/trackers'
import { Card, SectionTitle, Btn } from '../components/UI'

export default function Trackers() {
  const { settings } = useAppSettings()
  const trackers = enabledTrackers(settings.trackers)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Trackers</h1>
          <p className="page-subtitle">
            Log habits you care about — gym, reading, meditation, or anything else. Add or remove trackers in Settings.
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/settings">
            <Btn variant="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Settings size={16} /> Manage trackers
            </Btn>
          </Link>
        </div>
      </header>

      {trackers.length === 0 ? (
        <Card className="tracker-empty-card">
          <SectionTitle>No trackers yet</SectionTitle>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
            You have not enabled any personal trackers. Add Gym, Reading, or create your own in Settings.
          </p>
          <Link to="/settings">
            <Btn style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Add a tracker
            </Btn>
          </Link>
        </Card>
      ) : (
        <div className="tracker-card-grid">
          {trackers.map((tracker) => {
            const Icon = getTrackerIcon(tracker.icon)
            return (
              <Link key={tracker.id} to={`/trackers/${tracker.id}`} className="tracker-card-link">
                <Card className="tracker-card">
                  <div className="tracker-card-icon" aria-hidden>
                    <Icon size={22} />
                  </div>
                  <div>
                    <div className="tracker-card-title">{tracker.label}</div>
                    <div className="tracker-card-meta">
                      {tracker.target_per_week}× / week
                      {tracker.budget_category ? ` · ${tracker.budget_category}` : ''}
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
