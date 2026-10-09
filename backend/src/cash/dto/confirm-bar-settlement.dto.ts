import { IsOptional, IsString } from 'class-validator';

export class ConfirmBarSettlementDto {
  @IsString()
  locationId!: string;

  @IsString()
  cashSessionId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
