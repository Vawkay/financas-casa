import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Client Drizzle para acesso direto ao Postgres do Supabase (server-side).
 *
 * O client é cacheado em `globalThis` para que o hot-reload do dev (Turbopack)
 * reaproveite a MESMA conexão a cada recompilação — sem isso, cada reload abre
 * um novo pool e as conexões vazam até estourar o limite do Postgres.
 *
 * Em produção serverless (Vercel), prefira a connection string do
 * "Transaction pooler" (porta 6543) na DATABASE_URL.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida. Veja .env.example.");
}

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__pgClient ??
  postgres(connectionString, {
    prepare: false, // compatível com o pooler em modo transaction
    max: 3, // pool enxuto: app single-user
    idle_timeout: 20, // encerra conexões ociosas (segundos)
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
