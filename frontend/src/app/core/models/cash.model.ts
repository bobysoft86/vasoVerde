export type CashSessionStatus = 'OPEN' | 'CLOSED';
export type CashMovementType =
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'COLLECTION'
  | 'WITHDRAWAL'
  | 'EXPENSE'
  | 'ADJUSTMENT'
  | 'REFUND'
  | 'SALE';
export interface CashSession {
  id: string;
  eventId?: string | null;
  status: CashSessionStatus;
  openedAt: string;
  openingAmount: number;
  expectedAmount: number;
  closingAmount: number | null;
  difference: number | null;
  settledAt?: string | null;
  settlementAmount?: number | null;
  location: { id: string; name: string; type: string };
  movements: Array<{
    id: string;
    type: string;
    amount: number;
    signedAmount: number;
    concept: string;
    createdAt: string;
  }>;
}
