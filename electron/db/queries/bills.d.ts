import type { Bill, BillInput, BillPayment } from '../../../src/types';
export declare function getAllBills(activeOnly?: boolean): Bill[];
export declare function getUpcomingBills(days?: number): Bill[];
export declare function getBillById(id: number): Bill | null;
export declare function createBill(data: BillInput): Bill;
export declare function updateBill(data: Partial<BillInput> & {
    id: number;
}): Bill;
export declare function deleteBill(id: number): void;
export declare function recordPayment(billId: number, amount: number, date?: string, transactionId?: number, notes?: string): BillPayment;
export declare function getBillPayments(billId: number): BillPayment[];
