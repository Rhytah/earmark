import { supabase } from './supabase'
import { edgeFunctionErrorMessage } from './edgeFunctionErrors'

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
  const supported = files.filter((f) => {
    const name = String(f.name || '').toLowerCase()
    const type = String(f.type || '').toLowerCase()
    return (
      type === 'application/pdf' ||
      type.startsWith('image/') ||
      /\.(pdf|png|jpe?g|webp)$/i.test(name)
    )
  })
  if (!supported.length) {
    throw new Error('Upload PDF or image files (PNG, JPG, WEBP). CSV and TXT are not supported for AI analysis.')
  }

  const payloadFiles = await Promise.all(
    supported.map(async (f) => ({
      name: f.name,
      mimeType: f.type || 'application/octet-stream',
      contentBase64: await fileToBase64(f),
    })),
  )

  const { data, error } = await supabase.functions.invoke('insurance-analyzer', {
    body: { files: payloadFiles },
  })
  if (error) {
    throw new Error(
      await edgeFunctionErrorMessage(
        error,
        data,
        'Insurance analyzer unavailable. Set a valid Anthropic key: supabase secrets set ANTHROPIC_API_KEY=your_key',
      ),
    )
  }
  if (data?.error) {
    const extra = data.details ? ` ${String(data.details).slice(0, 200)}` : ''
    throw new Error(String(data.error) + extra)
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
