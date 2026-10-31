import { forwardToAiService } from './ai.proxy.js';

export class AiController {
  /**
   * Health Check Proxy: GET /api/v1/ai/health
   * Public readiness probe forwarded to upstream AI service.
   */
  async health(req, res, next) {
    try {
      return await forwardToAiService(req, res, '/api/v1/ai/health');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Natural Language Chat Proxy: POST /api/v1/ai/chat
   * Authenticated chat query forwarded to upstream AI assistant with caller JWT.
   */
  async chat(req, res, next) {
    try {
      return await forwardToAiService(req, res, '/api/v1/ai/chat');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Semantic Knowledge Retrieval Proxy: POST /api/v1/ai/rag/query
   * Authenticated RAG query forwarded to upstream AI knowledge store.
   */
  async ragQuery(req, res, next) {
    try {
      return await forwardToAiService(req, res, '/api/v1/ai/rag/query');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generic Forwarder for any additional subpaths under /api/v1/ai/*
   */
  async forward(req, res, next) {
    try {
      const subpath = req.path.startsWith('/') ? req.path : `/${req.path}`;
      return await forwardToAiService(req, res, `/api/v1/ai${subpath}`);
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AiController();

