import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// node-postgres waits forever by default. Over a WAN link to Neon a stalled TLS handshake or a
// silently dropped connection then hangs a request indefinitely, so every stage gets a deadline.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000, // establishing a connection
  idleTimeoutMillis: 10_000, // retire idle sockets before Neon/pgbouncer drops them under us
  keepAlive: true,
  query_timeout: 35_000, // client-side backstop for a single query
  statement_timeout: 30_000, // server-side cap per statement
  lock_timeout: 10_000, // a posting waiting this long for a row lock fails cleanly instead of queueing forever
});

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
