import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeliveryNoteDto {
  @IsString()
  stockMovementId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
