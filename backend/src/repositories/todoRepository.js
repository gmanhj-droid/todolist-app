import { db } from '../config/database.js';

/**
 * Data-access layer for the todos table.
 * All SQL uses parameterized bindings — no string concatenation for values.
 */
export const todoRepository = {
  /**
   * Retrieve all todos belonging to a user, with optional category filter.
   * Results are ordered newest-first.
   *
   * @param {number} userId
   * @param {{ categoryId?: number }} [filters={}]
   * @returns {Promise<object[]>}
   */
  async findAllByUserId(userId, filters = {}) {
    const params = [userId];
    let sql =
      'SELECT id, user_id, category_id, title, description, due_date, is_completed, created_at, updated_at ' +
      'FROM todos WHERE user_id = $1';

    if (filters.categoryId !== null && filters.categoryId !== undefined) {
      params.push(filters.categoryId);
      sql += ` AND category_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const { rows } = await db.query(sql, params);
    return rows;
  },

  /**
   * Find a single todo by primary key and owner.
   * Returns null when no matching row is found or if it belongs to another user.
   *
   * @param {number} id
   * @param {number} userId
   * @returns {Promise<object|null>}
   */
  async findByIdAndUserId(id, userId) {
    const { rows } = await db.query(
      'SELECT id, user_id, category_id, title, description, due_date, is_completed, created_at, updated_at ' +
        'FROM todos WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId],
    );
    return rows[0] ?? null;
  },

  /**
   * Find a single todo by primary key.
   * Returns null when no matching row is found.
   *
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const { rows } = await db.query(
      'SELECT id, user_id, category_id, title, description, due_date, is_completed, created_at, updated_at ' +
        'FROM todos WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  },

  /**
   * Insert a new todo and return the created row.
   * description, categoryId, and dueDate are nullable.
   *
   * @param {{ userId: number, title: string, description?: string, categoryId?: number, dueDate?: string }} param0
   * @returns {Promise<object>}
   */
  async create({ userId, title, description, categoryId, dueDate }) {
    const { rows } = await db.query(
      `INSERT INTO todos (user_id, category_id, title, description, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, category_id, title, description, due_date, is_completed, created_at, updated_at`,
      [userId, categoryId ?? null, title, description ?? null, dueDate ?? null],
    );
    return rows[0];
  },

  /**
   * Partially update a todo's fields and return the updated row.
   * Only the provided fields are changed; updated_at is always refreshed.
   *
   * @param {number} id
   * @param {number} userId
   * @param {{ title?: string, description?: string, categoryId?: number, dueDate?: string }} fields
   * @returns {Promise<object|null>}
   */
  async update(id, userId, fields) {
    const setClauses = [];
    const params = [];

    if (fields.title !== undefined) {
      params.push(fields.title);
      setClauses.push(`title = $${params.length}`);
    }

    if (fields.description !== undefined) {
      params.push(fields.description);
      setClauses.push(`description = $${params.length}`);
    }

    if (fields.categoryId !== undefined) {
      params.push(fields.categoryId);
      setClauses.push(`category_id = $${params.length}`);
    }

    if (fields.dueDate !== undefined) {
      params.push(fields.dueDate);
      setClauses.push(`due_date = $${params.length}`);
    }

    // updated_at is always refreshed
    setClauses.push('updated_at = now()');

    const idIndex = params.length + 1;
    const userIdIndex = params.length + 2;
    params.push(id, userId);

    const sql =
      `UPDATE todos SET ${setClauses.join(', ')} WHERE id = $${idIndex} AND user_id = $${userIdIndex} ` +
      'RETURNING id, user_id, category_id, title, description, due_date, is_completed, created_at, updated_at';

    const { rows } = await db.query(sql, params);
    return rows[0] ?? null;
  },

  /**
   * Set the is_completed flag on a todo and return the updated row.
   *
   * @param {number} id
   * @param {number} userId
   * @param {boolean} isCompleted
   * @returns {Promise<object|null>}
   */
  async setCompleted(id, userId, isCompleted) {
    const { rows } = await db.query(
      `UPDATE todos
       SET is_completed = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, category_id, title, description, due_date, is_completed, created_at, updated_at`,
      [isCompleted, id, userId],
    );
    return rows[0] ?? null;
  },

  /**
   * Delete a todo by primary key and owner.
   *
   * @param {number} id
   * @param {number} userId
   * @returns {Promise<boolean>} True if a row was deleted, false otherwise
   */
  async deleteById(id, userId) {
    const { rowCount } = await db.query('DELETE FROM todos WHERE id = $1 AND user_id = $2', [id, userId]);
    return rowCount > 0;
  },
};
