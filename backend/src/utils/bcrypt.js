import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt with 12 salt rounds.
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Bcrypt hash
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * @param {string} password - Plaintext password to verify
 * @param {string} hash - Stored bcrypt hash
 * @returns {Promise<boolean>} True when the password matches the hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
