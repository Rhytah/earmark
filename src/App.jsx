import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsProvider'
import Nav from './components/Nav'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Gym from './pages/Gym'
import Goals from './pages/Goals'
import Settings from './pages/Settings'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <div className="app-shell">
          <Nav />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/gym" element={<Gym />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </SettingsProvider>
    </BrowserRouter>
  )
}
