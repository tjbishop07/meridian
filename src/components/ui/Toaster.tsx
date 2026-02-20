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
      position="top-center"
      toastOptions={{
        duration: 6000,
        classNames: {
          toast: 'bg-card! border-border! text-card-foreground! shadow-lg!',
          title: 'text-card-foreground! font-medium!',
          description: 'text-muted-foreground!',
        },
      }}
    />
  );
}
