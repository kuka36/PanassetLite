import type { KeySpec } from '../utils/keyboard'

export type ShortcutScope = 'global' | 'dashboard' | 'assets' | 'flows' | 'overlay'

export interface ShortcutEntry {
  id: string
  label: string
  keys: KeySpec
  scope: ShortcutScope
}

export const SHORTCUT_SCOPE_LABEL: Record<ShortcutScope, string> = {
  global: '全局',
  dashboard: '总览',
  assets: '资产',
  flows: '流水',
  overlay: '覆盖层',
}

export const SHORTCUT_CATALOG: ShortcutEntry[] = [
  { id: 'nav-dashboard', label: '切换到总览', keys: { key: '1', alt: true }, scope: 'global' },
  { id: 'nav-assets', label: '切换到资产', keys: { key: '2', alt: true }, scope: 'global' },
  { id: 'nav-strategies', label: '切换到策略', keys: { key: '3', alt: true }, scope: 'global' },
  { id: 'nav-settings', label: '切换到设置', keys: { key: '4', alt: true }, scope: 'global' },
  { id: 'toggle-assistant', label: '打开/关闭 AI 助手', keys: { key: 'k', mod: true }, scope: 'global' },
  { id: 'show-help', label: '显示快捷键帮助', keys: { key: '?', shift: true }, scope: 'global' },
  { id: 'add-asset', label: '添加资产', keys: { key: 'a' }, scope: 'assets' },
  { id: 'nl-tx', label: '记一笔', keys: { key: 't' }, scope: 'assets' },
  { id: 'add-tx', label: '记一笔', keys: { key: 'n' }, scope: 'flows' },
  { id: 'close-overlay', label: '关闭弹窗/面板', keys: { key: 'Escape' }, scope: 'overlay' },
]

let paused = false

export function setShortcutLayerPaused(v: boolean) {
  paused = v
}

export function isShortcutLayerPaused() {
  return paused
}

export function shortcutsByScope(scope: ShortcutScope): ShortcutEntry[] {
  return SHORTCUT_CATALOG.filter((s) => s.scope === scope)
}
