import { usersService } from './users.service.js';
import { successResponse } from '../../utils/response.js';

export class UsersController {
  async createStaff(req, res, next) {
    try {
      const result = await usersService.createStaff({
        ...req.validatedBody,
        adminUserId: req.user.id
      });

      return successResponse(res, {
        message: 'Staff account created successfully',
        data: result,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const { role, status, search } = req.query;

      const result = await usersService.listUsers({ page, limit, role, status, search });

      return successResponse(res, {
        message: 'Users retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      // Only ADMIN can view other users' detailed profiles; users can view their own
      if (req.user.role !== 'ADMIN' && req.user.id !== id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: you cannot view other user profiles',
          errors: []
        });
      }

      const result = await usersService.getUserById(id);

      return successResponse(res, {
        message: 'User retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await usersService.updateUser(id, req.validatedBody, req.user);

      return successResponse(res, {
        message: 'User updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.validatedBody;

      const result = await usersService.updateUserStatus(id, isActive, req.user);

      return successResponse(res, {
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();

