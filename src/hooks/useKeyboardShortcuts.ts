import { useEffect, useRef } from 'react'
import { isShortcutLayerPaused } from '../keyboard/shortcutCatalog'
import { isEditableTarget, matchKey, type KeySpec } from '../utils/keyboard'

export interface ShortcutDef extends KeySpec {
  action: () => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[], enabled = true) {
  const shortcutsRef = useRef(shortcuts)

  useEffect(() => {
    shortcutsRef.current = shortcuts
  })

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (isShortcutLayerPaused()) return

      for (const s of shortcutsRef.current) {
        if (matchKey(e, s)) {
          e.preventDefault()
          s.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled])
}
