import { BadRequestException } from '@nestjs/common';
import { StockCondition, StockMovementType } from '@prisma/client';
import { balanceFor, reserveStock } from './stock-ledger';

describe('stock ledger', () => {
  it('keeps delivery and collection balances by condition', () => {
    const balance = balanceFor([
      {
        sourceLocationId: 'warehouse', destinationLocationId: 'bar',
        type: StockMovementType.DELIVERY, createdAt: new Date('2026-01-01'),
        items: [{ cupTypeId: 'cup', quantity: 100, condition: StockCondition.CLEAN }],
      },
      {
        sourceLocationId: 'bar', destinationLocationId: 'warehouse',
        type: StockMovementType.RETURN, createdAt: new Date('2026-01-02'),
        items: [{ cupTypeId: 'cup', quantity: 40, condition: StockCondition.DIRTY }],
      },
    ], 'bar');

    expect(balance.get('cup:CLEAN')).toBe(60);
    expect(balance.get('cup:DIRTY')).toBe(0);
  });

  it('allows external bars to return more than their controlled balance', () => {
    const balance = new Map<string, number>([['cup:CLEAN', 10]]);
    expect(() => reserveStock(balance, StockMovementType.RETURN, [
      { cupTypeId: 'cup', quantity: 50, condition: StockCondition.DIRTY },
    ], true)).not.toThrow();
    expect(balance.get('cup:CLEAN')).toBe(10);
  });

  it('rejects insufficient stock for controlled locations', () => {
    const balance = new Map<string, number>([['cup:CLEAN', 10]]);
    expect(() => reserveStock(balance, StockMovementType.RETURN, [
      { cupTypeId: 'cup', quantity: 11, condition: StockCondition.DIRTY },
    ], false)).toThrow(BadRequestException);
  });

  it('uses dirty stock as the source for cleaning sends', () => {
    const balance = new Map<string, number>([['cup:DIRTY', 25]]);
    expect(() => reserveStock(balance, StockMovementType.CLEANING_SEND, [
      { cupTypeId: 'cup', quantity: 25, condition: StockCondition.DIRTY },
    ])).not.toThrow();
    expect(balance.get('cup:DIRTY')).toBe(0);
  });

  it('completes the central warehouse washing and re-dispatch cycle', () => {
    const balance = balanceFor([
      {
        sourceLocationId: null, destinationLocationId: 'central',
        type: StockMovementType.INITIAL_LOAD, createdAt: new Date('2026-01-01'),
        items: [{ cupTypeId: 'cup', quantity: 100, condition: StockCondition.CLEAN }],
      },
      {
        sourceLocationId: 'event-warehouse', destinationLocationId: 'central',
        type: StockMovementType.RETURN, createdAt: new Date('2026-01-02'),
        items: [{ cupTypeId: 'cup', quantity: 40, condition: StockCondition.DIRTY }],
      },
      {
        sourceLocationId: 'central', destinationLocationId: 'washing',
        type: StockMovementType.CLEANING_SEND, createdAt: new Date('2026-01-03'),
        items: [{ cupTypeId: 'cup', quantity: 40, condition: StockCondition.DIRTY }],
      },
      {
        sourceLocationId: 'washing', destinationLocationId: 'central',
        type: StockMovementType.CLEANING_RETURN, createdAt: new Date('2026-01-04'),
        items: [{ cupTypeId: 'cup', quantity: 40, condition: StockCondition.CLEAN }],
      },
      {
        sourceLocationId: 'central', destinationLocationId: 'event-warehouse',
        type: StockMovementType.DELIVERY, createdAt: new Date('2026-01-05'),
        items: [{ cupTypeId: 'cup', quantity: 50, condition: StockCondition.CLEAN }],
      },
    ], 'central');

    expect(balance.get('cup:CLEAN')).toBe(90);
    expect(balance.get('cup:DIRTY')).toBe(0);
  });
});
