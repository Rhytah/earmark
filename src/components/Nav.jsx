import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, Dumbbell, TrendingUp, Settings, PieChart, Moon, Sun } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/gym', icon: Dumbbell, label: 'Gym' },
  { to: '/goals', icon: TrendingUp, label: 'Goals' },
  { to: '/reports', icon: PieChart, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Nav({ theme, onToggleTheme }) {
  const { settings } = useAppSettings()

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
