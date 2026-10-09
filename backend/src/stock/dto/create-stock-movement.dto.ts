import { ApiProperty } from '@nestjs/swagger';
import { StockCondition, StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockMovementItemDto {
  @ApiProperty() @IsString() cupTypeId!: string;
  @ApiProperty() @IsInt() @Min(1) quantity!: number;
  @ApiProperty({ enum: StockCondition })
  @IsEnum(StockCondition)
  condition!: StockCondition;
}
export class CreateStockMovementDto {
  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type!: StockMovementType;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  chargeable?: boolean;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  chargeAmount?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cashSessionId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceLocationId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  destinationLocationId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  generateDeliveryNote?: boolean;
  @ApiProperty({ type: [StockMovementItemDto] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockMovementItemDto)
  items!: StockMovementItemDto[];
}
