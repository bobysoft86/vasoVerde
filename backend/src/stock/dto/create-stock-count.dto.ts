import { StockCondition } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class StockCountLineDto {
  @IsString() cupTypeId!: string;
  @IsEnum(StockCondition) condition!: StockCondition;
  @IsInt() @Min(0) counted!: number;
}

export class CreateStockCountDto {
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StockCountLineDto)
  lines!: StockCountLineDto[];
}
