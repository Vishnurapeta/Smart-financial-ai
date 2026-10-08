import { Router } from 'express';
import {
  getHealthHandler,
  getLivenessHandler,
  getReadinessHandler,
  getDependenciesHealthHandler,
} from '../controllers/health.controller.js';

const router = Router();

// Standard health endpoints
router.get('/health', getHealthHandler);
router.get('/health/live', getLivenessHandler);
router.get('/health/ready', getReadinessHandler);
router.get('/health/dependencies', getDependenciesHealthHandler);

// Shorthand Kubernetes/Docker probe aliases
router.get('/live', getLivenessHandler);
router.get('/ready', getReadinessHandler);
router.get('/dependencies', getDependenciesHealthHandler);

export default router;
