/// <reference types="react" />
export interface ToastOptions {
    duration?: number;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
    dismissible?: boolean;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    icon?: React.ReactNode;
}
export interface PromiseToastMessages<T> {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
}
