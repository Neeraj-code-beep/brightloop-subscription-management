import { z } from 'zod';

const passwordPolicy = z
  .string({ required_error: 'Password is required' })
  .min(9, 'Password must be more than 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters long').max(100),
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address').toLowerCase(),
  password: passwordPolicy
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address').toLowerCase(),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password cannot be empty')
});

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1, 'Refresh token cannot be empty')
});

export const forgotPasswordSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address').toLowerCase()
});

export const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'Reset token is required' }).min(1, 'Reset token cannot be empty'),
  newPassword: passwordPolicy
});

