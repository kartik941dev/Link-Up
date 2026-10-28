import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error occurred.';

  // Detect database connection failure
  if (
    err.code === 'ECONNREFUSED' ||
    (err as any).name === 'AggregateError' ||
    (err.message && err.message.includes('ECONNREFUSED'))
  ) {
    message = 'Database connection failed. Please start your PostgreSQL server or verify DATABASE_URL in backend/.env';
  }

  console.error(`[ERROR] [${statusCode}] ${message}`, err.stack || err);

  res.status(statusCode).json({
    error: message,
    code: err.code || 'DATABASE_CONNECTION_ERROR',
    ...(config.nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
};
