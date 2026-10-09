import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCupTypeDto {
  @IsOptional() @IsString() ownerEventId?: string;
  @IsOptional() @IsString() baseTypeId?: string;
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty({ example: 'CUP-33' }) @IsString() @MinLength(2) code!: string;
  @ApiProperty({ required: false, example: 330 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityMl?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalCode?: string;
}
