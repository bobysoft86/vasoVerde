import { GlobalRole, LocationType, StockCondition, StockMovementType } from '@prisma/client';
import { StockService } from './stock.service';

describe('stock service edition boundaries', () => {
  const user = { sub: 'admin', companyId: 'company', email: 'admin@example.test', globalRole: GlobalRole.ADMIN };
  const source = { id: 'source', companyId: 'company', eventId: null, active: true, type: LocationType.CENTRAL_WAREHOUSE };
  const destination = { id: 'destination', companyId: 'company', eventId: 'event', active: true, type: LocationType.BAR };
  let prisma: any;
  let service: StockService;
  beforeEach(() => {
    prisma = {
      location: { findMany: jest.fn().mockResolvedValue([source, destination]) },
      locationClosure: { findFirst: jest.fn().mockResolvedValue(null) },
      cupType: { findMany: jest.fn().mockResolvedValue([{ id: 'edition', ownerEventId: 'other-event' }]) },
      $transaction: jest.fn(),
    };
    service = new StockService(prisma, { assertAccess: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) } as any, {} as any, {} as any);
  });
  it('rejects a forged delivery of foreign cups before creating stock, cash or documents', async () => {
    await expect(service.create(user, 'event', {
      type: StockMovementType.DELIVERY, sourceLocationId: 'source', destinationLocationId: 'destination',
      items: [{ cupTypeId: 'edition', quantity: 1, condition: StockCondition.CLEAN }],
    })).rejects.toThrow('otro evento');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects foreign editions in a closure as well', async () => {
    prisma.location.findMany.mockResolvedValue([{ ...source, eventId: 'event', type: LocationType.BAR }, { ...destination, type: LocationType.EVENT_WAREHOUSE }]);
    await expect(service.closeLocation(user, 'event', 'source', {
      destinationLocationId: 'destination', items: [{ cupTypeId: 'edition', quantity: 1, condition: StockCondition.DIRTY }],
    })).rejects.toThrow('otro evento');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
