// The ONE place the database connection is created. Everything else does:
//   import { prisma } from "@/lib/prisma";
//
// Prisma 7 needs a "driver adapter"; for the local SQLite file we use better-sqlite3.
// DATABASE_URL comes from web/.env (Next.js loads it automatically), e.g. file:./dev.db
// In development, Next.js reloads code often, so the client is kept on `globalThis`
// to avoid opening a new connection on every reload.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to web/.env (file:./dev.db).");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
