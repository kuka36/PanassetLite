export interface KeySpec {
  key: string
  mod?: boolean
  alt?: boolean
  shift?: boolean
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function isMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey
}

function normalizeKey(key: string): string {
  if (key.length === 1) return key.toLowerCase()
  return key
}

function isDigitKey(key: string): boolean {
  return key.length === 1 && key >= '0' && key <= '9'
}

/** macOS Option+数字会打出特殊字符(如 ⌥2 → ™),需用物理键位 code 匹配 */
function matchesDigitCode(e: KeyboardEvent, digit: string): boolean {
  return e.code === `Digit${digit}` || e.code === `Numpad${digit}`
}

export function matchKey(e: KeyboardEvent, spec: KeySpec): boolean {
  const wantMod = spec.mod ?? false
  const wantAlt = spec.alt ?? false
  const wantShift = spec.shift ?? false

  if (isMod(e) !== wantMod) return false
  if (e.altKey !== wantAlt) return false
  if (e.shiftKey !== wantShift) return false

  const eventKey = normalizeKey(e.key)
  const specKey = normalizeKey(spec.key)
  if (eventKey === specKey) return true

  if (isDigitKey(specKey) && matchesDigitCode(e, specKey)) return true

  return false
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent)

export function formatShortcut(spec: KeySpec): string {
  const parts: string[] = []
  if (spec.mod) parts.push(isMac ? '⌘' : 'Ctrl')
  if (spec.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (spec.shift) parts.push(isMac ? '⇧' : 'Shift')

  let keyLabel = spec.key
  if (keyLabel === '?') keyLabel = '?'
  else if (keyLabel === 'Escape') keyLabel = 'Esc'
  else if (keyLabel.length === 1) keyLabel = keyLabel.toUpperCase()
  parts.push(keyLabel)

  return parts.join(isMac ? '' : '+')
}
