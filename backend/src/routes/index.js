import { Router } from 'express';
import authRouter from './auth.js';
import todosRouter from './todos.js';
import categoriesRouter from './categories.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/todos', todosRouter);
router.use('/categories', categoriesRouter);

export default router;
