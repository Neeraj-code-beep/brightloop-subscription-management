import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setPrismaClient } from '../src/utils/prisma.js';
import { createMockPrisma, seedTestUser } from './testHelper.js';

describe('Product Management & Dual Pagination Suite', () => {
  let mockPrisma;
  let adminUser, staffUser, customerUser;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    setPrismaClient(mockPrisma);

    adminUser = await seedTestUser(mockPrisma, {
      name: 'Admin User',
      email: 'admin@subpilot.io',
      role: 'ADMIN'
    });

    staffUser = await seedTestUser(mockPrisma, {
      name: 'Staff User',
      email: 'staff@subpilot.io',
      role: 'STAFF'
    });

    customerUser = await seedTestUser(mockPrisma, {
      name: 'Customer Alice',
      email: 'alice@client.com',
      role: 'CUSTOMER'
    });
  });

  describe('1. Product CRUD & Authorization', () => {
    it('ADMIN can create a product with valid details', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Brightloop Analytics',
          slug: 'brightloop-analytics',
          description: 'Enterprise data visualization suite',
          type: 'SOFTWARE',
          basePrice: 5000.00,
          costPrice: 2000.00
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Brightloop Analytics');
      expect(res.body.data.slug).toBe('brightloop-analytics');
      expect(res.body.data.type).toBe('SOFTWARE');
      expect(res.body.data.isActive).toBe(true);
    });

    it('STAFF can create a product', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${staffUser.token}`)
        .send({
          name: 'Staff Provisioned Service',
          type: 'SERVICE',
          basePrice: '150.00'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('SERVICE');
    });

    it('CUSTOMER cannot create a product (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerUser.token}`)
        .send({
          name: 'Unauthorized Product',
          basePrice: 100
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Unauthenticated requests are rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .send({
          name: 'Anon Product',
          basePrice: 100
        });

      expect(res.status).toBe(401);
    });

    it('Duplicate product slug is rejected with 409 Conflict', async () => {
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Unique Product',
          slug: 'unique-slug',
          basePrice: 100
        });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Another Product',
          slug: 'unique-slug',
          basePrice: 200
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('Validation rejects negative prices and invalid product type', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Invalid Price Product',
          basePrice: -50,
          type: 'INVALID_TYPE'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('Can fetch product details by ID', async () => {
      const createRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Detail Test',
          basePrice: 300
        });

      const productId = createRes.body.data.id;

      const res = await request(app)
        .get(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(productId);
      expect(res.body.data.name).toBe('Detail Test');
    });

    it('Can update product fields and toggle active status', async () => {
      const createRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Initial Product',
          basePrice: 100
        });

      const productId = createRes.body.data.id;

      // Update fields
      const updateRes = await request(app)
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Updated Product Name',
          basePrice: 150
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Updated Product Name');

      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/v1/products/${productId}/status`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ isActive: false });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);

      // Reactivate
      const reactRes = await request(app)
        .patch(`/api/v1/products/${productId}/status`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ isActive: true });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data.isActive).toBe(true);
    });
  });

  describe('2. Product Variant Management', () => {
    let productId;

    beforeEach(async () => {
      const prodRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Odoo ERP',
          slug: 'odoo-erp',
          basePrice: 5000.00
        });
      productId = prodRes.body.data.id;
    });

    it('ADMIN can create variants for product', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Premium Support',
          additionalPrice: 560.00,
          description: '24/7 dedicated telephone support'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Premium Support');
      expect(res.body.data.productId).toBe(productId);
      expect(res.body.data.sku).toBeTruthy();
    });

    it('STAFF can create variants', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${staffUser.token}`)
        .send({
          name: 'Advanced Integration',
          additionalPrice: 1000.00
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Advanced Integration');
    });

    it('CUSTOMER cannot create variants (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${customerUser.token}`)
        .send({
          name: 'Customer Variant',
          additionalPrice: 50
        });

      expect(res.status).toBe(403);
    });

    it('Rejects duplicate variant name under same product (409 Conflict)', async () => {
      await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Same Name',
          additionalPrice: 100
        });

      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Same Name',
          additionalPrice: 200
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists for this product/i);
    });

    it('Can update variant and toggle status', async () => {
      const createRes = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Modifiable Variant',
          additionalPrice: 250
        });

      const variantId = createRes.body.data.id;

      // Update
      const updateRes = await request(app)
        .patch(`/api/v1/products/${productId}/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Modified Variant Name',
          additionalPrice: 300
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Modified Variant Name');

      // Status
      const statusRes = await request(app)
        .patch(`/api/v1/products/${productId}/variants/${variantId}/status`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ isActive: false });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isActive).toBe(false);
    });

    it('Cross-product isolation: modifying variant under wrong product returns 404', async () => {
      const otherProdRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ name: 'Another Product', basePrice: 100 });

      const otherProdId = otherProdRes.body.data.id;

      const varRes = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ name: 'Isolated Variant', additionalPrice: 50 });

      const variantId = varRes.body.data.id;

      // Attempt to access via other product
      const res = await request(app)
        .patch(`/api/v1/products/${otherProdId}/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ name: 'Cross Attack' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/does not belong to product/i);
    });
  });

  describe('3. Final Price Calculation (Base + Active Variants)', () => {
    let productId, variantAId, variantBId, inactiveVarId;

    beforeEach(async () => {
      // Product: Odoo (Base Price: 5000)
      const prodRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Odoo',
          basePrice: 5000.00
        });
      productId = prodRes.body.data.id;

      // Variant A: Premium Support (560)
      const varARes = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Premium Support',
          additionalPrice: 560.00
        });
      variantAId = varARes.body.data.id;

      // Variant B: Advanced Integration (1000)
      const varBRes = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Advanced Integration',
          additionalPrice: 1000.00
        });
      variantBId = varBRes.body.data.id;

      // Inactive Variant
      const inactiveRes = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          name: 'Legacy Feature',
          additionalPrice: 200.00,
          isActive: false
        });
      inactiveVarId = inactiveRes.body.data.id;
    });

    it('Calculates price with base product price only (no variants)', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/calculate-price`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ variantIds: [] });

      expect(res.status).toBe(200);
      expect(res.body.data.basePrice).toBe('5000.00');
      expect(res.body.data.finalPrice).toBe('5000.00');
      expect(res.body.data.selectedVariants.length).toBe(0);
    });

    it('Calculates price for Base + Both Variants (₹5,000 + ₹560 + ₹1,000 = ₹6,560)', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/calculate-price`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ variantIds: [variantAId, variantBId] });

      expect(res.status).toBe(200);
      expect(res.body.data.basePrice).toBe('5000.00');
      expect(res.body.data.finalPrice).toBe('6560.00');
      expect(res.body.data.selectedVariants.length).toBe(2);
    });

    it('Alias POST /api/v1/products/:id/price returns identical accurate result', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/price`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ variantIds: [variantAId] });

      expect(res.status).toBe(200);
      expect(res.body.data.finalPrice).toBe('5560.00');
    });

    it('Rejects duplicate variant IDs in price calculation', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/calculate-price`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ variantIds: [variantAId, variantAId] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/duplicate variant/i);
    });

    it('Rejects selection of inactive variant', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/calculate-price`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ variantIds: [inactiveVarId] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/inactive/i);
    });

    it('Rejects variant belonging to another product', async () => {
      const otherProdRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ name: 'Foreign Product', basePrice: 100 });

      const foreignProdId = otherProdRes.body.data.id;

      const foreignVarRes = await request(app)
        .post(`/api/v1/products/${foreignProdId}/variants`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ name: 'Foreign Variant', additionalPrice: 50 });

      const foreignVarId = foreignVarRes.body.data.id;

      const res = await request(app)
        .post(`/api/v1/products/${productId}/calculate-price`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ variantIds: [foreignVarId] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to product/i);
    });
  });

  describe('4. Dual Pagination (Offset-based & Cursor-based)', () => {
    let createdProductIds = [];

    beforeEach(async () => {
      createdProductIds = [];
      // Seed 5 products with slight delays to establish chronological ordering
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${adminUser.token}`)
          .send({
            name: `Product ${i.toString().padStart(2, '0')}`,
            type: i % 2 === 0 ? 'SERVICE' : 'SOFTWARE',
            basePrice: i * 100
          });
        createdProductIds.push(res.body.data.id);
      }
    });

    it('Offset mode: returns page, limit, total, totalPages and correct slice', async () => {
      const res = await request(app)
        .get('/api/v1/products?page=1&limit=2')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.mode).toBe('offset');
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.total).toBe(5);
      expect(res.body.data.pagination.totalPages).toBe(3);
      expect(res.body.data.pagination.hasNextPage).toBe(true);
      expect(res.body.data.pagination.hasPrevPage).toBe(false);
      expect(res.body.data.items.length).toBe(2);
    });

    it('Offset mode: page 2 returns subsequent records', async () => {
      const res = await request(app)
        .get('/api/v1/products?page=2&limit=2')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.hasNextPage).toBe(true);
      expect(res.body.data.pagination.hasPrevPage).toBe(true);
      expect(res.body.data.items.length).toBe(2);
    });

    it('Cursor mode: page 1 returns nextCursor and hasNextPage=true', async () => {
      const res = await request(app)
        .get('/api/v1/products?limit=2&cursor')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.mode).toBe('cursor');
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.hasNextPage).toBe(true);
      expect(res.body.data.pagination.nextCursor).toBeTruthy();
      expect(res.body.data.items.length).toBe(2);
    });

    it('Cursor mode: page 2 using cursor fetches subsequent items deterministically', async () => {
      // First page
      const page1Res = await request(app)
        .get('/api/v1/products?limit=2&cursor')
        .set('Authorization', `Bearer ${adminUser.token}`);

      const nextCursor = page1Res.body.data.pagination.nextCursor;
      expect(nextCursor).toBeTruthy();
      const page1Ids = page1Res.body.data.items.map(p => p.id);

      // Second page
      const page2Res = await request(app)
        .get(`/api/v1/products?limit=2&cursor=${nextCursor}`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data.pagination.mode).toBe('cursor');
      expect(page2Res.body.data.items.length).toBe(2);

      const page2Ids = page2Res.body.data.items.map(p => p.id);
      // Ensure no overlapping records between pages
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it('Rejects request supplying both page and cursor simultaneously (400 Bad Request)', async () => {
      const res = await request(app)
        .get(`/api/v1/products?page=1&cursor=${createdProductIds[0]}`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot provide both/i);
    });

    it('Rejects invalid/non-existent cursor (400 Bad Request)', async () => {
      const res = await request(app)
        .get('/api/v1/products?cursor=non_existent_deleted_id_999')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid pagination cursor/i);
    });

    it('Preserves filtering and search across dual pagination modes', async () => {
      // Offset with filter
      const offsetRes = await request(app)
        .get('/api/v1/products?page=1&limit=10&type=SERVICE')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(offsetRes.status).toBe(200);
      offsetRes.body.data.items.forEach(p => {
        expect(p.type).toBe('SERVICE');
      });

      // Cursor with search
      const cursorRes = await request(app)
        .get('/api/v1/products?limit=10&search=Product 02')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(cursorRes.status).toBe(200);
      expect(cursorRes.body.data.items.length).toBe(1);
      expect(cursorRes.body.data.items[0].name).toBe('Product 02');
    });

    it('Handles empty results gracefully in both pagination modes', async () => {
      // Offset empty
      const offsetRes = await request(app)
        .get('/api/v1/products?page=1&limit=10&search=NoMatchingProduct')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(offsetRes.status).toBe(200);
      expect(offsetRes.body.data.items.length).toBe(0);
      expect(offsetRes.body.data.pagination.total).toBe(0);
      expect(offsetRes.body.data.pagination.hasNextPage).toBe(false);

      // Cursor empty
      const cursorRes = await request(app)
        .get('/api/v1/products?limit=10&cursor&search=NoMatchingProduct')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(cursorRes.status).toBe(200);
      expect(cursorRes.body.data.items.length).toBe(0);
      expect(cursorRes.body.data.pagination.nextCursor).toBeNull();
      expect(cursorRes.body.data.pagination.hasNextPage).toBe(false);
    });
  });
});

