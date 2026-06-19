import { DEFAULT_APP_SETTINGS } from './constants'
import { gymLegacyFromTrackers, normalizeTrackers } from './trackers'

export function normalizeGamification(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APP_SETTINGS.gamification }
  }

  const earned_badges = {}
  const src = raw.earned_badges || raw.earnedBadges || {}
  for (const [id, val] of Object.entries(src)) {
    if (val && typeof val === 'object') {
      const earned_at = val.earned_at || val.earnedAt || null
      if (earned_at) earned_badges[id] = { earned_at }
    }
  }

  return {
    version: 1,
    peak_xp: Math.max(0, Math.round(Number(raw.peak_xp ?? raw.peakXp) || 0)),
    earned_badges,
    updated_at: raw.updated_at ?? raw.updatedAt ?? null,
  }
}

function normalizeInvestmentGoals(goals) {
  const raw = Array.isArray(goals) ? [...goals].slice(0, 3) : []
  while (raw.length < 3) {
    const n = raw.length + 1
    raw.push({ label: `Goal ${n}`, target: 1_000_000, years: 5 })
  }
  return raw.map((g, i) => ({
    label: g?.label ?? `Goal ${i + 1}`,
    target: Math.max(1, Number(g?.target) || 1),
    years: Math.max(1, Number(g?.years) || 1),
  }))
}

export function rowToSettings(row) {
  if (!row) return { ...DEFAULT_APP_SETTINGS }
  return {
    app_title: row.app_title ?? DEFAULT_APP_SETTINGS.app_title,
    salary: Number(row.salary) || DEFAULT_APP_SETTINGS.salary,
    budget: Array.isArray(row.budget) ? row.budget : DEFAULT_APP_SETTINGS.budget,
    payment_methods: Array.isArray(row.payment_methods)
      ? row.payment_methods
      : DEFAULT_APP_SETTINGS.payment_methods,
    investment_goals: normalizeInvestmentGoals(
      Array.isArray(row.investment_goals) ? row.investment_goals : DEFAULT_APP_SETTINGS.investment_goals,
    ),
    emergency_fund_target: Number(row.emergency_fund_target) || DEFAULT_APP_SETTINGS.emergency_fund_target,
    trackers: normalizeTrackers(row.trackers, row),
    gym_session_cost: Number(row.gym_session_cost) || DEFAULT_APP_SETTINGS.gym_session_cost,
    gym_sessions_per_week: Number(row.gym_sessions_per_week) || 1,
    gym_category: row.gym_category || DEFAULT_APP_SETTINGS.gym_category,
    emergency_category: row.emergency_category || DEFAULT_APP_SETTINGS.emergency_category,
    investments_category: row.investments_category || DEFAULT_APP_SETTINGS.investments_category,
    sheet_sync_enabled: Boolean(row.sheet_sync_enabled),
    sheet_sync_url: row.sheet_sync_url ?? '',
    sheet_sync_interval_seconds: Math.max(15, Number(row.sheet_sync_interval_seconds) || 60),
    sheet_sync_last_at: row.sheet_sync_last_at ?? null,
    sheet_sync_last_error: row.sheet_sync_last_error ?? null,
    sheet_sync_last_count: Number(row.sheet_sync_last_count) || 0,
    gamification: normalizeGamification(row.gamification),
  }
}

export function settingsToRow(s, userId) {
  const trackers = normalizeTrackers(s.trackers, s)
  const gymLegacy = gymLegacyFromTrackers(trackers)
  return {
    user_id: userId,
    app_title: s.app_title,
    salary: s.salary,
    budget: s.budget,
    payment_methods: s.payment_methods,
    investment_goals: s.investment_goals,
    emergency_fund_target: s.emergency_fund_target,
    trackers,
    gym_session_cost: gymLegacy.gym_session_cost,
    gym_sessions_per_week: gymLegacy.gym_sessions_per_week,
    gym_category: gymLegacy.gym_category,
    emergency_category: s.emergency_category,
    investments_category: s.investments_category,
    sheet_sync_enabled: Boolean(s.sheet_sync_enabled),
    sheet_sync_url: String(s.sheet_sync_url || '').trim(),
    sheet_sync_interval_seconds: Math.max(15, Number(s.sheet_sync_interval_seconds) || 60),
    sheet_sync_last_at: s.sheet_sync_last_at ?? null,
    sheet_sync_last_error: s.sheet_sync_last_error ?? null,
    sheet_sync_last_count: Number(s.sheet_sync_last_count) || 0,
    gamification: normalizeGamification(s.gamification),
  }
}

export function mergeDefaults(partial) {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...partial,
    budget: partial.budget?.length ? partial.budget : DEFAULT_APP_SETTINGS.budget,
    payment_methods: partial.payment_methods?.length
      ? partial.payment_methods
      : DEFAULT_APP_SETTINGS.payment_methods,
    investment_goals: normalizeInvestmentGoals(
      partial.investment_goals?.length ? partial.investment_goals : DEFAULT_APP_SETTINGS.investment_goals,
    ),
    trackers: normalizeTrackers(partial.trackers, partial),
    gamification: normalizeGamification(partial.gamification ?? DEFAULT_APP_SETTINGS.gamification),
  }
}
