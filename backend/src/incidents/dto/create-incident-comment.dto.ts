import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIncidentCommentDto {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
}
