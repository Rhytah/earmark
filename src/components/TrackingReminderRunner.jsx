import { useTrackingReminders } from '../lib/useTrackingReminders'

/** Runs tracking reminder checks while the app is open. */
export default function TrackingReminderRunner() {
  useTrackingReminders()
  return null
}
