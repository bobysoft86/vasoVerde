import { ApiProperty } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
export class CreateEventDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty({ example: 'FESTIVAL-2026-002' })
  @IsString()
  @MinLength(2)
  code!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiProperty({ enum: EventStatus, required: false })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
