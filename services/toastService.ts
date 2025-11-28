import { ToastMessage, ToastType } from '../types';

type ToastListener = (toast: ToastMessage) => void;

class ToastService {
    private listeners: ToastListener[] = [];
    private toastCounter = 0;

    subscribe(listener: ToastListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify(toast: ToastMessage) {
        this.listeners.forEach(listener => listener(toast));
    }

    showToast(type: ToastType, message: string, duration?: number) {
        const toast: ToastMessage = {
            id: `toast-${++this.toastCounter}-${Date.now()}`,
            type,
            message,
            duration: duration !== undefined ? duration : 5000 // Default 5 seconds
        };
        this.notify(toast);
    }

    showError(message: string, duration?: number) {
        this.showToast('error', message, duration);
    }

    showWarning(message: string, duration?: number) {
        this.showToast('warning', message, duration);
    }

    showInfo(message: string, duration?: number) {
        this.showToast('info', message, duration);
    }

    showSuccess(message: string, duration?: number) {
        this.showToast('success', message, duration);
    }
}

export const toastService = new ToastService();
