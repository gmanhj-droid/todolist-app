import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

/**
 * Generate a signed HS512 JWT for the given payload.
 * @param {object} payload - Data to embed in the token (e.g. { userId, email })
 * @returns {string} Signed JWT string
 */
export function generateToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: 'HS512',
    expiresIn: env.jwtExpiry,
  });
}

/**
 * Verify and decode a JWT.
 * Throws AppError (AUTH_ERROR) when the token is invalid or expired.
 * @param {string} token - JWT string to verify
 * @returns {object} Decoded payload
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS512'] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.auth('Token has expired.');
    }
    throw AppError.auth('Invalid or malformed token.');
  }
}
