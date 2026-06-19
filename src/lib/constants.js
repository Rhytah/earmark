/** Default app configuration (used until DB row exists and as fallback). */
export const DEFAULT_APP_SETTINGS = {
  app_title: 'My Budget',
  salary: 3_000_000,
  extra_income: [],
  budget: [
    { category: 'Groceries', amount: 400_000, type: 'variable', color: '#ff8c5a' },
    { category: 'Housing & utilities', amount: 800_000, type: 'fixed', color: '#3dbe7a' },
    { category: 'Transport', amount: 250_000, type: 'fixed', color: '#38bdf8' },
    { category: 'Gym', amount: 200_000, type: 'fixed', color: '#a78bfa' },
    { category: 'Subscriptions', amount: 150_000, type: 'fixed', color: '#f472b6' },
    { category: 'Dining & misc', amount: 150_000, type: 'variable', color: '#ffb347' },
    { category: 'Emergency fund', amount: 400_000, type: 'savings', color: '#3dbe7a' },
    { category: 'Investments', amount: 300_000, type: 'savings', color: '#5b8cff' },
  ],
  payment_methods: ['Card', 'Cash', 'Bank transfer', 'Mobile money'],
  investment_goals: [
    { label: 'Long-term goal 1', target: 10_000_000, years: 5 },
    { label: 'Long-term goal 2', target: 25_000_000, years: 7 },
    { label: 'Long-term goal 3', target: 50_000_000, years: 10 },
  ],
  emergency_fund_target: 10_000_000,
  gym_session_cost: 0,
  gym_sessions_per_week: 3,
  gym_category: 'Gym',
  trackers: [],
  emergency_category: 'Emergency fund',
  investments_category: 'Investments',
  sheet_sync_enabled: false,
  sheet_sync_url: '',
  sheet_sync_interval_seconds: 60,
  sheet_sync_last_at: null,
  sheet_sync_last_error: null,
  sheet_sync_last_count: 0,
  gamification: {
    version: 1,
    peak_xp: 0,
    earned_badges: {},
    updated_at: null,
  },
  tracking_reminders: {
    enabled: false,
    time: '20:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    last_sent_at: null,
  },
}

export function budgetLineAmount(budget, categoryName) {
  const line = budget?.find((b) => b.category === categoryName)
  return line ? Number(line.amount) : 0
}

export const fmt = (n) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', maximumFractionDigits: 0 }).format(n)

export const fmtUGX = (n) => `UGX ${fmt(n)}`

export const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
