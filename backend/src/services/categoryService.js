import { categoryRepository } from '../repositories/categoryRepository.js';
import { AppError } from '../utils/AppError.js';

/**
 * Business-logic layer for category operations.
 * All authorization and validation rules are enforced here before delegating
 * to the repository layer.
 */
export const categoryService = {
  /**
   * Return all categories that belong to the given user.
   *
   * @param {number} userId
   * @returns {Promise<object[]>}
   */
  async getCategories(userId) {
    return categoryRepository.findAllByUserId(userId);
  },

  /**
   * Create a new category for the given user.
   *
   * Validation rules:
   *  - name must be a non-empty string
   *  - name (trimmed) must not exceed 20 characters
   *  - name must be unique for this user
   *
   * @param {number} userId
   * @param {{ name: string }} param1
   * @returns {Promise<object>} Created category row
   */
  async createCategory(userId, { name }) {
    if (!name || name.trim().length === 0) {
      throw AppError.validation('카테고리 이름은 필수입니다.');
    }

    if (name.trim().length > 20) {
      throw AppError.validation('카테고리 이름은 20자 이하이어야 합니다.');
    }

    const trimmedName = name.trim();
    const existing = await categoryRepository.findByUserIdAndName(userId, trimmedName);
    if (existing) {
      throw AppError.conflict('이미 존재하는 카테고리 이름입니다.');
    }

    return categoryRepository.create({ userId, name: trimmedName });
  },

  /**
   * Update the name of an existing category.
   *
   * Authorization: the category must belong to userId.
   * Validation rules mirror createCategory.
   *
   * @param {number} userId
   * @param {number} categoryId
   * @param {{ name: string }} param2
   * @returns {Promise<object>} Updated category row
   */
  async updateCategory(userId, categoryId, { name }) {
    if (!name || name.trim().length === 0) {
      throw AppError.validation('카테고리 이름은 필수입니다.');
    }

    if (name.trim().length > 20) {
      throw AppError.validation('카테고리 이름은 20자 이하이어야 합니다.');
    }

    const trimmedName = name.trim();

    // Check ownership and current state
    const existing = await categoryRepository.findById(categoryId);
    if (!existing) {
      throw AppError.notFound('카테고리를 찾을 수 없습니다.');
    }

    if (Number(existing.user_id) !== Number(userId)) {
      throw AppError.forbidden('이 카테고리를 수정할 권한이 없습니다.');
    }

    // Check for duplicate only when the name actually changes
    if (trimmedName !== existing.name) {
      const duplicate = await categoryRepository.findByUserIdAndName(userId, trimmedName);
      if (duplicate) {
        throw AppError.conflict('이미 존재하는 카테고리 이름입니다.');
      }
    }

    const updated = await categoryRepository.update(categoryId, userId, { name: trimmedName });
    return updated;
  },

  /**
   * Delete a category.
   * Todos that reference the category will have their category_id set to NULL
   * by the database-level ON DELETE SET NULL constraint.
   *
   * Authorization: the category must belong to userId.
   *
   * @param {number} userId
   * @param {number} categoryId
   * @returns {Promise<void>}
   */
  async deleteCategory(userId, categoryId) {
    const existing = await categoryRepository.findById(categoryId);
    if (!existing) {
      throw AppError.notFound('카테고리를 찾을 수 없습니다.');
    }

    if (Number(existing.user_id) !== Number(userId)) {
      throw AppError.forbidden('이 카테고리를 삭제할 권한이 없습니다.');
    }

    await categoryRepository.deleteById(categoryId, userId);
  },
};
