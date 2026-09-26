import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
export class CreateBoothDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty() @IsString() @MinLength(2) code!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
