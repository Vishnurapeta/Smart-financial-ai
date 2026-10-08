import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initSocketServer } from './config/socket.js';
import { initStockAlertQueue, closeStockAlertQueue } from './queues/stock-alert.queue.js';
import { initNotificationQueues, closeNotificationQueues } from './queues/notification.queue.js';
import { initReportQueue, closeReportQueue } from './queues/report.queue.js';
import { notificationService } from './services/notification.service.js';
import { cacheService } from './config/redis.js';

// Create native Node HTTP server wrapping Express app
const httpServer = http.createServer(app);

// Initialize Socket.IO Server with JWT authentication and rooms
initSocketServer(httpServer);

// Initialize BullMQ queues and workers when Redis is confirmed available
async function startBackgroundQueues(): Promise<void> {
  const isRedisAvailable = await cacheService.waitForReady(1500);
  if (isRedisAvailable) {
    initStockAlertQueue();
    initNotificationQueues();
    initReportQueue();
  } else {
    logger.info(
      '[BullMQ] Redis is offline; background workers deferred, resilient in-memory direct execution fallback active',
    );
  }
}

// Automatically activate BullMQ background workers if Redis connects or reconnects later
cacheService.onConnect(() => {
  initStockAlertQueue();
  initNotificationQueues();
  initReportQueue();
});

// Ensure NotificationService singleton & domain event subscriptions are active
notificationService;

let server: http.Server;

/**
 * Bootstrap the application: connect to MongoDB first, then start the HTTP server.
 * This prevents "buffering timed out" errors by ensuring Mongoose has an active
 * connection before any request handlers execute database queries.
 */
async function bootstrap(): Promise<void> {
  try {
    // 1. Connect to MongoDB — this MUST succeed before we accept HTTP requests
    await connectDatabase();
    logger.info('✅ MongoDB connection established — database ready for queries');
  } catch (error) {
    const message = (error as Error).message;
    // Redact credentials from the error message
    const safeMessage = message.replace(/:\/\/[^@]*@/, '://<credentials>@');
    logger.fatal(
      `❌ FATAL: MongoDB connection failed — ${safeMessage}. The server cannot start without a database connection.`,
    );
    process.exit(1);
  }

  // 2. Start background BullMQ queues (non-blocking, Redis is optional)
  void startBackgroundQueues();

  // 3. Start listening for HTTP requests only after MongoDB is confirmed connected
  server = httpServer.listen(env.PORT, () => {
    logger.info(
      `🚀 ${env.APP_NAME} operational on port ${env.PORT} [${env.NODE_ENV}] (API prefix: ${env.API_PREFIX}) with Socket.IO enabled`,
    );
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Shutting down HTTP & WebSocket server gracefully...`);
  await Promise.allSettled([
    closeStockAlertQueue(),
    closeNotificationQueues(),
    closeReportQueue(),
    cacheService.disconnect(),
    disconnectDatabase(),
  ]);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force close after 10 seconds if not gracefully completed
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception thrown');
  process.exit(1);
});

// Start the application
bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
