// Fetches a public Google Sheet CSV export (bypasses browser CORS when needed).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing sheet URL.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) {
      return new Response(JSON.stringify({ error: 'URL must be a Google Sheets link.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(url, { redirect: 'follow' })
    const csv = await res.text()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Sheet fetch failed (${res.status}).`, details: csv.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (/<!DOCTYPE html|<html/i.test(csv)) {
      return new Response(
        JSON.stringify({
          error:
            'Sheet is not publicly readable. Use File → Share → Anyone with the link, or File → Share → Publish to web.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ csv }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
