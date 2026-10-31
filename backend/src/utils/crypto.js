import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const SALT_ROUNDS = 12;

/**
 * Hash password with bcryptjs
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare plain password against bcrypt hash
 */
export async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Generate a cryptographically secure random token (e.g., for refresh tokens or password reset)
 */
export function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a sensitive token using SHA-256 before storing in database
 */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate short-lived JWT access token
 * Does not include passwords, secrets, or sensitive PII
 */
export function generateAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    customerId: user.customer?.id || null
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

