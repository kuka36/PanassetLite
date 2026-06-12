import { useState } from 'react'
import { palette } from './theme/colors'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Transactions from './pages/Transactions'
import Advisor from './pages/Advisor'
import Settings from './pages/Settings'

const NAV = [
  { id: 'dashboard', label: '总览', icon: '◉' },
  { id: 'assets', label: '资产', icon: '▤' },
  { id: 'transactions', label: '流水', icon: '⇅' },
  { id: 'advisor', label: 'AI 顾问', icon: '✦' },
  { id: 'settings', label: '设置', icon: '⚙' },
] as const

type PageId = (typeof NAV)[number]['id']

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')

  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur max-md:w-16">
        <div className="flex items-center gap-2.5 px-5 py-5 max-md:justify-center max-md:px-0">
          <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0">
            <rect x="2" y="2" width="28" height="28" rx="7" fill={palette.sky500} />
            <path
              d="M9 22 L13 14 L17 18 L23 9"
              stroke="#fff"
              strokeWidth="2.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="23" cy="9" r="2.2" fill="#fff" />
          </svg>
          <div className="max-md:hidden">
            <div className="text-sm font-bold tracking-wide text-slate-100">PanassetLite</div>
            <div className="text-[10px] text-slate-500">轻量个人资产管理</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 max-md:px-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors max-md:justify-center max-md:px-0 ${
                page === item.id
                  ? 'bg-sky-500/15 font-medium text-sky-400'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="max-md:hidden">{item.label}</span>
            </button>
          ))}
        </nav>
        <p className="px-4 pb-4 text-[10px] leading-relaxed text-slate-600 max-md:hidden">
          数据仅存于本地浏览器
          <br />
          无注册 · 无上传 · 隐私至上
        </p>
      </aside>

      {/* 主内容 */}
      <main className="ml-52 flex-1 px-6 pb-10 pt-8 max-md:ml-16 lg:px-10">
        <div key={page} className="fade-up mx-auto max-w-6xl">
          {page === 'dashboard' && <Dashboard goTo={(p) => setPage(p as PageId)} />}
          {page === 'assets' && <Assets />}
          {page === 'transactions' && <Transactions />}
          {page === 'advisor' && <Advisor />}
          {page === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  )
}
