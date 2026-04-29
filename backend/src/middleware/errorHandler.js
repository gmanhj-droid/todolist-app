import { AppError, ErrorType } from '../utils/AppError.js';
import { env } from '../config/env.js';

/**
 * Centralised Express error-handling middleware (four-argument signature).
 * Must be registered after all routes.
 *
 * Response shape:
 *   { success: false, error: { message, type, ...(stack in development) } }
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let statusCode;
  let message;
  let type;

  if (err instanceof AppError && err.isOperational) {
    statusCode = err.statusCode;
    message = err.message;
    type = err.type;
  } else {
    // Unexpected / programmer errors — mask details in production
    statusCode = 500;
    message = env.isProduction ? 'An unexpected error occurred.' : err.message;
    type = ErrorType.INTERNAL_ERROR;

    // Always log unexpected errors regardless of environment
    console.error('Unhandled error:', err);
  }

  const errorBody = { message, type };

  if (!env.isProduction && err.stack) {
    errorBody.stack = err.stack;
  }

  res.status(statusCode).json({
    success: false,
    error: errorBody,
  });
}
