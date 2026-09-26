import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@ecocups.demo' })
  @IsEmail()
  email!: string;
  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
