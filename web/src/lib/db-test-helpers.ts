import { getDb } from "./db";

type RowsForQuery = (sqlText: string, args: unknown[]) => Record<string, unknown>[];

// Runs `run` with database queries answered by `rowsForQuery` instead of a real Postgres server.
export async function withDbRows<T>(
  rowsForQuery: RowsForQuery,
  run: (queries: string[]) => Promise<T>,
): Promise<T> {
  process.env.SUPABASE_DATABASE_URL = "postgres://example.test/madgrades";

  const db = getDb();
  const queries: string[] = [];
  const originalUnsafe = db.unsafe;
  db.unsafe = (async (sqlText: string, args: unknown[] = []) => {
    queries.push(sqlText);
    return rowsForQuery(sqlText, args);
  }) as unknown as typeof db.unsafe;

  try {
    return await run(queries);
  } finally {
    db.unsafe = originalUnsafe;
  }
}
