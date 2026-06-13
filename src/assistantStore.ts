import { create } from 'zustand'
import type { ChatMessage, PendingAction } from './types/assistant'

const MSG_KEY = 'panasset.assistant.messages'

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(MSG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(MSG_KEY, JSON.stringify(messages.slice(-50)))
  } catch {
    /* ignore quota */
  }
}

interface AssistantState {
  open: boolean
  messages: ChatMessage[]
  pendingAction: PendingAction | null
  loading: boolean
  error: string

  toggle: () => void
  setOpen: (open: boolean) => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => string
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  appendToMessage: (id: string, delta: string) => void
  setPendingAction: (action: PendingAction | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
  clearMessages: () => void
}

export const useAssistantStore = create<AssistantState>((set) => ({
  open: false,
  messages: loadMessages(),
  pendingAction: null,
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

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearMessages: () => {
    saveMessages([])
    set({ messages: [], error: '' })
  },
}))
