import { supabase } from './supabase'

const BUCKET = 'expense-receipts'

export async function uploadExpenseReceipt(file, expenseId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Sign in to upload receipts.')

  const safeName = String(file.name || 'receipt').replace(/[^\w.\-]+/g, '_')
  const path = `${user.id}/${expenseId}_${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return { path, name: file.name || safeName }
}

export async function attachReceiptToExpense(expenseId, path, name) {
  const { data, error } = await supabase
    .from('expenses')
    .update({ receipt_path: path, receipt_name: name })
    .eq('id', expenseId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeExpenseReceipt(expense) {
  if (expense.receipt_path) {
    await supabase.storage.from(BUCKET).remove([expense.receipt_path])
  }
  const { error } = await supabase
    .from('expenses')
    .update({ receipt_path: null, receipt_name: null })
    .eq('id', expense.id)
  if (error) throw error
}

export async function getReceiptSignedUrl(path, expiresIn = 3600) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data?.signedUrl ?? null
}
