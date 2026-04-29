import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { todoController } from '../controllers/todoController.js';

const router = Router();

// All todo routes require authentication
router.use(authMiddleware);

// Collection routes
router.get('/', todoController.getTodos);
router.post('/', todoController.createTodo);

// Specific action routes MUST be declared before the generic /:id route
// to prevent Express from treating 'complete' and 'incomplete' as id values.
router.patch('/:id/complete', todoController.completeTodo);
router.patch('/:id/incomplete', todoController.incompleteTodo);

// Generic resource routes
router.patch('/:id', todoController.updateTodo);
router.delete('/:id', todoController.deleteTodo);

export default router;
