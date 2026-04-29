import { db } from '../config/database.js';

/**
 * Data-access layer for the categories table.
 * All SQL uses parameterized bindings — no string concatenation.
 */
export const categoryRepository = {
  /**
   * Retrieve all categories belonging to a user, ordered by creation time.
   *
   * @param {number} userId
   * @returns {Promise<object[]>}
   */
  async findAllByUserId(userId) {
    const { rows } = await db.query(
      'SELECT id, user_id, name, created_at FROM categories WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    );
    return rows;
  },

  /**
   * Find a single category by primary key and owner.
   * Returns null when no matching row is found or if it belongs to another user.
   *
   * @param {number} id
   * @param {number} userId
   * @returns {Promise<object|null>}
   */
  async findByIdAndUserId(id, userId) {
    const { rows } = await db.query(
      'SELECT id, user_id, name, created_at FROM categories WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId],
    );
    return rows[0] ?? null;
  },

  /**
   * Find a single category by primary key.
   * Returns null when no matching row is found.
   *
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const { rows } = await db.query(
      'SELECT id, user_id, name, created_at FROM categories WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  },

  /**
   * Find a category by owner and name (used for duplicate detection).
   * Returns null when no matching row is found.
   *
   * @param {number} userId
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async findByUserIdAndName(userId, name) {
    const { rows } = await db.query(
      'SELECT id, user_id, name, created_at FROM categories WHERE user_id = $1 AND name = $2 LIMIT 1',
      [userId, name],
    );
    return rows[0] ?? null;
  },

  /**
   * Insert a new category and return the created row.
   *
   * @param {{ userId: number, name: string }} param0
   * @returns {Promise<object>}
   */
  async create({ userId, name }) {
    const { rows } = await db.query(
      `INSERT INTO categories (user_id, name)
       VALUES ($1, $2)
       RETURNING id, user_id, name, created_at`,
      [userId, name],
    );
    return rows[0];
  },

  /**
   * Update a category's name and return the updated row.
   *
   * @param {number} id
   * @param {number} userId
   * @param {{ name: string }} param1
   * @returns {Promise<object|null>}
   */
  async update(id, userId, { name }) {
    const { rows } = await db.query(
      `UPDATE categories
       SET name = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, name, created_at`,
      [name, id, userId],
    );
    return rows[0] ?? null;
  },

  /**
   * Delete a category by primary key and owner.
   * The DB constraint (ON DELETE SET NULL) handles nullifying category_id in todos.
   *
   * @param {number} id
   * @param {number} userId
   * @returns {Promise<boolean>} True if a row was deleted, false otherwise
   */
  async deleteById(id, userId) {
    const { rowCount } = await db.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
    return rowCount > 0;
  },
};
