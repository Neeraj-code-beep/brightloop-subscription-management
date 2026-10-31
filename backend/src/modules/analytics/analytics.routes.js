import { Router } from 'express';
import { analyticsController } from './analytics.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';

export const analyticsRouter = Router();

// Global authentication and role-based protection
// ADMIN and STAFF have access; CUSTOMER is strictly forbidden
analyticsRouter.use(authenticate);
analyticsRouter.use(authorize('ADMIN', 'STAFF'));

// 1. Dashboard & Executive Summary
analyticsRouter.get('/summary', analyticsController.getSummary.bind(analyticsController));
analyticsRouter.get('/dashboard', analyticsController.getDashboard.bind(analyticsController));

// 2. Revenue Analytics
analyticsRouter.get('/revenue', analyticsController.getRevenue.bind(analyticsController));

// 3. MRR & ARR
analyticsRouter.get('/mrr', analyticsController.getMrr.bind(analyticsController));
analyticsRouter.get('/arr', analyticsController.getArr.bind(analyticsController));

// 4. Customer Analytics
analyticsRouter.get('/customers', analyticsController.getCustomers.bind(analyticsController));

// 5. Subscription Analytics
analyticsRouter.get('/subscriptions', analyticsController.getSubscriptions.bind(analyticsController));

// 6. Invoice & Payment Analytics
analyticsRouter.get('/invoices', analyticsController.getInvoices.bind(analyticsController));
analyticsRouter.get('/overdue', analyticsController.getOverdue.bind(analyticsController));
analyticsRouter.get('/payments', analyticsController.getPayments.bind(analyticsController));
