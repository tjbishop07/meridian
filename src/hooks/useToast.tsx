import toast from 'react-hot-toast';
import type { ToastOptions, PromiseToastMessages } from '../types/toast';

export function useToast() {
  return {
    success: (message: string, options?: ToastOptions) => {
      return toast.success(message, {
        duration: 3000,
        className: 'toast-success',
        ...options,
      });
    },

    error: (message: string, options?: ToastOptions) => {
      return toast.error(message, {
        duration: 5000,
        className: 'toast-error',
        ...options,
      });
    },

    warning: (message: string, options?: ToastOptions) => {
      return toast((t) => (
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{message}</span>
        </div>
      ), {
        duration: 4000,
        className: 'toast-warning',
        ...options,
      });
    },

    info: (message: string, options?: ToastOptions) => {
      return toast((t) => (
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{message}</span>
        </div>
      ), {
        duration: 4000,
        className: 'toast-info',
        ...options,
      });
    },

    loading: (message: string, options?: ToastOptions) => {
      return toast.loading(message, {
        className: 'toast-base',
        ...options,
      });
    },

    promise: <T,>(
      promise: Promise<T>,
      messages: PromiseToastMessages<T>
    ) => {
      return toast.promise(promise, messages, {
        loading: { className: 'toast-base' },
        success: { className: 'toast-success' },
        error: { className: 'toast-error' },
      });
    },

    dismiss: (toastId?: string) => {
      return toast.dismiss(toastId);
    },
  };
}

// Export raw toast for non-hook usage
export { toast };
