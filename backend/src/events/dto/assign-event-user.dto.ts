import { ApiProperty } from '@nestjs/swagger';
import { EventRole } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
export class AssignEventUserDto {
  @ApiProperty() @IsString() userId!: string;
  @ApiProperty({ enum: EventRole }) @IsEnum(EventRole) role!: EventRole;
}
