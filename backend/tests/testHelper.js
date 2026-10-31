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
    payments: [],
    products: [],
    productVariants: [],
    plans: [],
    planVariants: [],
    quotations: [],
    quotationItems: [],
    subscriptionItems: [],
    taxes: [],
    discounts: []
  };

  const projectSelect = (item, select) => {
    if (!select || !item) return item;
    const projected = {};
    for (const key of Object.keys(select)) {
      if (select[key]) {
        if (typeof select[key] === 'object' && select[key] !== null) {
          // Unwrap Prisma nested { select: { ... } } or direct { ... }
          const nestedSelect = select[key].select || select[key];
          projected[key] = item[key] ? projectSelect(item[key], nestedSelect) : null;
        } else {
          projected[key] = item[key] !== undefined ? item[key] : null;
        }
      }
    }
    return projected;
  };

  const sortArray = (list, orderBy) => {
    if (!orderBy) return list;
    const orderList = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...list].sort((a, b) => {
      for (const rule of orderList) {
        const field = Object.keys(rule)[0];
        const dir = rule[field] === 'asc' ? 1 : -1;
        let valA = a[field];
        let valB = b[field];
        if (valA instanceof Date) valA = valA.getTime();
        if (valB instanceof Date) valB = valB.getTime();
        if (valA > valB) return dir;
        if (valA < valB) return -dir;
      }
      return 0;
    });
  };

  const mock = {
    _state: state,

    // Atomic transaction mock with state rollback on error
    $transaction: async (arg) => {
      if (typeof arg === 'function') {
        const snapshot = JSON.stringify(state);
        try {
          return await arg(mock);
        } catch (err) {
          const restored = JSON.parse(snapshot);
          Object.keys(restored).forEach(k => {
            state[k] = restored[k];
          });
          throw err;
        }
      } else if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    },

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
      count: async ({ where = {} } = {}) => {
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
            customerCode: data.customer.create.customerCode || `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            customerType: data.customer.create.customerType || 'INDIVIDUAL',
            firstName: data.customer.create.firstName || data.name,
            lastName: data.customer.create.lastName || null,
            companyName: data.customer.create.companyName || null,
            email: data.customer.create.email || data.email,
            phone: data.customer.create.phone || null,
            alternatePhone: data.customer.create.alternatePhone || null,
            billingAddress: data.customer.create.billingAddress || null,
            billingCity: data.customer.create.billingCity || null,
            billingState: data.customer.create.billingState || null,
            billingPostalCode: data.customer.create.billingPostalCode || null,
            billingCountry: data.customer.create.billingCountry || null,
            taxNumber: data.customer.create.taxNumber || null,
            notes: data.customer.create.notes || null,
            currency: data.customer.create.currency || 'USD',
            isActive: data.customer.create.isActive !== undefined ? data.customer.create.isActive : true,
            status: data.customer.create.status || 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          state.customers.push(customer);
        }

        const fullRecord = { ...newUser, customer };
        return projectSelect(fullRecord, select);
      },
      update: async ({ where, data }) => {
        const idx = state.users.findIndex(u => u.id === where.id);
        if (idx === -1) throw new Error('User not found');
        state.users[idx] = { ...state.users[idx], ...data, updatedAt: new Date() };
        return { ...state.users[idx] };
      }
    },

    customer: {
      findUnique: async ({ where, select }) => {
        let cust = null;
        if (where.id) cust = state.customers.find(c => c.id === where.id);
        else if (where.email) cust = state.customers.find(c => c.email === where.email);
        else if (where.customerCode) cust = state.customers.find(c => c.customerCode === where.customerCode);
        else if (where.userId) cust = state.customers.find(c => c.userId === where.userId);

        if (!cust) return null;
        return projectSelect(cust, select);
      },
      findMany: async ({ where = {}, skip = 0, take = 20, orderBy = {}, select }) => {
        let list = [...state.customers];

        if (where.customerType) {
          list = list.filter(c => c.customerType === where.customerType);
        }
        if (where.isActive !== undefined) {
          list = list.filter(c => c.isActive === where.isActive);
        }
        if (where.OR && Array.isArray(where.OR)) {
          list = list.filter(c => {
            return where.OR.some(clause => {
              for (const [key, filter] of Object.entries(clause)) {
                if (filter?.contains && c[key]) {
                  const val = String(c[key]).toLowerCase();
                  const target = String(filter.contains).toLowerCase();
                  if (val.includes(target)) return true;
                }
              }
              return false;
            });
          });
        }

        const sorted = sortArray(list, orderBy);
        const paginated = sorted.slice(skip, skip + take);
        return paginated.map(item => projectSelect(item, select));
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.customers];
        if (where.customerType) {
          list = list.filter(c => c.customerType === where.customerType);
        }
        if (where.isActive !== undefined) {
          list = list.filter(c => c.isActive === where.isActive);
        }
        if (where.OR && Array.isArray(where.OR)) {
          list = list.filter(c => {
            return where.OR.some(clause => {
              for (const [key, filter] of Object.entries(clause)) {
                if (filter?.contains && c[key]) {
                  const val = String(c[key]).toLowerCase();
                  const target = String(filter.contains).toLowerCase();
                  if (val.includes(target)) return true;
                }
              }
              return false;
            });
          });
        }
        return list.length;
      },
      create: async ({ data, select }) => {
        const id = `cst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newCustomer = {
          id,
          userId: data.userId || null,
          customerCode: data.customerCode,
          customerType: data.customerType || 'COMPANY',
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          companyName: data.companyName || null,
          email: data.email,
          phone: data.phone || null,
          alternatePhone: data.alternatePhone || null,
          billingAddress: data.billingAddress || null,
          billingCity: data.billingCity || null,
          billingState: data.billingState || null,
          billingPostalCode: data.billingPostalCode || null,
          billingCountry: data.billingCountry || null,
          taxNumber: data.taxNumber || null,
          notes: data.notes || null,
          currency: data.currency || 'USD',
          isActive: data.isActive !== undefined ? data.isActive : true,
          status: data.status || 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.customers.push(newCustomer);
        return projectSelect(newCustomer, select);
      },
      update: async ({ where, data, select }) => {
        const idx = state.customers.findIndex(c => c.id === where.id);
        if (idx === -1) throw new Error('Customer not found');
        state.customers[idx] = { ...state.customers[idx], ...data, updatedAt: new Date() };
        return projectSelect(state.customers[idx], select);
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

    quotation: {
      findUnique: async ({ where, include, select }) => {
        let q = null;
        if (where.id) q = state.quotations.find(x => x.id === where.id);
        else if (where.quotationNumber) q = state.quotations.find(x => x.quotationNumber === where.quotationNumber);
        if (!q) return null;

        const res = { ...q };
        if (include?.customer) {
          res.customer = state.customers.find(c => c.id === q.customerId) || null;
        }
        if (include?.items) {
          res.items = state.quotationItems
            .filter(item => item.quotationId === q.id)
            .map(item => {
              const itemCopy = { ...item };
              if (include.items.include?.product) {
                itemCopy.product = state.products.find(p => p.id === item.productId) || null;
              }
              if (include.items.include?.plan) {
                itemCopy.plan = state.plans.find(p => p.id === item.planId) || null;
              }
              return itemCopy;
            });
        }
        if (include?.subscription) {
          res.subscription = state.subscriptions.find(s => s.quotationId === q.id) || null;
        }
        return projectSelect(res, select);
      },
      findFirst: async ({ where }) => {
        let list = [...state.quotations];
        if (where.customerId) list = list.filter(q => q.customerId === where.customerId);
        if (where.status) list = list.filter(q => q.status === where.status);
        return list[0] ? { ...list[0] } : null;
      },
      findMany: async ({ where = {}, cursor, skip = 0, take = 20, orderBy, include, select }) => {
        let list = [...state.quotations];
        if (where.customerId) list = list.filter(q => q.customerId === where.customerId);
        if (where.status) list = list.filter(q => q.status === where.status);
        if (where.OR) {
          list = list.filter(q => {
            return where.OR.some(cond => {
              if (cond.quotationNumber?.contains) {
                return q.quotationNumber.toLowerCase().includes(String(cond.quotationNumber.contains).toLowerCase());
              }
              if (cond.notes?.contains && q.notes) {
                return q.notes.toLowerCase().includes(String(cond.notes.contains).toLowerCase());
              }
              return false;
            });
          });
        }

        const sorted = sortArray(list, orderBy);
        let startIndex = 0;
        if (cursor?.id) {
          const idx = sorted.findIndex(q => q.id === cursor.id);
          if (idx !== -1) startIndex = idx + (skip || 0);
        } else if (skip) {
          startIndex = skip;
        }

        const sliced = sorted.slice(startIndex, startIndex + take);
        return sliced.map(q => {
          const res = { ...q };
          if (include?.customer) {
            res.customer = state.customers.find(c => c.id === q.customerId) || null;
          }
          if (include?.items) {
            res.items = state.quotationItems
              .filter(item => item.quotationId === q.id)
              .map(item => {
                const itemCopy = { ...item };
                if (include.items.include?.product) {
                  itemCopy.product = state.products.find(p => p.id === item.productId) || null;
                }
                if (include.items.include?.plan) {
                  itemCopy.plan = state.plans.find(p => p.id === item.planId) || null;
                }
                return itemCopy;
              });
          }
          if (include?.subscription) {
            res.subscription = state.subscriptions.find(s => s.quotationId === q.id) || null;
          }
          return projectSelect(res, select);
        });
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.quotations];
        if (where.customerId) list = list.filter(q => q.customerId === where.customerId);
        if (where.status) list = list.filter(q => q.status === where.status);
        return list.length;
      },
      create: async ({ data, include, select }) => {
        const id = `quo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newQuo = {
          id,
          quotationNumber: data.quotationNumber,
          customerId: data.customerId,
          status: data.status || 'DRAFT',
          currency: data.currency || 'INR',
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          taxAmount: data.taxAmount,
          grandTotal: data.grandTotal,
          validUntil: data.validUntil,
          notes: data.notes || null,
          termsAndConditions: data.termsAndConditions || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.quotations.push(newQuo);

        if (data.items?.create) {
          for (const item of data.items.create) {
            state.quotationItems.push({
              id: `qi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              quotationId: id,
              ...item,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }

        const res = { ...newQuo };
        if (include?.customer) {
          res.customer = state.customers.find(c => c.id === newQuo.customerId) || null;
        }
        if (include?.items) {
          res.items = state.quotationItems
            .filter(item => item.quotationId === id)
            .map(item => {
              const itemCopy = { ...item };
              if (include.items.include?.product) {
                itemCopy.product = state.products.find(p => p.id === item.productId) || null;
              }
              if (include.items.include?.plan) {
                itemCopy.plan = state.plans.find(p => p.id === item.planId) || null;
              }
              return itemCopy;
            });
        }
        return projectSelect(res, select);
      },
      update: async ({ where, data, include, select }) => {
        const idx = state.quotations.findIndex(q => q.id === where.id);
        if (idx === -1) throw new Error('Quotation not found');
        state.quotations[idx] = { ...state.quotations[idx], ...data, updatedAt: new Date() };

        const res = { ...state.quotations[idx] };
        if (include?.customer) {
          res.customer = state.customers.find(c => c.id === res.customerId) || null;
        }
        if (include?.items) {
          res.items = state.quotationItems
            .filter(item => item.quotationId === where.id)
            .map(item => {
              const itemCopy = { ...item };
              if (include.items.include?.product) {
                itemCopy.product = state.products.find(p => p.id === item.productId) || null;
              }
              if (include.items.include?.plan) {
                itemCopy.plan = state.plans.find(p => p.id === item.planId) || null;
              }
              return itemCopy;
            });
        }
        if (include?.subscription) {
          res.subscription = state.subscriptions.find(s => s.quotationId === where.id) || null;
        }
        return projectSelect(res, select);
      }
    },

    quotationItem: {
      deleteMany: async ({ where = {} }) => {
        const before = state.quotationItems.length;
        if (where.quotationId) {
          state.quotationItems = state.quotationItems.filter(item => item.quotationId !== where.quotationId);
        }
        return { count: before - state.quotationItems.length };
      },
      createMany: async ({ data = [] }) => {
        let count = 0;
        for (const item of data) {
          state.quotationItems.push({
            id: `qi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            ...item,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          count++;
        }
        return { count };
      },
      findMany: async ({ where = {} }) => {
        let list = [...state.quotationItems];
        if (where.quotationId) list = list.filter(i => i.quotationId === where.quotationId);
        return list;
      }
    },

    subscription: {
      findUnique: async ({ where, include, select }) => {
        let s = null;
        if (where.id) s = state.subscriptions.find(x => x.id === where.id);
        else if (where.quotationId) s = state.subscriptions.find(x => x.quotationId === where.quotationId);
        else if (where.subscriptionNumber) s = state.subscriptions.find(x => x.subscriptionNumber === where.subscriptionNumber);
        if (!s) return null;

        const res = { ...s };
        if (include?.customer) {
          res.customer = state.customers.find(c => c.id === s.customerId) || null;
        }
        if (include?.plan) {
          const plan = state.plans.find(p => p.id === s.planId) || null;
          if (plan) {
            const planCopy = { ...plan };
            if (include.plan.include?.product) {
              planCopy.product = state.products.find(p => p.id === plan.productId) || null;
            }
            res.plan = planCopy;
          } else {
            res.plan = null;
          }
        }
        if (include?.items) {
          res.items = state.subscriptionItems.filter(item => item.subscriptionId === s.id);
        }
        return projectSelect(res, select);
      },
      findFirst: async ({ where }) => {
        let list = [...state.subscriptions];
        if (where.customerId) list = list.filter(s => s.customerId === where.customerId);
        if (where.status) list = list.filter(s => s.status === where.status);
        if (where.quotationId) list = list.filter(s => s.quotationId === where.quotationId);
        return list[0] ? { ...list[0] } : null;
      },
      findMany: async ({ where = {}, cursor, skip = 0, take = 20, orderBy, include, select }) => {
        let list = [...state.subscriptions];
        if (where.customerId) list = list.filter(s => s.customerId === where.customerId);
        if (where.status) list = list.filter(s => s.status === where.status);
        if (where.planId) list = list.filter(s => s.planId === where.planId);
        if (where.subscriptionNumber?.contains) {
          const search = String(where.subscriptionNumber.contains).toLowerCase();
          list = list.filter(s => s.subscriptionNumber && s.subscriptionNumber.toLowerCase().includes(search));
        }

        const sorted = sortArray(list, orderBy);
        let startIndex = 0;
        if (cursor?.id) {
          const idx = sorted.findIndex(s => s.id === cursor.id);
          if (idx !== -1) startIndex = idx + (skip || 0);
        } else if (skip) {
          startIndex = skip;
        }

        const sliced = sorted.slice(startIndex, startIndex + take);
        return sliced.map(s => {
          const res = { ...s };
          if (include?.customer) {
            res.customer = state.customers.find(c => c.id === s.customerId) || null;
          }
          if (include?.plan) {
            const plan = state.plans.find(p => p.id === s.planId) || null;
            if (plan) {
              const planCopy = { ...plan };
              if (include.plan.include?.product) {
                planCopy.product = state.products.find(p => p.id === plan.productId) || null;
              }
              res.plan = planCopy;
            } else {
              res.plan = null;
            }
          }
          if (include?.items) {
            res.items = state.subscriptionItems.filter(item => item.subscriptionId === s.id);
          }
          return projectSelect(res, select);
        });
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.subscriptions];
        if (where.customerId) list = list.filter(s => s.customerId === where.customerId);
        if (where.status) list = list.filter(s => s.status === where.status);
        if (where.planId) list = list.filter(s => s.planId === where.planId);
        return list.length;
      },
      create: async ({ data, include, select }) => {
        const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newSub = {
          id,
          subscriptionNumber: data.subscriptionNumber || `SUB-${Date.now()}`,
          customerId: data.customerId,
          planId: data.planId || null,
          quotationId: data.quotationId || null,
          status: data.status || 'ACTIVE',
          startDate: data.startDate || new Date(),
          currentPeriodStart: data.currentPeriodStart || new Date(),
          currentPeriodEnd: data.currentPeriodEnd || new Date(),
          nextBillingDate: data.nextBillingDate || null,
          endDate: data.endDate || null,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
          canceledAt: data.canceledAt || null,
          cancellationReason: data.cancellationReason || null,
          pausedAt: data.pausedAt || null,
          resumedAt: data.resumedAt || null,
          billingCycle: data.billingCycle || 'MONTHLY',
          recurringPrice: data.recurringPrice || '0.00',
          setupFee: data.setupFee || '0.00',
          currency: data.currency || 'INR',
          metadata: data.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.subscriptions.push(newSub);

        if (data.items?.create) {
          for (const item of data.items.create) {
            state.subscriptionItems.push({
              id: `si_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              subscriptionId: id,
              ...item,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }

        const res = { ...newSub };
        if (include?.customer) {
          res.customer = state.customers.find(c => c.id === newSub.customerId) || null;
        }
        if (include?.plan) {
          res.plan = state.plans.find(p => p.id === newSub.planId) || null;
        }
        if (include?.items) {
          res.items = state.subscriptionItems.filter(item => item.subscriptionId === id);
        }
        return projectSelect(res, select);
      },
      update: async ({ where, data, include, select }) => {
        const idx = state.subscriptions.findIndex(s => s.id === where.id);
        if (idx === -1) throw new Error('Subscription not found');
        state.subscriptions[idx] = { ...state.subscriptions[idx], ...data, updatedAt: new Date() };

        const res = { ...state.subscriptions[idx] };
        if (include?.customer) {
          res.customer = state.customers.find(c => c.id === res.customerId) || null;
        }
        if (include?.plan) {
          res.plan = state.plans.find(p => p.id === res.planId) || null;
        }
        if (include?.items) {
          res.items = state.subscriptionItems.filter(item => item.subscriptionId === where.id);
        }
        return projectSelect(res, select);
      }
    },

    subscriptionItem: {
      createMany: async ({ data = [] }) => {
        let count = 0;
        for (const item of data) {
          state.subscriptionItems.push({
            id: `si_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            ...item,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          count++;
        }
        return { count };
      },
      findMany: async ({ where = {} }) => {
        let list = [...state.subscriptionItems];
        if (where.subscriptionId) list = list.filter(i => i.subscriptionId === where.subscriptionId);
        return list;
      }
    },

    tax: {
      findUnique: async ({ where }) => {
        return state.taxes.find(t => t.id === where.id) || null;
      },
      findMany: async ({ where = {} }) => {
        let list = [...state.taxes];
        if (where.isActive !== undefined) list = list.filter(t => t.isActive === where.isActive);
        return list;
      },
      create: async ({ data }) => {
        const t = {
          id: `tax_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: data.name,
          percentage: data.percentage,
          jurisdiction: data.jurisdiction || 'Default',
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.taxes.push(t);
        return t;
      }
    },

    discount: {
      findUnique: async ({ where }) => {
        let d = null;
        if (where.id) d = state.discounts.find(x => x.id === where.id);
        else if (where.code) d = state.discounts.find(x => x.code === where.code);
        return d || null;
      },
      findMany: async ({ where = {} }) => {
        let list = [...state.discounts];
        if (where.isActive !== undefined) list = list.filter(d => d.isActive === where.isActive);
        return list;
      },
      create: async ({ data }) => {
        const d = {
          id: `disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          code: data.code,
          type: data.type || 'PERCENTAGE',
          value: data.value,
          currency: data.currency || null,
          validFrom: data.validFrom || new Date(),
          validTo: data.validTo || null,
          maxRedemptions: data.maxRedemptions || null,
          timesRedeemed: 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.discounts.push(d);
        return d;
      }
    },

    invoice: {
      findUnique: async ({ where }) => {
        return state.invoices.find(i => i.id === where.id) || null;
      },
      findMany: async ({ where = {}, skip = 0, take = 20, select }) => {
        let list = [...state.invoices];
        if (where.customerId) {
          list = list.filter(i => i.customerId === where.customerId);
        }
        return list.slice(skip, skip + take).map(i => projectSelect(i, select));
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.invoices];
        if (where.customerId) {
          list = list.filter(i => i.customerId === where.customerId);
        }
        return list.length;
      },
      create: async ({ data }) => {
        const inv = {
          id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.invoices.push(inv);
        return inv;
      }
    },

    payment: {
      findUnique: async ({ where }) => {
        const p = state.payments.find(pay => pay.id === where.id);
        if (!p) return null;
        const inv = state.invoices.find(i => i.id === p.invoiceId);
        return { ...p, invoice: inv };
      },
      findMany: async ({ where = {}, skip = 0, take = 20, select }) => {
        let list = [...state.payments];
        if (where.invoice?.customerId) {
          list = list.filter(p => {
            const inv = state.invoices.find(i => i.id === p.invoiceId);
            return inv && inv.customerId === where.invoice.customerId;
          });
        }
        return list.slice(skip, skip + take).map(p => {
          const inv = state.invoices.find(i => i.id === p.invoiceId);
          return projectSelect({ ...p, invoice: inv }, select);
        });
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.payments];
        if (where.invoice?.customerId) {
          list = list.filter(p => {
            const inv = state.invoices.find(i => i.id === p.invoiceId);
            return inv && inv.customerId === where.invoice.customerId;
          });
        }
        return list.length;
      },
      create: async ({ data }) => {
        const p = {
          id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.payments.push(p);
        return p;
      }
    },

    // --- Product & Variant Models ---
    product: {
      findUnique: async ({ where, include, select }) => {
        let p = null;
        if (where.id) p = state.products.find(x => x.id === where.id);
        else if (where.slug) p = state.products.find(x => x.slug === where.slug);
        if (!p) return null;
        const res = { ...p };
        if (include?.variants) {
          let vars = state.productVariants.filter(v => v.productId === p.id);
          if (include.variants.where?.isActive !== undefined) {
            vars = vars.filter(v => v.isActive === include.variants.where.isActive);
          }
          res.variants = vars.map(v => ({ ...v }));
        }
        return projectSelect(res, select);
      },
      findMany: async ({ where = {}, cursor, skip = 0, take = 20, orderBy, include, select }) => {
        let list = [...state.products];
        if (where.type) list = list.filter(p => p.type === where.type);
        if (where.isActive !== undefined) list = list.filter(p => p.isActive === where.isActive);
        if (where.name?.contains) {
          const search = String(where.name.contains).toLowerCase();
          list = list.filter(p => p.name.toLowerCase().includes(search));
        }

        const sorted = sortArray(list, orderBy);
        let startIndex = 0;
        if (cursor?.id) {
          const idx = sorted.findIndex(p => p.id === cursor.id);
          if (idx !== -1) {
            startIndex = idx + (skip || 0);
          }
        } else if (skip) {
          startIndex = skip;
        }

        const sliced = sorted.slice(startIndex, startIndex + take);
        return sliced.map(p => {
          const res = { ...p };
          if (include?.variants) {
            let vars = state.productVariants.filter(v => v.productId === p.id);
            if (include.variants.where?.isActive !== undefined) {
              vars = vars.filter(v => v.isActive === include.variants.where.isActive);
            }
            res.variants = vars.map(v => ({ ...v }));
          }
          return projectSelect(res, select);
        });
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.products];
        if (where.type) list = list.filter(p => p.type === where.type);
        if (where.isActive !== undefined) list = list.filter(p => p.isActive === where.isActive);
        if (where.name?.contains) {
          const search = String(where.name.contains).toLowerCase();
          list = list.filter(p => p.name.toLowerCase().includes(search));
        }
        return list.length;
      },
      create: async ({ data, include, select }) => {
        const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newProduct = {
          id,
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          type: data.type || 'SOFTWARE',
          basePrice: data.basePrice,
          costPrice: data.costPrice || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.products.push(newProduct);
        const res = { ...newProduct };
        if (include?.variants) res.variants = [];
        return projectSelect(res, select);
      },
      update: async ({ where, data, include, select }) => {
        const idx = state.products.findIndex(p => p.id === where.id);
        if (idx === -1) throw new Error('Product not found');
        state.products[idx] = { ...state.products[idx], ...data, updatedAt: new Date() };
        const res = { ...state.products[idx] };
        if (include?.variants) {
          res.variants = state.productVariants.filter(v => v.productId === where.id);
        }
        return projectSelect(res, select);
      }
    },

    productVariant: {
      findUnique: async ({ where, select }) => {
        let v = null;
        if (where.id) v = state.productVariants.find(x => x.id === where.id);
        else if (where.sku) v = state.productVariants.find(x => x.sku === where.sku);
        if (!v) return null;
        return projectSelect(v, select);
      },
      findFirst: async ({ where }) => {
        let list = [...state.productVariants];
        if (where.productId) list = list.filter(v => v.productId === where.productId);
        if (where.name?.equals) {
          const target = String(where.name.equals).toLowerCase();
          list = list.filter(v => v.name.toLowerCase() === target);
        }
        if (where.NOT?.id) {
          list = list.filter(v => v.id !== where.NOT.id);
        }
        return list[0] ? { ...list[0] } : null;
      },
      findMany: async ({ where = {}, cursor, skip = 0, take = 20, orderBy, select }) => {
        let list = [...state.productVariants];
        if (where.productId) list = list.filter(v => v.productId === where.productId);
        if (where.isActive !== undefined) list = list.filter(v => v.isActive === where.isActive);
        if (where.id?.in) list = list.filter(v => where.id.in.includes(v.id));
        if (where.name?.contains) {
          const search = String(where.name.contains).toLowerCase();
          list = list.filter(v => v.name.toLowerCase().includes(search));
        }

        const sorted = sortArray(list, orderBy);
        let startIndex = 0;
        if (cursor?.id) {
          const idx = sorted.findIndex(v => v.id === cursor.id);
          if (idx !== -1) {
            startIndex = idx + (skip || 0);
          }
        } else if (skip) {
          startIndex = skip;
        }

        const sliced = sorted.slice(startIndex, startIndex + take);
        return sliced.map(v => projectSelect(v, select));
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.productVariants];
        if (where.productId) list = list.filter(v => v.productId === where.productId);
        if (where.isActive !== undefined) list = list.filter(v => v.isActive === where.isActive);
        if (where.id?.in) list = list.filter(v => where.id.in.includes(v.id));
        return list.length;
      },
      create: async ({ data, select }) => {
        const id = `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newVariant = {
          id,
          productId: data.productId,
          name: data.name,
          sku: data.sku,
          description: data.description || null,
          additionalPrice: data.additionalPrice,
          unit: data.unit || 'seat',
          unitPriceInCents: data.unitPriceInCents || 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.productVariants.push(newVariant);
        return projectSelect(newVariant, select);
      },
      update: async ({ where, data, select }) => {
        const idx = state.productVariants.findIndex(v => v.id === where.id);
        if (idx === -1) throw new Error('Variant not found');
        state.productVariants[idx] = { ...state.productVariants[idx], ...data, updatedAt: new Date() };
        return projectSelect(state.productVariants[idx], select);
      }
    },

    plan: {
      findUnique: async ({ where, include, select }) => {
        const p = state.plans.find(x => x.id === where.id);
        if (!p) return null;
        const res = { ...p };
        if (include?.product) {
          res.product = state.products.find(prod => prod.id === p.productId) || null;
        }
        if (include?.planVariants) {
          const pvs = state.planVariants.filter(pv => pv.planId === p.id);
          res.planVariants = pvs.map(pv => {
            const variant = state.productVariants.find(v => v.id === pv.variantId) || null;
            return { ...pv, variant };
          });
        }
        return projectSelect(res, select);
      },
      findFirst: async ({ where }) => {
        let list = [...state.plans];
        if (where.productId) list = list.filter(p => p.productId === where.productId);
        if (where.name) {
          const target = String(where.name).toLowerCase();
          list = list.filter(p => p.name.toLowerCase() === target);
        }
        if (where.billingCycle) {
          list = list.filter(p => p.billingCycle === where.billingCycle);
        }
        if (where.NOT?.id) {
          list = list.filter(p => p.id !== where.NOT.id);
        }
        return list[0] ? { ...list[0] } : null;
      },
      findMany: async ({ where = {}, cursor, skip = 0, take = 20, orderBy, include, select }) => {
        let list = [...state.plans];
        if (where.productId) list = list.filter(p => p.productId === where.productId);
        if (where.billingCycle) list = list.filter(p => p.billingCycle === where.billingCycle);
        if (where.isActive !== undefined) list = list.filter(p => p.isActive === where.isActive);
        if (where.name?.contains) {
          const search = String(where.name.contains).toLowerCase();
          list = list.filter(p => p.name.toLowerCase().includes(search));
        }

        const sorted = sortArray(list, orderBy);
        let startIndex = 0;
        if (cursor?.id) {
          const idx = sorted.findIndex(p => p.id === cursor.id);
          if (idx !== -1) {
            startIndex = idx + (skip || 0);
          }
        } else if (skip) {
          startIndex = skip;
        }

        const sliced = sorted.slice(startIndex, startIndex + take);
        return sliced.map(p => {
          const res = { ...p };
          if (include?.product) {
            res.product = state.products.find(prod => prod.id === p.productId) || null;
          }
          if (include?.planVariants) {
            const pvs = state.planVariants.filter(pv => pv.planId === p.id);
            res.planVariants = pvs.map(pv => {
              const variant = state.productVariants.find(v => v.id === pv.variantId) || null;
              return { ...pv, variant };
            });
          }
          return projectSelect(res, select);
        });
      },
      count: async ({ where = {} } = {}) => {
        let list = [...state.plans];
        if (where.productId) list = list.filter(p => p.productId === where.productId);
        if (where.billingCycle) list = list.filter(p => p.billingCycle === where.billingCycle);
        if (where.isActive !== undefined) list = list.filter(p => p.isActive === where.isActive);
        if (where.name?.contains) {
          const search = String(where.name.contains).toLowerCase();
          list = list.filter(p => p.name.toLowerCase().includes(search));
        }
        return list.length;
      },
      create: async ({ data, include, select }) => {
        const id = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newPlan = {
          id,
          productId: data.productId,
          name: data.name,
          description: data.description || null,
          billingCycle: data.billingCycle || 'MONTHLY',
          customDuration: data.customDuration || null,
          customDurationUnit: data.customDurationUnit || null,
          price: data.price,
          setupFee: data.setupFee,
          currency: data.currency || 'INR',
          trialDays: data.trialDays || 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.plans.push(newPlan);

        if (data.planVariants?.create) {
          for (const item of data.planVariants.create) {
            state.planVariants.push({
              id: `pv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              planId: id,
              variantId: item.variantId,
              createdAt: new Date()
            });
          }
        }

        const res = { ...newPlan };
        if (include?.product) {
          res.product = state.products.find(prod => prod.id === newPlan.productId) || null;
        }
        if (include?.planVariants) {
          const pvs = state.planVariants.filter(pv => pv.planId === id);
          res.planVariants = pvs.map(pv => {
            const variant = state.productVariants.find(v => v.id === pv.variantId) || null;
            return { ...pv, variant };
          });
        }
        return projectSelect(res, select);
      },
      update: async ({ where, data, include, select }) => {
        const idx = state.plans.findIndex(p => p.id === where.id);
        if (idx === -1) throw new Error('Plan not found');
        state.plans[idx] = { ...state.plans[idx], ...data, updatedAt: new Date() };

        const res = { ...state.plans[idx] };
        if (include?.product) {
          res.product = state.products.find(prod => prod.id === res.productId) || null;
        }
        if (include?.planVariants) {
          const pvs = state.planVariants.filter(pv => pv.planId === where.id);
          res.planVariants = pvs.map(pv => {
            const variant = state.productVariants.find(v => v.id === pv.variantId) || null;
            return { ...pv, variant };
          });
        }
        return projectSelect(res, select);
      }
    },

    planVariant: {
      deleteMany: async ({ where = {} }) => {
        const before = state.planVariants.length;
        if (where.planId) {
          state.planVariants = state.planVariants.filter(pv => pv.planId !== where.planId);
        }
        return { count: before - state.planVariants.length };
      },
      createMany: async ({ data = [] }) => {
        let count = 0;
        for (const item of data) {
          state.planVariants.push({
            id: `pv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            planId: item.planId,
            variantId: item.variantId,
            createdAt: new Date()
          });
          count++;
        }
        return { count };
      },
      findMany: async ({ where = {} }) => {
        let list = [...state.planVariants];
        if (where.planId) list = list.filter(pv => pv.planId === where.planId);
        if (where.variantId) list = list.filter(pv => pv.variantId === where.variantId);
        return list;
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
      customerCode: `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      customerType: 'INDIVIDUAL',
      firstName: name,
      lastName: null,
      companyName: null,
      email,
      phone: null,
      alternatePhone: null,
      billingAddress: null,
      billingCity: null,
      billingState: null,
      billingPostalCode: null,
      billingCountry: null,
      taxNumber: null,
      notes: null,
      currency: 'USD',
      isActive: true,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const token = generateAccessToken({ ...user, customer: custId ? { id: custId } : null });

  return { user, token, customerId: custId };
}
