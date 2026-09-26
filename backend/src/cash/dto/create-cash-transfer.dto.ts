import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCashTransferDto {
  @IsString()
  originSessionId!: string;

  @IsString()
  destinationSessionId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  concept!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
