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
          toast: 'bg-foreground! border-foreground/10! text-background! shadow-[0_8px_40px_rgba(0,0,0,0.35)]! rounded-xl!',
          title: 'text-background! font-semibold! text-sm!',
          description: 'text-background/55! text-xs!',
          closeButton: 'bg-background/15! border-background/10! text-background/70! hover:bg-background/25! hover:text-background!',
          icon: '[&>svg]:text-background/80!',
        },
      }}
    />
  );
}
