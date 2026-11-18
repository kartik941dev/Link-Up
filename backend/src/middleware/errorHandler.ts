import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
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
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Internal server error occurred.';

  // Handle Multer upload errors gracefully as 400 Bad Request
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    code = err.code || 'UPLOAD_ERROR';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File is too large. Maximum allowed upload size exceeded.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded at once (maximum 30 files per batch).';
    }
  }

  // Detect database connection failure
  if (
    err.code === 'ECONNREFUSED' ||
    (err as any).name === 'AggregateError' ||
    (err.message && err.message.includes('ECONNREFUSED'))
  ) {
    statusCode = 503;
    code = 'DATABASE_CONNECTION_ERROR';
    message = 'Database connection failed. Please start your PostgreSQL server or verify DATABASE_URL in backend/.env';
  }

  console.error(`[ERROR] [${statusCode}] ${message}`, statusCode >= 500 ? (err.stack || err) : '');

  res.status(statusCode).json({
    error: message,
    code,
    ...(config.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
};
