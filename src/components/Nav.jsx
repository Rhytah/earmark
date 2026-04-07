import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, Dumbbell, TrendingUp, Settings } from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/gym', icon: Dumbbell, label: 'Gym' },
  { to: '/goals', icon: TrendingUp, label: 'Goals' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Nav() {
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
      </nav>
    </>
  )
}
