import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

function toTursoUploadUrl(databaseUrl) {
  const trimmedUrl = databaseUrl.replace(/\/$/, '');

  if (trimmedUrl.startsWith('libsql://')) {
    return `https://${trimmedUrl.slice('libsql://'.length)}/v1/upload`;
  }

  if (trimmedUrl.startsWith('https://')) {
    return `${trimmedUrl}/v1/upload`;
  }

  throw new Error('TURSO database URL must use libsql:// or https://');
}

export async function publishSqliteToTurso({
  databaseUrl,
  authToken,
  dbPath,
  fetchImpl = fetch,
}) {
  const sqliteBytes = await readFile(dbPath);
  const uploadUrl = toTursoUploadUrl(databaseUrl);
  const response = await fetchImpl(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Length': String(sqliteBytes.length),
    },
    body: sqliteBytes,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
}

export async function publishCourseDb({
  env = process.env,
  publishImpl = publishSqliteToTurso,
} = {}) {
  const databaseUrl = env.TURSO_COURSE_DATABASE_URL;
  const authToken = env.TURSO_COURSE_AUTH_TOKEN;

  if (!databaseUrl) {
    throw new Error('Missing TURSO_COURSE_DATABASE_URL');
  }

  if (!authToken) {
    throw new Error('Missing TURSO_COURSE_AUTH_TOKEN');
  }

  await publishImpl({
    databaseUrl,
    authToken,
    dbPath: path.join(repoRoot, 'data', 'fall-2026.sqlite'),
  });
}

async function main() {
  await publishCourseDb();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
