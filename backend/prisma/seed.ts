import {
  CashMovementType,
  EventRole,
  EventStatus,
  GlobalRole,
  LocationType,
  LocationUserRole,
  PrismaClient,
  StockCondition,
  StockMovementStatus,
  StockMovementType,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const password = 'Demo1234!';

async function main() {
  // Once operations exist, demo fixtures are no longer a source of truth.
  // Skip the entire seed so renamed/deleted fixtures cannot be recreated or
  // injected into an event which users have already closed or reconciled.
  const existingCompany = await prisma.company.findUnique({ where: { code: 'ECO-CUPS-DEMO' } });
  if (existingCompany) {
    const where = { companyId: existingCompany.id };
    const operations = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.cashSession.count({ where }),
      prisma.cashMovement.count({ where }),
      prisma.deliveryNote.count({ where }),
      prisma.documentSequence.count({ where }),
    ]);
    if (operations.some((count) => count > 0)) {
      console.log('Seed omitido: la empresa demo ya contiene datos operativos.');
      return;
    }
  }
  const company = await prisma.company.upsert({
    where: { code: 'ECO-CUPS-DEMO' },
    update: {},
    create: { name: 'Eco Cups Demo', code: 'ECO-CUPS-DEMO' },
  });
  const passwordHash = await argon2.hash(password);

  const userData = [
    ['Admin Demo', 'admin@ecocups.demo', GlobalRole.ADMIN],
    ['Responsable Evento', 'responsable@ecocups.demo', GlobalRole.RESPONSIBLE],
    ['Trabajador Operativo', 'trabajador@ecocups.demo', GlobalRole.WORKER],
    ['Cliente Barra Norte', 'cliente@ecocups.demo', GlobalRole.CLIENT],
  ] as const;
  const users = new Map<string, { id: string; name: string; email: string }>();
  for (const [name, email, globalRole] of userData) {
    const user = await prisma.user.upsert({
      where: { companyId_email: { companyId: company.id, email } },
      update: {},
      create: { companyId: company.id, name, email, globalRole, passwordHash },
      select: { id: true, name: true, email: true },
    });
    users.set(email, user);
  }

  const cupData = [
    ['Vaso 25cl', 'CUP-25CL', 250, 1],
    ['Vaso 33cl', 'CUP-33CL', 330, 1],
    ['Vaso 50cl', 'CUP-50CL', 500, 1],
  ] as const;
  const cups = new Map<string, { id: string; name: string }>();
  for (const [name, code, capacityMl, deposit] of cupData) {
    const cup = await prisma.cupType.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { cost: deposit, deposit },
      create: { companyId: company.id, name, code, capacityMl, cost: deposit, deposit },
      select: { id: true, name: true },
    });
    cups.set(code, cup);
  }

  const event = await prisma.event.upsert({
    where: { companyId_code: { companyId: company.id, code: 'FESTIVAL-2026-001' } },
    update: {},
    create: {
      companyId: company.id, name: 'Festival Demo 2026', code: 'FESTIVAL-2026-001', location: 'Madrid',
      status: EventStatus.ACTIVE, startDate: new Date('2026-10-02T12:00:00Z'), endDate: new Date('2026-10-04T23:00:00Z'),
    },
  });

  const responsible = users.get('responsable@ecocups.demo')!;
  const worker = users.get('trabajador@ecocups.demo')!;
  const client = users.get('cliente@ecocups.demo')!;
  const admin = users.get('admin@ecocups.demo')!;
  for (const [userId, role] of [[responsible.id, EventRole.EVENT_MANAGER], [worker.id, EventRole.OPERATOR], [client.id, EventRole.VIEWER]] as const) {
    await prisma.eventUser.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      update: {}, create: { eventId: event.id, userId, role },
    });
  }

  const boothNorth = await prisma.booth.upsert({
    where: { eventId_code: { eventId: event.id, code: 'BOOTH-NORTE' } },
    update: {},
    create: { eventId: event.id, name: 'Caseta Norte', code: 'BOOTH-NORTE' },
  });
  const boothSouth = await prisma.booth.upsert({
    where: { eventId_code: { eventId: event.id, code: 'BOOTH-SUR' } },
    update: {},
    create: { eventId: event.id, name: 'Caseta Sur', code: 'BOOTH-SUR' },
  });
  const barNorth = await prisma.bar.upsert({
    where: { eventId_code: { eventId: event.id, code: 'BAR-NORTE-1' } },
    update: {},
    create: { eventId: event.id, boothId: boothNorth.id, clientUserId: client.id, name: 'Barra Norte 1', code: 'BAR-NORTE-1' },
  });
  const barSouth = await prisma.bar.upsert({
    where: { eventId_code: { eventId: event.id, code: 'BAR-SUR-1' } },
    update: {},
    create: { eventId: event.id, boothId: boothSouth.id, name: 'Barra Sur 1', code: 'BAR-SUR-1' },
  });

  const locationData = [
    { key: 'central', name: 'Nave central', code: 'LOC-CENTRAL', type: LocationType.CENTRAL_WAREHOUSE, eventId: null, boothId: null, barId: null },
    { key: 'cleaning', name: 'Zona de lavado', code: 'LOC-CLEANING', type: LocationType.CLEANING_AREA, eventId: null, boothId: null, barId: null },
    { key: 'eventWarehouse', name: `Almacén ${event.name}`, code: `EVENT-${event.code}`, type: LocationType.EVENT_WAREHOUSE, eventId: event.id, boothId: null, barId: null },
    { key: 'boothNorth', name: boothNorth.name, code: `BOOTH-${event.id}-${boothNorth.code}`, type: LocationType.BOOTH, eventId: event.id, boothId: boothNorth.id, barId: null },
    { key: 'boothSouth', name: boothSouth.name, code: `BOOTH-${event.id}-${boothSouth.code}`, type: LocationType.BOOTH, eventId: event.id, boothId: boothSouth.id, barId: null },
    { key: 'barNorth', name: barNorth.name, code: `BAR-${barNorth.code}`, type: LocationType.BAR, eventId: event.id, boothId: null, barId: barNorth.id },
    { key: 'barSouth', name: barSouth.name, code: `BAR-${barSouth.code}`, type: LocationType.BAR, eventId: event.id, boothId: null, barId: barSouth.id },
  ] as const;
  const locations = new Map<string, { id: string; type: LocationType }>();
  for (const data of locationData) {
    const location = await prisma.location.upsert({
      where: { companyId_code: { companyId: company.id, code: data.code } },
      update: {},
      create: { companyId: company.id, name: data.name, code: data.code, type: data.type, eventId: data.eventId, boothId: data.boothId, barId: data.barId },
      select: { id: true, type: true },
    });
    locations.set(data.key, location);
  }

  const assignmentData = [
    [locations.get('boothNorth')!, responsible, LocationUserRole.RESPONSIBLE],
    [locations.get('boothNorth')!, worker, LocationUserRole.WORKER],
    [locations.get('boothSouth')!, responsible, LocationUserRole.RESPONSIBLE],
    [locations.get('barNorth')!, worker, LocationUserRole.WORKER],
    [locations.get('barNorth')!, client, LocationUserRole.CLIENT],
    [locations.get('barSouth')!, worker, LocationUserRole.WORKER],
  ] as const;
  for (const [location, user, role] of assignmentData) {
    await prisma.locationUserAssignment.upsert({
      where: { locationId_userId: { locationId: location.id, userId: user.id } },
      update: {},
      create: { companyId: company.id, eventId: event.id, locationId: location.id, userId: user.id, role },
    });
  }

  const cup33 = cups.get('CUP-33CL')!;
  const cup50 = cups.get('CUP-50CL')!;
  const central = locations.get('central')!;
  const cleaning = locations.get('cleaning')!;
  const eventWarehouse = locations.get('eventWarehouse')!;
  const booth = locations.get('boothNorth')!;
  const bar = locations.get('barNorth')!;

  async function movement(notes: string, sourceLocationId: string | null, destinationLocationId: string | null, type: StockMovementType, items: Array<[string, number, StockCondition]>, eventId: string | null, billing?: { chargeAmount: number; cashSessionId: string }) {
    const existing = await prisma.stockMovement.findFirst({ where: { companyId: company.id, notes } });
    const itemData = items.map(([cupTypeId, quantity, condition]) => ({ cupTypeId, quantity, condition }));
    const data = { companyId: company.id, eventId, sourceLocationId, destinationLocationId, createdByUserId: admin.id, type, status: StockMovementStatus.POSTED, notes, chargeable: !!billing, chargeAmount: billing?.chargeAmount };
    // Seed history may already have been signed, reconciled or consumed.
    if (existing) return existing;
    const created = await prisma.stockMovement.create({ data: { ...data, items: { create: itemData } } });
    if (billing) {
      await prisma.cashMovement.upsert({
        where: { stockMovementId: created.id },
        update: {},
        create: { companyId: company.id, eventId, locationId: destinationLocationId, cashSessionId: billing.cashSessionId, stockMovementId: created.id, createdByUserId: admin.id, type: CashMovementType.COLLECTION, amount: billing.chargeAmount, concept: 'Cobro demo de segunda entrega' },
      });
    }
    return created;
  }

  const centralCash = await prisma.cashSession.upsert({
    where: { id: 'seed-cash-session-central' }, update: {},
    create: { id: 'seed-cash-session-central', companyId: company.id, eventId: null, locationId: central.id, openedByUserId: admin.id, openingAmount: 1000, notes: 'Caja demo de nave central' },
  });
  await prisma.cashMovement.upsert({
    where: { id: 'seed-cash-opening-central' }, update: {},
    create: { id: 'seed-cash-opening-central', companyId: company.id, eventId: null, locationId: central.id, cashSessionId: centralCash.id, createdByUserId: admin.id, type: CashMovementType.INITIAL_CASH, amount: 1000, concept: 'Fondo inicial de nave central' },
  });
  const barCash = await prisma.cashSession.upsert({
    where: { id: 'seed-cash-session-bar-north' }, update: {},
    create: { id: 'seed-cash-session-bar-north', companyId: company.id, eventId: event.id, locationId: bar.id, openedByUserId: admin.id, openingAmount: 0, notes: 'Caja demo de Barra Norte 1' },
  });
  await prisma.cashMovement.upsert({
    where: { id: 'seed-cash-opening-bar-north' }, update: {},
    create: { id: 'seed-cash-opening-bar-north', companyId: company.id, eventId: event.id, locationId: bar.id, cashSessionId: barCash.id, createdByUserId: admin.id, type: CashMovementType.INITIAL_CASH, amount: 0, concept: 'Apertura de caja a cero antes del fondo' },
  });
  await prisma.cashTransfer.upsert({
    where: { id: 'seed-cash-transfer-bar-north' }, update: {},
    create: { id: 'seed-cash-transfer-bar-north', companyId: company.id, eventId: event.id, originSessionId: centralCash.id, destinationSessionId: barCash.id, createdByUserId: admin.id, amount: 100, concept: 'Fondo demo para Barra Norte 1', movements: { create: [
      { companyId: company.id, eventId: null, locationId: central.id, cashSessionId: centralCash.id, createdByUserId: admin.id, type: CashMovementType.CASH_OUT, amount: 100, concept: 'Fondo enviado a Barra Norte 1' },
      { companyId: company.id, eventId: event.id, locationId: bar.id, cashSessionId: barCash.id, createdByUserId: admin.id, type: CashMovementType.CASH_IN, amount: 100, concept: 'Fondo recibido desde nave central' },
    ] } },
  });

  await movement('Seed: recepción de fábrica en nave central', null, central.id, StockMovementType.INITIAL_LOAD, [[cup33.id, 10000, StockCondition.CLEAN], [cup50.id, 3000, StockCondition.CLEAN]], null);
  const warehouseDelivery = await movement('Seed: nave central a almacén del evento', central.id, eventWarehouse.id, StockMovementType.DELIVERY, [[cup33.id, 5000, StockCondition.CLEAN], [cup50.id, 1000, StockCondition.CLEAN]], event.id);
  await movement('Seed: almacén a Caseta Norte', eventWarehouse.id, booth.id, StockMovementType.DELIVERY, [[cup33.id, 3000, StockCondition.CLEAN], [cup50.id, 500, StockCondition.CLEAN]], event.id);
  await movement('Seed: suministro inicial gratuito a Barra Norte 1', booth.id, bar.id, StockMovementType.DELIVERY, [[cup33.id, 1000, StockCondition.CLEAN]], event.id);
  await movement('Seed: segunda entrega con cargo a Barra Norte 1', booth.id, bar.id, StockMovementType.DELIVERY, [[cup33.id, 200, StockCondition.CLEAN]], event.id, { chargeAmount: 200, cashSessionId: barCash.id });
  const barReturn = await movement('Seed: recogida de Barra Norte 1', bar.id, booth.id, StockMovementType.RETURN, [[cup33.id, 600, StockCondition.DIRTY], [cup33.id, 100, StockCondition.CLEAN], [cup50.id, 25, StockCondition.DAMAGED]], event.id);
  await movement('Seed: consolidación de recogidas en almacén del evento', booth.id, eventWarehouse.id, StockMovementType.RETURN, [[cup33.id, 600, StockCondition.DIRTY], [cup33.id, 100, StockCondition.CLEAN], [cup50.id, 25, StockCondition.DAMAGED]], event.id);
  await movement('Seed: retorno de vasos recogidos a nave central', eventWarehouse.id, central.id, StockMovementType.RETURN, [[cup33.id, 600, StockCondition.DIRTY], [cup33.id, 100, StockCondition.CLEAN], [cup50.id, 25, StockCondition.DAMAGED]], event.id);
  await movement('Seed: nave central envía sucios a zona de lavado', central.id, cleaning.id, StockMovementType.CLEANING_SEND, [[cup33.id, 600, StockCondition.DIRTY]], null);
  await movement('Seed: zona de lavado devuelve limpios a nave central', cleaning.id, central.id, StockMovementType.CLEANING_RETURN, [[cup33.id, 600, StockCondition.CLEAN]], null);
  await movement('Seed: nave central reenvía vasos limpios al evento', central.id, eventWarehouse.id, StockMovementType.DELIVERY, [[cup33.id, 600, StockCondition.CLEAN]], event.id);
  await movement('Seed: vasos perdidos en evento', eventWarehouse.id, null, StockMovementType.LOSS, [[cup33.id, 30, StockCondition.CLEAN]], event.id);
  await movement('Seed: vasos rotos en Caseta Norte', booth.id, null, StockMovementType.BREAKAGE, [[cup50.id, 10, StockCondition.DAMAGED]], event.id);

  await prisma.deliveryNote.upsert({
    where: { stockMovementId: warehouseDelivery.id },
    update: {},
    create: { companyId: company.id, eventId: event.id, stockMovementId: warehouseDelivery.id, number: `${event.code}-ALB-000001`, type: 'DELIVERY', status: 'PENDING_SIGNATURE', notes: 'Entrega demo desde nave central', createdByUserId: admin.id },
  });
  await prisma.deliveryNote.upsert({
    where: { stockMovementId: barReturn.id },
    update: {},
    create: { companyId: company.id, eventId: event.id, stockMovementId: barReturn.id, number: `${event.code}-ALB-000002`, type: 'RETURN', status: 'PENDING_SIGNATURE', notes: 'Recogida demo de barra', createdByUserId: admin.id },
  });
  await prisma.documentSequence.upsert({
    where: { companyId_eventId_documentType: { companyId: company.id, eventId: event.id, documentType: 'DELIVERY_NOTE' } },
    update: {}, create: { companyId: company.id, eventId: event.id, documentType: 'DELIVERY_NOTE', nextValue: 3 },
  });

  console.log(`Seed completado: ${company.name} · ${event.name}`);
  console.log(`Usuarios demo: admin@ecocups.demo, responsable@ecocups.demo, trabajador@ecocups.demo, cliente@ecocups.demo · contraseña: ${password}`);
  console.log('Escenario: nave con 1.000 €, fondo de barra de 100 €, segunda entrega cobrada de 200 € y recogida externa sin bloqueo de stock.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
