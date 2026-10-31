import { Router } from 'express';
import { aiController } from './ai.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { aiRateLimiter } from '../../middleware/rateLimiter.js';

export const aiRouter = Router();

// 1. Health Probe (Public) - GET /api/v1/ai/health
aiRouter.get('/health', aiController.health.bind(aiController));

// 2. Chat Endpoint (Protected + Rate Limited) - POST /api/v1/ai/chat
aiRouter.post('/chat', aiRateLimiter, authenticate, aiController.chat.bind(aiController));

// 3. RAG Query Endpoint (Protected + Rate Limited) - POST /api/v1/ai/rag/query
aiRouter.post('/rag/query', aiRateLimiter, authenticate, aiController.ragQuery.bind(aiController));

// 4. Catch-all for any additional subpaths (Protected + Rate Limited)
aiRouter.all('{*path}', aiRateLimiter, authenticate, aiController.forward.bind(aiController));
