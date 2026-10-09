import { GlobalRole } from '@prisma/client';
import { CupTypesService } from './cup-types.service';

describe('cup reference ownership', () => {
  const user = { sub: 'admin', companyId: 'company', email: 'a@test.test', globalRole: GlobalRole.ADMIN };
  it('cannot convert a historical generic reference into an event edition', async () => {
    const prisma = { cupType: { findFirst: jest.fn().mockResolvedValue({ id: 'cup', ownerEventId: null, baseTypeId: null }), update: jest.fn() } };
    await expect(new CupTypesService(prisma as any).update(user, 'cup', { ownerEventId: 'event' })).rejects.toThrow('permanentes');
    expect(prisma.cupType.update).not.toHaveBeenCalled();
  });
  it('requires an event belonging to the same company', async () => {
    const prisma = { event: { findFirst: jest.fn().mockResolvedValue(null) }, cupType: { create: jest.fn() } };
    await expect(new CupTypesService(prisma as any).create(user, { name: 'Edition', code: 'EDITION', ownerEventId: 'foreign', baseTypeId: 'base' })).rejects.toThrow('Evento no válido');
    expect(prisma.event.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', companyId: 'company', deletedAt: null } });
    expect(prisma.cupType.create).not.toHaveBeenCalled();
  });
  it('rejects a foreign or edition reference as a physical base', async () => {
    const prisma = { event: { findFirst: jest.fn().mockResolvedValue({ id: 'event' }) }, cupType: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() } };
    await expect(new CupTypesService(prisma as any).create(user, { name: 'Edition', code: 'EDITION', ownerEventId: 'event', baseTypeId: 'foreign' })).rejects.toThrow('Modelo físico no válido');
    expect(prisma.cupType.create).not.toHaveBeenCalled();
  });
});
