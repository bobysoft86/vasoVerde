import { PartialType } from '@nestjs/swagger';
import { CreateBarDto } from './create-bar.dto';
import { IsBoolean, IsOptional } from 'class-validator';
export class UpdateBarDto extends PartialType(CreateBarDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}
