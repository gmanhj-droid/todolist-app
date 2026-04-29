/**
 * Known application error types mapped to standard HTTP semantics.
 */
export const ErrorType = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  FORBIDDEN_ERROR: 'FORBIDDEN_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

/** Default HTTP status codes for each error type. */
const STATUS_MAP = {
  [ErrorType.VALIDATION_ERROR]: 400,
  [ErrorType.CONFLICT_ERROR]: 409,
  [ErrorType.AUTH_ERROR]: 401,
  [ErrorType.FORBIDDEN_ERROR]: 403,
  [ErrorType.NOT_FOUND_ERROR]: 404,
  [ErrorType.INTERNAL_ERROR]: 500,
};

/**
 * Operational application error that carries an HTTP status code and a
 * machine-readable type string for structured error responses.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} [statusCode] - HTTP status code (derived from type when omitted)
   * @param {string} [type] - One of the ErrorType constants
   */
  constructor(message, statusCode, type = ErrorType.INTERNAL_ERROR) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode ?? STATUS_MAP[type] ?? 500;
    this.isOperational = true;

    // Maintain proper prototype chain in transpiled environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Convenience factory: 400 Validation error */
  static validation(message) {
    return new AppError(message, 400, ErrorType.VALIDATION_ERROR);
  }

  /** Convenience factory: 409 Conflict error */
  static conflict(message) {
    return new AppError(message, 409, ErrorType.CONFLICT_ERROR);
  }

  /** Convenience factory: 401 Authentication error */
  static auth(message) {
    return new AppError(message, 401, ErrorType.AUTH_ERROR);
  }

  /** Convenience factory: 403 Forbidden error */
  static forbidden(message) {
    return new AppError(message, 403, ErrorType.FORBIDDEN_ERROR);
  }

  /** Convenience factory: 404 Not-found error */
  static notFound(message) {
    return new AppError(message, 404, ErrorType.NOT_FOUND_ERROR);
  }

  /** Convenience factory: 500 Internal error */
  static internal(message) {
    return new AppError(message, 500, ErrorType.INTERNAL_ERROR);
  }
}
