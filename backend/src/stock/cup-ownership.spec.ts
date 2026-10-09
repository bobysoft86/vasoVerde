import { assertCupOwnership } from './cup-ownership';
import { balanceFor, LedgerMovement } from './stock-ledger';
import { StockCondition, StockMovementType } from '@prisma/client';

describe('event cup editions', () => {
  it('allows generic stock at any event', () => {
    expect(() => assertCupOwnership([{ ownerEventId: null }], ['event-a', 'event-b'])).not.toThrow();
  });
  it('accepts own edition and generic stock together', () => {
    expect(() => assertCupOwnership([{ ownerEventId: 'a' }, { ownerEventId: null }], ['a', null])).not.toThrow();
  });
  it('rejects another occurrence of the same festival', () => {
    expect(() => assertCupOwnership([{ ownerEventId: 'festival-2026' }], ['festival-2027'])).toThrow('otro evento');
  });
  it('rejects a mixed load if only one edition is incompatible', () => {
    expect(() => assertCupOwnership([{ ownerEventId: null }, { ownerEventId: 'a' }, { ownerEventId: 'b' }], ['a'])).toThrow();
  });
  it('allows washing without event context and checks both movement endpoints', () => {
    expect(() => assertCupOwnership([{ ownerEventId: 'a' }], [null, null])).not.toThrow();
    expect(() => assertCupOwnership([{ ownerEventId: 'a' }], ['a', 'b'])).toThrow();
  });
  it('washing consumes only the dirty stock of that exact edition', () => {
    const movements: LedgerMovement[] = [
      { sourceLocationId: 'central', destinationLocationId: 'wash', type: StockMovementType.CLEANING_SEND, createdAt: new Date(1), items: [
        { cupTypeId: 'edition-a', condition: StockCondition.DIRTY, quantity: 100 },
        { cupTypeId: 'edition-b', condition: StockCondition.DIRTY, quantity: 50 },
      ] },
      { sourceLocationId: 'wash', destinationLocationId: 'central', type: StockMovementType.CLEANING_RETURN, createdAt: new Date(2), items: [
        { cupTypeId: 'edition-a', condition: StockCondition.CLEAN, quantity: 80 },
      ] },
    ];
    const stock = balanceFor(movements, 'wash');
    expect(stock.get('edition-a:DIRTY')).toBe(20);
    expect(stock.get('edition-b:DIRTY')).toBe(50);
  });
});
