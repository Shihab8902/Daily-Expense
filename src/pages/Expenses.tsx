import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/Header'
import ConfirmModal from '../components/ConfirmModal'

interface Expense {
  id: string
  name: string
  description: string
  amount: number
  date: string
  time: string
  createdAt: string
  recurring?: boolean
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

function getMonthKey(date: string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export default function Expenses() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentMonth = getCurrentMonthKey()

  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formTime, setFormTime] = useState(new Date().toTimeString().slice(0, 5))
  const [formRecurring, setFormRecurring] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const ref = doc(db, 'expenseDB', user.uid)
    getDoc(ref)
      .then(async (snap) => {
        let expenses: Expense[] = snap.data()?.expenses || []

        // auto-carry-over recurring expenses from previous months
        const currentNames = new Set(
          expenses
            .filter((e) => getMonthKey(e.date) === currentMonth)
            .map((e) => e.name),
        )
        const toCarryOver = expenses.filter(
          (e) =>
            e.recurring &&
            getMonthKey(e.date) < currentMonth &&
            !currentNames.has(e.name),
        )
        if (toCarryOver.length > 0) {
          const carried: Expense[] = toCarryOver.map((e) => ({
            ...e,
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().slice(0, 5),
            createdAt: new Date().toISOString(),
          }))
          expenses = [...carried, ...expenses]
          await setDoc(ref, { expenses }, { merge: true })
        }

        setAllExpenses(expenses)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!loading && searchParams.get('add') === 'true') {
      openAdd()
      navigate('/expenses', { replace: true })
    }
  }, [loading, searchParams])

  const currentExpenses = useMemo(
    () => allExpenses.filter((e) => getMonthKey(e.date) === currentMonth),
    [allExpenses, currentMonth],
  )

  const pastMonths = useMemo(() => {
    const map: Record<string, Expense[]> = {}
    for (const exp of allExpenses) {
      const key = getMonthKey(exp.date)
      if (key < currentMonth) {
        if (!map[key]) map[key] = []
        map[key].push(exp)
      }
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [allExpenses, currentMonth])

  const downloadCsv = (monthKey: string, expenses: Expense[]) => {
    const rows = [['Name', 'Description', 'Date', 'Time', 'Amount (BDT)']]
    for (const exp of expenses) {
      rows.push([exp.name, exp.description, formatDateStr(exp.date), to12h(exp.time), String(exp.amount)])
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${monthKey}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetForm = () => {
    setFormName('')
    setFormDesc('')
    setFormAmount('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormTime(new Date().toTimeString().slice(0, 5))
    setFormRecurring(false)
  }

  const openAdd = () => {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  const openEdit = (exp: Expense) => {
    setEditingId(exp.id)
    setFormName(exp.name)
    setFormDesc(exp.description)
    setFormAmount(String(exp.amount))
    setFormDate(exp.date)
    setFormTime(exp.time)
    setFormRecurring(exp.recurring ?? false)
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
      const existing = snap.data()?.expenses || []

      if (editingId) {
        const updated = existing.map((e: Expense) =>
          e.id === editingId
            ? { ...e, name: formName, description: formDesc, amount: val, date: formDate, time: formTime, recurring: formRecurring }
            : e,
        )
        await setDoc(ref, { expenses: updated }, { merge: true })
        setAllExpenses(updated)
        toast.success('Expense updated!')
      } else {
        const newExpense: Expense = {
          id: generateId(),
          name: formName,
          description: formDesc,
          amount: val,
          date: formDate,
          time: formTime,
          createdAt: new Date().toISOString(),
          recurring: formRecurring,
        }
        const updated = [newExpense, ...existing]
        await setDoc(ref, { expenses: updated }, { merge: true })
        setAllExpenses(updated)
        toast.success('Expense added!')
      }

      setShowModal(false)
      setEditingId(null)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !deleteTarget) return
    try {
      const ref = doc(db, 'expenseDB', user.uid)
      const snap = await getDoc(ref)
      const existing = snap.data()?.expenses || []
      const updated = existing.filter((e: Expense) => e.id !== deleteTarget)
      await setDoc(ref, { expenses: updated }, { merge: true })
      setAllExpenses(updated)
      toast.success('Expense deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete expense')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header backTo="/dashboard" />

      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Expenses</h2>
              <p className="text-sm text-gray-500 mt-1">
                Showing <span className="font-medium">{formatMonthLabel(currentMonth)}</span>
              </p>
            </div>
            <button
              onClick={openAdd}
              className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-brand-700 active:bg-brand-800 transition-colors cursor-pointer flex items-center gap-2"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Expense
            </button>
          </div>

          {pastMonths.length > 0 && (
            <div className="space-y-2 mb-6">
              {pastMonths.map(([monthKey, exps]) => (
                  <div key={monthKey} className="rounded-xl border border-amber-200 bg-amber-50 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                  <div className="text-sm text-amber-800 break-words">
                    <span className="font-semibold">{formatMonthLabel(monthKey)}</span>
                    {' '}has {exps.length} expense{exps.length > 1 ? 's' : ''} — download the report.
                  </div>
                  <button
                    onClick={() => downloadCsv(monthKey, exps)}
                    className="shrink-0 rounded-lg bg-amber-600 text-white px-4 py-2 text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    CSV
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-sm text-gray-400">Loading...</div>
          ) : allExpenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-2">No expenses yet</p>
              <p className="text-sm text-gray-300">Click "Add Expense" to get started</p>
            </div>
          ) : currentExpenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-2">No expenses this month</p>
              <p className="text-sm text-gray-300">Click "Add Expense" to record your first one.</p>
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
                    {currentExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          <span className="flex items-center gap-2">
                            {exp.name}
                            {exp.recurring && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 leading-none">
                                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                                </svg>
                                Recurring
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{exp.description || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-700">{formatDateStr(exp.date)}</td>
                        <td className="px-5 py-3.5 text-gray-700">{to12h(exp.time)}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-gray-900">BDT {exp.amount.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => openEdit(exp)}
                              className="size-8 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(exp.id)}
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
                {currentExpenses.map((exp) => (
                  <div key={exp.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                          {exp.name}
                          {exp.recurring && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 leading-none">
                              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                              </svg>
                              Recurring
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => openEdit(exp)}
                          className="size-8 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(exp.id)}
                          className="size-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {exp.description && (
                      <p className="text-xs text-gray-500 mb-2">{exp.description}</p>
                    )}
                    <p className="text-base font-bold text-brand-600 mb-2">BDT {exp.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{formatDateStr(exp.date)} at {to12h(exp.time)}</p>
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
              {editingId ? 'Edit Expense' : 'Add Expense'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Grocery shopping"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (BDT) *</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Time *</label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormRecurring(!formRecurring)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${formRecurring ? 'bg-purple-600' : 'bg-gray-300'}`}
                  role="switch"
                  aria-checked={formRecurring}
                >
                  <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${formRecurring ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                </button>
                <label className="text-sm text-gray-700 select-none">
                  Recurring expense
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6 flex-wrap">
              <button
                onClick={handleSave}
                disabled={saving || !formName || !formAmount || Number(formAmount) <= 0}
                className="flex-1 rounded-lg bg-brand-600 text-white py-2.5 text-sm font-semibold hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {saving && (
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Saving...' : editingId ? 'Update Expense' : 'Add Expense'}
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
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
