import { useCallback, useEffect, useMemo, useState } from 'react'
import { initAnalytics, reportPageView } from './services/analytics'
import {
  ArrowLeftRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Settings,
  Wallet,
  X,
} from 'lucide-react'
import { palette } from './theme/colors'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Transactions from './pages/Transactions'
import SettingsPage from './pages/Settings'
import AssistantFab from './components/AssistantFab'
import AssistantPanel from './components/AssistantPanel'
import AssistantConfirmModals from './components/AssistantConfirmModals'
import ShortcutHelpModal from './components/ShortcutHelpModal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAssistantStore } from './assistantStore'
import type { AppPageId } from './types/assistant'

const NAV = [
  { id: 'dashboard', label: '总览', icon: LayoutDashboard },
  { id: 'assets', label: '资产', icon: Wallet },
  { id: 'transactions', label: '流水', icon: ArrowLeftRight },
  { id: 'settings', label: '设置', icon: Settings },
] as const

type PageId = (typeof NAV)[number]['id']

const SIDEBAR_EXPANDED = 'w-56'
const SIDEBAR_COLLAPSED = 'w-[4.5rem]'
const MAIN_EXPANDED = 'md:ml-56'
const MAIN_COLLAPSED = 'md:ml-[4.5rem]'
const ABOUT_URL = 'https://mp.weixin.qq.com/s/du0wh1As2s-casSadFAgZQ'

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const addAssistantMessage = useAssistantStore((s) => s.addMessage)
  const toggleAssistant = useAssistantStore((s) => s.toggle)

  useEffect(() => {
    initAnalytics('dashboard')
  }, [])

  const goTo = useCallback((id: PageId) => {
    setPage(id)
    reportPageView(id)
    setMobileOpen(false)
  }, [])

  const globalShortcuts = useMemo(
    () => [
      { key: '1', alt: true, action: () => goTo('dashboard') },
      { key: '2', alt: true, action: () => goTo('assets') },
      { key: '3', alt: true, action: () => goTo('transactions') },
      { key: '4', alt: true, action: () => goTo('settings') },
      { key: 'k', mod: true, action: toggleAssistant },
      { key: '?', shift: true, action: () => setHelpOpen(true) },
    ],
    [goTo, toggleAssistant],
  )
  useKeyboardShortcuts(globalShortcuts)

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
  const mainMargin = collapsed ? MAIN_COLLAPSED : MAIN_EXPANDED

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 移动端顶栏 */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-100 bg-white/80 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl p-2 text-slate-600 transition-all duration-200 hover:bg-slate-100 active:scale-95"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-semibold text-slate-800">PanassetLite</span>
        </div>
        <div className="w-9" />
      </header>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="关闭菜单"
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-100 bg-white transition-all duration-200 ${sidebarWidth} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-5">
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center w-full' : ''}`}>
            <LogoMark className="h-7 w-7 shrink-0" />
            {!collapsed && (
              <div>
                <div className="text-sm font-bold tracking-wide text-slate-800">PanassetLite</div>
                <div className="text-[10px] text-slate-500">轻量个人资产管理</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 md:hidden"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item.id)}
                title={
                  collapsed
                    ? item.label
                    : `Alt+${NAV.findIndex((n) => n.id === item.id) + 1} · ${item.label}`
                }
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 active:scale-[0.98] ${
                  collapsed ? 'justify-center px-0' : ''
                } ${
                  active
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-blue-600' : ''}`} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className={`${collapsed ? 'mx-3 mb-2' : 'px-4 pb-2'} text-[10px] leading-relaxed text-slate-400`}>
          {!collapsed && (
            <p>
              数据仅存于本地浏览器
              <br />
              无注册 · 无上传 · 隐私至上
            </p>
          )}
          <a
            href={ABOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="关于 PanassetLite"
            aria-label="关于 PanassetLite"
            className={`text-slate-500 transition-colors hover:text-slate-700 ${
              collapsed
                ? 'flex items-center justify-center rounded-xl py-2.5 transition-all duration-200 hover:bg-slate-50'
                : 'mt-2 inline-flex items-center gap-1.5'
            }`}
          >
            <BookOpen className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>关于 PanassetLite</span>}
          </a>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mx-3 mb-4 hidden items-center justify-center gap-1 rounded-xl border border-slate-100 py-2 text-xs text-slate-500 transition-all duration-200 hover:bg-slate-50 md:flex"
          aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>收起侧栏</span>}
        </button>
      </aside>

      {/* 主内容 */}
      <main className={`px-4 pb-10 pt-20 transition-all duration-200 md:pt-8 md:px-6 lg:px-10 ${mainMargin}`}>
        <div key={page} className="animate-fade-in mx-auto max-w-6xl space-y-6">
          {page === 'dashboard' && <Dashboard goTo={(p) => goTo(p as PageId)} />}
          {page === 'assets' && <Assets />}
          {page === 'transactions' && <Transactions />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>

      <AssistantFab />
      <AssistantPanel currentPage={page as AppPageId} onNavigate={goTo} />
      <AssistantConfirmModals
        onSuccess={(msg) => addAssistantMessage({ role: 'assistant', content: msg })}
      />
      <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className}>
      <rect x="2" y="2" width="28" height="28" rx="7" fill={palette.blue600} />
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
  )
}
