import { Toaster as HotToaster } from 'react-hot-toast';

export default function Toaster() {
  return (
    <HotToaster
      position="top-left"
      containerStyle={{
        top: 70,
        left: 20,
      }}
      toastOptions={{
        duration: 4000,
        className: 'toast-base',
        success: {
          duration: 3000,
          className: 'toast-success',
        },
        error: {
          duration: 5000,
          className: 'toast-error',
        },
      }}
    />
  );
}
