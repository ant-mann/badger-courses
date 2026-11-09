import postgres from "postgres";

let cachedDb: postgres.Sql | null = null;

export function getDb(): postgres.Sql {
  if (!cachedDb) {
    const url = process.env.SUPABASE_DATABASE_URL?.trim();

    if (!url) {
      throw new Error("SUPABASE_DATABASE_URL environment variable is required");
    }

    cachedDb = postgres(url);
  }

  return cachedDb;
}

export function __resetDbForTests(): void {
  void cachedDb?.end({ timeout: 0 }).catch(() => {});
  cachedDb = null;
}
