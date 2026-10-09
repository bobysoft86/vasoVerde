import { IncidentPriority, IncidentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateIncidentDto {
  @IsEnum(IncidentStatus) @IsOptional() status?: IncidentStatus;
  @IsEnum(IncidentPriority) @IsOptional() priority?: IncidentPriority;
  @IsString() @IsOptional() assignedToUserId?: string | null;
}
