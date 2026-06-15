import { useEffect } from 'react'
import Modal from './Modal'
import {
  SHORTCUT_SCOPE_LABEL,
  setShortcutLayerPaused,
  type ShortcutScope,
  shortcutsByScope,
} from '../keyboard/shortcutCatalog'
import { formatShortcut } from '../utils/keyboard'

const SCOPES: ShortcutScope[] = ['global', 'dashboard', 'assets', 'transactions', 'overlay']

interface Props {
  open: boolean
  onClose: () => void
}

export default function ShortcutHelpModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    setShortcutLayerPaused(true)
    return () => setShortcutLayerPaused(false)
  }, [open])

  if (!open) return null

  return (
    <Modal title="键盘快捷键" onClose={onClose} size="md">
      <div className="space-y-5">
        {SCOPES.map((scope) => {
          const items = shortcutsByScope(scope)
          if (items.length === 0) return null
          return (
            <section key={scope}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {SHORTCUT_SCOPE_LABEL[scope]}
              </h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <kbd className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700">
                      {formatShortcut(item.keys)}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        <p className="text-xs text-slate-400">在输入框内编辑时，单键快捷键不会触发。</p>
      </div>
    </Modal>
  )
}
