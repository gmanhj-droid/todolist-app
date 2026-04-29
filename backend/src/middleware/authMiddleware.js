import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

/**
 * Authentication middleware.
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded payload to req.user.
 *
 * Throws AppError (AUTH_ERROR / 401) when:
 *  - Authorization header is absent or malformed
 *  - Token is invalid or expired
 */
export function authMiddleware(req, _res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.auth('Authorization header is missing or malformed.');
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      throw AppError.auth('Bearer token is empty.');
    }

    const decoded = verifyToken(token);
    req.user = decoded;

    next();
  } catch (err) {
    next(err);
  }
}
