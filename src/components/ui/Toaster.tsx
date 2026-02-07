import { Toaster as HotToaster } from 'react-hot-toast';

export default function Toaster() {
  return (
    <HotToaster
      position="top-center"
      containerStyle={{
        top: 10,
        zIndex: 99999,
      }}
      toastOptions={{
        duration: 4000,
        className: 'toast-base',
        style: {
          zIndex: 99999,
        },
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
