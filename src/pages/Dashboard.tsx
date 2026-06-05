import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { HiOutlineCash, HiOutlineTrendingUp, HiOutlineTag, HiOutlineChartBar, HiOutlinePlusCircle, HiOutlineChartSquareBar, HiOutlineCollection, HiOutlineAdjustments } from 'react-icons/hi'
import Header from '../components/Header'
import { fetchInsights, type Insight } from '../lib/openrouter'

const DEFAULT_BUDGET = 22000

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthKey(date: string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmt(n: number) {
  return 'BDT ' + n.toLocaleString('en-BD')
}

interface Expense {
  id: string
  name: string
  amount: number
  date: string
}

interface Saving {
  id: string
  name: string
  amount: number
  date: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [budget, setBudget] = useState(DEFAULT_BUDGET)
  const [spent, setSpent] = useState(0)
  const [savings, setSavings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [currentExpenses, setCurrentExpenses] = useState<Expense[]>([])
  const [currentSavings, setCurrentSavings] = useState<Saving[]>([])

  useEffect(() => {
    if (!user) return
    const currentMonth = getCurrentMonthKey()
    const ref = doc(db, 'expenseDB', user.uid)

    getDoc(ref).then((snap) => {
      if (!snap.exists()) {
        setLoading(false)
        return
      }
      const data = snap.data()

      const budgets: Record<string, { amount: number }> = data?.budgets || {}
      const monthlyBudget = budgets[currentMonth]?.amount ?? DEFAULT_BUDGET
      setBudget(monthlyBudget)

      const allExpenses: Expense[] = data?.expenses || []
      const monthExpenses = allExpenses.filter((e) => getMonthKey(e.date) === currentMonth)
      setCurrentExpenses(monthExpenses)
      const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0)
      setSpent(totalSpent)

      const allSavings: Saving[] = data?.savings || []
      const monthSavings = allSavings.filter((s) => getMonthKey(s.date) === currentMonth)
      setCurrentSavings(monthSavings)
      const totalSavings = monthSavings.reduce((sum, s) => sum + s.amount, 0)
      setSavings(totalSavings)
    }).finally(() => setLoading(false))
  }, [user])

  const remaining = Math.max(0, budget - spent)
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - now.getDate() + 1
  const dailyBudget = remaining > 0 && daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0

  const hasInsightData = budget > 0 && !loading
  useEffect(() => {
    if (!hasInsightData) return
    if (!import.meta.env.VITE_OPENROUTER_API_KEY) return
    setInsightsLoading(true)
    fetchInsights({
      budget,
      spent,
      savings,
      daysLeft,
      dailyBudget,
      expenses: currentExpenses.map((e) => ({ name: e.name, amount: e.amount, date: e.date })),
      savingsEntries: currentSavings.map((s) => ({ name: s.name, amount: s.amount, date: s.date })),
    }).then((result) => {
      setInsights(result)
      setInsightsLoading(false)
    }).catch(() => setInsightsLoading(false))
  }, [hasInsightData, budget, spent, savings, daysLeft, dailyBudget])

  const activityItems = useMemo(() => {
    const now = Date.now()
    const items: { action: string; amount: string; time: string; type: 'expense' | 'saving' }[] = []
    for (const e of currentExpenses) {
      const diff = now - new Date(e.date).getTime()
      const hours = Math.floor(diff / 3600000)
      items.push({
        action: e.name,
        amount: `BDT ${e.amount.toLocaleString('en-BD')}`,
        time: hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`,
        type: 'expense',
      })
    }
    for (const s of currentSavings) {
      const diff = now - new Date(s.date).getTime()
      const hours = Math.floor(diff / 3600000)
      items.push({
        action: s.name,
        amount: `BDT ${s.amount.toLocaleString('en-BD')}`,
        time: hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`,
        type: 'saving',
      })
    }
    items.sort((a, b) => {
      const aVal = a.time.includes('Just now') ? 0 : parseInt(a.time)
      const bVal = b.time.includes('Just now') ? 0 : parseInt(b.time)
      if (a.time.includes('d') && b.time.includes('h')) return -1
      if (a.time.includes('h') && b.time.includes('d')) return 1
      return aVal - bVal
    })
    return items.slice(0, 5)
  }, [currentExpenses, currentSavings])

  const cards = [
    {
      icon: HiOutlineCash,
      label: 'Monthly Budget',
      value: `${fmt(spent)} / ${fmt(budget)}`,
      sub: `of ${fmt(budget)} used`,
    },
    {
      icon: HiOutlineTrendingUp,
      label: 'Daily Budget',
      value: `${dailyBudget > 0 ? fmt(dailyBudget) : 'BDT 0'}/day`,
      sub: `${daysLeft} days remaining in month`,
    },
    {
      icon: HiOutlineTag,
      label: 'Remaining Budget',
      value: fmt(remaining),
      sub: 'left to spend',
    },
    {
      icon: HiOutlineChartBar,
      label: 'Total Savings',
      value: fmt(savings),
      sub: 'all time savings',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-[1600px]">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-9 rounded-lg bg-gray-200" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                  </div>
                  <div className="h-5 w-24 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
              {cards.map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="size-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <card.icon className="size-5" />
                    </span>
                    <p className="text-xs sm:text-sm text-gray-500">{card.label}</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 mb-1 break-words">{card.value}</p>
                  <p className="text-xs text-gray-400">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {insightsLoading ? (
            <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 sm:p-6 mb-6 animate-pulse">
              <div className="flex gap-3 sm:gap-4">
                <div className="size-8 sm:size-9 rounded-lg bg-brand-200 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-brand-200 rounded w-3/4" />
                  <div className="h-4 bg-brand-200 rounded w-1/2" />
                  <div className="h-4 bg-brand-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ) : insights.length > 0 ? (
            <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 sm:p-6 mb-6">
              <div className="flex gap-3 sm:gap-4">
                <span className="size-8 sm:size-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {[
                  { icon: HiOutlinePlusCircle, label: 'Add Expense', desc: 'Record a new expense', color: 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100', path: '/expenses?add=true' },
                  { icon: HiOutlineCollection, label: 'Expenses', desc: 'View all expenses', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', path: '/expenses' },
                  { icon: HiOutlineAdjustments, label: 'Set Monthly Budget', desc: 'Define spending limits', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', path: '/budget' },
                  { icon: HiOutlineTrendingUp, label: 'Savings', desc: 'Track your savings goals', color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100', path: '/savings' },
                  { icon: HiOutlineChartSquareBar, label: 'View Reports', desc: 'Monthly & category insights', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', path: '/reports' },
                ].map((link) => (
                  <button
                    key={link.label}
                    onClick={() => link.path !== '#' && navigate(link.path)}
                    className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${link.color}`}
                  >
                    <link.icon className="size-5 mb-2" />
                    <p className="font-semibold text-sm mb-0.5">{link.label}</p>
                    <p className="text-xs opacity-70">{link.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</h3>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {activityItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">No activity yet this month.</div>
                ) : activityItems.map((item) => (
                  <div key={item.action + item.time} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm text-gray-900 truncate">{item.action}</p>
                      <p className="text-xs text-gray-400">{item.time}</p>
                    </div>
                    <span className={`text-sm font-medium shrink-0 ${item.type === 'saving' ? 'text-brand-600' : 'text-gray-700'}`}>
                      -{item.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
