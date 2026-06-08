import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { getCurrentMonth } from './constants'

function getMonthRange(month) {
  const [year, monthNum] = month.split('-').map(Number)
  const mm = String(monthNum).padStart(2, '0')
  const lastDay = new Date(year, monthNum, 0).getDate()
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function useExpenses(month = getCurrentMonth()) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { start, end } = getMonthRange(month)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    if (error) console.error('[supabase expenses]', error.message, error)
    setExpenses(data || [])
    setLoading(false)
  }, [month])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  useEffect(() => {
    const onSync = () => void fetch()
    window.addEventListener('earmark:expenses-synced', onSync)
    return () => window.removeEventListener('earmark:expenses-synced', onSync)
  }, [fetch])

  const addExpense = async (expense) => {
    const { data, error } = await supabase.from('expenses').insert([expense]).select()
    if (!error) setExpenses((prev) => [data[0], ...prev])
    return { data: data?.[0] ?? null, error }
  }

  const addExpensesBulk = async (rows) => {
    if (!rows?.length) return { data: [], error: null }
    const { data, error } = await supabase.from('expenses').insert(rows).select()
    if (!error) await fetch()
    return { data, error }
  }

  const updateExpense = async (id, patch) => {
    const { data, error } = await supabase.from('expenses').update(patch).eq('id', id).select().single()
    if (!error) setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)))
    return { data, error }
  }

  const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) setExpenses(prev => prev.filter(e => e.id !== id))
    return { error }
  }

  return { expenses, loading, addExpense, addExpensesBulk, updateExpense, deleteExpense, refetch: fetch }
}

export function useTrackerLogs(trackerId, month = getCurrentMonth()) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!trackerId) {
      setLogs([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('gym_sessions')
      .select('*')
      .eq('month', month)
      .eq('tracker_id', trackerId)
      .order('date', { ascending: false })
    if (error) console.error('[supabase tracker logs]', error.message, error)
    setLogs(data || [])
    setLoading(false)
  }, [trackerId, month])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  const logEntry = async (date) => {
    const { data, error } = await supabase
      .from('gym_sessions')
      .insert([{ date, month, tracker_id: trackerId }])
      .select()
    if (!error) setLogs((prev) => [data[0], ...prev])
    return { data, error }
  }

  const removeLog = async (id) => {
    const { error } = await supabase.from('gym_sessions').delete().eq('id', id)
    if (!error) setLogs((prev) => prev.filter((s) => s.id !== id))
    return { error }
  }

  return { logs, loading, logEntry, removeLog, refetch: fetch }
}

/** @deprecated Use useTrackerLogs */
export function useGymSessions(month = getCurrentMonth()) {
  return useTrackerLogs('gym', month)
}

export function useTrackerLogsBatch(month = getCurrentMonth(), trackerIds = []) {
  const [logsByTracker, setLogsByTracker] = useState({})
  const [loading, setLoading] = useState(true)
  const idKey = trackerIds.join(',')

  const fetch = useCallback(async () => {
    if (!trackerIds.length) {
      setLogsByTracker({})
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('gym_sessions')
      .select('*')
      .eq('month', month)
      .in('tracker_id', trackerIds)
      .order('date', { ascending: false })
    if (error) console.error('[supabase tracker logs batch]', error.message, error)

    const grouped = Object.fromEntries(trackerIds.map((id) => [id, []]))
    for (const row of data || []) {
      if (grouped[row.tracker_id]) grouped[row.tracker_id].push(row)
    }
    setLogsByTracker(grouped)
    setLoading(false)
  }, [month, idKey])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  return { logsByTracker, loading, refetch: fetch }
}

export function useExpensesHistory(monthsBack = 6, endMonth = getCurrentMonth()) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [endYear, endMonthNum] = endMonth.split('-').map(Number)
    const startDate = new Date(endYear, endMonthNum - monthsBack, 1)
    const start = startDate.toISOString().slice(0, 10)
    const { end } = getMonthRange(endMonth)

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
    if (error) console.error('[supabase expenses history]', error.message, error)
    setExpenses(data || [])
    setLoading(false)
  }, [monthsBack, endMonth])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  useEffect(() => {
    const onSync = () => void fetch()
    window.addEventListener('earmark:expenses-synced', onSync)
    return () => window.removeEventListener('earmark:expenses-synced', onSync)
  }, [fetch])

  return { expenses, loading, refetch: fetch }
}

export function useExpensesRange(startDate = null, endDate = null) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('expenses').select('*')
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    const { data, error } = await query.order('date', { ascending: true })
    if (error) console.error('[supabase expenses range]', error.message, error)
    setExpenses(data || [])
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  useEffect(() => {
    const onSync = () => void fetch()
    window.addEventListener('earmark:expenses-synced', onSync)
    return () => window.removeEventListener('earmark:expenses-synced', onSync)
  }, [fetch])

  return { expenses, loading, refetch: fetch }
}

export function useSavingsSnapshot() {
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('savings_snapshots')
      .select('*')
      .order('month', { ascending: true })
    if (error) console.error('[supabase savings_snapshots]', error.message, error)
    setSnapshots(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  const upsertSnapshot = async (snapshot) => {
    const { data, error } = await supabase
      .from('savings_snapshots')
      .upsert([snapshot], { onConflict: 'user_id,month' })
      .select()
    if (!error) fetch()
    return { data, error }
  }

  return { snapshots, loading, upsertSnapshot, refetch: fetch }
}

export function useInvestments(month = getCurrentMonth()) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [year, monthNum] = month.split('-').map(Number)
    const mm = String(monthNum).padStart(2, '0')
    const endDay = new Date(year, monthNum, 0).getDate()
    const start = `${year}-${mm}-01`
    const end = `${year}-${mm}-${String(endDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('investment_transactions')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    if (error) console.error('[supabase investment_transactions]', error.message, error)
    setTransactions(data || [])
    setLoading(false)
  }, [month])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  const addTransactionsBulk = async (rows) => {
    if (!rows?.length) return { data: [], error: null }
    const { data, error } = await supabase.from('investment_transactions').insert(rows).select()
    if (!error) await fetch()
    return { data, error }
  }

  const deleteTransaction = async (id) => {
    const { error } = await supabase.from('investment_transactions').delete().eq('id', id)
    if (!error) setTransactions((prev) => prev.filter((x) => x.id !== id))
    return { error }
  }

  return { transactions, loading, addTransactionsBulk, deleteTransaction, refetch: fetch }
}

export function useInvestmentsRange(startDate = null, endDate = null) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('investment_transactions').select('*')
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    const { data, error } = await query.order('date', { ascending: false })
    if (error) console.error('[supabase investment_transactions range]', error.message, error)
    setTransactions(data || [])
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  const addTransactionsBulk = async (rows) => {
    if (!rows?.length) return { data: [], error: null }
    const { data, error } = await supabase.from('investment_transactions').insert(rows).select()
    if (!error) await fetch()
    return { data, error }
  }

  const deleteTransaction = async (id) => {
    const { error } = await supabase.from('investment_transactions').delete().eq('id', id)
    if (!error) setTransactions((prev) => prev.filter((x) => x.id !== id))
    return { error }
  }

  return { transactions, loading, addTransactionsBulk, deleteTransaction, refetch: fetch }
}

export function useInsurancePolicies() {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('insurance_policies')
      .select('*, insurance_bonuses(*), insurance_documents(*)')
      .order('created_at', { ascending: false })
    if (error) console.error('[supabase insurance_policies]', error.message, error)
    setPolicies(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  return { policies, loading, refetch: fetch }
}
