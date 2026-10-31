import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { successResponse, errorResponse } from './utils/response.js';
import { errorHandler } from './middleware/errorHandler.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { customersRouter } from './modules/customers/customers.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { plansRouter } from './modules/plans/plans.routes.js';
import { quotationsRouter } from './modules/quotations/quotations.routes.js';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { taxesRouter } from './modules/taxes/taxes.routes.js';
import { discountsRouter } from './modules/discounts/discounts.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';

export const app = express();

// Security Headers
app.use(helmet());

// Global Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Health Check Endpoints
app.get('/health', (req, res) => {
  return successResponse(res, {
    message: 'Backend service is healthy',
    data: {
      status: 'UP',
      service: 'subpilot-backend',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv
    }
  });
});

app.get('/api/v1/health', (req, res) => {
  return successResponse(res, {
    message: 'Backend API v1 is healthy',
    data: {
      status: 'UP',
      service: 'subpilot-backend',
      version: 'v1',
      timestamp: new Date().toISOString()
    }
  });
});

// Mount Modules under /api/v1
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/plans', plansRouter);
app.use('/api/v1/quotations', quotationsRouter);
app.use('/api/v1/subscriptions', subscriptionsRouter);
app.use('/api/v1/invoices', invoicesRouter);
app.use('/api/v1/taxes', taxesRouter);
app.use('/api/v1/discounts', discountsRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/analytics', analyticsRouter);

// 404 Handler
app.use((req, res) => {
  return errorResponse(res, {
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    statusCode: 404
  });
});

// Central Error Handler
app.use(errorHandler);
