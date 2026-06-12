import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export default function Modal({ title, onClose, children, wide }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 外层负责滚动,内层 min-h-full 居中:内容高于视口时从顶部完整滚动,不会被裁切 */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={`fade-up my-6 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 placeholder:text-slate-600'
export const labelCls = 'mb-1 block text-xs font-medium text-slate-400'
export const btnPrimary =
  'rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
export const btnGhost =
  'rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors'
