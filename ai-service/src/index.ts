import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { successResponse, errorResponse } from './utils/response.js';
import { processBillingQuery } from './services/billingAssistant.js';

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
      geminiConfigured: Boolean(config.geminiApiKey),
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
      timestamp: new Date().toISOString()
    }
  });
});

// Chat Endpoint
app.post('/api/v1/ai/chat', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return errorResponse(res, {
      message: 'Prompt is required and must be a string',
      statusCode: 400
    });
  }

  try {
    const reply = await processBillingQuery(prompt);
    return successResponse(res, {
      message: 'Query processed successfully',
      data: { reply }
    });
  } catch (error: any) {
    return errorResponse(res, {
      message: error.message || 'Error processing AI request',
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

