// Supabase Edge Function: insurance-analyzer
// Expects { files: [{ name, mimeType, contentBase64 }] }
// Returns { policies: [{ insurer, policyNumber, policyType, sumAssured, currency, bonuses: [{type, amount, year}] }] }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'ANTHROPIC_API_KEY is missing for insurance-analyzer function.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { files } = await req.json()
    if (!Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const content = [
      {
        type: 'text',
        text:
          'Extract insurance policy and bonus info from uploaded documents. Return STRICT JSON only with this shape: ' +
          '{"policies":[{"insurer":"","policyNumber":"","policyType":"","sumAssured":0,"currency":"UGX","startDate":null,"maturityDate":null,"premium":null,"premiumFrequency":"","status":"active","bonuses":[{"type":"","amount":0,"year":""}]}]}. ' +
          'Capture bonus certificates as bonuses under the right policy number. Use numbers as plain numeric values.',
      },
      ...files.map((f: { mimeType: string; contentBase64: string }) => ({
        type: 'document',
        source: { type: 'base64', media_type: f.mimeType || 'application/pdf', data: f.contentBase64 },
      })),
    ]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1800,
        temperature: 0.1,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return new Response(
        JSON.stringify({
          error: `Anthropic request failed (${res.status}).`,
          details: errText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const json = await res.json()
    const text = json?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '{}'
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      // If model returns prose around JSON, try to extract JSON object.
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(text.slice(start, end + 1))
        } catch {
          parsed = { policies: [] }
        }
      } else {
        parsed = { policies: [] }
      }
    }

    if (!parsed || !Array.isArray(parsed.policies)) {
      parsed = { policies: [] }
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: (e as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
