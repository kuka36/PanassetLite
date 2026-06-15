import type { AuditLogEntry } from '../types/assistant'

const AUDIT_KEY = 'panasset.assistant.audit'
const MAX_ENTRIES = 200

function load(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AuditLogEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(entries: AuditLogEntry[]) {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    /* ignore quota */
  }
}

export function appendAuditEntry(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
): AuditLogEntry {
  const full: AuditLogEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  }
  const next = [...load(), full]
  save(next)
  return full
}

export function getAuditLog(): AuditLogEntry[] {
  return load()
}

export function clearAuditLog() {
  try {
    localStorage.removeItem(AUDIT_KEY)
  } catch {
    /* ignore */
  }
}
