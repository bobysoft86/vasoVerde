import { PartialType } from '@nestjs/swagger';
import { CreateCupTypeDto } from './create-cup-type.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCupTypeDto extends PartialType(CreateCupTypeDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}
