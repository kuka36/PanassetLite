import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** md=表单弹窗, lg=宽表(原 wide), xl=资产详情等大面板 */
  size?: 'md' | 'lg' | 'xl'
  /** @deprecated 请用 size="lg" */
  wide?: boolean
}

const SIZE_CLS: Record<NonNullable<Props['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl max-h-[90vh] overflow-y-auto',
}

export default function Modal({ title, onClose, children, size, wide }: Props) {
  const resolved = size ?? (wide ? 'lg' : 'md')
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={`fade-up my-6 w-full ${SIZE_CLS[resolved]} rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 active:scale-95"
            >
              <X className="h-5 w-5" />
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
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
export const labelCls = 'mb-1 block text-xs font-medium text-slate-500'
export const formGroupCls = 'rounded-xl border border-slate-100 bg-slate-50 p-4'
export const btnPrimary =
  'rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-all duration-200 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
export const btnGhost =
  'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50 active:scale-95'
export const btnAi =
  'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-200 transition-all duration-200 hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
