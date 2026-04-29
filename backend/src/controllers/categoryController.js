import { categoryService } from '../services/categoryService.js';

/**
 * HTTP handlers for category endpoints.
 *
 * Express 5 automatically forwards thrown errors from async functions to the
 * global error handler, so explicit try/catch blocks are unnecessary here.
 *
 * userId is extracted from req.user which is populated by authMiddleware after
 * JWT verification. The JWT payload may carry the user's primary key as either
 * `userId` or `id` depending on the signing context.
 */
export const categoryController = {
  /**
   * GET /api/categories
   * Returns all categories owned by the authenticated user.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getCategories(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const categories = await categoryService.getCategories(userId);
    res.status(200).json({ success: true, data: categories });
  },

  /**
   * POST /api/categories
   * Creates a new category for the authenticated user.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async createCategory(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const { name } = req.body;
    const category = await categoryService.createCategory(userId, { name });
    res.status(201).json({ success: true, data: category });
  },

  /**
   * PATCH /api/categories/:id
   * Updates the name of an existing category.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async updateCategory(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const categoryId = parseInt(req.params.id, 10);
    const { name } = req.body;
    const category = await categoryService.updateCategory(userId, categoryId, { name });
    res.status(200).json({ success: true, data: category });
  },

  /**
   * DELETE /api/categories/:id
   * Deletes a category. Todos linked to it will have their category_id set to
   * NULL by the database constraint.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async deleteCategory(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const categoryId = parseInt(req.params.id, 10);
    await categoryService.deleteCategory(userId, categoryId);
    res.status(200).json({ success: true });
  },
};
