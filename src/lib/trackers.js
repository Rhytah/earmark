import {
  Activity,
  BookOpen,
  Brain,
  Coffee,
  Dumbbell,
  Heart,
  Music,
  Utensils,
} from 'lucide-react'

export const TRACKER_ICON_OPTIONS = [
  { id: 'dumbbell', label: 'Fitness', Icon: Dumbbell },
  { id: 'heart', label: 'Health', Icon: Heart },
  { id: 'book', label: 'Reading', Icon: BookOpen },
  { id: 'brain', label: 'Mindfulness', Icon: Brain },
  { id: 'coffee', label: 'Coffee', Icon: Coffee },
  { id: 'music', label: 'Music', Icon: Music },
  { id: 'food', label: 'Meals', Icon: Utensils },
  { id: 'activity', label: 'Activity', Icon: Activity },
]

const ICON_BY_ID = Object.fromEntries(TRACKER_ICON_OPTIONS.map((o) => [o.id, o.Icon]))

export function getTrackerIcon(iconId) {
  return ICON_BY_ID[iconId] || Activity
}

export const TRACKER_PRESETS = [
  {
    label: 'Gym',
    icon: 'dumbbell',
    budget_category: 'Gym',
    unit_cost: 15_000,
    target_per_week: 3,
    unit_label: 'session',
  },
  {
    label: 'Reading',
    icon: 'book',
    budget_category: 'Subscriptions',
    unit_cost: 0,
    target_per_week: 5,
    unit_label: 'session',
  },
  {
    label: 'Meditation',
    icon: 'brain',
    budget_category: 'Dining & misc',
    unit_cost: 0,
    target_per_week: 7,
    unit_label: 'day',
  },
]

export function slugifyTrackerId(label, existingIds = []) {
  const base =
    String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tracker'
  if (!existingIds.includes(base)) return base
  let n = 2
  while (existingIds.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

function normalizeOne(raw, index) {
  const label = String(raw?.label || `Tracker ${index + 1}`).trim()
  return {
    id: String(raw?.id || slugifyTrackerId(label)).trim() || `tracker-${index}`,
    label,
    icon: TRACKER_ICON_OPTIONS.some((o) => o.id === raw?.icon) ? raw.icon : 'activity',
    enabled: raw?.enabled !== false,
    budget_category: String(raw?.budget_category || '').trim(),
    unit_cost: Math.max(0, Number(raw?.unit_cost) || 0),
    target_per_week: Math.max(1, Number(raw?.target_per_week) || 1),
    unit_label: String(raw?.unit_label || 'session').trim() || 'session',
  }
}

/** Merge DB trackers json with legacy gym_* columns when needed. */
export function normalizeTrackers(trackers, legacyRow = null) {
  if (Array.isArray(trackers) && trackers.length) {
    return trackers.map(normalizeOne)
  }
  if (legacyRow?.gym_category) {
    return [
      normalizeOne({
        id: 'gym',
        label: 'Gym',
        icon: 'dumbbell',
        enabled: true,
        budget_category: legacyRow.gym_category,
        unit_cost: legacyRow.gym_session_cost,
        target_per_week: legacyRow.gym_sessions_per_week,
        unit_label: 'session',
      }),
    ]
  }
  return []
}

export function enabledTrackers(trackers) {
  return normalizeTrackers(trackers).filter((t) => t.enabled)
}

export function findTracker(trackers, trackerId) {
  return normalizeTrackers(trackers).find((t) => t.id === trackerId) ?? null
}

/** Keep legacy gym columns populated for older DB constraints. */
export function gymLegacyFromTrackers(trackers) {
  const list = normalizeTrackers(trackers)
  const gym =
    list.find((t) => t.id === 'gym') ||
    list.find((t) => t.enabled) ||
    list[0] ||
    null
  return {
    gym_category: gym?.budget_category || 'Gym',
    gym_session_cost: gym?.unit_cost ?? 0,
    gym_sessions_per_week: gym?.target_per_week ?? 3,
  }
}

export function createTrackerFromPreset(preset, existingIds = []) {
  const id = slugifyTrackerId(preset.label, existingIds)
  return normalizeOne({ ...preset, id, enabled: true }, existingIds.length)
}

function countLogsInWeek(logs, referenceDate = new Date()) {
  const ref = new Date(referenceDate)
  const day = ref.getDay()
  const weekStart = new Date(ref)
  weekStart.setDate(ref.getDate() - day)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return logs.filter((log) => {
    const d = new Date(`${log.date}T12:00:00`)
    return d >= weekStart && d <= weekEnd
  }).length
}

/** Stats for dashboard / summary cards. */
export function computeTrackerSummary(tracker, logs, { month, budgetAmount = 0 }) {
  const count = logs.length
  const unitCost = Number(tracker.unit_cost) || 0
  const targetPerWeek = Math.max(1, Number(tracker.target_per_week) || 1)
  const unitLabel = tracker.unit_label || 'session'
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7)
  const weekCount = isCurrentMonth ? countLogsInWeek(logs) : null
  const spent = count * unitCost
  const unspent = Math.max(0, budgetAmount - spent)
  const maxUnits = unitCost > 0 && budgetAmount > 0 ? Math.floor(budgetAmount / unitCost) : null
  const weeksInMonth = 4
  const monthTarget = targetPerWeek * weeksInMonth

  return {
    count,
    weekCount,
    targetPerWeek,
    monthTarget,
    spent,
    unspent,
    maxUnits,
    unitLabel,
    isCurrentMonth,
  }
}
