import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SignatureType } from '@prisma/client';

export class SignDeliveryNoteDto {
  @IsEnum(SignatureType)
  type!: SignatureType;

  @IsString()
  @MaxLength(160)
  signerName!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
