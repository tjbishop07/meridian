import { useState, useEffect } from 'react';
import { Toaster as Sonner } from 'sonner';

export default function Toaster() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() =>
      setIsDark(el.classList.contains('dark'))
    );
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={isDark ? 'dark' : 'light'}
      position="bottom-right"
      toastOptions={{
        duration: 6000,
        classNames: {
          // Base — card look used by loading/default
          toast:       'bg-card! border-none! text-card-foreground! shadow-[0_8px_40px_rgba(0,0,0,0.35)]! rounded-xl!',
          title:       'font-semibold! text-sm! text-card-foreground!',
          description: 'text-muted-foreground! text-xs!',
          closeButton: 'bg-muted! border-none! text-muted-foreground! hover:bg-muted/80! hover:text-foreground!',
          icon:        '[&>svg]:text-muted-foreground!',

          // Info — blue
          info: [
            '[&_[data-title]]:text-blue-600!',
            'dark:[&_[data-title]]:text-blue-400!',
            '[&_[data-description]]:text-blue-600/60!',
            'dark:[&_[data-description]]:text-blue-400/60!',
            '[&_[data-icon]>svg]:text-blue-500!',
            'dark:[&_[data-icon]>svg]:text-blue-400!',
          ].join(' '),

          // Success — emerald
          success: [
            '[&_[data-title]]:text-emerald-600!',
            'dark:[&_[data-title]]:text-emerald-400!',
            '[&_[data-description]]:text-emerald-600/60!',
            'dark:[&_[data-description]]:text-emerald-400/60!',
            '[&_[data-icon]>svg]:text-emerald-500!',
            'dark:[&_[data-icon]>svg]:text-emerald-400!',
          ].join(' '),

          // Error — red
          error: [
            '[&_[data-title]]:text-red-600!',
            'dark:[&_[data-title]]:text-red-400!',
            '[&_[data-description]]:text-red-600/60!',
            'dark:[&_[data-description]]:text-red-400/60!',
            '[&_[data-icon]>svg]:text-red-500!',
            'dark:[&_[data-icon]>svg]:text-red-400!',
          ].join(' '),

          // Warning — amber
          warning: [
            '[&_[data-title]]:text-amber-600!',
            'dark:[&_[data-title]]:text-amber-400!',
            '[&_[data-description]]:text-amber-600/60!',
            'dark:[&_[data-description]]:text-amber-400/60!',
            '[&_[data-icon]>svg]:text-amber-500!',
            'dark:[&_[data-icon]>svg]:text-amber-400!',
          ].join(' '),
        },
      }}
    />
  );
}
