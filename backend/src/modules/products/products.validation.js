import { z } from 'zod';

const priceSchema = z.union([
  z.number().min(0, 'Price must be a non-negative number'),
  z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid non-negative decimal number')
]).transform(val => typeof val === 'number' ? val.toFixed(2) : parseFloat(val).toFixed(2));

const optionalPriceSchema = z.union([
  z.number().min(0, 'Price must be a non-negative number'),
  z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid non-negative decimal number')
]).optional().nullable().transform(val => {
  if (val === undefined) return undefined;
  if (val === null) return null;
  return typeof val === 'number' ? val.toFixed(2) : parseFloat(val).toFixed(2);
});

// Product Schemas
export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  slug: z.string().trim().min(1).max(200).toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase alphanumeric characters and hyphens').optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.enum(['SOFTWARE', 'SERVICE', 'SUBSCRIPTION', 'ADD_ON']).default('SOFTWARE'),
  basePrice: priceSchema.default(0),
  costPrice: optionalPriceSchema,
  isActive: z.boolean().default(true)
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase alphanumeric characters and hyphens').optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.enum(['SOFTWARE', 'SERVICE', 'SUBSCRIPTION', 'ADD_ON']).optional(),
  basePrice: priceSchema.optional(),
  costPrice: optionalPriceSchema,
  isActive: z.boolean().optional()
}).strict();

export const updateProductStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' })
}).strict();

// Variant Schemas
export const createVariantSchema = z.object({
  name: z.string().trim().min(1, 'Variant name is required').max(200),
  sku: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  additionalPrice: priceSchema.default(0),
  unit: z.string().trim().min(1).max(50).default('seat'),
  isActive: z.boolean().default(true)
});

export const updateVariantSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  additionalPrice: priceSchema.optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional()
}).strict();

export const updateVariantStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' })
}).strict();

// Final Price Calculation Schema
export const calculatePriceSchema = z.object({
  variantIds: z.array(z.string().min(1)).default([])
}).strict();

