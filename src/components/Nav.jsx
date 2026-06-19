import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PieChart,
  Receipt,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useAppSettings } from '../context/useAppSettings'
import { useAuth } from '../context/useAuth'
import { enabledTrackers, getTrackerIcon } from '../lib/trackers'

const coreLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile', icon: Sparkles, label: 'Profile' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/income', icon: Wallet, label: 'Income' },
  { to: '/goals', icon: TrendingUp, label: 'Goals' },
  { to: '/investments', icon: Landmark, label: 'Investments' },
  { to: '/reports', icon: PieChart, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Nav({ theme, onToggleTheme }) {
  const { settings } = useAppSettings()
  const { user, signOut } = useAuth()
  const email = user?.email ?? ''
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

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

    return [coreLinks[0], coreLinks[1], ...trackerLinks, ...coreLinks.slice(2)]
  }, [settings.trackers])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const closeMobile = () => setMobileOpen(false)
  const openMobile = () => setMobileOpen(true)

  const navBody = (
    <>
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
            onClick={closeMobile}
          >
            <LinkIcon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        )
      })}
      <div className="nav-sidebar-footer">
        {email && (
          <div className="nav-user-email" title={email}>
            {email}
          </div>
        )}
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
        <button type="button" className="nav-sign-out" onClick={() => void signOut()} aria-label="Sign out">
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      <header className="nav-mobile-header">
        <button
          type="button"
          className="nav-mobile-menu-btn"
          onClick={mobileOpen ? closeMobile : openMobile}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
        >
          {mobileOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
        </button>
        <div className="nav-mobile-brand">
          <span className="nav-brand-mark" aria-hidden>
            💰
          </span>
          <span className="nav-brand-title">{settings.app_title}</span>
        </div>
      </header>

      <button
        type="button"
        className={`nav-mobile-backdrop${mobileOpen ? ' nav-mobile-backdrop-open' : ''}`}
        aria-label="Close menu"
        onClick={closeMobile}
        tabIndex={mobileOpen ? 0 : -1}
      />

      <nav
        id="mobile-nav-drawer"
        className={`nav-mobile-drawer${mobileOpen ? ' nav-mobile-drawer-open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
      >
        {navBody}
      </nav>

      <nav className="nav-sidebar" aria-label="Main navigation">
        {navBody}
      </nav>
    </>
  )
}
