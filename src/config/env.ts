import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric environment value: ${value}`);
  }

  return parsed;
};

const parseOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return ['http://localhost:5173'];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 5100),
  mongoUri: process.env.MONGODB_URI ?? '',
  mongoDbName: process.env.MONGODB_DB_NAME ?? 'server_commands',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  bcryptRounds: parseNumber(process.env.BCRYPT_ROUNDS, 10),
  bootstrapToken: process.env.BOOTSTRAP_TOKEN ?? '',
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN)
};

const requiredEnvs = ['MONGODB_URI', 'JWT_SECRET'] as const;

for (const envName of requiredEnvs) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}
