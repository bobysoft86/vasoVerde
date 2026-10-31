import { IsInt, Min } from 'class-validator';

export class SetStockThresholdDto {
  @IsInt() @Min(0) minimum!: number;
}
