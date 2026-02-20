import { cn } from '@/lib/utils';

const BUBBLES = [
  { left: '8%',  size: 6,  duration: 6.0, delay: 0.0, opacity: 0.18 },
  { left: '18%', size: 4,  duration: 7.5, delay: 1.2, opacity: 0.12 },
  { left: '30%', size: 8,  duration: 5.5, delay: 2.8, opacity: 0.15 },
  { left: '42%', size: 5,  duration: 8.0, delay: 0.6, opacity: 0.10 },
  { left: '55%', size: 7,  duration: 6.5, delay: 3.5, opacity: 0.20 },
  { left: '65%', size: 4,  duration: 7.0, delay: 1.8, opacity: 0.13 },
  { left: '75%', size: 9,  duration: 5.0, delay: 4.2, opacity: 0.14 },
  { left: '85%', size: 5,  duration: 7.8, delay: 0.4, opacity: 0.11 },
  { left: '93%', size: 6,  duration: 6.2, delay: 2.1, opacity: 0.16 },
];

export function FloatingBubbles({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}>
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary"
          style={{
            left: b.left,
            bottom: '-12px',
            width: b.size,
            height: b.size,
            ['--bubble-opacity' as any]: b.opacity,
            animation: `bubble-float ${b.duration}s ease-in ${b.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
