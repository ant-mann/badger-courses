import Database from 'better-sqlite3';

import { getDatabasePath } from './env';

let cachedDb: Database.Database | null = null;

export function getDb(): Database.Database {
  if (cachedDb) {
    return cachedDb;
  }

  cachedDb = new Database(getDatabasePath(), {
    readonly: true,
    fileMustExist: true,
  });

  return cachedDb;
}
