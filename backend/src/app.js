import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { createRequire } from 'module';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';
import apiRouter from './routes/index.js';

const require = createRequire(import.meta.url);
const swaggerDoc = require('../../swagger/swagger.json');

const app = express();

// ── Security / transport middleware ──────────────────────────────────────────
// Set security-related HTTP headers
app.use(helmet());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-7', // set `RateLimit` and `RateLimit-Policy` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  skip: () => env.isTest, // Skip rate limiting during tests
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again after 15 minutes',
      type: 'RATE_LIMIT_ERROR',
    },
  },
});
app.use(globalLimiter);

app.use(
  cors({
    origin: env.corsOrigin.length === 1 ? env.corsOrigin[0] : env.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DOS

// ── Request logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Swagger UI ───────────────────────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// ── Application routes ───────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
