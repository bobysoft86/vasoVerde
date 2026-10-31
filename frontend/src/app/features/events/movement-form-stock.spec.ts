import { CupType, StockItem } from '../../core/models/event.model';
import { filterCupsWithStock } from './movement-form-stock';

describe('filterCupsWithStock', () => {
  const cups = [
    { id: 'clean', name: 'Limpio', code: 'CLEAN', active: true },
    { id: 'dirty', name: 'Sucio', code: 'DIRTY', active: true },
    { id: 'empty', name: 'Agotado', code: 'EMPTY', active: true },
  ] as CupType[];
  const stock = [
    { cupTypeId: 'clean', cupTypeName: 'Limpio', condition: 'CLEAN', quantity: 12 },
    { cupTypeId: 'dirty', cupTypeName: 'Sucio', condition: 'DIRTY', quantity: 5 },
    { cupTypeId: 'empty', cupTypeName: 'Agotado', condition: 'CLEAN', quantity: 0 },
  ] as StockItem[];

  it('keeps only cup types with a positive quantity at the source location', () => {
    expect(filterCupsWithStock(cups, stock).map((cup) => cup.id)).toEqual(['clean', 'dirty']);
  });

  it('returns no cup types when the source has no positive stock', () => {
    expect(filterCupsWithStock(cups, stock.map((item) => ({ ...item, quantity: 0 })))).toEqual([]);
  });
});
