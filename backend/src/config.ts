import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiration: string;
  corsOrigin: string;
  apiUrl: string;
  mlServiceUrl: string;
  frontendUrl: string;
  emailUser: string;
  brevoApiKey: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/linkup?sslmode=disable',
  jwtSecret:
    process.env.JWT_SECRET || 'linkup_development_fallback_secret_key_32_chars_minimum',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  emailUser: process.env.EMAIL_USER || 'kartikpatel9411@gmail.com',
  brevoApiKey: process.env.BREVO_API_KEY || '',
};

if (!process.env.DATABASE_URL) {
  console.warn(
    '[WARN] DATABASE_URL is not set in environment. Using fallback local connection string.'
  );
}
