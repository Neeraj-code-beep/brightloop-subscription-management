import { prisma } from '../../utils/prisma.js';
import {
  hashPassword,
  comparePassword,
  generateRandomToken,
  hashToken,
  generateAccessToken
} from '../../utils/crypto.js';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const RESET_TOKEN_EXPIRY_HOURS = 1;

export class AuthService {
  /**
   * Register a new public Customer
   */
  async register({ name, email, password }) {
    // 1. Check duplicate email
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

    // 3. Create User with CUSTOMER role (strictly server-enforced) and associated Customer record
    const customerCode = `CUST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'CUSTOMER',
        isActive: true,
        customer: {
          create: {
            customerCode,
            customerType: 'INDIVIDUAL',
            firstName: name,
            email,
            isActive: true,
            status: 'ACTIVE'
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        customer: {
          select: { id: true }
        }
      }
    });

    // 4. Generate Tokens
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customer?.id || null,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken: rawRefreshToken
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login({ email, password, userAgent, ipAddress }) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customer: {
          select: { id: true }
        }
      }
    });

    // 2. Verify password with bcrypt using generic error to prevent enumeration
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // 3. Reject inactive users
    if (!user.isActive) {
      const error = new Error('Account is deactivated. Please contact an administrator.');
      error.statusCode = 403;
      throw error;
    }

    // 4. Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // 5. Generate and persist rotated refresh token
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null
      }
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customer?.id || null,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken: rawRefreshToken
    };
  }

  /**
   * Rotate refresh token and issue new access token
   */
  async refresh({ rawRefreshToken, userAgent, ipAddress }) {
    const tokenHash = hashToken(rawRefreshToken);

    const session = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            customer: { select: { id: true } }
          }
        }
      }
    });

    if (!session) {
      const error = new Error('Invalid or non-existent refresh token');
      error.statusCode = 401;
      throw error;
    }

    // If token is already revoked, potential token reuse attack -> revoke all user sessions
    if (session.isRevoked) {
      await prisma.refreshToken.updateMany({
        where: { userId: session.userId },
        data: { isRevoked: true }
      });
      const error = new Error('Refresh token has been revoked. Security alert: session terminated.');
      error.statusCode = 401;
      throw error;
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      const error = new Error('Refresh token has expired');
      error.statusCode = 401;
      throw error;
    }

    // Check user status
    if (!session.user.isActive) {
      const error = new Error('User account is inactive');
      error.statusCode = 403;
      throw error;
    }

    // Invalidate old refresh token (Rotation)
    await prisma.refreshToken.update({
      where: { id: session.id },
      data: { isRevoked: true }
    });

    // Generate new tokens
    const accessToken = generateAccessToken(session.user);
    const newRawRefreshToken = generateRandomToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: session.userId,
        tokenHash: newTokenHash,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null
      }
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken
    };
  }

  /**
   * Revoke current session
   */
  async logout({ rawRefreshToken }) {
    if (!rawRefreshToken) return;

    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true }
    });
  }

  /**
   * Request password reset token (generic safe response)
   */
  async forgotPassword({ email }) {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (user && user.isActive) {
      const rawResetToken = generateRandomToken();
      const tokenHash = hashToken(rawResetToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Invalidate existing unused reset tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, isUsed: false },
        data: { isUsed: true }
      });

      // Store hashed reset token
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt
        }
      });

      // Prepare email delivery integration (Log in non-production environments)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[PasswordReset] Reset token generated for ${email}: ${rawResetToken}`);
      }
    }

    // Always return identical generic message to prevent email enumeration
    return {
      message: 'If an account with that email exists, password reset instructions have been sent.'
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword({ token, newPassword }) {
    const tokenHash = hashToken(token);

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });

    if (!resetRecord || resetRecord.isUsed || new Date() > resetRecord.expiresAt) {
      const error = new Error('Invalid or expired password reset token');
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash }
    });

    // Mark reset token used
    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { isUsed: true }
    });

    // Revoke all active refresh sessions to ensure security
    await prisma.refreshToken.updateMany({
      where: { userId: resetRecord.userId },
      data: { isRevoked: true }
    });

    return {
      message: 'Password has been successfully reset. Please log in with your new credentials.'
    };
  }
}

export const authService = new AuthService();

