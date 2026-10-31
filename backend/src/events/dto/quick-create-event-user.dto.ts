import { EventRole, GlobalRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class QuickCreateEventUserDto {
  @IsString() @MinLength(2) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(GlobalRole) globalRole?: GlobalRole;
  @IsOptional() @IsEnum(EventRole) eventRole?: EventRole;
}
