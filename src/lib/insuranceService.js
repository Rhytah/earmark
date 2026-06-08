import { supabase } from './supabase'

export async function uploadInsuranceDocs(files) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Sign in to upload insurance documents.')

  const uploaded = []
  for (const file of files) {
    const path = `${user.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('insurance-docs').upload(path, file)
    if (error) throw error
    uploaded.push({ path, name: file.name })
  }
  return uploaded
}

async function fileToBase64(file) {
  const buf = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function analyzeInsuranceDocuments(files) {
  const payloadFiles = await Promise.all(
    files.map(async (f) => ({
      name: f.name,
      mimeType: f.type || 'application/octet-stream',
      contentBase64: await fileToBase64(f),
    })),
  )

  const { data, error } = await supabase.functions.invoke('insurance-analyzer', {
    body: { files: payloadFiles },
  })
  if (error) {
    const msg = String(error?.message || '')
    if (/non-2xx|status code/i.test(msg)) {
      throw new Error(
        'Analyzer request failed. Ensure insurance-analyzer is deployed, JWT is disabled for this function, and ANTHROPIC_API_KEY is set in Supabase secrets.',
      )
    }
    throw error
  }
  if (data?.error) {
    throw new Error(String(data.error))
  }
  return data
}

export async function savePolicyAnalysis(policy, uploadedFiles = []) {
  const { bonuses = [], ...p } = policy
  const { data: saved, error: pErr } = await supabase
    .from('insurance_policies')
    .insert({
      insurer: p.insurer || null,
      policy_number: p.policyNumber || null,
      policy_type: p.policyType || null,
      sum_assured: Number(p.sumAssured || 0),
      currency: p.currency || 'UGX',
      start_date: p.startDate || null,
      maturity_date: p.maturityDate || null,
      premium: p.premium != null ? Number(p.premium) : null,
      premium_frequency: p.premiumFrequency || null,
      status: p.status || 'active',
      source: 'ai',
    })
    .select('*')
    .single()
  if (pErr) throw pErr

  if (bonuses.length) {
    const { error: bErr } = await supabase.from('insurance_bonuses').insert(
      bonuses.map((b) => ({
        policy_id: saved.id,
        bonus_type: b.type || 'bonus',
        amount: Number(b.amount || 0),
        bonus_year: b.year ? String(b.year) : null,
      })),
    )
    if (bErr) throw bErr
  }

  if (uploadedFiles.length) {
    const { error: dErr } = await supabase.from('insurance_documents').insert(
      uploadedFiles.map((f) => ({
        policy_id: saved.id,
        file_path: f.path,
        file_name: f.name,
      })),
    )
    if (dErr) throw dErr
  }

  return saved
}
