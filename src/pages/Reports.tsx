import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveLine } from '@nivo/line'
import Header from '../components/Header'

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
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getLast6Months(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

interface Expense {
  id: string
  name: string
  amount: number
  date: string
  recurring?: boolean
}

interface Saving {
  id: string
  name: string
  amount: number
  date: string
}

const brand = '#22c55e'
const brandLight = '#86efac'
const purple = '#a855f7'
const teal = '#14b8a6'
const gray = '#9ca3af'

const theme = {
  background: 'transparent',
  text: { fontSize: 11, fill: '#64748b', fontFamily: 'Inter, system-ui, sans-serif' },
  axis: {
    domain: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
    ticks: { line: { stroke: '#e2e8f0' } },
  },
  grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
  tooltip: {
    container: {
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '13px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  },
}

export default function Reports() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  const [monthlyData, setMonthlyData] = useState<{ month: string; budget: number; spent: number; label: string }[]>([])
  const [dailyData, setDailyData] = useState<{ day: string; spent: number }[]>([])
  const [savingsData, setSavingsData] = useState<{ month: string; total: number; label: string }[]>([])
  const [recurringPie, setRecurringPie] = useState<{ id: string; label: string; value: number; color: string }[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [totalSaved, setTotalSaved] = useState(0)
  const [averageDaily, setAverageDaily] = useState(0)

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'expenseDB', user.uid)
    getDoc(ref).then((snap) => {
      if (!snap.exists()) { setLoading(false); return }
      const data = snap.data()
      const expenses: Expense[] = data?.expenses || []
      const budgets: Record<string, { amount: number }> = data?.budgets || {}
      const savings: Saving[] = data?.savings || []
      const currentMonth = getCurrentMonthKey()

      // --- Monthly budget vs spent (last 6 months) ---
      const last6 = getLast6Months()
      const monthly = last6.map((key) => {
        const spent = expenses
          .filter((e) => getMonthKey(e.date) === key)
          .reduce((s, e) => s + e.amount, 0)
        return {
          month: key,
          label: formatMonthLabel(key),
          budget: budgets[key]?.amount ?? 22000,
          spent,
        }
      })
      setMonthlyData(monthly)

      // --- Daily spending for current month ---
      const currentYear = new Date().getFullYear()
      const currentMonthNum = new Date().getMonth() + 1
      const daysInMonth = getDaysInMonth(currentYear, currentMonthNum)
      const currentDayExpenses = expenses.filter((e) => getMonthKey(e.date) === currentMonth)
      const daily = Array.from({ length: daysInMonth }, (_, i) => {
        const dayStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
        const spent = currentDayExpenses
          .filter((e) => e.date === dayStr)
          .reduce((s, e) => s + e.amount, 0)
        return { day: String(i + 1), spent }
      })
      setDailyData(daily)

      // --- Cumulative savings by month ---
      const savingsByMonth: Record<string, number> = {}
      for (const s of savings) {
        const key = getMonthKey(s.date)
        savingsByMonth[key] = (savingsByMonth[key] || 0) + s.amount
      }
      const allMonthKeys = [...new Set([...last6, ...Object.keys(savingsByMonth)])].sort()
      let cum = 0
      const savingsTrend = allMonthKeys.map((key) => {
        cum += savingsByMonth[key] || 0
        return { month: key, label: formatMonthLabel(key), total: cum }
      })
      setSavingsData(savingsTrend)

      // --- Recurring vs one-time pie ---
      const currentExpenses = expenses.filter((e) => getMonthKey(e.date) === currentMonth)
      const recurringTotal = currentExpenses
        .filter((e) => e.recurring)
        .reduce((s, e) => s + e.amount, 0)
      const oneTimeTotal = currentExpenses
        .filter((e) => !e.recurring)
        .reduce((s, e) => s + e.amount, 0)
      setRecurringPie([
        { id: 'recurring', label: 'Recurring', value: recurringTotal, color: purple },
        { id: 'one-time', label: 'One-time', value: oneTimeTotal, color: gray },
      ])

      // --- Summary stats ---
      const currentBudget = monthly.find((m) => m.month === currentMonth)
      setTotalBudget(currentBudget?.budget ?? 22000)
      setTotalSpent(currentBudget?.spent ?? 0)
      const totalSavings = savings.reduce((s, e) => s + e.amount, 0)
      setTotalSaved(totalSavings)

      const today = new Date().getDate()
      const remaining = (currentBudget?.budget ?? 22000) - (currentBudget?.spent ?? 0)
      const daysLeft = daysInMonth - today + 1
      setAverageDaily(daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0)
    }).finally(() => setLoading(false))
  }, [user])

  const remaining = totalBudget - totalSpent

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header backTo="/dashboard" />
        <main className="flex-1 p-4 sm:p-8">
          <div className="mx-auto max-w-6xl animate-pulse space-y-6">
            <div className="h-8 w-48 bg-gray-200 rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl" />
              ))}
            </div>
            <div className="h-72 bg-gray-200 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-72 bg-gray-200 rounded-xl" />
              <div className="h-72 bg-gray-200 rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header backTo="/dashboard" />

      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Reports</h1>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Budget</p>
              <p className="text-lg font-bold text-gray-900 break-words">BDT {totalBudget.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Spent</p>
              <p className="text-lg font-bold text-gray-900 break-words">BDT {totalSpent.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Remaining</p>
              <p className={`text-lg font-bold break-words ${remaining >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                BDT {remaining.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Saved</p>
              <p className="text-lg font-bold text-teal-600 break-words">BDT {totalSaved.toLocaleString()}</p>
            </div>
          </div>

          {/* Monthly Budget vs Spent */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Monthly Budget vs Spending</h2>
            <div className="h-64 sm:h-72">
              <ResponsiveBar
                data={monthlyData}
                keys={['budget', 'spent']}
                indexBy="label"
                margin={{ top: 10, right: 10, bottom: 40, left: 60 }}
                padding={0.3}
                groupMode="grouped"
                valueFormat={(v) => `BDT ${Number(v).toLocaleString()}`}
                colors={[brandLight, brand]}
                theme={theme}
                borderRadius={4}
                enableLabel={false}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 8,
                    format: (v: number) => `BDT ${Number(v).toLocaleString()}`,
                  }}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 8,
                  }}
                  legends={[
                    {
                      dataFrom: 'keys',
                      anchor: 'top-right',
                      direction: 'row',
                      translateY: -28,
                      itemsSpacing: 16,
                      itemWidth: 80,
                      itemHeight: 20,
                      symbolSize: 10,
                      symbolShape: 'circle',
                    },
                  ]}
                  motionConfig="gentle"
                />
              </div>
            </div>

            {/* Daily Spending + Recurring Pie */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Daily Spending</h2>
                <p className="text-xs text-gray-400 mb-4">This month &mdash; {averageDaily > 0 ? `BDT ${averageDaily.toLocaleString()}/day remaining` : 'budget exhausted'}</p>
                <div className="h-64">
                  <ResponsiveBar
                    data={dailyData}
                    keys={['spent']}
                    indexBy="day"
                    margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
                    padding={0.15}
                    valueFormat={(v: number) => `BDT ${Number(v).toLocaleString()}`}
                    colors={[brand]}
                    theme={theme}
                    borderRadius={3}
                    enableLabel={false}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 8,
                      tickValues: 4,
                      format: (v: number) => `BDT ${Number(v).toLocaleString()}`,
                    }}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 8,
                      tickValues: 5,
                    }}
                    motionConfig="gentle"
                  />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Expense Breakdown</h2>
              <p className="text-xs text-gray-400 mb-4">Recurring vs one-time this month</p>
              <div className="h-64">
                <ResponsivePie
                  data={recurringPie.filter((d) => d.value > 0)}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  innerRadius={0.6}
                  padAngle={2}
                  cornerRadius={4}
                  activeOuterRadiusOffset={6}
                  colors={{ datum: 'data.color' }}
                  theme={theme}
                  enableArcLinkLabels={false}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor="#fff"
                  arcLabelsRadiusOffset={0.5}
                  valueFormat={(v) => `BDT ${Number(v).toLocaleString()}`}
                  motionConfig="gentle"
                  legends={[
                    {
                      anchor: 'bottom',
                      direction: 'row',
                      translateY: 36,
                      itemsSpacing: 20,
                      itemWidth: 80,
                      itemHeight: 20,
                      symbolSize: 10,
                      symbolShape: 'circle',
                    },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Savings Growth */}
          {savingsData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Savings Growth</h2>
              <div className="h-64 sm:h-72">
                <ResponsiveLine
                  data={[
                    {
                      id: 'Savings',
                      data: savingsData.map((s) => ({ x: s.label, y: s.total })),
                    },
                  ]}
                  margin={{ top: 10, right: 10, bottom: 40, left: 60 }}
                  colors={[teal]}
                  theme={theme}
                  enableArea
                  areaOpacity={0.15}
                  enablePoints
                  pointSize={6}
                  pointColor={teal}
                  pointBorderWidth={2}
                  pointBorderColor="#fff"
                  useMesh
                  enableSlices="x"
                  curve="monotoneX"
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 8,
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 8,
                    format: (v: number) => `BDT ${Number(v).toLocaleString()}`,
                  }}
                  motionConfig="gentle"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
