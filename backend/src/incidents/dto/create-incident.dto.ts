import { IncidentKind, IncidentPriority, IncidentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIncidentDto {
  @IsEnum(IncidentKind) @IsOptional() kind?: IncidentKind;
  @IsEnum(IncidentType) type!: IncidentType;
  @IsEnum(IncidentPriority) @IsOptional() priority?: IncidentPriority;
  @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @IsString() @IsOptional() @MaxLength(5000) description?: string;
  @IsString() @IsOptional() locationId?: string;
}
