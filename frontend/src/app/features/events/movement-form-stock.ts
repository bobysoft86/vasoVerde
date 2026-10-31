import { CupType, StockItem } from '../../core/models/event.model';

export function filterCupsWithStock(cups: CupType[], stock: StockItem[]) {
  const availableIds = new Set(stock.filter((item) => item.quantity > 0).map((item) => item.cupTypeId));
  return cups.filter((cup) => availableIds.has(cup.id));
}
