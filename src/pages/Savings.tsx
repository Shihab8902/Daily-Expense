import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/Header'
import ConfirmModal from '../components/ConfirmModal'
import { fetchInsights, type Insight } from '../lib/openrouter'

interface Saving {
  id: string
  name: string
  description: string
  amount: number
  date: string
  time: string
  createdAt: string
}

function to12h(time: string) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDateStr(date: string) {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function getMonthKey(date: string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getLast3MonthKeys(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export default function Savings() {
  const { user } = useAuth()

  const [savings, setSavings] = useState<Saving[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [filter, setFilter] = useState<'currentMonth' | 'last3Months' | 'allTime'>('currentMonth')

  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [budget, setBudget] = useState(22000)
  const [spent, setSpent] = useState(0)
  const [currentMonthsExpenses, setCurrentMonthsExpenses] = useState<{ name: string; amount: number; date: string }[]>([])

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formTime, setFormTime] = useState(new Date().toTimeString().slice(0, 5))

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const ref = doc(db, 'expenseDB', user.uid)
    const currentMonthKey = getCurrentMonthKey()
    getDoc(ref)
      .then((snap) => {
        const data = snap.data()

        const allSavings: Saving[] = data?.savings || []
        setSavings(allSavings)

        const budgets: Record<string, { amount: number }> = data?.budgets || {}
        setBudget(budgets[currentMonthKey]?.amount ?? 22000)

        const allExpenses: { name: string; amount: number; date: string }[] = data?.expenses || []
        const monthExpenses = allExpenses
          .filter((e) => getMonthKey(e.date) === currentMonthKey)
        setCurrentMonthsExpenses(monthExpenses)
        const monthSpent = monthExpenses.reduce((s, e) => s + e.amount, 0)
        setSpent(monthSpent)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const currentMonth = getCurrentMonthKey()
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - now.getDate() + 1
  const remaining = Math.max(0, budget - spent)
  const dailyBudget = remaining > 0 && daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0

  const last3Months = getLast3MonthKeys()

  const filteredSavings = savings.filter((s) => {
    const key = getMonthKey(s.date)
    if (filter === 'currentMonth') return key === currentMonth
    if (filter === 'last3Months') return last3Months.includes(key)
    return true
  })

  const filteredTotal = filteredSavings.reduce((sum, s) => sum + s.amount, 0)

  const filterOptions: { value: typeof filter; label: string }[] = [
    { value: 'currentMonth', label: 'This Month' },
    { value: 'last3Months', label: 'Last 3 Months' },
    { value: 'allTime', label: 'All Time' },
  ]

  useEffect(() => {
    if (!user || !import.meta.env.VITE_OPENROUTER_API_KEY) return
    setInsightsLoading(true)
    fetchInsights({
      budget,
      spent,
      savings: filteredTotal,
      daysLeft,
      dailyBudget,
      expenses: currentMonthsExpenses,
      savingsEntries: filteredSavings.map((s) => ({ name: s.name, amount: s.amount, date: s.date })),
    }, 'savings').then((result) => {
      setInsights(result)
      setInsightsLoading(false)
    }).catch(() => setInsightsLoading(false))
  }, [user, budget, spent, filteredTotal, daysLeft, dailyBudget, currentMonthsExpenses])

  const resetForm = () => {
    setFormName('')
    setFormDesc('')
    setFormAmount('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormTime(new Date().toTimeString().slice(0, 5))
  }

  const openAdd = () => {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  const openEdit = (s: Saving) => {
    setEditingId(s.id)
    setFormName(s.name)
    setFormDesc(s.description)
    setFormAmount(String(s.amount))
    setFormDate(s.date)
    setFormTime(s.time)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!user) return
    const val = Number(formAmount)
    if (!formName || isNaN(val) || val <= 0) return
    setSaving(true)
    try {
      const ref = doc(db, 'expenseDB', user.uid)
      const snap = await getDoc(ref)
      const existing = snap.data()?.savings || []

      if (editingId) {
        const updated = existing.map((s: Saving) =>
          s.id === editingId
            ? { ...s, name: formName, description: formDesc, amount: val, date: formDate, time: formTime }
            : s,
        )
        await setDoc(ref, { savings: updated }, { merge: true })
        setSavings(updated)
        toast.success('Saving updated!')
      } else {
        const newSaving: Saving = {
          id: generateId(),
          name: formName,
          description: formDesc,
          amount: val,
          date: formDate,
          time: formTime,
          createdAt: new Date().toISOString(),
        }
        const updatedSavings = [newSaving, ...existing]
        await setDoc(ref, { savings: updatedSavings }, { merge: true })
        setSavings(updatedSavings)

        // Also add as an expense so it reflects in budget/spending
        const existingExpenses = snap.data()?.expenses || []
        const newExpense = {
          id: generateId(),
          name: `Saving: ${formName}`,
          description: formDesc || 'Transfer to savings',
          amount: val,
          date: formDate,
          time: formTime,
          createdAt: new Date().toISOString(),
          recurring: false,
        }
        await setDoc(ref, { expenses: [newExpense, ...existingExpenses] }, { merge: true })

        toast.success('Saving added!')
      }

      setShowModal(false)
      setEditingId(null)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save saving')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !deleteTarget) return
    try {
      const ref = doc(db, 'expenseDB', user.uid)
      const snap = await getDoc(ref)
      const existing = snap.data()?.savings || []
      const updated = existing.filter((s: Saving) => s.id !== deleteTarget)
      await setDoc(ref, { savings: updated }, { merge: true })
      setSavings(updated)
      toast.success('Saving deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete saving')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header backTo="/dashboard" />

      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          {insightsLoading ? (
            <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 sm:p-6 mb-6 animate-pulse">
              <div className="flex gap-3 sm:gap-4">
                <div className="size-9 sm:size-10 rounded-xl bg-teal-200 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-teal-200 rounded w-3/4" />
                  <div className="h-4 bg-teal-200 rounded w-1/2" />
                  <div className="h-4 bg-teal-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ) : insights.length > 0 ? (
            <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 sm:p-6 mb-6">
              <div className="flex gap-3 sm:gap-4">
                <span className="size-9 sm:size-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="size-5 sm:size-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 6 6 6 6 0 0 0-6 6 6 6 0 0 0-6-6 6 6 0 0 0 6-6Z" />
                    <path d="M19 14a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3Z" />
                    <path d="M5 14a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3Z" />
                  </svg>
                </span>
                <div className="flex-1 space-y-2">
                  {insights.map((insight, i) => {
                    const colors = {
                      good: 'text-green-800',
                      warning: 'text-amber-800',
                      danger: 'text-red-800',
                    }
                    const bgColors = {
                      good: 'bg-green-100',
                      warning: 'bg-amber-100',
                      danger: 'bg-red-100',
                    }
                    return (
                       <p key={i} className={`text-sm leading-relaxed break-words ${colors[insight.type]} flex items-start gap-2`}>
                        <span className={`mt-0.5 size-4 rounded-full ${bgColors[insight.type]} flex items-center justify-center shrink-0`}>
                          <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            {insight.type === 'good' ? <path d="M20 6L9 17l-5-5" /> : <path d="M18 6L6 18M6 6l12 12" />}
                          </svg>
                        </span>
                        {insight.message}
                      </p>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Savings</h2>
              <p className="text-sm text-gray-500 mt-1">Track your saved money</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap rounded-lg border border-gray-200 overflow-hidden">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      filter === opt.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={openAdd}
                className="rounded-lg bg-teal-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-teal-700 active:bg-teal-800 transition-colors cursor-pointer flex items-center gap-2 shrink-0"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Saving
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-sm text-gray-400">Loading...</div>
          ) : filteredSavings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-2">No savings found</p>
              <p className="text-sm text-gray-300">Try changing the filter or add a new saving.</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Description</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Time</th>
                      <th className="px-5 py-3 font-medium text-right">Amount</th>
                      <th className="px-5 py-3 font-medium text-right w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSavings.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{s.name}</td>
                        <td className="px-5 py-3.5 text-gray-500">{s.description || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-700">{formatDateStr(s.date)}</td>
                        <td className="px-5 py-3.5 text-gray-700">{to12h(s.time)}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-teal-600">BDT {s.amount.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => openEdit(s)}
                              className="size-8 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 flex items-center justify-center transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(s.id)}
                              className="size-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sm:hidden space-y-3">
                {filteredSavings.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="size-8 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s.id)}
                          className="size-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {s.description && (
                      <p className="text-xs text-gray-500 mb-2">{s.description}</p>
                    )}
                    <p className="text-base font-bold text-teal-600 mb-2">BDT {s.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{formatDateStr(s.date)} at {to12h(s.time)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-5">
              {editingId ? 'Edit Saving' : 'Add Saving'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Salary deposit"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (BDT) *</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Time *</label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !formName || !formAmount || Number(formAmount) <= 0}
                className="flex-1 rounded-lg bg-teal-600 text-white py-2.5 text-sm font-semibold hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {saving && (
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Saving...' : editingId ? 'Update Saving' : 'Add Saving'}
              </button>
              <button
                onClick={() => { setShowModal(false); setEditingId(null); resetForm() }}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Saving"
        message="Are you sure you want to delete this saving entry?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
