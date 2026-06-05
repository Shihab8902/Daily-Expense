import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HiOutlineCash, HiOutlineTrendingUp, HiOutlineTag, HiOutlineChartBar, HiOutlinePlusCircle, HiOutlineChartSquareBar, HiOutlineCollection, HiOutlineAdjustments } from 'react-icons/hi'
import Logo from '../components/Logo'
import ConfirmModal from '../components/ConfirmModal'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'user'
  const initials = (user?.displayName ?? user?.email ?? '')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = async () => {
    setShowLogoutModal(false)
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Logo className="size-7 sm:size-8 text-brand-600 shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold text-brand-700 truncate">Expense Manager</h1>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 sm:gap-3 rounded-lg hover:bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 transition-colors cursor-pointer"
          >
            <span className="size-7 sm:size-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">
              {initials || '?'}
            </span>
            <span className="text-sm text-gray-700 font-medium hidden sm:inline">{displayName}</span>
            <svg className={`size-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); setShowLogoutModal(true) }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-2"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
            {[
              { icon: HiOutlineCash, label: 'Total Expenses', value: 'BDT 2,450', change: '+8% vs last month' },
              { icon: HiOutlineTrendingUp, label: 'Monthly Spending', value: 'BDT 1,280', change: '↓ 12% from last month' },
              { icon: HiOutlineTag, label: 'Active Categories', value: '6', change: 'Groceries, Dining, Rent +3' },
              { icon: HiOutlineChartBar, label: 'Savings Goal', value: 'BDT 420 / BDT 1,000', change: '42% completed' },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="size-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <card.icon className="size-5" />
                  </span>
                  <p className="text-xs sm:text-sm text-gray-500">{card.label}</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{card.value}</p>
                <p className="text-xs text-gray-400">{card.change}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 sm:p-6 mb-6">
            <div className="flex gap-3 sm:gap-4">
              <span className="size-8 sm:size-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 6 6 6 6 0 0 0-6 6 6 6 0 0 0-6-6 6 6 0 0 0 6-6Z" />
                  <path d="M19 14a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3Z" />
                  <path d="M5 14a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3Z" />
                </svg>
              </span>
              <div className="space-y-1">
                <p className="text-sm text-brand-800 leading-relaxed">
                  Your spending is <span className="font-semibold">12% lower</span> than last month &mdash; great job! Dining out decreased by $45, while grocery spending stayed consistent.
                </p>
                <p className="text-sm text-brand-700 leading-relaxed">
                  Tip: You're on track to save $180 this month. Consider setting a category budget for entertainment to optimize further.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  { icon: HiOutlinePlusCircle, label: 'Add Expense', desc: 'Record a new expense', color: 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100', path: '#' },
                  { icon: HiOutlineAdjustments, label: 'Set Monthly Budget', desc: 'Define spending limits', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', path: '/budget' },
                  { icon: HiOutlineChartSquareBar, label: 'View Reports', desc: 'Monthly & category insights', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', path: '#' },
                  { icon: HiOutlineCollection, label: 'Categories', desc: 'Organize your spending', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', path: '#' },
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
                {[
                  { action: 'Grocery shopping', amount: 'BDT 850', time: '2h ago', type: 'expense' },
                  { action: 'Dining out', amount: 'BDT 420', time: '5h ago', type: 'expense' },
                  { action: 'Monthly savings', amount: 'BDT 5,000', time: '1d ago', type: 'saving' },
                  { action: 'Electricity bill', amount: 'BDT 1,200', time: '2d ago', type: 'expense' },
                  { action: 'Freelance payment', amount: 'BDT 12,000', time: '3d ago', type: 'income' },
                ].map((item) => (
                  <div key={item.action + item.time} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900">{item.action}</p>
                      <p className="text-xs text-gray-400">{item.time}</p>
                    </div>
                    <span className={`text-sm font-medium ${item.type === 'income' ? 'text-green-600' : item.type === 'saving' ? 'text-brand-600' : 'text-gray-700'}`}>
                      {item.type === 'income' ? '+' : '-'}{item.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmModal
        open={showLogoutModal}
        title="Logout"
        message="Are you sure you want to log out?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  )
}
