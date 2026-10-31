import { prisma } from '../../utils/prisma.js';
import { hashPassword } from '../../utils/crypto.js';

export class UsersService {
  /**
   * Create a STAFF account (ADMIN only)
   */
  async createStaff({ name, email, password, adminUserId }) {
    // 1. Prevent duplicate email
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      const error = new Error('An account with this email address already exists');
      error.statusCode = 409;
      throw error;
    }

    // 2. Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // 3. Strictly create with STAFF role, recording creator
    const staffUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'STAFF',
        isActive: true,
        createdById: adminUserId || null
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdById: true,
        createdAt: true
      }
    });

    const { passwordHash: _, ...safeStaffUser } = staffUser;
    return safeStaffUser;
  }

  /**
   * List users with pagination and filtering (ADMIN only)
   */
  async listUsers({ page = 1, limit = 20, role, status, search }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (role) {
      where.role = role;
    }

    if (status !== undefined) {
      where.isActive = status === 'active' || status === 'true' || status === true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdById: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Get single user by ID
   */
  async getUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdById: true,
        createdAt: true,
        customer: {
          select: { id: true, companyName: true, status: true }
        }
      }
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  /**
   * Update user details
   */
  async updateUser(id, updateData, requestingUser) {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Only ADMIN can modify other users or change roles
    if (requestingUser.role !== 'ADMIN') {
      if (requestingUser.id !== id) {
        const error = new Error('Access denied: you cannot modify other user accounts');
        error.statusCode = 403;
        throw error;
      }

      // Non-admins cannot modify their own role
      if (updateData.role && updateData.role !== user.role) {
        const error = new Error('Access denied: self-promotion or role changing is prohibited');
        error.statusCode = 403;
        throw error;
      }
    }

    // Check email uniqueness if email is changed
    if (updateData.email && updateData.email !== user.email) {
      const existing = await prisma.user.findUnique({
        where: { email: updateData.email }
      });
      if (existing) {
        const error = new Error('Email address already in use');
        error.statusCode = 409;
        throw error;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: updateData.name !== undefined ? updateData.name : undefined,
        email: updateData.email !== undefined ? updateData.email : undefined,
        role: requestingUser.role === 'ADMIN' && updateData.role ? updateData.role : undefined
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    return updated;
  }

  /**
   * Activate or deactivate user (ADMIN only)
   */
  async updateUserStatus(id, isActive, requestingUser) {
    if (requestingUser.id === id && !isActive) {
      const error = new Error('Administrators cannot deactivate their own account');
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // If deactivating user, revoke all active sessions immediately
    if (!isActive) {
      await prisma.refreshToken.updateMany({
        where: { userId: id },
        data: { isRevoked: true }
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    return updated;
  }
}

export const usersService = new UsersService();

