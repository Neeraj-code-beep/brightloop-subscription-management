import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('AI Service Health Check & API Contract', () => {
  it('GET /health returns 200 with standard envelope', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'AI Service is healthy');
    expect(res.body.data).toHaveProperty('status', 'UP');
  });

  it('GET /api/v1/ai/health returns 200 with standard envelope', async () => {
    const res = await request(app).get('/api/v1/ai/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('POST /api/v1/ai/chat returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/v1/ai/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message');
  });

  it('POST /api/v1/ai/chat returns dual-key response (reply and answer) in scaffolding mode', async () => {
    const res = await request(app).post('/api/v1/ai/chat').send({ prompt: 'Hello' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('reply');
    expect(res.body.data).toHaveProperty('answer');
    expect(res.body.data.reply).toBe(res.body.data.answer);
  });
});
