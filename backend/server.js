import { env } from './src/config/env.js';
import { testConnection } from './src/config/database.js';
import app from './src/app.js';

async function bootstrap() {
  try {
    await testConnection();

    const server = app.listen(env.port, () => {
      console.log(
        `Server started in ${env.nodeEnv} mode on http://localhost:${env.port}`
      );
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`${signal} received — shutting down gracefully.`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

bootstrap();
