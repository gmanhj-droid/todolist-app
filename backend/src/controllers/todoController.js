import { todoService } from '../services/todoService.js';

/**
 * HTTP handlers for todo endpoints.
 *
 * Express 5 automatically forwards thrown errors from async functions to the
 * global error handler, so explicit try/catch blocks are not required here.
 *
 * userId is extracted from req.user which is populated by authMiddleware after
 * JWT verification. The JWT payload may carry the user's primary key as either
 * `userId` or `id` depending on the signing context.
 */
export const todoController = {
  /**
   * GET /api/todos
   * Returns all todos owned by the authenticated user.
   * Accepts optional query parameters:
   *   - status: 'active' | 'overdue' | 'completed'
   *   - category_id: integer
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getTodos(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const { status } = req.query;
    const categoryId = req.query.category_id
      ? parseInt(req.query.category_id, 10)
      : undefined;

    const todos = await todoService.getTodos(userId, { status, categoryId });
    res.status(200).json({ success: true, data: todos });
  },

  /**
   * POST /api/todos
   * Creates a new todo for the authenticated user.
   * Accepts body fields: title, description, category_id, due_date.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async createTodo(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const {
      title,
      description,
      category_id: categoryId,
      due_date: dueDate,
    } = req.body;

    const todo = await todoService.createTodo(userId, {
      title,
      description,
      categoryId: categoryId !== null && categoryId !== undefined ? parseInt(categoryId, 10) : undefined,
      dueDate,
    });

    res.status(201).json({ success: true, data: todo });
  },

  /**
   * PATCH /api/todos/:id
   * Partially updates a todo that belongs to the authenticated user.
   * Accepts body fields: title, description, category_id, due_date.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async updateTodo(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const todoId = parseInt(req.params.id, 10);
    const {
      title,
      description,
      category_id: categoryId,
      due_date: dueDate,
    } = req.body;

    const fields = {};
    if (title !== undefined) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (categoryId !== undefined) fields.categoryId = parseInt(categoryId, 10);
    if (dueDate !== undefined) fields.dueDate = dueDate;

    const todo = await todoService.updateTodo(userId, todoId, fields);
    res.status(200).json({ success: true, data: todo });
  },

  /**
   * DELETE /api/todos/:id
   * Deletes a todo that belongs to the authenticated user.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async deleteTodo(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const todoId = parseInt(req.params.id, 10);
    await todoService.deleteTodo(userId, todoId);
    res.status(200).json({ success: true });
  },

  /**
   * PATCH /api/todos/:id/complete
   * Marks a todo as completed.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async completeTodo(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const todoId = parseInt(req.params.id, 10);
    const todo = await todoService.completeTodo(userId, todoId);
    res.status(200).json({ success: true, data: todo });
  },

  /**
   * PATCH /api/todos/:id/incomplete
   * Marks a todo as not completed and recalculates its status.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async incompleteTodo(req, res) {
    const userId = req.user.userId ?? req.user.id;
    const todoId = parseInt(req.params.id, 10);
    const todo = await todoService.incompleteTodo(userId, todoId);
    res.status(200).json({ success: true, data: todo });
  },
};
