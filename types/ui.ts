import { PendingAction } from './store';

export interface ChatMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    content: string;
    timestamp: number;
    pendingAction?: PendingAction; // If the bot proposes an action
    isError?: boolean;
    image?: string; // Base64 encoded image
}

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number; // in milliseconds, undefined means no auto-dismiss
}
