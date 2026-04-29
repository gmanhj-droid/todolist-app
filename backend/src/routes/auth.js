import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Stricter rate limiting for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // Limit each IP to 10 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again after an hour',
      type: 'RATE_LIMIT_ERROR',
    },
  },
});

// Public routes
router.post('/sign-up', authLimiter, authController.signUp);
router.post('/sign-in', authLimiter, authController.signIn);

// Protected routes (valid JWT required)
router.post('/sign-out', authMiddleware, authController.signOut);
router.delete('/account', authMiddleware, authController.deleteAccount);

export default router;
