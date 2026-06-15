import { create } from 'zustand'
import type { ChatMessage, PendingAction, QueuedAction } from './types/assistant'
import { appendAuditEntry } from './services/assistantAudit'

const MSG_KEY = 'panasset.assistant.messages'

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MSG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(MSG_KEY, JSON.stringify(messages.slice(-50)))
  } catch {
    /* ignore quota */
  }
}

function isFormAction(action: PendingAction): boolean {
  return action.kind !== 'deleteAsset' && action.kind !== 'deleteTx'
}

function makeQueueId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

interface AssistantState {
  open: boolean
  messages: ChatMessage[]
  /** 当前打开的表单类待确认动作(由队列驱动) */
  pendingAction: PendingAction | null
  actionQueue: QueuedAction[]
  loading: boolean
  error: string

  toggle: () => void
  setOpen: (open: boolean) => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => string
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  appendToMessage: (id: string, delta: string) => void
  setPendingAction: (action: PendingAction | null) => void
  enqueueActions: (
    items: Array<{ action: PendingAction; summary: string }>,
    messageId?: string,
  ) => void
  openQueuedAction: (queueId: string) => void
  completeQueueItem: (queueId: string, cancelled?: boolean) => void
  processNextInQueue: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
  clearMessages: () => void
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  messages: loadMessages(),
  pendingAction: null,
  actionQueue: [],
  loading: false,
  error: '',

  toggle: () => set((s) => ({ open: !s.open })),

  setOpen: (open) => set({ open }),

  addMessage: (msg) => {
    const id = msg.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const full: ChatMessage = { ...msg, id, timestamp: Date.now() }
    set((s) => {
      const messages = [...s.messages, full]
      saveMessages(messages)
      return { messages }
    })
    return id
  },

  updateMessage: (id, patch) => {
    set((s) => {
      const messages = s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m))
      saveMessages(messages)
      return { messages }
    })
  },

  appendToMessage: (id, delta) => {
    set((s) => {
      const messages = s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      )
      saveMessages(messages)
      return { messages }
    })
  },

  setPendingAction: (pendingAction) => set({ pendingAction }),

  enqueueActions: (items, messageId) => {
    if (items.length === 0) return
    const newItems: QueuedAction[] = items.map((item) => ({
      id: makeQueueId(),
      action: item.action,
      summary: item.summary,
      messageId,
      status: 'pending' as const,
      createdAt: Date.now(),
    }))
    for (const item of newItems) {
      appendAuditEntry({
        kind: 'action_queued',
        summary: item.summary,
        detail: item.action.kind,
      })
    }
    set((s) => ({ actionQueue: [...s.actionQueue, ...newItems] }))
    get().processNextInQueue()
  },

  openQueuedAction: (queueId) => {
    const item = get().actionQueue.find((q) => q.id === queueId)
    if (!item || !isFormAction(item.action)) return
    set((s) => ({
      actionQueue: s.actionQueue.map((q) =>
        q.id === queueId ? { ...q, status: 'active' } : q.status === 'active' ? { ...q, status: 'pending' } : q,
      ),
      pendingAction: item.action,
    }))
  },

  completeQueueItem: (queueId, cancelled = false) => {
    const item = get().actionQueue.find((q) => q.id === queueId)
    if (item) {
      appendAuditEntry({
        kind: cancelled ? 'action_cancelled' : 'action_confirmed',
        summary: item.summary,
        detail: item.action.kind,
      })
    }
    set((s) => ({
      actionQueue: s.actionQueue.map((q) =>
        q.id === queueId ? { ...q, status: cancelled ? 'cancelled' : 'done' } : q,
      ),
      pendingAction: null,
    }))
    get().processNextInQueue()
  },

  processNextInQueue: () => {
    const { actionQueue, pendingAction } = get()
    if (pendingAction) return
    const next = actionQueue.find((q) => q.status === 'pending' && isFormAction(q.action))
    if (!next) return
    set((s) => ({
      actionQueue: s.actionQueue.map((q) =>
        q.id === next.id ? { ...q, status: 'active' } : q,
      ),
      pendingAction: next.action,
    }))
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearMessages: () => {
    saveMessages([])
    set({ messages: [], error: '', actionQueue: [], pendingAction: null })
  },
}))

export function findQueueIdByAction(action: PendingAction, queue: QueuedAction[]): string | undefined {
  const match = queue.find(
    (q) =>
      (q.status === 'pending' || q.status === 'active') &&
      q.action.kind === action.kind &&
      JSON.stringify(q.action) === JSON.stringify(action),
  )
  return match?.id
}

export function openAssistant() {
  useAssistantStore.getState().setOpen(true)
}
