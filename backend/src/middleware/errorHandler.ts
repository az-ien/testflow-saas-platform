import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { logger } from '../config/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class PlanLimitError extends AppError {
  constructor(message = 'Plan limit reached. Please upgrade your subscription.') {
    super(message, 429);
  }
}

// ─── Global Error Handler ─────────────────────────────────────────────────────
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (process.env.SENTRY_DSN && !(err instanceof AppError)) {
    Sentry.captureException(err);
  }

  if (err instanceof AppError) {
    logger.warn(`[${err.statusCode}] ${err.message}`, {
      path: req.path,
      method: req.method,
    });
    res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // Sequelize unique constraint
  if ((err as any).name === 'SequelizeUniqueConstraintError') {
    res.status(409).json({ error: 'Resource already exists' });
    return;
  }

  // Sequelize validation
  if ((err as any).name === 'SequelizeValidationError') {
    const messages = (err as any).errors.map((e: any) => e.message);
    res.status(422).json({ error: messages.join(', ') });
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
