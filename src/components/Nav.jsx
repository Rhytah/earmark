import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, TrendingUp, Settings, PieChart, Moon, Sun, Landmark, LogOut, Activity } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { useAuth } from '../context/useAuth'
import { enabledTrackers, getTrackerIcon } from '../lib/trackers'

const coreLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/goals', icon: TrendingUp, label: 'Goals' },
  { to: '/reports', icon: PieChart, label: 'Reports' },
  { to: '/investments', icon: Landmark, label: 'Investments' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Nav({ theme, onToggleTheme }) {
  const { settings } = useAppSettings()
  const { user, signOut } = useAuth()
  const email = user?.email ?? ''

  const links = useMemo(() => {
    const trackers = enabledTrackers(settings.trackers)
    const trackerLinks =
      trackers.length === 1
        ? [
            {
              to: `/trackers/${trackers[0].id}`,
              icon: getTrackerIcon(trackers[0].icon),
              label: trackers[0].label,
            },
          ]
        : trackers.length > 1
          ? [{ to: '/trackers', icon: Activity, label: 'Trackers' }]
          : []

    return [
      coreLinks[0],
      coreLinks[1],
      ...trackerLinks,
      ...coreLinks.slice(2),
    ]
  }, [settings.trackers])

  return (
    <>
      <nav className="nav-sidebar" aria-label="Main navigation">
        <div className="nav-brand">
          <span className="nav-brand-mark" aria-hidden>
            💰
          </span>
          <span className="nav-brand-title">{settings.app_title}</span>
        </div>
        {links.map((item) => {
          const LinkIcon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              <LinkIcon size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          )
        })}
        <div className="nav-sidebar-footer">
          {email && <div className="nav-user-email" title={email}>{email}</div>}
          <button
            type="button"
            className="nav-theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            type="button"
            className="nav-sign-out"
            onClick={() => void signOut()}
            aria-label="Sign out"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </nav>

      <nav className="nav-bottom" aria-label="Mobile navigation">
        {links.map((item) => {
          const LinkIcon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-bottom-link nav-bottom-link-active' : 'nav-bottom-link'
              }
            >
              <LinkIcon size={22} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className="nav-bottom-theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={22} strokeWidth={2} /> : <Moon size={22} strokeWidth={2} />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </>
  )
}
