/** Pull a user-facing message from a failed supabase.functions.invoke call. */
export async function edgeFunctionErrorMessage(error, data, fallback) {
  if (data?.error) {
    const extra = data.details ? ` ${String(data.details).slice(0, 240)}` : ''
    return String(data.error) + extra
  }

  const ctx = error?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) {
        const text = String(body.error)
        if (/invalid x-api-key|authentication_error/i.test(String(body.details || text))) {
          return 'Anthropic API key is invalid. Update it with: supabase secrets set ANTHROPIC_API_KEY=your_key'
        }
        const extra = body.details ? ` ${String(body.details).slice(0, 240)}` : ''
        return text + extra
      }
    } catch {
      // ignore parse errors
    }
  }

  const msg = String(error?.message || '')
  if (/non-2xx|status code|failed to send/i.test(msg)) {
    return fallback
  }
  return msg || fallback
}
