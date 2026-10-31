import { PrismaClient } from '@prisma/client';

let prismaInstance = null;

export function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }
  return prismaInstance;
}

// Allow overriding Prisma client for isolated unit/integration tests
export function setPrismaClient(mockClient) {
  prismaInstance = mockClient;
}

export const prisma = new Proxy({}, {
  get(target, prop) {
    return getPrismaClient()[prop];
  }
});

