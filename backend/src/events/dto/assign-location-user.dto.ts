import { LocationUserRole } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class AssignLocationUserDto {
  @IsString()
  userId!: string;

  @IsEnum(LocationUserRole)
  role!: LocationUserRole;
}
