import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { SettingsProvider } from './context/SettingsProvider'
import { useAuth } from './context/useAuth'
import Nav from './components/Nav'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Trackers from './pages/Trackers'
import TrackerDetail from './pages/TrackerDetail'
import Goals from './pages/Goals'
import Reports from './pages/Reports'
import Investments from './pages/Investments'
import Income from './pages/Income'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { Spinner } from './components/UI'
import { useGoogleSheetSync } from './lib/useGoogleSheetSync'
import TrackingReminderRunner from './components/TrackingReminderRunner'

import './index.css'

function resolveInitialTheme() {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function GoogleSheetSyncRunner() {
  useGoogleSheetSync()
  return null
}

function AppRoutes({ theme, onToggleTheme }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-page">
        <Spinner />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <SettingsProvider>
      <GoogleSheetSyncRunner />
      <TrackingReminderRunner />
      <div className="app-shell">
        <Nav theme={theme} onToggleTheme={onToggleTheme} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/income" element={<Income />} />
            <Route path="/trackers" element={<Trackers />} />
            <Route path="/trackers/:trackerId" element={<TrackerDetail />} />
            <Route path="/gym" element={<Navigate to="/trackers/gym" replace />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </SettingsProvider>
  )
}

export default function App() {
  const [theme, setTheme] = useState(resolveInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes theme={theme} onToggleTheme={toggleTheme} />
      </AuthProvider>
    </BrowserRouter>
  )
}
