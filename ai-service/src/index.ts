import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { successResponse, errorResponse } from './utils/response.js';
import { processBillingQuery } from './services/billingAssistant.js';
import { retrieveRelevantDocuments } from './rag/retriever.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Health Check Endpoints
app.get('/health', (req: Request, res: Response) => {
  return successResponse(res, {
    message: 'AI Service is healthy',
    data: {
      status: 'UP',
      service: 'sms-ai-service',
      model: config.geminiModel,
      embeddingModel: config.geminiEmbeddingModel,
      geminiConfigured: Boolean(config.geminiApiKey),
      huggingFaceConfigured: Boolean(config.huggingFaceApiKey),
      huggingFaceModel: config.huggingFaceModel,
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/api/v1/ai/health', (req: Request, res: Response) => {
  return successResponse(res, {
    message: 'AI Service v1 is healthy',
    data: {
      status: 'UP',
      service: 'sms-ai-service',
      geminiConfigured: Boolean(config.geminiApiKey),
      huggingFaceConfigured: Boolean(config.huggingFaceApiKey),
      timestamp: new Date().toISOString()
    }
  });
});

// Chat Endpoint: POST /api/v1/ai/chat
// Supports both data.reply and data.answer for full frontend compatibility
app.post('/api/v1/ai/chat', async (req: Request, res: Response) => {
  const { prompt, conversationId, context } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return errorResponse(res, {
      message: 'Prompt is required and must be a string',
      statusCode: 400
    });
  }

  const jwtToken = req.headers.authorization;

  try {
    const result = await processBillingQuery(prompt, {
      jwtToken
    });

    return successResponse(res, {
      message: 'Query processed successfully',
      data: {
        reply: result.reply,
        answer: result.answer,
        toolsUsed: result.toolsUsed,
        provider: result.provider,
        conversationId: conversationId || undefined
      }
    });
  } catch (error: any) {
    return errorResponse(res, {
      message: error.message || 'Error processing AI request',
      statusCode: 500
    });
  }
});

// RAG Query Endpoint: POST /api/v1/ai/rag/query
app.post('/api/v1/ai/rag/query', async (req: Request, res: Response) => {
  const { query, topK, category, includeDemoFixtures } = req.body;
  if (!query || typeof query !== 'string') {
    return errorResponse(res, {
      message: 'Query is required and must be a string',
      statusCode: 400
    });
  }

  try {
    // Only permit demo fixtures if explicitly requested (e.g. in development/tests)
    const retrieval = await retrieveRelevantDocuments(query, {
      topK: typeof topK === 'number' ? topK : 3,
      category: typeof category === 'string' ? category : undefined,
      includeDemoFixtures: Boolean(includeDemoFixtures)
    });

    if (retrieval.results.length === 0) {
      return successResponse(res, {
        message: retrieval.message || 'No verified policy document available',
        data: {
          query,
          count: 0,
          results: []
        }
      });
    }

    return successResponse(res, {
      message: 'Knowledge documents retrieved successfully',
      data: {
        query,
        count: retrieval.results.length,
        results: retrieval.results
      }
    });
  } catch (error: any) {
    return errorResponse(res, {
      message: error.message || 'Error executing semantic search',
      statusCode: 500
    });
  }
});

// Fallback 404
app.use((req: Request, res: Response) => {
  return errorResponse(res, {
    message: `AI route not found: ${req.method} ${req.originalUrl}`,
    statusCode: 404
  });
});

// Start server when executed directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[AI Service] Listening on port ${config.port} (${config.nodeEnv})`);
    console.log(`[AI Service] Health check: http://localhost:${config.port}/health`);
  });
}
