import { Router } from 'express';
import { usersController } from './users.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';
import {
  createStaffSchema,
  updateUserSchema,
  updateUserStatusSchema
} from './users.validation.js';

export const usersRouter = Router();

// Staff account creation (ADMIN only)
usersRouter.post(
  '/staff',
  authenticate,
  authorize('ADMIN'),
  validateBody(createStaffSchema),
  (req, res, next) => usersController.createStaff(req, res, next)
);

// List all users with pagination and filters (ADMIN only)
usersRouter.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  (req, res, next) => usersController.listUsers(req, res, next)
);

// Get single user (ADMIN or self)
usersRouter.get(
  '/:id',
  authenticate,
  (req, res, next) => usersController.getUserById(req, res, next)
);

// Update user details (ADMIN or self for personal info)
usersRouter.patch(
  '/:id',
  authenticate,
  validateBody(updateUserSchema),
  (req, res, next) => usersController.updateUser(req, res, next)
);

// Update user active status (ADMIN only)
usersRouter.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN'),
  validateBody(updateUserStatusSchema),
  (req, res, next) => usersController.updateUserStatus(req, res, next)
);
