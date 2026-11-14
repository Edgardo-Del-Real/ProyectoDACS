import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacs:dacs@localhost:5432/dacs';

const adapter = new PrismaPg({ connectionString });

export interface AsociacionProductorDelegate {
  findMany: (args?: any) => Promise<any[]>;
  findFirst: (args?: any) => Promise<any | null>;
  findUnique: (args: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
}

export type ExtendedPrismaClient = PrismaClient & {
  asociacionProductor: AsociacionProductorDelegate;
};

export const prisma: ExtendedPrismaClient = new PrismaClient({ adapter }) as unknown as ExtendedPrismaClient;

