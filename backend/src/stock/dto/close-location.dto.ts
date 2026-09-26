import { ApiProperty } from '@nestjs/swagger';
import { StockCondition } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CloseLocationItemDto {
  @IsString() cupTypeId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsEnum(StockCondition) condition!: StockCondition;
}

export class CloseLocationDto {
  @IsString() destinationLocationId!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() generateDeliveryNote?: boolean;
  @ApiProperty({ type: [CloseLocationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloseLocationItemDto)
  items!: CloseLocationItemDto[];
}
