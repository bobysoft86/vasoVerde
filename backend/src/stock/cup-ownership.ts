import { BadRequestException } from '@nestjs/common';

// A reference retains its identity through washing, returns and settlement.
export function assertCupOwnership(
  cups: Array<{ ownerEventId?: string | null }>,
  eventIds: Array<string | null | undefined>,
) {
  if (cups.some(cup => cup.ownerEventId && eventIds.some(id => id && id !== cup.ownerEventId))) {
    throw new BadRequestException('La serigrafía del vaso pertenece a otro evento. Usa vasos del evento o genéricos.');
  }
}
