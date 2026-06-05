import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/Header'

const DEFAULT_BUDGET = 22000

interface BudgetEntry {
  amount: number
  notes: string
  createdAt: string
  updatedAt: string
}

function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthOptions() {
  const months: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    months.push({ value, label })
  }
  return months
}

export default function Budget() {
  const { user } = useAuth()
  const currentMonth = getCurrentMonthKey()
  const months = getMonthOptions()

  const [budgets, setBudgets] = useState<Record<string, BudgetEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const ref = doc(db, 'expenseDB', user.uid)
    getDoc(ref)
      .then((snap) => {
        const data = snap.data()?.budgets || {}
        setBudgets(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const existingBudget = budgets[selectedMonth]

  useEffect(() => {
    if (existingBudget) {
      setAmount(String(existingBudget.amount))
      setNotes(existingBudget.notes || '')
      setEditing(selectedMonth)
    } else {
      setEditing(null)
      setAmount(selectedMonth === currentMonth ? String(DEFAULT_BUDGET) : '')
      setNotes('')
    }
  }, [selectedMonth, currentMonth, existingBudget])

  const handleSave = async () => {
    if (!user) return
    const val = Number(amount)
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    try {
      const ref = doc(db, 'expenseDB', user.uid)
      const snap = await getDoc(ref)
      const existing = snap.data()?.budgets || {}
      existing[selectedMonth] = {
        amount: val,
        notes,
        createdAt: existing[selectedMonth]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await setDoc(ref, { budgets: existing }, { merge: true })
      setBudgets(existing)
      setEditing(null)
      toast.success('Budget saved successfully!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save budget')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (monthKey: string) => {
    if (!user) return
    try {
      const ref = doc(db, 'expenseDB', user.uid)
      const snap = await getDoc(ref)
      const existing = snap.data()?.budgets || {}
      delete existing[monthKey]
      await setDoc(ref, { budgets: existing }, { merge: true })
      setBudgets(existing)
      if (editing === monthKey) {
        setEditing(null)
        setSelectedMonth(currentMonth)
      }
      toast.success('Budget entry removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete budget')
    }
  }

  const handleEdit = (monthKey: string) => {
    setEditing(monthKey)
    setSelectedMonth(monthKey)
  }

  const sortedEntries = Object.entries(budgets).sort(([a], [b]) => b.localeCompare(a))

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header backTo="/dashboard" />

      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Monthly Budgets</h2>
          <p className="text-sm text-gray-500 mb-6">Manage your monthly spending limits</p>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {editing ? `Budget for ${formatMonthLabel(editing)}` : `Set Budget for ${formatMonthLabel(selectedMonth)}`}
            </h3>

            {editing && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Budget already set for this month. Update below or delete it first to set a new one.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(e.target.value) }}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all bg-white"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Budget <span className="text-gray-400 font-normal">(BDT)</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter budget amount"
                  disabled={loading}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for this month's budget"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleSave}
                disabled={loading || saving || !amount || Number(amount) <= 0}
                className="rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {saving && (
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Saving...' : editing ? 'Update Budget' : 'Save Budget'}
              </button>

              {editing && (
                <button
                  onClick={() => handleDelete(selectedMonth)}
                  className="rounded-lg border border-red-300 text-red-600 px-5 py-2.5 text-sm font-medium hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>

            {!editing && (
              <p className="text-xs text-gray-400 mt-3">
                Default budget is BDT {DEFAULT_BUDGET.toLocaleString()} if none is set for a month.
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Saved Budgets</h3>
            </div>

            {loading ? (
              <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
            ) : sortedEntries.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No budgets set yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedEntries.map(([monthKey, entry]) => (
                  <div key={monthKey} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{formatMonthLabel(monthKey)}</p>
                      <p className="text-xs text-gray-400 truncate">
                        BDT {entry.amount.toLocaleString()}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                        {entry.updatedAt ? ` · Updated ${formatDate(entry.updatedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleEdit(monthKey)}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(monthKey)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
