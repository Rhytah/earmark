import { supabase } from './supabase'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export { DAY_LABELS }

export function normalizeTrackingReminders(raw) {
  const defaults = {
    enabled: false,
    time: '20:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    last_sent_at: null,
  }
  if (!raw || typeof raw !== 'object') return { ...defaults }

  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
    : defaults.days

  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(raw.time || '')) ? raw.time : defaults.time

  return {
    enabled: Boolean(raw.enabled),
    time,
    days: days.length ? days : defaults.days,
    last_sent_at: raw.last_sent_at ?? raw.lastSentAt ?? null,
  }
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function isReminderDay(now, days) {
  return days.includes(now.getDay())
}

export function isPastReminderTime(now, timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const reminderAt = new Date(now)
  reminderAt.setHours(h, m, 0, 0)
  return now >= reminderAt
}

export function alreadySentToday(lastSentAt, now = new Date()) {
  if (!lastSentAt) return false
  const last = new Date(lastSentAt)
  return last.toDateString() === now.toDateString()
}

export function shouldSendTrackingReminder({ reminders, hasExpenseToday, now = new Date() }) {
  const cfg = normalizeTrackingReminders(reminders)
  if (!cfg.enabled) return false
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  if (hasExpenseToday) return false
  if (!isReminderDay(now, cfg.days)) return false
  if (!isPastReminderTime(now, cfg.time)) return false
  if (alreadySentToday(cfg.last_sent_at, now)) return false
  return true
}

export function showTrackingReminder({ appTitle = 'Earmark' }) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false

  const notification = new Notification(`${appTitle} — log your spending`, {
    body: "You haven't logged an expense today. Tap to add one quickly.",
    tag: 'earmark-tracking-reminder',
    renotify: true,
  })

  notification.onclick = () => {
    window.focus()
    window.location.assign('/expenses')
    notification.close()
  }

  return true
}

export async function hasExpenseOnDate(dateStr) {
  const { count, error } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('date', dateStr)

  if (error) {
    console.error('[tracking reminder]', error.message, error)
    return false
  }
  return (count ?? 0) > 0
}

export function todayDateStr(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shouldShowInAppNudge({ reminders, hasExpenseToday }) {
  const cfg = normalizeTrackingReminders(reminders)
  if (!cfg.enabled) return false
  if (hasExpenseToday) return false
  if (!isReminderDay(new Date(), cfg.days)) return false
  return true
}
