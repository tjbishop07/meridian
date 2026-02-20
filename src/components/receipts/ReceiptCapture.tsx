import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReceiptData } from '../../types';

type CaptureStep = 'starting' | 'waiting' | 'uploading' | 'analyzing' | 'done' | 'error';

interface ReceiptCaptureProps {
  transactionId?: number | null;
  onDone: (receiptId: number, extractedData: ReceiptData | null) => void;
  onCancel: () => void;
}

// Organic scatter — heavier at edges, avoids dead-center
const PARTICLES = [
  { x:  8, y: 14, s: 3, d: 0.0  },
  { x: 25, y:  7, s: 2, d: 0.5  },
  { x: 48, y: 18, s: 4, d: 1.1  },
  { x: 68, y:  9, s: 2, d: 0.3  },
  { x: 84, y: 24, s: 3, d: 1.7  },
  { x: 14, y: 38, s: 2, d: 0.9  },
  { x: 78, y: 46, s: 3, d: 1.4  },
  { x: 92, y: 33, s: 2, d: 0.2  },
  { x: 38, y: 62, s: 3, d: 1.9  },
  { x: 55, y: 44, s: 2, d: 0.7  },
  { x:  6, y: 72, s: 4, d: 1.3  },
  { x: 30, y: 82, s: 2, d: 0.4  },
  { x: 62, y: 78, s: 3, d: 1.0  },
  { x: 85, y: 70, s: 2, d: 1.6  },
  { x: 72, y: 90, s: 3, d: 0.6  },
  { x: 20, y: 56, s: 2, d: 2.1  },
];

export function ReceiptCapture({ transactionId, onDone, onCancel }: ReceiptCaptureProps) {
  const [step, setStep] = useState<CaptureStep>('starting');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [captureUrl, setCaptureUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [receiptImageDataUrl, setReceiptImageDataUrl] = useState<string | null>(null);
  const pendingReceiptId = useRef<number | null>(null);

  useEffect(() => {
    startServer();

    const handleProgress = (data: { step: string; imageDataUrl?: string }) => {
      if (data.step === 'uploading') setStep('uploading');
      else if (data.step === 'analyzing') {
        if (data.imageDataUrl) setReceiptImageDataUrl(data.imageDataUrl);
        setStep('analyzing');
      } else if (data.step === 'done') {
        setStep('done');
      }
    };

    const handleUploaded = (data: { receiptId: number; extractedData: ReceiptData | null }) => {
      pendingReceiptId.current = data.receiptId;
      if (transactionId && data.receiptId) {
        window.electron.invoke('receipt:link-transaction', data.receiptId, transactionId).catch(console.error);
      }
      setTimeout(() => onDone(data.receiptId, data.extractedData), 1500);
    };

    const handleError = (data: { message: string }) => {
      setErrorMsg(data.message);
      setStep('error');
    };

    window.electron.on('receipt:analysis-progress', handleProgress);
    window.electron.on('receipt:uploaded', handleUploaded);
    window.electron.on('receipt:error', handleError);

    return () => {
      window.electron.removeListener('receipt:analysis-progress', handleProgress);
      window.electron.removeListener('receipt:uploaded', handleUploaded);
      window.electron.removeListener('receipt:error', handleError);
      window.electron.invoke('receipt:stop-server').catch(console.error);
    };
  }, []);

  const startServer = async () => {
    try {
      setStep('starting');
      const result = await window.electron.invoke('receipt:start-server');
      if ('error' in result) {
        setErrorMsg(
          result.error === 'not_on_wifi'
            ? 'Not connected to WiFi. Connect your computer to a WiFi network and try again.'
            : 'Failed to start capture server. Please try again.'
        );
        setStep('error');
        return;
      }
      setCaptureUrl(result.url);
      const dataUrl = await QRCode.toDataURL(result.url, {
        width: 240, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setStep('waiting');
    } catch {
      setErrorMsg('Failed to start server. Please try again.');
      setStep('error');
    }
  };

  const handleCancel = () => {
    window.electron.invoke('receipt:stop-server').catch(console.error);
    onCancel();
  };

  const showingImage = receiptImageDataUrl &&
    (step === 'uploading' || step === 'analyzing' || step === 'done');

  return (
    <>
      <style>{`
        @keyframes aiParticle {
          0%   { opacity: 0;    transform: scale(0.3); }
          20%  { opacity: 0.9;  transform: scale(1.2); }
          55%  { opacity: 0.55; transform: scale(1.0); }
          80%  { opacity: 0.85; transform: scale(1.1); }
          100% { opacity: 0;    transform: scale(0.3); }
        }
        @keyframes aiShimmer {
          0%   { transform: translateX(-180%) rotate(22deg); }
          100% { transform: translateX(380%) rotate(22deg); }
        }
        @keyframes aiCheckIn {
          0%   { opacity: 0; transform: scale(0.5); }
          65%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1);   }
        }
      `}</style>

      <div className="absolute inset-0 z-10 bg-card flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Capture Receipt</h3>
          <button
            onClick={handleCancel}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-5 overflow-y-auto">

          {step === 'starting' && (
            <>
              <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Starting camera server…</p>
            </>
          )}

          {step === 'waiting' && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Scan with your phone to take a photo
              </p>
              {qrDataUrl && (
                <div className="p-3 bg-white rounded-xl shadow-md">
                  <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              )}
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">or open on your phone:</p>
                <p className="text-xs font-mono text-primary break-all">{captureUrl}</p>
              </div>
              <p className="text-xs text-amber-500 text-center">
                📶 Must be on the same WiFi network
              </p>
            </>
          )}

          {/* Image with overlay states */}
          {showingImage && (
            <div className="w-full space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-border/60 bg-black mx-auto">
                <img
                  src={receiptImageDataUrl!}
                  alt="Receipt"
                  className="w-full object-contain block"
                  style={{ maxHeight: '260px' }}
                />

                {/* ── AI analyzing overlay ── */}
                {step === 'analyzing' && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Base darkening */}
                    <div className="absolute inset-0 bg-black/40" />

                    {/* Diagonal shimmer band — slow, barely visible */}
                    <div
                      className="absolute inset-y-0"
                      style={{
                        width: '18%',
                        top: '-20%',
                        bottom: '-20%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
                        animation: 'aiShimmer 5s ease-in-out infinite',
                      }}
                    />

                    {/* Sparkle particles */}
                    {PARTICLES.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: `${p.x}%`,
                          top: `${p.y}%`,
                          width: `${p.s}px`,
                          height: `${p.s}px`,
                          marginLeft: `-${p.s / 2}px`,
                          marginTop: `-${p.s / 2}px`,
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.95)',
                          boxShadow: [
                            `0 0 ${p.s + 2}px ${p.s}px rgba(255,255,255,0.7)`,
                            `0 0 ${p.s * 4}px ${p.s * 2}px rgba(210,230,255,0.25)`,
                          ].join(', '),
                          animation: `aiParticle ${2.2 + (i % 5) * 0.22}s ease-in-out infinite`,
                          animationDelay: `${p.d}s`,
                          transformOrigin: 'center center',
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* ── Done overlay ── */}
                {step === 'done' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 pointer-events-none">
                    <div
                      style={{
                        animation: 'aiCheckIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
                      }}
                    >
                      {/* Clean checkmark circle */}
                      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                        <circle cx="26" cy="26" r="24" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />
                        <path d="M16 26.5l8 8 12-14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Status text */}
              {step === 'uploading' && (
                <div className="flex items-center justify-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading…</p>
                </div>
              )}
              {step === 'analyzing' && (
                <div className="text-center space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Analyzing with AI</p>
                  <p className="text-xs text-muted-foreground">Extracting merchant, items & amounts</p>
                </div>
              )}
              {step === 'done' && (
                <p className="text-sm font-medium text-center text-foreground">Receipt captured</p>
              )}
            </div>
          )}

          {/* Fallback: no image yet */}
          {step === 'uploading' && !showingImage && (
            <>
              <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-medium text-foreground">Uploading photo…</p>
            </>
          )}
          {step === 'analyzing' && !showingImage && (
            <>
              <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-medium text-foreground">Analyzing with AI…</p>
              <p className="text-xs text-muted-foreground">This may take a moment</p>
            </>
          )}
          {step === 'done' && !showingImage && (
            <div style={{ animation: 'aiCheckIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <circle cx="26" cy="26" r="24" fill="rgba(100,200,100,0.15)" stroke="rgba(74,222,128,0.9)" strokeWidth="2" />
                <path d="M16 26.5l8 8 12-14" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {step === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full border border-destructive/30 bg-destructive/10 flex items-center justify-center">
                <span className="text-destructive text-lg font-medium">!</span>
              </div>
              <p className="text-sm text-destructive text-center">{errorMsg}</p>
              <Button size="sm" variant="outline" onClick={startServer}>Try Again</Button>
            </>
          )}
        </div>

        {(step === 'waiting' || step === 'error') && (
          <div className="px-6 pb-6 flex-shrink-0">
            <Button variant="outline" className="w-full" onClick={handleCancel}>Cancel</Button>
          </div>
        )}
      </div>
    </>
  );
}
