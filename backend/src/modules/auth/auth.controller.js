import { authService } from './auth.service.js';
import { successResponse } from '../../utils/response.js';

export class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.validatedBody);
      return successResponse(res, {
        message: 'Account registered successfully',
        data: result,
        statusCode: 201
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.socket?.remoteAddress;

      const result = await authService.login({
        ...req.validatedBody,
        userAgent,
        ipAddress
      });

      return successResponse(res, {
        message: 'Authentication successful',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.socket?.remoteAddress;

      const result = await authService.refresh({
        rawRefreshToken: req.validatedBody.refreshToken,
        userAgent,
        ipAddress
      });

      return successResponse(res, {
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const rawRefreshToken = req.body?.refreshToken;
      await authService.logout({ rawRefreshToken });

      return successResponse(res, {
        message: 'Logged out successfully',
        data: {}
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.validatedBody);
      return successResponse(res, {
        message: result.message,
        data: {}
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(req.validatedBody);
      return successResponse(res, {
        message: result.message,
        data: {}
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req, res) {
    return successResponse(res, {
      message: 'Current user profile retrieved successfully',
      data: {
        user: req.user
      }
    });
  }
}

export const authController = new AuthController();

