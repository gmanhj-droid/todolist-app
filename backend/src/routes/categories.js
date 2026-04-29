import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { categoryController } from '../controllers/categoryController.js';

const router = Router();

// All category routes require a valid JWT
router.use(authMiddleware);

// GET    /api/categories       — list all categories for the authenticated user
router.get('/', categoryController.getCategories);

// POST   /api/categories       — create a new category
router.post('/', categoryController.createCategory);

// PATCH  /api/categories/:id   — rename an existing category
router.patch('/:id', categoryController.updateCategory);

// DELETE /api/categories/:id   — delete a category (todos set to NULL by DB)
router.delete('/:id', categoryController.deleteCategory);

export default router;
