import { setPrismaClient } from '../src/utils/prisma.js';
import { hashPassword, generateAccessToken } from '../src/utils/crypto.js';

export function createMockPrisma() {
  const state = {
    users: [],
    refreshTokens: [],
    passwordResetTokens: [],
    customers: [],
    invoices: [],
    subscriptions: [],
    payments: []
  };

  const mock = {
    _state: state,
    user: {
      findUnique: async ({ where }) => {
        let user = null;
        if (where.id) user = state.users.find(u => u.id === where.id);
        else if (where.email) user = state.users.find(u => u.email === where.email);

        if (!user) return null;

        const customer = state.customers.find(c => c.userId === user.id) || null;
        return { ...user, customer };
      },
      findMany: async ({ where = {}, skip = 0, take = 20 }) => {
        let list = [...state.users];
        if (where.role) list = list.filter(u => u.role === where.role);
        if (where.isActive !== undefined) list = list.filter(u => u.isActive === where.isActive);
        return list.slice(skip, skip + take).map(u => ({ ...u }));
      },
      count: async ({ where = {} }) => {
        let list = [...state.users];
        if (where.role) list = list.filter(u => u.role === where.role);
        return list.length;
      },
      create: async ({ data, select }) => {
        const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newUser = {
          id,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role || 'CUSTOMER',
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdById: data.createdById || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.users.push(newUser);

        let customer = null;
        if (data.customer?.create) {
          const cId = `cst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          customer = {
            id: cId,
            userId: id,
            companyName: data.customer.create.companyName,
            contactName: data.customer.create.contactName,
            email: data.customer.create.email,
            status: data.customer.create.status || 'ACTIVE'
          };
          state.customers.push(customer);
        }

        const fullRecord = { ...newUser, customer };
        if (select) {
          const projected = {};
          for (const key of Object.keys(select)) {
            if (select[key]) projected[key] = fullRecord[key];
          }
          return projected;
        }

        return fullRecord;
      },
      update: async ({ where, data }) => {
        const idx = state.users.findIndex(u => u.id === where.id);
        if (idx === -1) throw new Error('User not found');
        state.users[idx] = { ...state.users[idx], ...data, updatedAt: new Date() };
        return { ...state.users[idx] };
      }
    },
    refreshToken: {
      findUnique: async ({ where }) => {
        const token = state.refreshTokens.find(t => t.tokenHash === where.tokenHash);
        if (!token) return null;
        const user = state.users.find(u => u.id === token.userId);
        const customer = state.customers.find(c => c.userId === user?.id) || null;
        return { ...token, user: user ? { ...user, customer } : null };
      },
      create: async ({ data }) => {
        const id = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const record = {
          id,
          userId: data.userId,
          tokenHash: data.tokenHash,
          isRevoked: data.isRevoked || false,
          expiresAt: data.expiresAt,
          userAgent: data.userAgent || null,
          ipAddress: data.ipAddress || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.refreshTokens.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const idx = state.refreshTokens.findIndex(t => t.id === where.id);
        if (idx !== -1) {
          state.refreshTokens[idx] = { ...state.refreshTokens[idx], ...data, updatedAt: new Date() };
          return state.refreshTokens[idx];
        }
        return null;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        state.refreshTokens.forEach((t, i) => {
          let match = true;
          if (where.userId && t.userId !== where.userId) match = false;
          if (where.tokenHash && t.tokenHash !== where.tokenHash) match = false;
          if (match) {
            state.refreshTokens[i] = { ...t, ...data };
            count++;
          }
        });
        return { count };
      }
    },
    passwordResetToken: {
      findUnique: async ({ where }) => {
        return state.passwordResetTokens.find(r => r.tokenHash === where.tokenHash) || null;
      },
      create: async ({ data }) => {
        const id = `prt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const record = {
          id,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          isUsed: false,
          createdAt: new Date()
        };
        state.passwordResetTokens.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const idx = state.passwordResetTokens.findIndex(r => r.id === where.id);
        if (idx !== -1) {
          state.passwordResetTokens[idx] = { ...state.passwordResetTokens[idx], ...data };
          return state.passwordResetTokens[idx];
        }
        return null;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        state.passwordResetTokens.forEach((r, i) => {
          let match = true;
          if (where.userId && r.userId !== where.userId) match = false;
          if (where.isUsed !== undefined && r.isUsed !== where.isUsed) match = false;
          if (match) {
            state.passwordResetTokens[i] = { ...r, ...data };
            count++;
          }
        });
        return { count };
      }
    },
    invoice: {
      findUnique: async ({ where }) => {
        return state.invoices.find(i => i.id === where.id) || null;
      }
    },
    subscription: {
      findUnique: async ({ where }) => {
        return state.subscriptions.find(s => s.id === where.id) || null;
      }
    },
    payment: {
      findUnique: async ({ where }) => {
        const p = state.payments.find(pay => pay.id === where.id);
        if (!p) return null;
        const inv = state.invoices.find(i => i.id === p.invoiceId);
        return { ...p, invoice: inv };
      }
    }
  };

  return mock;
}

export async function seedTestUser(mockPrisma, { name = 'Test User', email, password = 'Password@123', role = 'CUSTOMER', isActive = true, customerId = null }) {
  const passwordHash = await hashPassword(password);
  const id = `usr_${Math.random().toString(36).substring(2, 9)}`;

  const user = {
    id,
    name,
    email,
    passwordHash,
    role,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  mockPrisma._state.users.push(user);

  let custId = customerId;
  if (role === 'CUSTOMER') {
    if (!custId) custId = `cst_${Math.random().toString(36).substring(2, 9)}`;
    mockPrisma._state.customers.push({
      id: custId,
      userId: id,
      companyName: name,
      contactName: name,
      email,
      status: 'ACTIVE'
    });
  }

  const token = generateAccessToken({ ...user, customer: custId ? { id: custId } : null });

  return { user, token, customerId: custId };
}

