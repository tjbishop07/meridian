import { useState, useEffect } from 'react';
import { Trash2, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Receipt } from '../../types';

interface ReceiptViewerProps {
  receipt: Receipt;
  onDeleted: () => void;
}

export function ReceiptViewer({ receipt, onDeleted }: ReceiptViewerProps) {
  const [deleting, setDeleting] = useState(false);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);

  const data = receipt.extracted_data;

  // Load image as base64 data URL (file:// won't work in dev mode from http origin)
  useEffect(() => {
    setImgDataUrl(null);
    window.electron.invoke('receipt:get-image-data', receipt.file_path)
      .then((dataUrl) => { if (dataUrl) setImgDataUrl(dataUrl); })
      .catch(console.error);
  }, [receipt.file_path]);

  const handleDelete = async () => {
    if (!confirm('Delete this receipt? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await window.electron.invoke('receipt:delete', receipt.id);
      onDeleted();
    } catch (err) {
      console.error('Failed to delete receipt:', err);
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Full-screen lightbox */}
      {lightbox && imgDataUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightbox(false)}
        >
          <img
            src={imgDataUrl}
            alt="Receipt full view"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden">
        {/* Receipt image — full width, prominent */}
        {imgDataUrl ? (
          <div
            className="relative group cursor-zoom-in bg-muted/20"
            onClick={() => setLightbox(true)}
          >
            <img
              src={imgDataUrl}
              alt="Receipt"
              className="w-full object-contain"
              style={{ maxHeight: '220px', display: 'block' }}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <div className="bg-black/60 rounded-full p-2">
                <ZoomIn className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ) : (
          // Loading placeholder
          <div className="w-full bg-muted/30 animate-pulse" style={{ height: '120px' }} />
        )}

        {/* Header row */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-b border-border">
          <span className="text-xs font-medium text-foreground">
            Receipt
            {receipt.ai_model && (
              <span className="ml-1.5 text-muted-foreground/60 font-normal">
                · via {receipt.ai_model}
              </span>
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>

        {/* Extracted data */}
        <div className="p-3 space-y-3">
          {data ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {data.merchant && (
                  <div>
                    <p className="text-muted-foreground">Merchant</p>
                    <p className="font-medium text-foreground truncate">{data.merchant}</p>
                  </div>
                )}
                {data.date && (
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium text-foreground">{data.date}</p>
                  </div>
                )}
                {data.total != null && (
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold text-foreground">${data.total.toFixed(2)}</p>
                  </div>
                )}
                {data.tax != null && (
                  <div>
                    <p className="text-muted-foreground">Tax</p>
                    <p className="font-medium text-foreground">${data.tax.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {data.items.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Items</p>
                  <div className="space-y-0.5">
                    {data.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/40 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-foreground truncate block">{item.name}</span>
                          {item.category_name && (
                            <span className="text-muted-foreground/70">{item.category_name}</span>
                          )}
                        </div>
                        <span className="text-foreground font-medium tabular-nums flex-shrink-0">
                          ${item.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Receipt saved — no data extracted.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
