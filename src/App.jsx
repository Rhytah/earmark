import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsProvider'
import Nav from './components/Nav'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Gym from './pages/Gym'
import Goals from './pages/Goals'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

import './index.css'

function resolveInitialTheme() {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
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
      <SettingsProvider>
        <div className="app-shell">
          <Nav theme={theme} onToggleTheme={toggleTheme} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/gym" element={<Gym />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </SettingsProvider>
    </BrowserRouter>
  )
}
