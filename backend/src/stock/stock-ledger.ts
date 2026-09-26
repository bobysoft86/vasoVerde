import { BadRequestException } from '@nestjs/common';
import { StockCondition, StockMovementType } from '@prisma/client';

export interface LedgerMovement {
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  type: StockMovementType;
  createdAt: Date;
  items: Array<{ cupTypeId: string; quantity: number; condition: StockCondition }>;
}
export type Balance = Map<string, number>;

// External-bar collections consume the controlled balance without inventing negatives.
export function consumeAcrossConditions(balance: Balance, cupTypeId: string, preferred: StockCondition, quantity: number) {
  for (const condition of [preferred, ...Object.values(StockCondition).filter(c => c !== preferred)]) {
    const key = `${cupTypeId}:${condition}`;
    const used = Math.min(Math.max(0, balance.get(key) ?? 0), quantity);
    balance.set(key, (balance.get(key) ?? 0) - used);
    quantity -= used;
    if (!quantity) break;
  }
}

export function balanceFor(movements: LedgerMovement[], locationId: string): Balance {
  const balance: Balance = new Map();
  for (const movement of [...movements].sort((a,b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    for (const item of movement.items) {
      if (movement.destinationLocationId === locationId) {
        const key = `${item.cupTypeId}:${item.condition}`;
        balance.set(key, (balance.get(key) ?? 0) + item.quantity);
      }
      if (movement.sourceLocationId === locationId) {
        if (movement.type === StockMovementType.RETURN) {
          consumeAcrossConditions(balance, item.cupTypeId, item.condition, item.quantity);
        } else {
          const condition = movement.type === StockMovementType.CLEANING_RETURN ? StockCondition.DIRTY : item.condition;
          const key = `${item.cupTypeId}:${condition}`;
          balance.set(key, (balance.get(key) ?? 0) - item.quantity);
        }
      }
    }
  }
  return balance;
}

// Reserve each line against the remaining stock, not repeatedly against the initial total.
export function reserveStock(balance: Balance, type: StockMovementType, items: LedgerMovement['items'], externalBar = false) {
  for (const item of items) {
    if (type === StockMovementType.RETURN && externalBar) continue;
    const condition = type === StockMovementType.CLEANING_RETURN ? StockCondition.DIRTY : item.condition;
    const key = `${item.cupTypeId}:${condition}`;
    const available = type === StockMovementType.RETURN
      ? [...balance].filter(([k]) => k.startsWith(`${item.cupTypeId}:`)).reduce((n,[,q]) => n + Math.max(0,q), 0)
      : balance.get(key) ?? 0;
    if (available < item.quantity) throw new BadRequestException({ message: 'Stock insuficiente', cupTypeId: item.cupTypeId, condition, available, requested: item.quantity });
    if (type === StockMovementType.RETURN) consumeAcrossConditions(balance,item.cupTypeId,item.condition,item.quantity);
    else balance.set(key,available-item.quantity);
  }
}
