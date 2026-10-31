import { z } from 'zod';

const passwordPolicy = z
  .string({ required_error: 'Password is required' })
  .min(9, 'Password must be more than 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const createStaffSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters long').max(100),
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address').toLowerCase(),
  password: passwordPolicy
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional()
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' })
});

