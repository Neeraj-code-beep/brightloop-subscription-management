import { verifyAccessToken } from '../utils/crypto.js';
import { prisma } from '../utils/prisma.js';
import { errorResponse } from '../utils/response.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, {
      message: 'Authentication token is missing or malformed',
      statusCode: 401
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return errorResponse(res, {
      message: 'Authentication token is required',
      statusCode: 401
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    // Verify user exists and account is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        customer: {
          select: {
            id: true
          }
        }
      }
    });

    if (!user) {
      return errorResponse(res, {
        message: 'Authenticated user no longer exists',
        statusCode: 401
      });
    }

    if (!user.isActive) {
      return errorResponse(res, {
        message: 'Account is deactivated. Please contact an administrator.',
        statusCode: 401
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      customerId: user.customer?.id || null
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, {
        message: 'Authentication token has expired',
        statusCode: 401
      });
    }

    return errorResponse(res, {
      message: 'Invalid authentication token',
      statusCode: 401
    });
  }
}
