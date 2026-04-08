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

  const addExpense = async (expense) => {
    const { data, error } = await supabase.from('expenses').insert([expense]).select()
    if (!error) setExpenses(prev => [data[0], ...prev])
    return { data, error }
  }

  const addExpensesBulk = async (rows) => {
    if (!rows?.length) return { data: [], error: null }
    const { data, error } = await supabase.from('expenses').insert(rows).select()
    if (!error) await fetch()
    return { data, error }
  }

  const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) setExpenses(prev => prev.filter(e => e.id !== id))
    return { error }
  }

  return { expenses, loading, addExpense, addExpensesBulk, deleteExpense, refetch: fetch }
}

export function useGymSessions(month = getCurrentMonth()) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gym_sessions')
      .select('*')
      .eq('month', month)
      .order('date', { ascending: false })
    if (error) console.error('[supabase gym_sessions]', error.message, error)
    setSessions(data || [])
    setLoading(false)
  }, [month])

  useEffect(() => {
    void Promise.resolve().then(() => fetch())
  }, [fetch])

  const logSession = async (date) => {
    const { data, error } = await supabase
      .from('gym_sessions')
      .insert([{ date, month }])
      .select()
    if (!error) setSessions(prev => [data[0], ...prev])
    return { data, error }
  }

  const removeSession = async (id) => {
    const { error } = await supabase.from('gym_sessions').delete().eq('id', id)
    if (!error) setSessions(prev => prev.filter(s => s.id !== id))
    return { error }
  }

  return { sessions, loading, logSession, removeSession, refetch: fetch }
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
      .upsert([snapshot], { onConflict: 'month' })
      .select()
    if (!error) fetch()
    return { data, error }
  }

  return { snapshots, loading, upsertSnapshot, refetch: fetch }
}
