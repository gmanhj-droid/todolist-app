import { todoRepository } from '../repositories/todoRepository.js';
import { categoryRepository } from '../repositories/categoryRepository.js';
import { AppError } from '../utils/AppError.js';

/**
 * Derive a human-readable status string from a todo row.
 *
 * Rules (evaluated in order):
 *  1. is_completed = true  → 'completed'
 *  2. due_date exists and is in the past (UTC date comparison) → 'overdue'
 *  3. otherwise → 'active'
 *
 * @param {object} todo - A todo row from the database
 * @returns {'completed'|'overdue'|'active'}
 */
function calculateStatus(todo) {
  if (todo.is_completed) return 'completed';

  if (todo.due_date) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dueDate =
      typeof todo.due_date === 'string'
        ? todo.due_date.split('T')[0]
        : todo.due_date.toISOString().split('T')[0];

    if (dueDate < today) return 'overdue';
  }

  return 'active';
}

/**
 * Business-logic layer for todo operations.
 * Authorization, validation, and status computation all live here.
 */
export const todoService = {
  /**
   * Return todos for the given user, optionally filtered by status and/or category.
   * The status field is computed in memory after fetching from the DB.
   *
   * @param {number} userId
   * @param {{ status?: 'active'|'overdue'|'completed', categoryId?: number }} [filters={}]
   * @returns {Promise<object[]>}
   */
  async getTodos(userId, filters = {}) {
    const todos = await todoRepository.findAllByUserId(userId, {
      categoryId: filters.categoryId,
    });

    const todosWithStatus = todos.map((todo) => ({
      ...todo,
      status: calculateStatus(todo),
    }));

    if (filters.status) {
      return todosWithStatus.filter((t) => t.status === filters.status);
    }

    return todosWithStatus;
  },

  /**
   * Create a new todo for the given user.
   *
   * Validation rules:
   *  - title is required and must not be blank
   *  - title (trimmed) must not exceed 50 characters
   *  - description, when provided, must not exceed 200 characters
   *  - categoryId, when provided, must exist and belong to userId
   *
   * @param {number} userId
   * @param {{ title: string, description?: string, categoryId?: number, dueDate?: string }} param1
   * @returns {Promise<object>} Created todo with status field
   */
  async createTodo(userId, { title, description, categoryId, dueDate }) {
    if (!title || title.trim().length === 0) {
      throw AppError.validation('할일 제목은 필수입니다.');
    }

    if (title.trim().length > 50) {
      throw AppError.validation('할일 제목은 50자 이하이어야 합니다.');
    }

    if (description && description.length > 200) {
      throw AppError.validation('할일 설명은 200자 이하이어야 합니다.');
    }

    if (categoryId !== null && categoryId !== undefined) {
      const category = await categoryRepository.findByIdAndUserId(categoryId, userId);
      if (!category) {
        throw AppError.forbidden('이 카테고리를 사용할 권한이 없거나 존재하지 않습니다.');
      }
    }

    const todo = await todoRepository.create({
      userId,
      title: title.trim(),
      description: description ?? null,
      categoryId: categoryId ?? null,
      dueDate: dueDate ?? null,
    });

    return { ...todo, status: calculateStatus(todo) };
  },

  /**
   * Update selected fields of an existing todo.
   *
   * Authorization: the todo must belong to userId.
   * Validation mirrors createTodo for whichever fields are present.
   *
   * @param {number} userId
   * @param {number} todoId
   * @param {{ title?: string, description?: string, categoryId?: number, dueDate?: string }} fields
   * @returns {Promise<object>} Updated todo with status field
   */
  async updateTodo(userId, todoId, fields) {
    const existing = await todoRepository.findById(todoId);
    if (!existing) {
      throw AppError.notFound('할일을 찾을 수 없습니다.');
    }

    if (Number(existing.user_id) !== Number(userId)) {
      throw AppError.forbidden('이 할일을 수정할 권한이 없습니다.');
    }

    if (fields.title !== undefined) {
      if (!fields.title || fields.title.trim().length === 0) {
        throw AppError.validation('할일 제목은 필수입니다.');
      }
      if (fields.title.trim().length > 50) {
        throw AppError.validation('할일 제목은 50자 이하이어야 합니다.');
      }
      fields = { ...fields, title: fields.title.trim() };
    }

    if (fields.description !== undefined && fields.description !== null) {
      if (fields.description.length > 200) {
        throw AppError.validation('할일 설명은 200자 이하이어야 합니다.');
      }
    }

    if (fields.categoryId !== null && fields.categoryId !== undefined) {
      const category = await categoryRepository.findByIdAndUserId(fields.categoryId, userId);
      if (!category) {
        throw AppError.forbidden('이 카테고리를 사용할 권한이 없거나 존재하지 않습니다.');
      }
    }

    const updated = await todoRepository.update(todoId, userId, fields);
    return { ...updated, status: calculateStatus(updated) };
  },

  /**
   * Delete a todo by ID.
   * Authorization: the todo must belong to userId.
   *
   * @param {number} userId
   * @param {number} todoId
   * @returns {Promise<void>}
   */
  async deleteTodo(userId, todoId) {
    const existing = await todoRepository.findById(todoId);
    if (!existing) {
      throw AppError.notFound('할일을 찾을 수 없습니다.');
    }

    if (Number(existing.user_id) !== Number(userId)) {
      throw AppError.forbidden('이 할일을 삭제할 권한이 없습니다.');
    }

    await todoRepository.deleteById(todoId, userId);
  },

  /**
   * Mark a todo as completed.
   * Authorization: the todo must belong to userId.
   *
   * @param {number} userId
   * @param {number} todoId
   * @returns {Promise<object>} Updated todo with status: 'completed'
   */
  async completeTodo(userId, todoId) {
    const existing = await todoRepository.findById(todoId);
    if (!existing) {
      throw AppError.notFound('할일을 찾을 수 없습니다.');
    }

    if (Number(existing.user_id) !== Number(userId)) {
      throw AppError.forbidden('이 할일을 수정할 권한이 없습니다.');
    }

    const updated = await todoRepository.setCompleted(todoId, userId, true);
    return { ...updated, status: calculateStatus(updated) };
  },

  /**
   * Mark a todo as not completed.
   * Authorization: the todo must belong to userId.
   *
   * @param {number} userId
   * @param {number} todoId
   * @returns {Promise<object>} Updated todo with recalculated status
   */
  async incompleteTodo(userId, todoId) {
    const existing = await todoRepository.findById(todoId);
    if (!existing) {
      throw AppError.notFound('할일을 찾을 수 없습니다.');
    }

    if (Number(existing.user_id) !== Number(userId)) {
      throw AppError.forbidden('이 할일을 수정할 권한이 없습니다.');
    }

    const updated = await todoRepository.setCompleted(todoId, userId, false);
    return { ...updated, status: calculateStatus(updated) };
  },
};

// Export for unit testing
export { calculateStatus };
