// Reads receipt images/PDFs and returns structured expense fields.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseJsonFromText(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({
          error: 'ANTHROPIC_API_KEY is missing. Set it in Supabase Edge Function secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { file, categories = [], paymentMethods = [] } = await req.json()
    if (!file?.contentBase64) {
      return new Response(JSON.stringify({ error: 'No receipt file provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mimeType = file.mimeType || 'image/jpeg'
    const isPdf = mimeType === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf')
    const catList = Array.isArray(categories) ? categories.filter(Boolean).join(', ') : ''
    const payList = Array.isArray(paymentMethods) ? paymentMethods.filter(Boolean).join(', ') : ''

    const prompt =
      'Extract one expense from this receipt. Return STRICT JSON only with this shape: ' +
      '{"expense":{"date":"YYYY-MM-DD","amount":0,"description":"","category":"","payment_method":"","currency":"UGX"},"confidence":"high|medium|low","notes":""}. ' +
      'Rules: amount is the total paid as a plain number (no commas). date is the transaction date in ISO format. ' +
      'description is the merchant or short summary. ' +
      (catList ? `category MUST be one of: ${catList}. Pick the closest match.` : 'category is your best guess for the purchase type.') +
      (payList ? ` payment_method MUST be one of: ${payList}. Guess from card/cash/mobile hints.` : '') +
      ' If unsure, use empty strings and explain in notes.'

    const mediaBlock = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: file.contentBase64 },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
            data: file.contentBase64,
          },
        }

    const headers: Record<string, string> = {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        temperature: 0.1,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, mediaBlock] }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return new Response(
        JSON.stringify({ error: `Receipt scan failed (${res.status}).`, details: errText.slice(0, 300) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const json = await res.json()
    const text = json?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '{}'
    const parsed = parseJsonFromText(text) ?? { expense: {}, confidence: 'low', notes: 'Could not parse receipt.' }

    if (!parsed.expense || typeof parsed.expense !== 'object') {
      parsed.expense = {}
    }

    return new Response(JSON.stringify(parsed), {
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
