import mongoose from 'mongoose';
import { env } from './env.js';
import { logger, logStructuredEvent } from '../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';
import { alertManager } from '../services/observability/alert-manager.service.js';

let isConnected = false;

// Attach global slow query detection plugin (never logs sensitive query params)
mongoose.plugin((schema) => {
  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'updateMany', 'countDocuments', 'deleteMany'] as any, function () {
    (this as any)._queryStartTime = Date.now();
  });

  schema.post(['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'updateMany', 'countDocuments', 'deleteMany'] as any, function () {
    const start = (this as any)._queryStartTime;
    if (start) {
      const durationMs = Date.now() - start;
      const slowThreshold = env.DB_SLOW_OPERATION_THRESHOLD_MS;
      if (durationMs >= slowThreshold) {
        logStructuredEvent({
          level: LogLevel.WARN,
          service: 'database',
          event: ObservabilityEvent.DB_SLOW_OPERATION,
          durationMs,
          metadata: {
            collection: (this as any).model?.collection?.name || (this as any).collection?.name || 'unknown',
            operation: (this as any).op || 'query',
            durationMs,
            thresholdMs: slowThreshold,
          },
        });
      }
    }
  });
});

export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected) {
    return mongoose;
  }

  try {
    mongoose.set('strictQuery', true);

    const connection = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    logger.info(`MongoDB connected successfully to ${connection.connection.name}`);
    alertManager.resolve('mongodb_unavailable');

    mongoose.connection.on('error', (err) => {
      logStructuredEvent({
        level: LogLevel.ERROR,
        service: 'database',
        event: ObservabilityEvent.DATABASE_ERROR,
        metadata: {
          error: err.message,
        },
      });
      alertManager.recordIncident('mongodb_unavailable', `MongoDB error: ${err.message}`, 'FATAL');
    });

    mongoose.connection.on('disconnected', () => {
      logStructuredEvent({
        level: LogLevel.WARN,
        service: 'database',
        event: ObservabilityEvent.DATABASE_ERROR,
        metadata: {
          message: 'MongoDB connection lost. Attempting reconnect...',
        },
      });
      isConnected = false;
      alertManager.recordIncident('mongodb_unavailable', 'MongoDB disconnected', 'FATAL');
    });

    mongoose.connection.on('connected', () => {
      isConnected = true;
      alertManager.resolve('mongodb_unavailable');
    });

    return connection;
  } catch (error) {
    logStructuredEvent({
      level: LogLevel.FATAL,
      service: 'database',
      event: ObservabilityEvent.DATABASE_ERROR,
      metadata: {
        error: (error as Error).message,
      },
    });
    alertManager.recordIncident('mongodb_unavailable', `MongoDB initialization failed: ${(error as Error).message}`, 'FATAL');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected cleanly');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting MongoDB');
  }
}
