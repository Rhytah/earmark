/** App origin used for Supabase email confirmation / OAuth redirects. */
export function getAppUrl() {
  const fromEnv = import.meta.env.VITE_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
