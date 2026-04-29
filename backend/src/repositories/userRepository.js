import { db } from '../config/database.js';

/**
 * Data-access layer for the users table.
 * All SQL uses parameterized bindings — no string concatenation.
 */
export const userRepository = {
  /**
   * Find a user by email address, including the hashed password field.
   * Returns null when no matching row is found.
   *
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    const { rows } = await db.query(
      'SELECT id, email, password, created_at FROM users WHERE email = $1 LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  },

  /**
   * Find a user by primary key, excluding the password field.
   * Returns null when no matching row is found.
   *
   * @param {string|number} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const { rows } = await db.query(
      'SELECT id, email, created_at FROM users WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  },

  /**
   * Insert a new user row and return the created record without the password.
   *
   * @param {{ email: string, password: string }} param0
   * @returns {Promise<object>} Created user row (id, email, created_at)
   */
  async create({ email, password }) {
    const { rows } = await db.query(
      `INSERT INTO users (email, password)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, password],
    );
    return rows[0];
  },

  /**
   * Delete a user row by primary key.
   *
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async deleteById(id) {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
  },
};
