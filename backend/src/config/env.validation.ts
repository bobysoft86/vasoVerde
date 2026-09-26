import { plainToInstance } from 'class-transformer';
import { IsInt, IsUrl, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsInt()
  PORT = 3000;

  @IsUrl({ require_tld: false })
  FRONTEND_URL = 'http://localhost:4200';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const normalizedConfig = {
    ...config,
    PORT: Number(config.PORT ?? 3000),
  };
  const validated = plainToInstance(EnvironmentVariables, normalizedConfig, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) throw new Error(errors.toString());
  return validated;
}
