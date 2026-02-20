import { Toaster as Sonner } from 'sonner';

export default function Toaster() {
  return (
    <Sonner
      position="top-center"
      style={{
        '--normal-bg':        'var(--card)',
        '--normal-border':    'var(--border)',
        '--normal-text':      'var(--card-foreground)',
        '--success-bg':       'var(--card)',
        '--success-border':   'var(--border)',
        '--success-text':     'var(--card-foreground)',
        '--error-bg':         'var(--card)',
        '--error-border':     'var(--border)',
        '--error-text':       'var(--card-foreground)',
        '--warning-bg':       'var(--card)',
        '--warning-border':   'var(--border)',
        '--warning-text':     'var(--card-foreground)',
        '--info-bg':          'var(--card)',
        '--info-border':      'var(--border)',
        '--info-text':        'var(--card-foreground)',
      } as React.CSSProperties}
      toastOptions={{
        duration: 6000,
        classNames: {
          description: 'text-muted-foreground!',
        },
      }}
    />
  );
}
