import { userRepository } from '../repositories/userRepository.js';
import { hashPassword, verifyPassword } from '../utils/bcrypt.js';
import { generateToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

/** RFC-5322-inspired email pattern — rejects addresses without @ and a dot in the domain. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;

/**
 * Business-logic layer for authentication operations.
 * Depends on userRepository, bcrypt utilities, and JWT utilities.
 */
export const authService = {
  /**
   * Register a new user account.
   *
   * Validation order:
   *  1. Email format (400)
   *  2. Password minimum length (400)
   *  3. Duplicate email (409)
   *  4. Hash password, persist, issue token
   *
   * @param {{ email: string, password: string }} param0
   * @returns {Promise<{ token: string, user: { id, email, created_at } }>}
   */
  async signUp({ email, password }) {
    if (!email || !EMAIL_REGEX.test(email)) {
      throw AppError.validation('Invalid email address format.');
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw AppError.validation('Password must be at least 8 characters long.');
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw AppError.conflict('An account with this email address already exists.');
    }

    const hashed = await hashPassword(password);
    const user = await userRepository.create({ email, password: hashed });

    const token = generateToken({ userId: user.id, email: user.email });

    return { token, user };
  },

  /**
   * Authenticate an existing user.
   *
   * Deliberately returns the same 401 error for both unknown email and wrong
   * password to avoid leaking account existence.
   *
   * @param {{ email: string, password: string }} param0
   * @returns {Promise<{ token: string, user: { id, email, created_at } }>}
   */
  async signIn({ email, password }) {
    const GENERIC_AUTH_ERROR = 'Invalid email or password.';

    const record = await userRepository.findByEmail(email);
    if (!record) {
      throw AppError.auth(GENERIC_AUTH_ERROR);
    }

    const isValid = await verifyPassword(password, record.password);
    if (!isValid) {
      throw AppError.auth(GENERIC_AUTH_ERROR);
    }

    const token = generateToken({ userId: record.id, email: record.email });

    // Exclude password from the returned user object
    const user = {
      id: record.id,
      email: record.email,
      created_at: record.created_at,
    };

    return { token, user };
  },

  /**
   * Permanently delete a user account.
   *
   * @param {string|number} userId
   * @returns {Promise<void>}
   */
  async deleteAccount(userId) {
    await userRepository.deleteById(userId);
  },
};
