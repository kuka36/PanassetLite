import { Sparkles } from 'lucide-react'
import { useAssistantStore } from '../assistantStore'

export default function AssistantFab() {
  const open = useAssistantStore((s) => s.open)
  const toggle = useAssistantStore((s) => s.toggle)

  if (open) return null

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition-all duration-200 hover:bg-indigo-700 active:scale-95"
      aria-label="打开 AI 助手"
    >
      <Sparkles className="h-6 w-6" />
    </button>
  )
}
