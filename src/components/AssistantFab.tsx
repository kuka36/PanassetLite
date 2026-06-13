import { Sparkles, X } from 'lucide-react'
import { useAssistantStore } from '../assistantStore'

export default function AssistantFab() {
  const open = useAssistantStore((s) => s.open)
  const toggle = useAssistantStore((s) => s.toggle)

  return (
    <button
      type="button"
      onClick={toggle}
      className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-indigo-200 transition-all duration-200 active:scale-95 ${
        open
          ? 'bg-slate-700 text-white hover:bg-slate-800'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
      }`}
      aria-label={open ? '关闭 AI 助手' : '打开 AI 助手'}
    >
      {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
    </button>
  )
}
