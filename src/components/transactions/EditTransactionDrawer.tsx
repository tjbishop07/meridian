import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import TransactionForm from './TransactionForm';
import { ReceiptCapture } from '../receipts/ReceiptCapture';
import { useTransactions } from '../../hooks/useTransactions';
import { useTags } from '../../hooks/useTags';
import type { Transaction, CreateTransactionInput, Receipt } from '../../types';

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function EditTransactionDrawer({ transaction, onClose, onSaved }: Props) {
  const { updateTransaction } = useTransactions();
  const { tags, setTagsForTransaction } = useTags();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [showReceiptCapture, setShowReceiptCapture] = useState(false);

  useEffect(() => {
    if (transaction) {
      setReceipt(null);
      setShowReceiptCapture(false);
      window.electron.invoke('receipt:get-for-transaction', transaction.id)
        .then(setReceipt)
        .catch(console.error);
    } else {
      setReceipt(null);
      setShowReceiptCapture(false);
    }
  }, [transaction?.id]);

  const handleSubmit = async (data: CreateTransactionInput, tagIds: number[]) => {
    if (!transaction) return;
    await updateTransaction({
      id: transaction.id,
      type: data.type,
      account_id: data.account_id,
      category_id: data.category_id,
      date: data.date,
      description: data.description,
      amount: data.amount,
      status: data.status,
      notes: data.notes,
      to_account_id: data.to_account_id,
    } as any, true);
    await setTagsForTransaction(transaction.id, tagIds);
    onClose();
    onSaved?.();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`absolute inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          transaction ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute inset-y-0 left-0 z-50 w-[420px] bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out ${
          transaction ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Edit Transaction</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowReceiptCapture(true)}
              title="Capture receipt"
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Receipt capture overlay */}
        {showReceiptCapture && transaction && (
          <ReceiptCapture
            transactionId={transaction.id}
            onDone={() => {
              setShowReceiptCapture(false);
              window.electron.invoke('receipt:get-for-transaction', transaction.id)
                .then(setReceipt)
                .catch(console.error);
            }}
            onCancel={() => setShowReceiptCapture(false)}
          />
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {transaction && (
            <TransactionForm
              transaction={transaction}
              receipt={receipt}
              onSubmit={handleSubmit}
              onCancel={onClose}
              onReceiptDeleted={() => setReceipt(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
