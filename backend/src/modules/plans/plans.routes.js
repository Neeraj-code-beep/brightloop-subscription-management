import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import { plansController } from './plans.controller.js';
import {
  createPlanSchema,
  updatePlanSchema,
  updatePlanStatusSchema
} from './plans.validation.js';

export const plansRouter = Router();

// Protect all plan management endpoints with authentication and RBAC (ADMIN, STAFF)
plansRouter.use(authenticate);
plansRouter.use(authorize('ADMIN', 'STAFF'));

// POST /api/v1/plans - Create plan
plansRouter.post(
  '/',
  validateBody(createPlanSchema),
  plansController.createPlan
);

// GET /api/v1/plans - List plans with dual pagination
plansRouter.get(
  '/',
  plansController.listPlans
);

// GET /api/v1/plans/:id - Get plan details
plansRouter.get(
  '/:id',
  plansController.getPlanById
);

// PATCH & PUT /api/v1/plans/:id - Update plan
plansRouter.patch(
  '/:id',
  validateBody(updatePlanSchema),
  plansController.updatePlan
);
plansRouter.put(
  '/:id',
  validateBody(updatePlanSchema),
  plansController.updatePlan
);

// PATCH /api/v1/plans/:id/status - Toggle plan active status
plansRouter.patch(
  '/:id/status',
  validateBody(updatePlanStatusSchema),
  plansController.updatePlanStatus
);
