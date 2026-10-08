import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Backend Core Endpoints', () => {
  it('GET /api/v1/health should return 200 and operational system metadata', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers).toHaveProperty('x-correlation-id');
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.service).toBe('SmartFinAI-Backend');
    expect(typeof response.body.data.environment).toBe('string');
    expect(typeof response.body.data.uptimeSeconds).toBe('number');
    expect(typeof response.body.data.timestamp).toBe('string');
    expect(response.body.data.memory).toHaveProperty('rssMb');
    expect(response.body.error).toBeNull();
  });

  it('GET /api/v1/non-existent-endpoint should return 404 and structured error envelope', async () => {
    const response = await request(app).get('/api/v1/non-existent-endpoint');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested endpoint was not found on this server',
      },
    });
    expect(response.body.error).toHaveProperty('traceId');
  });
});
