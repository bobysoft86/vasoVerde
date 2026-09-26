import { PartialType } from '@nestjs/swagger';
import { CreateBoothDto } from './create-booth.dto';
import { IsBoolean, IsOptional } from 'class-validator';
export class UpdateBoothDto extends PartialType(CreateBoothDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}
